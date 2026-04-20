import * as THREE from 'three'

import {
  AUDIO_SPEED_REFERENCE,
  AudioContextClass,
  ENGINE_CRUISE_SHIFT_MAX_DELAY,
  ENGINE_CRUISE_SHIFT_MIN_DELAY,
  ENGINE_GEAR_DOWNSHIFT_SPEEDS,
  ENGINE_GEAR_RATIOS,
  ENGINE_GEAR_UPSHIFT_SPEEDS,
  ENGINE_SHIFT_COOLDOWN,
} from '../constants.js'
import { damp, getSpeedRatio, randomBetween } from '../lib/utils.js'

export function createAudioSystem({
  audioState,
  carState,
  getDriveInputState,
}) {
  function setAudioParam(audioParam, value, timeConstant = 0.05) {
    if (!audioState.context) return

    const now = audioState.context.currentTime
    audioParam.cancelScheduledValues(now)
    audioParam.setTargetAtTime(value, now, timeConstant)
  }

  function getVirtualGearBandMin(gearIndex) {
    return gearIndex === 0 ? 0 : ENGINE_GEAR_DOWNSHIFT_SPEEDS[gearIndex - 1]
  }

  function getVirtualGearBandMax(gearIndex) {
    return gearIndex === ENGINE_GEAR_RATIOS.length - 1
      ? 1
      : ENGINE_GEAR_UPSHIFT_SPEEDS[gearIndex]
  }

  function getVirtualGearTarget(
    normalizedSpeed,
    throttleLoad,
    uphillLoad,
    downhillAssist,
    reversing,
  ) {
    if (reversing) return 1
    if (normalizedSpeed < 0.035 && throttleLoad < 0.25) return 1

    const gearIndex = THREE.MathUtils.clamp(
      audioState.gear - 1,
      0,
      ENGINE_GEAR_RATIOS.length - 1,
    )
    let nextGearIndex = gearIndex

    if (gearIndex < ENGINE_GEAR_RATIOS.length - 1) {
      const upshiftThreshold = THREE.MathUtils.clamp(
        ENGINE_GEAR_UPSHIFT_SPEEDS[gearIndex] +
          throttleLoad * 0.05 +
          uphillLoad * 1.6 -
          downhillAssist * 0.85,
        0.12,
        0.96,
      )

      if (normalizedSpeed > upshiftThreshold) {
        nextGearIndex += 1
      }
    }

    if (gearIndex > 0) {
      const downshiftThreshold = THREE.MathUtils.clamp(
        ENGINE_GEAR_DOWNSHIFT_SPEEDS[gearIndex - 1] +
          throttleLoad * 0.04 +
          uphillLoad * 1.45 -
          downhillAssist * 0.7,
        0.05,
        0.88,
      )

      if (normalizedSpeed < downshiftThreshold) {
        nextGearIndex -= 1
      }
    }

    return nextGearIndex + 1
  }

  function resetCruiseShiftClock() {
    audioState.cruiseShiftTimer = 0
    audioState.nextCruiseShiftDelay = randomBetween(
      ENGINE_CRUISE_SHIFT_MIN_DELAY,
      ENGINE_CRUISE_SHIFT_MAX_DELAY,
    )
  }

  function triggerGearShiftSound(direction, intensity) {
    if (!audioState.context || audioState.context.state !== 'running') return

    const now = audioState.context.currentTime
    const clampedIntensity = THREE.MathUtils.clamp(intensity, 0, 1)
    const shiftGain = audioState.context.createGain()
    shiftGain.gain.setValueAtTime(0.0001, now)
    shiftGain.gain.exponentialRampToValueAtTime(
      0.02 + clampedIntensity * 0.08,
      now + 0.014,
    )
    shiftGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
    shiftGain.connect(audioState.masterGain)

    const chirpOscillator = audioState.context.createOscillator()
    chirpOscillator.type = direction > 0 ? 'triangle' : 'sawtooth'
    const chirpStartFrequency =
      direction > 0
        ? THREE.MathUtils.lerp(420, 620, clampedIntensity)
        : THREE.MathUtils.lerp(180, 280, clampedIntensity)
    const chirpEndFrequency =
      direction > 0
        ? THREE.MathUtils.lerp(140, 220, clampedIntensity)
        : THREE.MathUtils.lerp(320, 460, clampedIntensity)
    chirpOscillator.frequency.setValueAtTime(chirpStartFrequency, now)
    chirpOscillator.frequency.exponentialRampToValueAtTime(
      chirpEndFrequency,
      now + 0.16,
    )

    const chirpFilter = audioState.context.createBiquadFilter()
    chirpFilter.type = 'bandpass'
    chirpFilter.frequency.setValueAtTime(direction > 0 ? 1100 : 820, now)
    chirpFilter.Q.value = 1.8 + clampedIntensity * 1.6

    chirpOscillator.connect(chirpFilter)
    chirpFilter.connect(shiftGain)

    chirpOscillator.start(now)
    chirpOscillator.stop(now + 0.18)
  }

  function initializeDrivingAudio() {
    if (!audioState.supported || audioState.context) return

    const audioContext = new AudioContextClass()
    const masterGain = audioContext.createGain()
    masterGain.gain.value = 0.34
    masterGain.connect(audioContext.destination)

    const enginePrimaryOscillator = audioContext.createOscillator()
    enginePrimaryOscillator.type = 'sawtooth'
    enginePrimaryOscillator.frequency.value = 34

    const engineSecondaryOscillator = audioContext.createOscillator()
    engineSecondaryOscillator.type = 'triangle'
    engineSecondaryOscillator.frequency.value = 68

    const enginePrimaryDrive = audioContext.createGain()
    enginePrimaryDrive.gain.value = 0.78
    const engineSecondaryDrive = audioContext.createGain()
    engineSecondaryDrive.gain.value = 0.34
    const engineFilter = audioContext.createBiquadFilter()
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 420
    engineFilter.Q.value = 1.4
    const engineGain = audioContext.createGain()
    engineGain.gain.value = 0

    const engineLfo = audioContext.createOscillator()
    engineLfo.type = 'sine'
    engineLfo.frequency.value = 11
    const engineLfoPrimaryGain = audioContext.createGain()
    engineLfoPrimaryGain.gain.value = 5
    const engineLfoSecondaryGain = audioContext.createGain()
    engineLfoSecondaryGain.gain.value = 8

    enginePrimaryOscillator.connect(enginePrimaryDrive)
    engineSecondaryOscillator.connect(engineSecondaryDrive)
    enginePrimaryDrive.connect(engineFilter)
    engineSecondaryDrive.connect(engineFilter)
    engineFilter.connect(engineGain)
    engineGain.connect(masterGain)
    engineLfo.connect(engineLfoPrimaryGain)
    engineLfo.connect(engineLfoSecondaryGain)
    engineLfoPrimaryGain.connect(enginePrimaryOscillator.detune)
    engineLfoSecondaryGain.connect(engineSecondaryOscillator.detune)

    enginePrimaryOscillator.start()
    engineSecondaryOscillator.start()
    engineLfo.start()

    audioState.context = audioContext
    audioState.masterGain = masterGain
    audioState.engine = {
      primaryOscillator: enginePrimaryOscillator,
      secondaryOscillator: engineSecondaryOscillator,
      primaryDrive: enginePrimaryDrive,
      secondaryDrive: engineSecondaryDrive,
      filter: engineFilter,
      gain: engineGain,
      lfo: engineLfo,
    }
  }

  function resumeDrivingAudio() {
    if (!audioState.supported) return

    initializeDrivingAudio()

    if (audioState.context?.state === 'suspended') {
      audioState.context.resume().catch(() => {})
    }
  }

  function pauseDrivingAudio() {
    if (!audioState.context || audioState.context.state !== 'running') return

    audioState.context.suspend().catch(() => {})
  }

  function playCountdownTick(_countdownValue) {
    if (!audioState.supported) return

    initializeDrivingAudio()
    if (!audioState.context || audioState.context.state !== 'running') return

    const now = audioState.context.currentTime
    const toneDuration = 0.18
    const fundamentalFrequency = 246
    const overtoneFrequency = fundamentalFrequency * 1.5

    const toneGain = audioState.context.createGain()
    toneGain.gain.setValueAtTime(0.0001, now)
    toneGain.gain.exponentialRampToValueAtTime(
      0.065,
      now + 0.015,
    )
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + toneDuration)

    const toneFilter = audioState.context.createBiquadFilter()
    toneFilter.type = 'lowpass'
    toneFilter.frequency.setValueAtTime(860, now)
    toneFilter.Q.value = 0.6

    const hornBody = audioState.context.createOscillator()
    hornBody.type = 'sawtooth'
    hornBody.frequency.setValueAtTime(fundamentalFrequency, now)
    hornBody.frequency.linearRampToValueAtTime(
      fundamentalFrequency * 0.97,
      now + toneDuration,
    )

    const hornEdge = audioState.context.createOscillator()
    hornEdge.type = 'square'
    hornEdge.frequency.setValueAtTime(overtoneFrequency, now)
    hornEdge.frequency.linearRampToValueAtTime(
      overtoneFrequency * 0.985,
      now + toneDuration,
    )

    const hornEdgeGain = audioState.context.createGain()
    hornEdgeGain.gain.setValueAtTime(0.18, now)

    hornBody.connect(toneFilter)
    hornEdge.connect(hornEdgeGain)
    hornEdgeGain.connect(toneFilter)
    toneFilter.connect(toneGain)
    toneGain.connect(audioState.masterGain)

    hornBody.start(now)
    hornEdge.start(now)
    hornBody.stop(now + toneDuration + 0.02)
    hornEdge.stop(now + toneDuration + 0.02)
  }

  function resetDrivingAudioState() {
    audioState.smoothedSpeed = 0
    audioState.smoothedThrottle = 0
    audioState.smoothedBrake = 0
    audioState.smoothedCornerLoad = 0
    audioState.lastSpeed = 0
    audioState.gear = 1
    audioState.shiftTransient = 0
    audioState.shiftDirection = 0
    audioState.lastShiftTime = -Infinity
    audioState.cruiseShiftTimer = 0
    audioState.nextCruiseShiftDelay = randomBetween(
      ENGINE_CRUISE_SHIFT_MIN_DELAY,
      ENGINE_CRUISE_SHIFT_MAX_DELAY,
    )
  }

  function updateDrivingAudio(delta, trackFrame) {
    if (!audioState.context || audioState.context.state !== 'running') return

    const driveInput = getDriveInputState()
    const accelerating = driveInput.accelerate > 0.001
    const reversing = driveInput.reverse > 0.001
    const braking = driveInput.brake > 0.001
    const speed = Math.abs(carState.speed)
    const forwardDirection = new THREE.Vector3(
      Math.sin(carState.rotation),
      0,
      Math.cos(carState.rotation),
    )
    const signedTravelDirection =
      speed > 0.02
        ? Math.sign(carState.speed)
        : accelerating
          ? 1
          : reversing
            ? -1
            : 0
    const slopeAlignment =
      signedTravelDirection === 0
        ? 0
        : signedTravelDirection * forwardDirection.dot(trackFrame.flatTangent)
    const gradeLoad = trackFrame.tangent.y * slopeAlignment
    const uphillLoad = Math.max(gradeLoad, 0)
    const downhillAssist = Math.max(-gradeLoad, 0)
    const normalizedSpeed = getSpeedRatio(speed, AUDIO_SPEED_REFERENCE)
    const throttleTarget =
      driveInput.accelerate > 0.001
        ? driveInput.accelerate
        : driveInput.reverse > 0.001
          ? driveInput.reverse * 0.72
          : 0.14
    const brakeTarget = driveInput.brake
    const cornerLoadTarget = THREE.MathUtils.clamp(
      Math.abs(carState.steer) * normalizedSpeed * 1.18 +
        trackFrame.turnStrength * normalizedSpeed * 0.7,
      0,
      1,
    )

    audioState.smoothedSpeed = damp(audioState.smoothedSpeed, normalizedSpeed, 7, delta)
    audioState.smoothedThrottle = damp(audioState.smoothedThrottle, throttleTarget, 10, delta)
    audioState.smoothedBrake = damp(audioState.smoothedBrake, brakeTarget, 12, delta)
    audioState.smoothedCornerLoad = damp(
      audioState.smoothedCornerLoad,
      cornerLoadTarget,
      9,
      delta,
    )

    const speedDelta = Math.max(speed - audioState.lastSpeed, 0)
    audioState.lastSpeed = speed
    const accelerationPunch = THREE.MathUtils.clamp(
      speedDelta / Math.max(delta * 10, 0.001),
      0,
      1,
    )

    const previousGear = audioState.gear
    const nextGear = getVirtualGearTarget(
      normalizedSpeed,
      audioState.smoothedThrottle,
      uphillLoad,
      downhillAssist,
      reversing,
    )
    audioState.gear = nextGear

    const now = audioState.context.currentTime
    if (
      nextGear !== previousGear &&
      now - audioState.lastShiftTime >= ENGINE_SHIFT_COOLDOWN &&
      normalizedSpeed > 0.05 &&
      !braking
    ) {
      const shiftDirection = Math.sign(nextGear - previousGear)
      const shiftIntensity = THREE.MathUtils.clamp(
        0.28 +
          audioState.smoothedThrottle * 0.36 +
          uphillLoad * 3.8 +
          accelerationPunch * 0.24,
        0,
        1,
      )
      audioState.shiftDirection = shiftDirection
      audioState.shiftTransient = shiftDirection > 0 ? -0.18 : 0.14
      audioState.lastShiftTime = now
      resetCruiseShiftClock()
      triggerGearShiftSound(shiftDirection, shiftIntensity)
    }

    audioState.shiftTransient = damp(
      audioState.shiftTransient,
      0,
      audioState.shiftDirection > 0 ? 13 : 9,
      delta,
    )

    const gearIndex = audioState.gear - 1
    const gearBandMin = getVirtualGearBandMin(gearIndex)
    const gearBandMax = getVirtualGearBandMax(gearIndex)
    const gearProgress = THREE.MathUtils.clamp(
      THREE.MathUtils.inverseLerp(gearBandMin, gearBandMax, normalizedSpeed),
      0,
      1,
    )
    const gearColor =
      gearIndex / Math.max(ENGINE_GEAR_RATIOS.length - 1, 1)
    const gearCharacter = 1 - gearColor
    const cruiseShiftEligible =
      normalizedSpeed > 0.72 &&
      accelerationPunch < 0.035 &&
      audioState.smoothedCornerLoad < 0.14 &&
      !reversing &&
      !braking

    if (cruiseShiftEligible) {
      audioState.cruiseShiftTimer += delta

      if (
        audioState.cruiseShiftTimer >= audioState.nextCruiseShiftDelay &&
        now - audioState.lastShiftTime >= ENGINE_SHIFT_COOLDOWN * 2
      ) {
        const cruiseShiftDirection = gearProgress > 0.58 ? 1 : -1
        const cruiseShiftIntensity = THREE.MathUtils.clamp(
          0.1 +
            audioState.smoothedThrottle * 0.12 +
            uphillLoad * 0.16 +
            downhillAssist * 0.08,
          0,
          0.34,
        )
        audioState.shiftDirection = cruiseShiftDirection
        audioState.shiftTransient = cruiseShiftDirection > 0 ? -0.08 : 0.065
        audioState.lastShiftTime = now
        resetCruiseShiftClock()
        triggerGearShiftSound(cruiseShiftDirection, cruiseShiftIntensity)
      }
    } else if (normalizedSpeed < 0.58 || braking || reversing) {
      resetCruiseShiftClock()
    } else {
      audioState.cruiseShiftTimer = Math.max(audioState.cruiseShiftTimer - delta * 0.5, 0)
    }

    const syntheticRpm = THREE.MathUtils.clamp(
      0.17 +
        gearCharacter * 0.18 +
        gearProgress * 0.46 +
        audioState.smoothedThrottle * 0.12 +
        accelerationPunch * 0.08 +
        uphillLoad * 0.4 -
        downhillAssist * 0.12 +
        audioState.smoothedCornerLoad * 0.03 +
        audioState.shiftTransient,
      0,
      1,
    )
    const engineBaseFrequency = THREE.MathUtils.lerp(30, 114, syntheticRpm)
    const engineBrightness = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(360, 1840, syntheticRpm) +
        uphillLoad * 220 -
        downhillAssist * 90,
      320,
      2100,
    )
    const engineVolume =
      0.018 +
      audioState.smoothedSpeed * 0.075 +
      audioState.smoothedThrottle * 0.036 +
      audioState.smoothedCornerLoad * 0.01 +
      gearCharacter * 0.012 +
      Math.abs(audioState.shiftTransient) * 0.02
    const enginePrimaryDrive = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(0.62, 0.92, gearCharacter) + uphillLoad * 0.09,
      0.55,
      1.04,
    )
    const engineSecondaryDrive = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(0.44, 0.28, gearCharacter) + downhillAssist * 0.04,
      0.22,
      0.52,
    )
    const engineSecondaryMultiplier = THREE.MathUtils.lerp(
      1.92,
      2.14,
      gearCharacter,
    )
    const engineLfoRate = THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(8.4, 12.6, gearCharacter) + accelerationPunch * 1.4,
      7.8,
      13.8,
    )
    setAudioParam(audioState.engine.primaryOscillator.frequency, engineBaseFrequency)
    setAudioParam(
      audioState.engine.secondaryOscillator.frequency,
      engineBaseFrequency * engineSecondaryMultiplier,
    )
    setAudioParam(audioState.engine.primaryDrive.gain, enginePrimaryDrive)
    setAudioParam(audioState.engine.secondaryDrive.gain, engineSecondaryDrive)
    setAudioParam(audioState.engine.filter.frequency, engineBrightness)
    setAudioParam(audioState.engine.gain.gain, engineVolume)
    setAudioParam(audioState.engine.lfo.frequency, engineLfoRate)
  }

  return {
    pauseDrivingAudio,
    playCountdownTick,
    resetDrivingAudioState,
    resumeDrivingAudio,
    updateDrivingAudio,
  }
}
