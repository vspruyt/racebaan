import * as THREE from 'three'

import {
  AudioContextClass,
  BOOST_PARTICLE_COUNT,
  BOOST_PARTICLE_MIN_LIFETIME,
  FOLLOW_CAMERA_DISTANCE_DEFAULT,
  PHYSICS_BODY_RIDE_HEIGHT,
  PHYSICS_SUSPENSION_REST,
  WORLD_UP,
} from './constants.js'

export const WHEEL_VISUAL_LAYOUT = [
  { x: 0.86, z: 1.08, steer: true },
  { x: -0.86, z: 1.08, steer: true },
  { x: 0.86, z: -1.08, steer: false },
  { x: -0.86, z: -1.08, steer: false },
]

export function createGameState({
  trackData,
  trackMinimapBounds,
  initialBestLapTime = null,
}) {
  const clock = new THREE.Clock()
  const trackStartIndex = 18
  const carStartSample = trackData.samples[trackStartIndex]
  const carStartPosition = carStartSample.point.clone()
  carStartPosition.y += PHYSICS_BODY_RIDE_HEIGHT
  const carStartBodyPosition = carStartPosition.clone()
  const carStartRotation = Math.atan2(
    carStartSample.flatTangent.x,
    carStartSample.flatTangent.z,
  )

  const keyState = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false,
    KeyB: false,
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
  }

  const carState = {
    position: carStartPosition.clone(),
    rotation: carStartRotation,
    speed: 0,
    steer: 0,
    steerTarget: 0,
    trackSampleIndex: trackStartIndex,
  }

  const cameraState = {
    mode: 'follow',
    driveMode: 'follow',
    dragging: false,
    pointerX: 0,
    pointerY: 0,
    orbitYaw: 0,
    orbitPitch: 1,
    orbitRadius: FOLLOW_CAMERA_DISTANCE_DEFAULT,
    followDistance: FOLLOW_CAMERA_DISTANCE_DEFAULT,
    speedVisual: 0,
  }

  const prefersTouchControls =
    typeof window !== 'undefined' &&
    !window.matchMedia?.('(any-pointer: fine)')?.matches &&
    (window.matchMedia?.('(any-pointer: coarse)')?.matches ||
      navigator.maxTouchPoints > 0)

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

  const renderState = {
    position: carStartPosition.clone(),
    rotation: carStartRotation,
    quaternion: new THREE.Quaternion(),
    targetQuaternion: new THREE.Quaternion(),
    lookTarget: new THREE.Vector3(),
    pitch: 0,
    roll: 0,
    wheelSteer: 0,
    trackSampleIndex: trackStartIndex,
  }

  const wheelVisualState = Array.from({ length: 4 }, () => ({
    suspensionLength: PHYSICS_SUSPENSION_REST,
    rotation: 0,
  }))

  const raceState = {
    lapArmed: false,
    finishTimer: 0,
    laps: [],
    nextLapNumber: 1,
    bestLapTime: initialBestLapTime,
    mode: 'racing',
    superboostActive: false,
    lastSuperboostEntryTime: -Infinity,
  }

  const physicsState = {
    ready: false,
    world: null,
    chassisBody: null,
    chassisCollider: null,
    vehicleController: null,
    drivableColliderHandles: new Set(),
    frozen: false,
    upsideDownTime: 0,
    offTrackTime: 0,
    engineForce: 0,
    accumulator: 0,
    brakeHoldActive: false,
    brakeHoldPosition: carStartBodyPosition.clone(),
    brakeHoldQuaternion: new THREE.Quaternion().setFromAxisAngle(
      WORLD_UP,
      carStartRotation,
    ),
    previousPosition: carStartPosition.clone(),
    currentPosition: carStartPosition.clone(),
    previousQuaternion: new THREE.Quaternion().setFromAxisAngle(
      WORLD_UP,
      carStartRotation,
    ),
    currentQuaternion: new THREE.Quaternion().setFromAxisAngle(
      WORLD_UP,
      carStartRotation,
    ),
  }

  const tempInterpolatedPosition = new THREE.Vector3()
  const tempInterpolatedQuaternion = new THREE.Quaternion()
  const tempForwardDirection = new THREE.Vector3()
  const tempBoostForward = new THREE.Vector3()
  const tempBoostRight = new THREE.Vector3()
  const tempBoostUp = new THREE.Vector3()
  const tempBoostWheelPosition = new THREE.Vector3()
  const tempBoostDirection = new THREE.Vector3()
  const tempBoostQuaternion = new THREE.Quaternion()
  const tempBoostScale = new THREE.Vector3()
  const tempBoostMatrix = new THREE.Matrix4()
  const tempBoostColor = new THREE.Color()
  const boostFlameCooledColor = new THREE.Color(0.82, 0.16, 0.02)
  const boostFlameLocalAxis = new THREE.Vector3(0, 0, 1)
  const boostHiddenPosition = new THREE.Vector3(10_000, 10_000, 10_000)

  const minimapState = {
    width: 0,
    height: 0,
    dpr: 1,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    roadWidth: 0,
    trackPoints: [],
  }

  const audioState = {
    supported: Boolean(AudioContextClass),
    context: null,
    masterGain: null,
    engine: null,
    road: null,
    wind: null,
    skid: null,
    brake: null,
    smoothedSpeed: 0,
    smoothedThrottle: 0,
    smoothedBrake: 0,
    smoothedCornerLoad: 0,
    lastSpeed: 0,
    gear: 1,
    shiftTransient: 0,
    shiftDirection: 0,
    lastShiftTime: -Infinity,
    cruiseShiftTimer: 0,
    nextCruiseShiftDelay: 3.6,
    noiseBuffer: null,
    lastGuardrailImpactTime: -Infinity,
    guardrailContactActive: false,
  }

  const boostState = {
    active: false,
    visualIntensity: 0,
    emitAccumulator: 0,
    nextParticleIndex: 0,
    positions: null,
    colors: null,
    lifetimes: new Float32Array(BOOST_PARTICLE_COUNT).fill(
      BOOST_PARTICLE_MIN_LIFETIME,
    ),
    maxLifetimes: new Float32Array(BOOST_PARTICLE_COUNT),
    velocities: Array.from({ length: BOOST_PARTICLE_COUNT }, () => new THREE.Vector3()),
    baseColors: Array.from({ length: BOOST_PARTICLE_COUNT }, () => new THREE.Color()),
  }

  return {
    clock,
    trackStartIndex,
    carStartSample,
    carStartPosition,
    carStartBodyPosition,
    carStartRotation,
    trackMinimapBounds,
    keyState,
    carState,
    cameraState,
    prefersTouchControls,
    touchDriveState,
    touchActionState,
    renderState,
    wheelVisualState,
    raceState,
    physicsState,
    tempInterpolatedPosition,
    tempInterpolatedQuaternion,
    tempForwardDirection,
    tempBoostForward,
    tempBoostRight,
    tempBoostUp,
    tempBoostWheelPosition,
    tempBoostDirection,
    tempBoostQuaternion,
    tempBoostScale,
    tempBoostMatrix,
    tempBoostColor,
    boostFlameCooledColor,
    boostFlameLocalAxis,
    boostHiddenPosition,
    minimapState,
    audioState,
    boostState,
  }
}
