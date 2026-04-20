import * as THREE from 'three'

import {
  TOUCH_DRIVE_DEADZONE,
  TOUCH_DRIVE_HOLD_THROTTLE,
  TOUCH_DRIVE_RADIUS,
  TOUCH_DRIVE_REVERSE_SPEED_THRESHOLD,
  TOUCH_DRIVE_BRAKE_INTENT_THRESHOLD,
} from '../constants.js'

export function createInputSystem({
  keyState,
  touchDriveState,
  touchActionState,
  prefersTouchControls,
  raceState,
  carState,
  minimapHint,
  touchControls,
  touchBoostButton,
  touchSuperBoostButton,
  resumeDrivingAudio,
  respawnAtTrackStart,
  toggleDrivingCameraMode,
  getRenderer,
}) {
  function clearDriveKeys() {
    Object.keys(keyState).forEach((code) => {
      keyState[code] = false
    })
  }

  function isDriveInputBufferedState() {
    return raceState.mode === 'racing' || raceState.mode === 'waiting'
  }

  function resetTouchDriveState() {
    touchDriveState.active = false
    touchDriveState.pointerId = null
    touchDriveState.startX = 0
    touchDriveState.startY = 0
    touchDriveState.pointerX = 0
    touchDriveState.pointerY = 0
    touchDriveState.steer = 0
    touchDriveState.throttle = 0
    touchDriveState.brake = 0
    touchDriveState.reverse = 0
  }

  function resetTouchActionState() {
    touchActionState.boostMode = 'none'
  }

  function isTouchDrivePointer(event) {
    return event.pointerType === 'touch' || event.pointerType === 'pen'
  }

  function normalizeTouchDriveAxis(delta) {
    const magnitude = Math.abs(delta)
    if (magnitude <= TOUCH_DRIVE_DEADZONE) return 0

    return (
      (Math.sign(delta) * (magnitude - TOUCH_DRIVE_DEADZONE)) /
      Math.max(TOUCH_DRIVE_RADIUS - TOUCH_DRIVE_DEADZONE, 1)
    )
  }

  function updateTouchDriveFromPointer(event) {
    const deltaX = event.clientX - touchDriveState.startX
    const deltaY = event.clientY - touchDriveState.startY
    const horizontal = THREE.MathUtils.clamp(normalizeTouchDriveAxis(deltaX), -1, 1)
    const vertical = THREE.MathUtils.clamp(normalizeTouchDriveAxis(deltaY), -1, 1)
    const reverseReady =
      Math.abs(carState.speed) <= TOUCH_DRIVE_REVERSE_SPEED_THRESHOLD ||
      carState.speed < -0.12
    const upwardInput = Math.max(0, -vertical)
    const downwardInput = Math.max(0, vertical)
    const deliberateBrakeInput = THREE.MathUtils.clamp(
      (downwardInput - TOUCH_DRIVE_BRAKE_INTENT_THRESHOLD) /
        Math.max(1 - TOUCH_DRIVE_BRAKE_INTENT_THRESHOLD, 0.001),
      0,
      1,
    )
    const holdThrottle =
      deliberateBrakeInput > 0.001 ? 0 : TOUCH_DRIVE_HOLD_THROTTLE

    touchDriveState.pointerX = event.clientX
    touchDriveState.pointerY = event.clientY
    touchDriveState.steer = -horizontal
    if (touchActionState.boostMode !== 'none') {
      touchDriveState.throttle = 0
      touchDriveState.brake = 0
      touchDriveState.reverse = 0
      return
    }
    touchDriveState.throttle = THREE.MathUtils.clamp(
      holdThrottle + upwardInput * (1 - TOUCH_DRIVE_HOLD_THROTTLE),
      0,
      1,
    )
    touchDriveState.brake = reverseReady ? 0 : deliberateBrakeInput
    touchDriveState.reverse = reverseReady ? deliberateBrakeInput : 0
  }

  function syncTouchDriveForCurrentMode() {
    if (!touchDriveState.active) return

    updateTouchDriveFromPointer({
      clientX: touchDriveState.pointerX,
      clientY: touchDriveState.pointerY,
    })
  }

  function getDriveInputState() {
    const digitalSteer =
      (keyState.ArrowLeft || keyState.KeyA ? 1 : 0) -
      (keyState.ArrowRight || keyState.KeyD ? 1 : 0)
    const touchButtonThrottle =
      prefersTouchControls && touchActionState.boostMode !== 'none'
        ? TOUCH_DRIVE_HOLD_THROTTLE
        : 0

    return {
      accelerate: Math.max(
        keyState.ArrowUp || keyState.KeyW || keyState.KeyB ? 1 : 0,
        touchDriveState.throttle,
        touchButtonThrottle,
      ),
      reverse: Math.max(
        keyState.ArrowDown || keyState.KeyS ? 1 : 0,
        touchDriveState.reverse,
      ),
      brake: Math.max(keyState.Space ? 1 : 0, touchDriveState.brake),
      steer:
        Math.abs(touchDriveState.steer) > Math.abs(digitalSteer)
          ? touchDriveState.steer
          : digitalSteer,
    }
  }

  function hasDriveInput() {
    const driveInput = getDriveInputState()
    return (
      driveInput.accelerate > 0.001 ||
      driveInput.reverse > 0.001 ||
      driveInput.brake > 0.001 ||
      Math.abs(driveInput.steer) > 0.001
    )
  }

  function createHintChip(label) {
    const chip = document.createElement('span')
    chip.textContent = label
    return chip
  }

  function updateControlHints() {
    if (!minimapHint) return

    minimapHint.classList.toggle('hidden', prefersTouchControls)
    minimapHint.replaceChildren(
      ...(prefersTouchControls
        ? []
        : [
            createHintChip('F camera'),
            createHintChip('R Reset'),
            createHintChip('B boost'),
          ]),
    )
  }

  function getRespawnPrompt() {
    return prefersTouchControls
      ? 'Tap and drag to respawn'
      : 'Press R, Enter, or Space to respawn'
  }

  function setTouchBoostMode(mode) {
    if (!prefersTouchControls) return

    const nextMode = isDriveInputBufferedState() ? mode : 'none'
    touchActionState.boostMode = nextMode
    touchBoostButton?.classList.toggle('is-active', nextMode === 'boost')
    touchSuperBoostButton?.classList.toggle('is-active', nextMode === 'superboost')

    if (nextMode !== 'none') {
      resumeDrivingAudio()
    }
    syncTouchDriveForCurrentMode()
  }

  function updateTouchControlsUI() {
    touchControls?.classList.toggle('is-touch-layout', prefersTouchControls)
    touchBoostButton?.classList.toggle('hidden', !prefersTouchControls)
    touchSuperBoostButton?.classList.toggle('hidden', !prefersTouchControls)
  }

  function onTouchDrivePointerDown(event) {
    const renderer = getRenderer()
    if (!renderer || !isTouchDrivePointer(event) || touchDriveState.active) return false

    if (raceState.mode === 'gameOver') {
      respawnAtTrackStart()
    }

    touchDriveState.active = true
    touchDriveState.pointerId = event.pointerId
    touchDriveState.startX = event.clientX
    touchDriveState.startY = event.clientY
    updateTouchDriveFromPointer(event)
    renderer.domElement.focus()
    renderer.domElement.setPointerCapture?.(event.pointerId)
    resumeDrivingAudio()
    event.preventDefault()
    return true
  }

  function onTouchDrivePointerMove(event) {
    if (!touchDriveState.active || event.pointerId !== touchDriveState.pointerId) return false

    updateTouchDriveFromPointer(event)
    event.preventDefault()
    return true
  }

  function onTouchDrivePointerUp(event) {
    const renderer = getRenderer()
    if (!touchDriveState.active || event.pointerId !== touchDriveState.pointerId) return false

    if (renderer?.domElement.hasPointerCapture?.(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId)
    }
    resetTouchDriveState()
    event.preventDefault()
    return true
  }

  function setDriveKey(event, isPressed) {
    if (
      raceState.mode === 'gameOver' &&
      isPressed &&
      (event.code === 'Enter' || event.code === 'Space' || event.code === 'KeyR')
    ) {
      respawnAtTrackStart()
      event.preventDefault()
      return
    }

    if (event.code === 'KeyR') {
      if (isPressed && !event.repeat) {
        respawnAtTrackStart()
      }
      event.preventDefault()
      return
    }

    if (event.code === 'KeyF') {
      if (isPressed && !event.repeat) {
        toggleDrivingCameraMode()
      }
      event.preventDefault()
      return
    }

    if (!(event.code in keyState)) return

    if (!isDriveInputBufferedState()) {
      keyState[event.code] = false
      event.preventDefault()
      return
    }

    keyState[event.code] = isPressed
    if (isPressed) {
      resumeDrivingAudio()
    }
    event.preventDefault()
  }

  return {
    clearDriveKeys,
    getDriveInputState,
    getRespawnPrompt,
    hasDriveInput,
    isTouchDrivePointer,
    onTouchDrivePointerDown,
    onTouchDrivePointerMove,
    onTouchDrivePointerUp,
    resetTouchActionState,
    resetTouchDriveState,
    setDriveKey,
    setTouchBoostMode,
    syncTouchDriveForCurrentMode,
    updateControlHints,
    updateTouchControlsUI,
  }
}
