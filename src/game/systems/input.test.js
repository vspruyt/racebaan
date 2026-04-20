import { describe, expect, it, vi } from 'vitest'

import { createInputSystem } from './input.js'

function createInputSystemForTest({ raceMode = 'waiting', prefersTouchControls = false } = {}) {
  const keyState = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    KeyB: false,
    Space: false,
  }
  const touchDriveState = {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    pointerX: 0,
    pointerY: 0,
    steer: 0,
    throttle: 0,
    brake: 0,
    reverse: 0,
  }
  const touchActionState = {
    boostMode: 'none',
  }
  const raceState = {
    mode: raceMode,
  }
  const classList = {
    toggle: vi.fn(),
  }

  return {
    keyState,
    touchActionState,
    inputSystem: createInputSystem({
      keyState,
      touchDriveState,
      touchActionState,
      prefersTouchControls,
      raceState,
      carState: { speed: 0 },
      minimapHint: null,
      touchControls: null,
      touchBoostButton: { classList },
      touchSuperBoostButton: { classList },
      resumeDrivingAudio: vi.fn(),
      respawnAtTrackStart: vi.fn(),
      toggleDrivingCameraMode: vi.fn(),
      getRenderer: () => null,
    }),
  }
}

describe('createInputSystem', () => {
  it('buffers held keyboard input while the race is waiting to start', () => {
    const { inputSystem } = createInputSystemForTest({
      raceMode: 'waiting',
    })
    const preventDefault = vi.fn()

    inputSystem.setDriveKey(
      {
        code: 'ArrowUp',
        repeat: false,
        preventDefault,
      },
      true,
    )

    expect(inputSystem.getDriveInputState().accelerate).toBe(1)
    expect(preventDefault).toHaveBeenCalled()
  })

  it('allows touch boost input to be armed during the countdown', () => {
    const { inputSystem, touchActionState } = createInputSystemForTest({
      raceMode: 'waiting',
      prefersTouchControls: true,
    })

    inputSystem.setTouchBoostMode('boost')

    expect(touchActionState.boostMode).toBe('boost')
  })
})
