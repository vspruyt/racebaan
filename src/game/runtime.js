import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'

import * as C from './constants.js'
import { WHEEL_VISUAL_LAYOUT, createGameState } from './state.js'
import {
  damp,
  dampAngle,
  formatLapTime,
  getCurrentTimeSeconds,
  getFastMotionRatio,
  getSpeedRatio,
  getTrackDistanceForward,
  getTrackZoneProgress,
  isTrackDistanceInZone,
  moveTowards,
  randomBetween,
  wrapTrackDistance,
} from './lib/utils.js'
import { createAudioSystem } from './systems/audio.js'
import { createEffectsSystem } from './systems/effects.js'
import { createInputSystem } from './systems/input.js'
import { createLapSystem, loadStoredBestLapTime } from './systems/laps.js'
import { createRaceCar, addDayEnvironment } from './systems/scene.js'
import { createTrackData } from './systems/track-data.js'
import {
  createTrackSystem,
  getTrackBounds2D as getTrackBounds2DFromData,
} from './systems/track.js'

export function createGame({ app }) {
const {
  AudioContextClass,
  DAY_SKY_COLOR,
  DAY_FOG_COLOR,
  LAP_RECORD_STORAGE_KEY,
  LAP_RECORD_MATCH_EPSILON,
  TRACK_BASE_Y,
  TRACK_THICKNESS,
  GROUND_LEVEL,
  TRACK_HEIGHT_OFFSET,
  TRACK_HEIGHT_WAVE_1,
  TRACK_HEIGHT_WAVE_2,
  TRACK_HEIGHT_WAVE_3,
  TRACK_HALF_WIDTH,
  TRACK_EDGE_STRIPE_WIDTH,
  TRACK_EDGE_STRIPE_INSET,
  TRACK_EDGE_STRIPE_REPEAT,
  TRACK_CENTER_STRIPE_WIDTH,
  TRACK_CENTER_STRIPE_REPEAT,
  TRACK_SKID_LAYER_INSET,
  TRACK_PAINT_LAYER_OFFSET,
  TRACK_SKID_LAYER_OFFSET,
  TRACK_SKID_TEXTURE_REPEAT,
  TRACK_SAMPLE_COUNT,
  TRACK_SHADOW_OFFSET,
  TRACK_STRAIGHT_TURN_THRESHOLD,
  TRACK_JUMP_GAP_LENGTH,
  TRACK_JUMP_TAKEOFF_LENGTH,
  TRACK_JUMP_LANDING_LENGTH,
  TRACK_JUMP_TAKEOFF_LIFT,
  TRACK_JUMP_LANDING_LIFT,
  TRACK_JUMP_LIP_FLAT_LENGTH,
  TRACK_JUMP_LANDING_FLAT_LENGTH,
  TRACK_JUMP_GAME_OVER_GRACE,
  SLOPE_SPEED_FACTOR,
  TREE_CLEARANCE,
  TRACK_CENTERING_START_RATIO,
  TRACK_RECOVERY_START_RATIO,
  TRACK_CORRECTION_DEADZONE,
  GUARDRAIL_OFFSET,
  GUARDRAIL_THICKNESS,
  GUARDRAIL_HEIGHT,
  GUARDRAIL_COLLISION_THICKNESS,
  GUARDRAIL_COLLISION_HEIGHT,
  GUARDRAIL_BASE_LIFT,
  GUARDRAIL_COLLISION_HALF_WIDTH,
  FINISH_LINE_HALF_DEPTH,
  FINISH_LINE_SURFACE_OFFSET,
  FINISH_LINE_BANNER_HEIGHT,
  FINISH_LINE_POST_HEIGHT,
  FINISH_LINE_ZONE_SAMPLES,
  FINISH_LINE_ARM_DISTANCE,
  FINISH_NOTICE_DURATION,
  MAX_VISIBLE_LAP_TIMERS,
  CAR_SIZE_MULTIPLIER,
  CAR_SCALE,
  CAR_RIDE_HEIGHT,
  FRONT_WHEEL_MAX_STEER_ANGLE,
  FOLLOW_CAMERA_HEIGHT,
  FOLLOW_CAMERA_DISTANCE_DEFAULT,
  FOLLOW_CAMERA_LOOK_AHEAD,
  FOLLOW_CAMERA_FOV,
  FOLLOW_CAMERA_FOV_FAST,
  FOLLOW_CAMERA_LOOK_AHEAD_FAST,
  FOLLOW_CAMERA_SPEED_DISTANCE_OFFSET,
  FIRST_PERSON_CAMERA_FOV,
  FIRST_PERSON_CAMERA_FOV_FAST,
  FIRST_PERSON_CAMERA_HEIGHT,
  FIRST_PERSON_CAMERA_FORWARD_OFFSET,
  FIRST_PERSON_CAMERA_LOOK_AHEAD,
  FIRST_PERSON_CAMERA_LOOK_UP,
  FIRST_PERSON_CAMERA_PITCH_BIAS,
  MIN_CAMERA_DISTANCE,
  MAX_CAMERA_DISTANCE,
  ORBIT_CAMERA_TARGET_HEIGHT,
  ORBIT_MIN_PHI,
  ORBIT_MAX_PHI,
  PHYSICS_STEP,
  SPEED_TO_KMH,
  CAR_TOP_SPEED_KMH,
  CAR_BOOST_SPEED_KMH,
  CAR_SUPERBOOST_SPEED_KMH,
  CAR_TOP_SPEED,
  CAR_BOOST_SPEED,
  CAR_SUPERBOOST_SPEED,
  CAR_MIN_FORWARD_SPEED,
  CAR_REVERSE_SPEED,
  CAR_MIN_REVERSE_SPEED,
  AUDIO_SPEED_REFERENCE,
  BOOST_ENGINE_FORCE_MULTIPLIER,
  SUPERBOOST_NOTICE_DURATION,
  SUPERBOOST_BANNER_COOLDOWN,
  BOOST_PARTICLE_COUNT,
  BOOST_PARTICLE_SIZE,
  BOOST_PARTICLE_SPAWN_RATE,
  BOOST_PARTICLE_DRAG,
  BOOST_PARTICLE_GRAVITY,
  BOOST_PARTICLE_MIN_LIFETIME,
  BOOST_PARTICLE_MAX_LIFETIME,
  BOOST_PARTICLE_MIN_SPEED,
  BOOST_EXHAUST_LOCAL_X,
  BOOST_EXHAUST_LOCAL_Y,
  BOOST_EXHAUST_LOCAL_Z,
  SPEED_EFFECTS_START_RATIO,
  SPEED_EFFECTS_FULL_RATIO,
  ENGINE_GEAR_RATIOS,
  ENGINE_GEAR_UPSHIFT_SPEEDS,
  ENGINE_GEAR_DOWNSHIFT_SPEEDS,
  ENGINE_SHIFT_COOLDOWN,
  ENGINE_CRUISE_SHIFT_MIN_DELAY,
  ENGINE_CRUISE_SHIFT_MAX_DELAY,
  MINIMAP_PADDING,
  MINIMAP_LOOKAHEAD_SAMPLES_MIN,
  MINIMAP_LOOKAHEAD_SAMPLES_MAX,
  TRACK_FRAME_SEARCH_RADIUS,
  TOUCH_DRIVE_RADIUS,
  TOUCH_DRIVE_DEADZONE,
  TOUCH_DRIVE_HOLD_THROTTLE,
  TOUCH_DRIVE_BRAKE_INTENT_THRESHOLD,
  TOUCH_DRIVE_REVERSE_SPEED_THRESHOLD,
  CRASH_GAME_OVER_DELAY,
  CRASH_OUT_OF_TRACK_MARGIN,
  CRASH_BELOW_TRACK_MARGIN,
  WORLD_UP,
  PHYSICS_GRAVITY,
  PHYSICS_ENGINE_FORCE,
  PHYSICS_ENGINE_FORCE_MIN,
  PHYSICS_FRONT_DRIVE_SHARE_FORWARD,
  PHYSICS_FRONT_DRIVE_SHARE_REVERSE,
  PHYSICS_ADDITIONAL_CHASSIS_MASS,
  PHYSICS_BRAKE_FORCE,
  PHYSICS_DIRECTION_BRAKE_FORCE,
  PHYSICS_IDLE_BRAKE_FORCE,
  PHYSICS_BRAKE_ASSIST,
  PHYSICS_BRAKE_ASSIST_SPEED_FACTOR,
  PHYSICS_BRAKE_ASSIST_MIN_SPEED,
  PHYSICS_BRAKE_HOLD_SPEED_THRESHOLD,
  PHYSICS_BRAKE_HOLD_VERTICAL_SPEED_THRESHOLD,
  PHYSICS_BRAKE_HOLD_ANGULAR_SPEED_THRESHOLD,
  PHYSICS_BRAKE_HOLD_MIN_WHEEL_CONTACTS,
  PHYSICS_DIRECTION_CHANGE_RESPONSE,
  PHYSICS_DIRECTION_CHANGE_SPEED_THRESHOLD,
  PHYSICS_DIRECTION_CHANGE_ENGINE_BLEND_SPEED,
  PHYSICS_MAX_STEER_ANGLE,
  PHYSICS_UPRIGHT_TORQUE,
  PHYSICS_PITCH_STABILITY_TORQUE,
  PHYSICS_STEER_ASSIST_TORQUE,
  PHYSICS_TRACK_ESCAPE_IMPULSE,
  PHYSICS_GUARDRAIL_RELEASE_IMPULSE,
  PHYSICS_GUARDRAIL_RELEASE_YAW_TORQUE,
  PHYSICS_GUARDRAIL_RELEASE_FORWARD_IMPULSE,
  PHYSICS_GUARDRAIL_GLIDE_MIN_SPEED,
  PHYSICS_GUARDRAIL_GLIDE_MAX_SPEED,
  PHYSICS_GUARDRAIL_GLIDE_MAX_INTO_SPEED,
  PHYSICS_GUARDRAIL_GLIDE_INWARD_SPEED,
  PHYSICS_THROTTLE_RESPONSE,
  PHYSICS_THROTTLE_RELEASE,
  PHYSICS_STEER_BUILD_RATE,
  PHYSICS_STEER_RELEASE_RATE,
  PHYSICS_ANGULAR_DAMPING,
  PHYSICS_LINEAR_DAMPING,
  PHYSICS_TRACK_FRICTION,
  PHYSICS_GROUND_FRICTION,
  PHYSICS_CHASSIS_FRICTION,
  PHYSICS_GUARDRAIL_FRICTION,
  PHYSICS_GUARDRAIL_RESTITUTION,
  PHYSICS_COLLISION_SKIN,
  PHYSICS_GUARDRAIL_SEGMENT_OVERLAP,
  PHYSICS_GUARDRAIL_JOINT_HALF_SIZE,
  PHYSICS_CHASSIS_HALF_HEIGHT,
  PHYSICS_CHASSIS_HALF_LENGTH,
  PHYSICS_CHASSIS_OFFSET_Y,
  PHYSICS_WHEEL_RADIUS,
  PHYSICS_WHEEL_VISUAL_CENTER_Y,
  PHYSICS_WHEEL_HALF_TRACK,
  PHYSICS_WHEEL_HALF_WIDTH,
  PHYSICS_CHASSIS_HALF_WIDTH,
  PHYSICS_CHASSIS_FORWARD_OFFSET,
  PHYSICS_WHEEL_FRONT_Z,
  PHYSICS_WHEEL_REAR_Z,
  PHYSICS_SUSPENSION_REST,
  PHYSICS_WHEEL_CONNECTION_Y,
  PHYSICS_SUSPENSION_TRAVEL,
  PHYSICS_VISUAL_RIDE_BIAS,
  PHYSICS_BODY_RIDE_HEIGHT,
  PHYSICS_GUARDRAIL_WHEEL_CLEARANCE,
  PHYSICS_GUARDRAIL_COLLISION_OFFSET,
  PHYSICS_GUARDRAIL_COLLISION_MESH_THICKNESS,
} = C

const homeScreen = app.querySelector('[data-screen="home"]')
const gameScreen = app.querySelector('[data-screen="game"]')
const canvasMount = app.querySelector('.game-canvas')
const speedometerValue = app.querySelector('.speedometer-value')
const lapTimers = app.querySelector('.lap-timers')
const minimapCanvas = app.querySelector('.minimap-canvas')
const minimapContext = minimapCanvas.getContext('2d')
const minimapHint = app.querySelector('.minimap-hint')
const touchBoostButton = app.querySelector('.touch-boost')
const touchSuperBoostButton = app.querySelector('.touch-superboost')
const touchControls = app.querySelector('.touch-controls')
const finishCelebration = app.querySelector('.finish-celebration')
const finishParticleLayer = app.querySelector('.finish-particles')
const finishKicker = finishCelebration.querySelector('.finish-kicker')
const finishNotice = finishCelebration.querySelector('.finish-notice')
const finishSubtitle = finishCelebration.querySelector('.finish-subtitle')
const gameOverCelebration = app.querySelector('.finish-celebration--danger')
const gameOverSubtitle = app.querySelector('.game-over-subtitle')

let renderer
let scene
let camera
let raceCar
let carShadow
let carFillLight
let boostParticleSystem
let boostFlameTexture
let frontLeftWheelGroup
let frontRightWheelGroup
let rearLeftWheelGroup
let rearRightWheelGroup
let steeringWheelGroup
const TRACK_DATA = createTrackData()
const TRACK_JUMP = TRACK_DATA.jumpFeature
const TRACK_MINIMAP_BOUNDS = getTrackBounds2DFromData(TRACK_DATA)
const {
  clock,
  trackStartIndex: TRACK_START_INDEX,
  carStartSample: CAR_START_SAMPLE,
  carStartPosition: CAR_START_POSITION,
  carStartBodyPosition: CAR_START_BODY_POSITION,
  carStartRotation: CAR_START_ROTATION,
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
  boostFlameCooledColor: BOOST_FLAME_COOLED_COLOR,
  boostFlameLocalAxis: BOOST_FLAME_LOCAL_AXIS,
  boostHiddenPosition: BOOST_HIDDEN_POSITION,
  minimapState,
  audioState,
  boostState,
} = createGameState({
  trackData: TRACK_DATA,
  trackMinimapBounds: TRACK_MINIMAP_BOUNDS,
  initialBestLapTime: loadStoredBestLapTime(),
})

const lapSystem = createLapSystem({
  raceState,
  lapTimers,
})
const effectsSystem = createEffectsSystem({
  raceState,
  keyState,
  touchActionState,
  carState,
  renderState,
  boostState,
  finishCelebration,
  finishParticleLayer,
  finishKicker,
  finishNotice,
  finishSubtitle,
  tempBoostForward,
  tempBoostRight,
  tempBoostUp,
  tempBoostWheelPosition,
  tempBoostColor,
  boostFlameCooledColor: BOOST_FLAME_COOLED_COLOR,
})
const trackSystem = createTrackSystem({
  trackData: TRACK_DATA,
  trackJump: TRACK_JUMP,
  trackStartIndex: TRACK_START_INDEX,
  carStartSample: CAR_START_SAMPLE,
  raceState,
  carState,
  renderState,
  minimapCanvas,
  minimapContext,
  minimapState,
  onFinishLineCrossed: () =>
    effectsSystem.triggerFinishCelebration(lapSystem.completeCurrentLap),
})
let audioSystem
const inputSystem = createInputSystem({
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
  resumeDrivingAudio: () => audioSystem.resumeDrivingAudio(),
  respawnAtTrackStart: () => respawnAtTrackStart(),
  toggleDrivingCameraMode: () => toggleDrivingCameraMode(),
  getRenderer: () => renderer,
})
audioSystem = createAudioSystem({
  audioState,
  carState,
  getDriveInputState: inputSystem.getDriveInputState,
})

function createTracksidePoint(config, clearance) {
  const sample = TRACK_DATA.samples[config.sampleIndex % TRACK_DATA.samples.length]
  const preferredOutward = sample.side
    .clone()
    .multiplyScalar(Math.sign(config.side) || 1)
  const scaleClearance = Math.max((config.scale ?? 1) - 1, 0) * 2.4
  const requiredClearance = clearance + scaleClearance + (config.clearanceOffset ?? 0)
  const point = sample.point
    .clone()
    .addScaledVector(sample.side, config.side * (TRACK_HALF_WIDTH + config.offset))
    .addScaledVector(sample.flatTangent, config.tangentOffset ?? 0)

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const trackFrame = trackSystem.getTrackFrame(point)
    const outwardAlignment =
      Math.sign(trackFrame.normal.dot(preferredOutward)) || 1
    const signedClearance = trackFrame.lateralOffset * outwardAlignment
    const clearanceShortfall = requiredClearance - signedClearance

    if (clearanceShortfall <= 0.01) {
      break
    }

    point.addScaledVector(
      preferredOutward,
      clearanceShortfall + 0.45,
    )
  }

  return point
}

function threeVectorToRapier(vector) {
  return { x: vector.x, y: vector.y, z: vector.z }
}

function quaternionToRapier(quaternion) {
  return {
    x: quaternion.x,
    y: quaternion.y,
    z: quaternion.z,
    w: quaternion.w,
  }
}

function createSequentialIndices(count) {
  const indices = new Uint32Array(count)
  for (let index = 0; index < count; index += 1) {
    indices[index] = index
  }
  return indices
}

function createTrimeshColliderFromGeometry(
  geometry,
  {
    friction = PHYSICS_TRACK_FRICTION,
    restitution = 0,
    drivable = false,
    contactSkin = PHYSICS_COLLISION_SKIN,
    flags,
  } = {},
) {
  const positionAttribute = geometry.getAttribute('position')
  const vertices = new Float32Array(positionAttribute.array)
  const indices = geometry.index
    ? new Uint32Array(geometry.index.array)
    : createSequentialIndices(positionAttribute.count)
  const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices, flags)
    .setFriction(friction)
    .setRestitution(restitution)
    .setContactSkin(contactSkin)
  const collider = physicsState.world.createCollider(colliderDesc)
  if (drivable) {
    physicsState.drivableColliderHandles.add(collider.handle)
  }
  return collider
}

function createTrackSurfaceCollider(halfWidth) {
  const { vertices, indices } = trackSystem.createTrackSurfaceColliderData(halfWidth)
  const colliderDesc = RAPIER.ColliderDesc.trimesh(
    vertices,
    indices,
    RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
  )
    .setFriction(PHYSICS_TRACK_FRICTION)
    .setRestitution(0)
  const collider = physicsState.world.createCollider(colliderDesc)
  physicsState.drivableColliderHandles.add(collider.handle)
  return collider
}

function getTrackSurfaceUp(trackFrame) {
  return trackFrame.tangent.clone().cross(trackFrame.normal).normalize()
}

function syncCarStateFromPhysics() {
  if (!physicsState.chassisBody) return

  const translation = physicsState.chassisBody.translation()
  const rotation = physicsState.chassisBody.rotation()
  const linearVelocity = physicsState.chassisBody.linvel()
  const worldQuaternion = new THREE.Quaternion(
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  )
  const forwardDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuaternion)
  const flatVelocity = new THREE.Vector3(linearVelocity.x, 0, linearVelocity.z)
  const visualPosition = new THREE.Vector3(
    translation.x,
    translation.y,
    translation.z,
  )
  const trackFrame = trackSystem.getTrackFrame(visualPosition, carState.trackSampleIndex)
  visualPosition.y += PHYSICS_VISUAL_RIDE_BIAS

  physicsState.currentPosition.copy(visualPosition)
  physicsState.currentQuaternion.copy(worldQuaternion)
  carState.position.copy(visualPosition)
  carState.rotation = Math.atan2(forwardDirection.x, forwardDirection.z)
  carState.speed =
    flatVelocity.length() * (flatVelocity.dot(forwardDirection) >= 0 ? 1 : -1)
  renderState.targetQuaternion.copy(worldQuaternion)
  carState.trackSampleIndex = trackFrame.sampleIndex
}

function updateWheelVisuals(delta) {
  if (!physicsState.vehicleController) return

  const wheelGroups = [
    frontLeftWheelGroup,
    frontRightWheelGroup,
    rearLeftWheelGroup,
    rearRightWheelGroup,
  ]

  for (let wheelIndex = 0; wheelIndex < wheelGroups.length; wheelIndex += 1) {
    const group = wheelGroups[wheelIndex]
    if (!group) continue

    const layout = WHEEL_VISUAL_LAYOUT[wheelIndex]
    const targetSuspensionLength =
      physicsState.vehicleController.wheelSuspensionLength(wheelIndex) ??
      PHYSICS_SUSPENSION_REST
    wheelVisualState[wheelIndex].suspensionLength = damp(
      wheelVisualState[wheelIndex].suspensionLength,
      targetSuspensionLength,
      24,
      delta,
    )

    const targetRotation =
      -(physicsState.vehicleController.wheelRotation(wheelIndex) ?? 0)
    wheelVisualState[wheelIndex].rotation = dampAngle(
      wheelVisualState[wheelIndex].rotation,
      targetRotation,
      20,
      delta,
    )

    group.position.set(
      layout.x,
      (PHYSICS_WHEEL_CONNECTION_Y - wheelVisualState[wheelIndex].suspensionLength) /
        CAR_SCALE,
      layout.z,
    )
    group.rotation.set(
      wheelVisualState[wheelIndex].rotation,
      layout.steer ? renderState.wheelSteer : 0,
      0,
    )
  }
}

function setWheelDrive(engineForce, steeringAngle, brakeForce) {
  if (!physicsState.vehicleController) return

  const frontDriveShare =
    engineForce >= 0
      ? PHYSICS_FRONT_DRIVE_SHARE_FORWARD
      : PHYSICS_FRONT_DRIVE_SHARE_REVERSE
  const frontEngineForce = engineForce * frontDriveShare
  const rearEngineForce = engineForce * (1 - frontDriveShare)

  physicsState.vehicleController.setWheelSteering(0, steeringAngle)
  physicsState.vehicleController.setWheelSteering(1, steeringAngle)
  physicsState.vehicleController.setWheelSteering(2, 0)
  physicsState.vehicleController.setWheelSteering(3, 0)

  physicsState.vehicleController.setWheelEngineForce(0, frontEngineForce)
  physicsState.vehicleController.setWheelEngineForce(1, frontEngineForce)
  physicsState.vehicleController.setWheelEngineForce(2, rearEngineForce)
  physicsState.vehicleController.setWheelEngineForce(3, rearEngineForce)

  for (let wheelIndex = 0; wheelIndex < 4; wheelIndex += 1) {
    physicsState.vehicleController.setWheelBrake(wheelIndex, brakeForce)
  }
}

function getWheelContactCount() {
  if (!physicsState.vehicleController) return 0

  let contactCount = 0
  for (let wheelIndex = 0; wheelIndex < 4; wheelIndex += 1) {
    if (physicsState.vehicleController.wheelIsInContact(wheelIndex)) {
      contactCount += 1
    }
  }

  return contactCount
}

function releaseBrakeHold() {
  physicsState.brakeHoldActive = false
}

function shouldApplyBrakeHold(braking, driveIntent) {
  if (
    !braking ||
    driveIntent !== 0 ||
    !physicsState.chassisBody ||
    getWheelContactCount() < PHYSICS_BRAKE_HOLD_MIN_WHEEL_CONTACTS
  ) {
    return false
  }

  const linearVelocity = physicsState.chassisBody.linvel()
  const angularVelocity = physicsState.chassisBody.angvel()
  const horizontalSpeed = Math.hypot(linearVelocity.x, linearVelocity.z)
  const angularSpeed = Math.hypot(
    angularVelocity.x,
    angularVelocity.y,
    angularVelocity.z,
  )

  return (
    horizontalSpeed <= PHYSICS_BRAKE_HOLD_SPEED_THRESHOLD &&
    Math.abs(linearVelocity.y) <= PHYSICS_BRAKE_HOLD_VERTICAL_SPEED_THRESHOLD &&
    angularSpeed <= PHYSICS_BRAKE_HOLD_ANGULAR_SPEED_THRESHOLD
  )
}

function applyBrakeHold() {
  if (!physicsState.chassisBody) return

  if (!physicsState.brakeHoldActive) {
    const translation = physicsState.chassisBody.translation()
    const rotation = physicsState.chassisBody.rotation()
    physicsState.brakeHoldPosition.set(
      translation.x,
      translation.y,
      translation.z,
    )
    physicsState.brakeHoldQuaternion.set(
      rotation.x,
      rotation.y,
      rotation.z,
      rotation.w,
    )
    physicsState.brakeHoldActive = true
  }

  physicsState.chassisBody.setTranslation(
    threeVectorToRapier(physicsState.brakeHoldPosition),
    true,
  )
  physicsState.chassisBody.setRotation(
    quaternionToRapier(physicsState.brakeHoldQuaternion),
    true,
  )
  physicsState.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
  physicsState.chassisBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
}

function applyUprightAssist(trackFrame, delta) {
  if (!physicsState.chassisBody || raceState.mode !== 'racing') return

  const surfaceHeight = trackFrame.surfacePoint.y + PHYSICS_BODY_RIDE_HEIGHT
  if (carState.position.y > surfaceHeight + 0.65) return

  const desiredUp = getTrackSurfaceUp(trackFrame)
  const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(renderState.quaternion)
  const correctionAxis = currentUp.cross(desiredUp)

  if (correctionAxis.lengthSq() < 0.000001) return

  const angularVelocity = physicsState.chassisBody.angvel()
  const torqueImpulse = correctionAxis
    .normalize()
    .multiplyScalar(PHYSICS_UPRIGHT_TORQUE * delta * correctionAxis.length())
    .add(
      new THREE.Vector3(
        -angularVelocity.x * 0.006,
        0,
        -angularVelocity.z * 0.006,
      ),
    )

  physicsState.chassisBody.applyTorqueImpulse(
    threeVectorToRapier(torqueImpulse),
    true,
  )
}

function applyPitchStabilityAssist(delta, driveIntent) {
  if (
    !physicsState.chassisBody ||
    !physicsState.vehicleController ||
    raceState.mode !== 'racing' ||
    driveIntent === 0
  ) {
    return
  }

  const rotation = physicsState.chassisBody.rotation()
  const worldQuaternion = new THREE.Quaternion(
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  )
  const rightDirection = new THREE.Vector3(1, 0, 0)
    .applyQuaternion(worldQuaternion)
    .normalize()
  const angularVelocity = physicsState.chassisBody.angvel()
  const pitchRate =
    angularVelocity.x * rightDirection.x +
    angularVelocity.y * rightDirection.y +
    angularVelocity.z * rightDirection.z
  const engineRatio = THREE.MathUtils.clamp(
    Math.abs(physicsState.engineForce) / PHYSICS_ENGINE_FORCE,
    0,
    1,
  )
  const speedFactor = THREE.MathUtils.clamp(1 - Math.abs(carState.speed) / 7.5, 0.2, 1)
  const drivenAxleLight =
    driveIntent > 0
      ? !physicsState.vehicleController.wheelIsInContact(0) ||
        !physicsState.vehicleController.wheelIsInContact(1)
      : !physicsState.vehicleController.wheelIsInContact(2) ||
        !physicsState.vehicleController.wheelIsInContact(3)
      ? 1.55
      : 1
  const stabilityDirection = driveIntent > 0 ? 1 : -1
  const stabilityImpulse =
    PHYSICS_PITCH_STABILITY_TORQUE *
    (0.35 + engineRatio * 0.65) *
    speedFactor *
    drivenAxleLight *
    stabilityDirection *
    delta
  const pitchDampingImpulse = -pitchRate * 0.018 * delta
  const torqueImpulse = rightDirection.multiplyScalar(
    stabilityImpulse + pitchDampingImpulse,
  )

  physicsState.chassisBody.applyTorqueImpulse(
    threeVectorToRapier(torqueImpulse),
    true,
  )
}

function applySteerAssist(delta, steeringInput, speed, nearGuardrail = false) {
  if (!physicsState.chassisBody || Math.abs(steeringInput) < 0.001) return

  const speedFactor = THREE.MathUtils.clamp(1 - Math.abs(speed) / 8.5, 0.18, 1)
  if (speedFactor <= 0) return

  const direction = speed < -0.18 ? -1 : 1
  const guardrailBoost = nearGuardrail ? 1.8 : 1
  const yawImpulse =
    steeringInput *
    direction *
    PHYSICS_STEER_ASSIST_TORQUE *
    speedFactor *
    guardrailBoost *
    delta

  physicsState.chassisBody.applyTorqueImpulse(
    { x: 0, y: yawImpulse, z: 0 },
    true,
  )
}

function applyTrackEscapeAssist(trackFrame, delta, steeringInput, driveIntent) {
  if (!physicsState.chassisBody) return

  const edgeAmount =
    Math.abs(trackFrame.lateralOffset) - (TRACK_HALF_WIDTH - 0.16)
  if (edgeAmount <= 0) return

  const inwardDirection = trackFrame.normal
    .clone()
    .multiplyScalar(-(Math.sign(trackFrame.lateralOffset) || 1))
  const assistStrength =
    (0.45 + Math.abs(steeringInput) * 0.35 + Math.abs(driveIntent) * 0.2) *
    THREE.MathUtils.clamp(edgeAmount / 0.55, 0, 1)
  const inwardImpulse = inwardDirection.multiplyScalar(
    PHYSICS_TRACK_ESCAPE_IMPULSE * assistStrength * delta,
  )
  const linearVelocity = physicsState.chassisBody.linvel()
  const outwardSpeed =
    linearVelocity.x * -inwardDirection.x + linearVelocity.z * -inwardDirection.z

  physicsState.chassisBody.applyImpulse(
    threeVectorToRapier(inwardImpulse),
    true,
  )

  if (outwardSpeed > 0.15) {
    physicsState.chassisBody.applyImpulse(
      {
        x: inwardDirection.x * outwardSpeed * 0.12,
        y: 0,
        z: inwardDirection.z * outwardSpeed * 0.12,
      },
      true,
    )
  }
}

function applyGuardrailReleaseAssist(trackFrame, delta, steeringInput, driveIntent) {
  if (!physicsState.chassisBody) return

  const guardrailEdgeAmount =
    Math.abs(trackFrame.lateralOffset) - (GUARDRAIL_OFFSET - 0.22)
  if (guardrailEdgeAmount <= 0) return

  const railSide = Math.sign(trackFrame.lateralOffset || 0)
  const steerAwayAmount = Math.max(
    0,
    steeringInput * railSide,
  )
  const steerIntoAmount = Math.max(0, -steeringInput * railSide)
  const glideIntent =
    driveIntent !== 0 && steerIntoAmount < 0.35
      ? 0.45 + (0.35 - steerIntoAmount) * 0.8
      : 0
  const releaseIntent = Math.max(steerAwayAmount, glideIntent)
  if (releaseIntent <= 0) return

  const inwardDirection = trackFrame.normal
    .clone()
    .multiplyScalar(-railSide)
  const edgeRatio = THREE.MathUtils.clamp(guardrailEdgeAmount / 0.22, 0, 1)
  const assistStrength = edgeRatio * (0.38 + releaseIntent * 0.7)
  const linearVelocity = physicsState.chassisBody.linvel()
  const outwardSpeed =
    linearVelocity.x * -inwardDirection.x + linearVelocity.z * -inwardDirection.z
  const forwardSign =
    driveIntent !== 0 ? driveIntent : carState.speed < -0.12 ? -1 : 1

  physicsState.chassisBody.applyImpulse(
    threeVectorToRapier(
      inwardDirection.multiplyScalar(
        PHYSICS_GUARDRAIL_RELEASE_IMPULSE * assistStrength * delta,
      ),
    ),
    true,
  )

  if (outwardSpeed > 0.04) {
    physicsState.chassisBody.applyImpulse(
      {
        x: inwardDirection.x * outwardSpeed * 0.22,
        y: 0,
        z: inwardDirection.z * outwardSpeed * 0.22,
      },
      true,
    )
  }

  physicsState.chassisBody.applyTorqueImpulse(
    {
      x: 0,
      y:
        steeringInput *
        forwardSign *
        PHYSICS_GUARDRAIL_RELEASE_YAW_TORQUE *
        assistStrength *
        Math.max(0.35, steerAwayAmount) *
        delta,
      z: 0,
    },
    true,
  )

  const tangentDirection = trackFrame.flatTangent.clone().multiplyScalar(forwardSign)
  const tangentSpeed =
    linearVelocity.x * tangentDirection.x + linearVelocity.z * tangentDirection.z
  const tangentAssistScale = THREE.MathUtils.clamp(1 - tangentSpeed / 4.2, 0, 1)
  const tangentAssist = trackFrame.flatTangent
    .clone()
    .multiplyScalar(
      forwardSign *
        PHYSICS_GUARDRAIL_RELEASE_FORWARD_IMPULSE *
        assistStrength *
        tangentAssistScale *
        delta,
    )
  physicsState.chassisBody.applyImpulse(
    threeVectorToRapier(tangentAssist),
    true,
  )
}

function applyGuardrailGlideAssist(trackFrame, steeringInput, driveIntent) {
  if (!physicsState.chassisBody || driveIntent === 0) return

  const guardrailEdgeAmount =
    Math.abs(trackFrame.lateralOffset) - (GUARDRAIL_OFFSET - 0.24)
  if (guardrailEdgeAmount <= 0) return

  const railSide = Math.sign(trackFrame.lateralOffset || 0)
  const steerIntoAmount = Math.max(0, -steeringInput * railSide)
  if (steerIntoAmount > 0.55) return

  const engineRatio = THREE.MathUtils.clamp(
    Math.abs(physicsState.engineForce) / PHYSICS_ENGINE_FORCE,
    0,
    1,
  )
  if (engineRatio < 0.08) return

  const linearVelocity = physicsState.chassisBody.linvel()
  const tangentDirection = trackFrame.flatTangent.clone().multiplyScalar(driveIntent)
  const inwardDirection = trackFrame.normal.clone().multiplyScalar(-railSide)
  const tangentSpeed =
    linearVelocity.x * tangentDirection.x + linearVelocity.z * tangentDirection.z
  const inwardSpeed =
    linearVelocity.x * inwardDirection.x + linearVelocity.z * inwardDirection.z
  const glideTargetSpeed = THREE.MathUtils.lerp(
    PHYSICS_GUARDRAIL_GLIDE_MIN_SPEED,
    PHYSICS_GUARDRAIL_GLIDE_MAX_SPEED,
    engineRatio,
  )
  const edgeRatio = THREE.MathUtils.clamp(guardrailEdgeAmount / 0.22, 0, 1)
  const glideBlend = edgeRatio * (0.55 + engineRatio * 0.45)
  const correctedTangentSpeed =
    tangentSpeed < glideTargetSpeed
      ? THREE.MathUtils.lerp(tangentSpeed, glideTargetSpeed, glideBlend)
      : tangentSpeed
  const correctedInwardSpeed = THREE.MathUtils.clamp(
    inwardSpeed,
    PHYSICS_GUARDRAIL_GLIDE_INWARD_SPEED,
    PHYSICS_GUARDRAIL_GLIDE_MAX_INTO_SPEED,
  )
  const correctedVelocity = tangentDirection
    .multiplyScalar(correctedTangentSpeed)
    .add(inwardDirection.multiplyScalar(correctedInwardSpeed))

  physicsState.chassisBody.setLinvel(
    {
      x: correctedVelocity.x,
      y: linearVelocity.y,
      z: correctedVelocity.z,
    },
    true,
  )
}

function applyDirectionChangeAssist(delta, driveIntent) {
  if (!physicsState.chassisBody || driveIntent === 0) return

  const rotation = physicsState.chassisBody.rotation()
  const worldQuaternion = new THREE.Quaternion(
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  )
  const forwardDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(
    worldQuaternion,
  )
  forwardDirection.y = 0
  if (forwardDirection.lengthSq() < 0.000001) return
  forwardDirection.normalize()

  const linearVelocity = physicsState.chassisBody.linvel()
  const horizontalVelocity = new THREE.Vector3(
    linearVelocity.x,
    0,
    linearVelocity.z,
  )
  const forwardSpeed = horizontalVelocity.dot(forwardDirection)
  if (forwardSpeed * driveIntent >= -0.05) return

  const opposingSpeed = Math.abs(forwardSpeed)
  const speedReduction = Math.min(
    opposingSpeed,
    (PHYSICS_DIRECTION_CHANGE_RESPONSE + opposingSpeed * 1.35) * delta,
  )
  const impulseMagnitude = speedReduction * physicsState.chassisBody.mass()
  const brakingImpulse = forwardDirection.multiplyScalar(
    -Math.sign(forwardSpeed) * impulseMagnitude,
  )
  physicsState.chassisBody.applyImpulse(
    threeVectorToRapier(brakingImpulse),
    true,
  )
}

function applyBrakeAssist(delta, braking) {
  if (
    !physicsState.chassisBody ||
    !braking ||
    getWheelContactCount() < PHYSICS_BRAKE_HOLD_MIN_WHEEL_CONTACTS
  ) {
    return
  }

  const linearVelocity = physicsState.chassisBody.linvel()
  const horizontalVelocity = new THREE.Vector3(
    linearVelocity.x,
    0,
    linearVelocity.z,
  )
  const horizontalSpeed = horizontalVelocity.length()
  if (horizontalSpeed < PHYSICS_BRAKE_ASSIST_MIN_SPEED) return

  const speedReduction = Math.min(
    horizontalSpeed,
    (PHYSICS_BRAKE_ASSIST + horizontalSpeed * PHYSICS_BRAKE_ASSIST_SPEED_FACTOR) *
      delta,
  )
  const impulseMagnitude = speedReduction * physicsState.chassisBody.mass()
  const brakingImpulse = horizontalVelocity
    .normalize()
    .multiplyScalar(-impulseMagnitude)

  physicsState.chassisBody.applyImpulse(
    threeVectorToRapier(brakingImpulse),
    true,
  )
}

function clampVehicleSpeed() {
  if (!physicsState.chassisBody) return

  const linearVelocity = physicsState.chassisBody.linvel()
  const worldQuaternion = new THREE.Quaternion()
  const rotation = physicsState.chassisBody.rotation()
  worldQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)

  const forwardDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuaternion)
  forwardDirection.y = 0
  if (forwardDirection.lengthSq() < 0.000001) return
  forwardDirection.normalize()

  const horizontalVelocity = new THREE.Vector3(
    linearVelocity.x,
    0,
    linearVelocity.z,
  )
  const forwardSpeed = horizontalVelocity.dot(forwardDirection)
  const clampedForwardSpeed = THREE.MathUtils.clamp(
    forwardSpeed,
    -CAR_REVERSE_SPEED,
    effectsSystem.getCurrentForwardTopSpeed(),
  )

  if (Math.abs(clampedForwardSpeed - forwardSpeed) < 0.0001) return

  const lateralVelocity = horizontalVelocity.sub(
    forwardDirection.clone().multiplyScalar(forwardSpeed),
  )
  const limitedVelocity = lateralVelocity.add(
    forwardDirection.multiplyScalar(clampedForwardSpeed),
  )

  physicsState.chassisBody.setLinvel(
    {
      x: limitedVelocity.x,
      y: linearVelocity.y,
      z: limitedVelocity.z,
    },
    true,
  )
}

function updatePhysicsGameOver(trackFrame, delta) {
  const surfaceHeight = trackFrame.surfacePoint.y + PHYSICS_BODY_RIDE_HEIGHT
  const jumpGrace = trackSystem.isTrackFrameInJumpZone(trackFrame)
    ? TRACK_JUMP_GAME_OVER_GRACE
    : 0
  const upDot = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(renderState.quaternion)
    .dot(WORLD_UP)
  const upsideDown =
    upDot < -0.35 &&
    carState.position.y <= surfaceHeight + 0.16
  const belowTrack =
    carState.position.y <
    surfaceHeight - (CRASH_BELOW_TRACK_MARGIN + jumpGrace)
  const outOfTrack =
    Math.abs(trackFrame.lateralOffset) >
      GUARDRAIL_OFFSET + GUARDRAIL_THICKNESS + CRASH_OUT_OF_TRACK_MARGIN ||
    belowTrack

  physicsState.upsideDownTime = upsideDown
    ? physicsState.upsideDownTime + delta
    : 0
  physicsState.offTrackTime = outOfTrack
    ? physicsState.offTrackTime + delta
    : 0

  if (physicsState.offTrackTime >= CRASH_GAME_OVER_DELAY) {
    triggerGameOver('offTrack')
  } else if (physicsState.upsideDownTime >= CRASH_GAME_OVER_DELAY) {
    triggerGameOver('upsideDown')
  }
}

function createVehicleController() {
  physicsState.vehicleController = physicsState.world.createVehicleController(
    physicsState.chassisBody,
  )
  physicsState.vehicleController.indexUpAxis = 1
  physicsState.vehicleController.setIndexForwardAxis = 2

  const wheelAnchors = [
    new THREE.Vector3(
      PHYSICS_WHEEL_HALF_TRACK,
      PHYSICS_WHEEL_CONNECTION_Y,
      PHYSICS_WHEEL_FRONT_Z,
    ),
    new THREE.Vector3(
      -PHYSICS_WHEEL_HALF_TRACK,
      PHYSICS_WHEEL_CONNECTION_Y,
      PHYSICS_WHEEL_FRONT_Z,
    ),
    new THREE.Vector3(
      PHYSICS_WHEEL_HALF_TRACK,
      PHYSICS_WHEEL_CONNECTION_Y,
      PHYSICS_WHEEL_REAR_Z,
    ),
    new THREE.Vector3(
      -PHYSICS_WHEEL_HALF_TRACK,
      PHYSICS_WHEEL_CONNECTION_Y,
      PHYSICS_WHEEL_REAR_Z,
    ),
  ]

  for (const anchor of wheelAnchors) {
    physicsState.vehicleController.addWheel(
      threeVectorToRapier(anchor),
      { x: 0, y: -1, z: 0 },
      { x: -1, y: 0, z: 0 },
      PHYSICS_SUSPENSION_REST,
      PHYSICS_WHEEL_RADIUS,
    )
  }

  for (let wheelIndex = 0; wheelIndex < 4; wheelIndex += 1) {
    physicsState.vehicleController.setWheelSuspensionStiffness(
      wheelIndex,
      wheelIndex < 2 ? 168 : 124,
    )
    physicsState.vehicleController.setWheelSuspensionCompression(
      wheelIndex,
      wheelIndex < 2 ? 11.8 : 9.6,
    )
    physicsState.vehicleController.setWheelSuspensionRelaxation(
      wheelIndex,
      wheelIndex < 2 ? 13.5 : 11,
    )
    physicsState.vehicleController.setWheelMaxSuspensionTravel(
      wheelIndex,
      PHYSICS_SUSPENSION_TRAVEL,
    )
    physicsState.vehicleController.setWheelMaxSuspensionForce(
      wheelIndex,
      wheelIndex < 2 ? 520 : 380,
    )
    physicsState.vehicleController.setWheelFrictionSlip(wheelIndex, 6.2)
    physicsState.vehicleController.setWheelSideFrictionStiffness(
      wheelIndex,
      wheelIndex < 2 ? 2.9 : 3.7,
    )
  }
}

async function ensurePhysicsWorld(
  trackGeometry,
  leftGuardrailGeometry,
  rightGuardrailGeometry,
) {
  if (physicsState.ready) return

  await RAPIER.init()

  physicsState.world = new RAPIER.World({ x: 0, y: -PHYSICS_GRAVITY, z: 0 })
  physicsState.world.timestep = PHYSICS_STEP
  physicsState.world.lengthUnit = 1
  physicsState.world.numSolverIterations = 8

  createTrackSurfaceCollider(TRACK_HALF_WIDTH)
  const leftGuardrailCollisionGeometry = trackSystem.createGuardrailGeometry(-1, {
    offset: PHYSICS_GUARDRAIL_COLLISION_OFFSET,
    thickness: PHYSICS_GUARDRAIL_COLLISION_MESH_THICKNESS,
    height: GUARDRAIL_COLLISION_HEIGHT,
  })
  createTrimeshColliderFromGeometry(leftGuardrailCollisionGeometry, {
    friction: PHYSICS_GUARDRAIL_FRICTION,
    restitution: PHYSICS_GUARDRAIL_RESTITUTION,
    contactSkin: PHYSICS_COLLISION_SKIN * 2,
    flags: RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
  })
  leftGuardrailCollisionGeometry.dispose()
  const rightGuardrailCollisionGeometry = trackSystem.createGuardrailGeometry(1, {
    offset: PHYSICS_GUARDRAIL_COLLISION_OFFSET,
    thickness: PHYSICS_GUARDRAIL_COLLISION_MESH_THICKNESS,
    height: GUARDRAIL_COLLISION_HEIGHT,
  })
  createTrimeshColliderFromGeometry(rightGuardrailCollisionGeometry, {
    friction: PHYSICS_GUARDRAIL_FRICTION,
    restitution: PHYSICS_GUARDRAIL_RESTITUTION,
    contactSkin: PHYSICS_COLLISION_SKIN * 2,
    flags: RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
  })
  rightGuardrailCollisionGeometry.dispose()

  const groundCollider = RAPIER.ColliderDesc.cuboid(90, 0.2, 90)
    .setTranslation(0, GROUND_LEVEL, 0)
    .setFriction(PHYSICS_GROUND_FRICTION)
  physicsState.world.createCollider(groundCollider)

  const startQuaternion = new THREE.Quaternion().setFromAxisAngle(
    WORLD_UP,
    CAR_START_ROTATION,
  )
  const chassisBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(
      CAR_START_BODY_POSITION.x,
      CAR_START_BODY_POSITION.y,
      CAR_START_BODY_POSITION.z,
    )
    .setRotation(quaternionToRapier(startQuaternion))
    .setLinearDamping(PHYSICS_LINEAR_DAMPING)
    .setAngularDamping(PHYSICS_ANGULAR_DAMPING)
    .setCanSleep(false)
    .setCcdEnabled(true)
  physicsState.chassisBody = physicsState.world.createRigidBody(chassisBodyDesc)

  const chassisColliderDesc = RAPIER.ColliderDesc.cuboid(
    PHYSICS_CHASSIS_HALF_WIDTH,
    PHYSICS_CHASSIS_HALF_HEIGHT,
    PHYSICS_CHASSIS_HALF_LENGTH,
  )
    .setTranslation(0, PHYSICS_CHASSIS_OFFSET_Y, PHYSICS_CHASSIS_FORWARD_OFFSET)
    .setMass(1.22)
    .setFriction(PHYSICS_CHASSIS_FRICTION)
    .setRestitution(0.02)
    .setContactSkin(PHYSICS_COLLISION_SKIN)
  physicsState.chassisCollider = physicsState.world.createCollider(
    chassisColliderDesc,
    physicsState.chassisBody,
  )
  const baseInertia = physicsState.chassisBody.principalInertia()
  physicsState.chassisBody.setAdditionalMassProperties(
    PHYSICS_ADDITIONAL_CHASSIS_MASS,
    { x: 0, y: -0.11, z: 0.42 },
    {
      x: baseInertia.x * 2.3,
      y: baseInertia.y * 1.2,
      z: baseInertia.z * 2.3,
    },
    { x: 0, y: 0, z: 0, w: 1 },
    true,
  )

  createVehicleController()
  syncCarStateFromPhysics()
  physicsState.ready = true
}

function triggerGameOver(reason = 'wrecked') {
  if (raceState.mode === 'gameOver') return

  inputSystem.setTouchBoostMode('none')
  raceState.mode = 'gameOver'
  raceState.finishTimer = 0
  raceState.superboostActive = false
  physicsState.frozen = true
  physicsState.brakeHoldActive = false
  carState.speed = 0
  audioState.guardrailContactActive = false
  setWheelDrive(0, 0, PHYSICS_BRAKE_FORCE)
  if (physicsState.chassisBody) {
    physicsState.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
    physicsState.chassisBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }

  finishCelebration.classList.remove('is-visible', 'is-bursting')
  effectsSystem.setFinishCelebrationContent()
  gameOverSubtitle.textContent =
    reason === 'upsideDown'
      ? `Upside down. ${inputSystem.getRespawnPrompt()}`
      : reason === 'offTrack'
        ? inputSystem.getRespawnPrompt()
        : inputSystem.getRespawnPrompt()
  gameOverCelebration.classList.add('is-visible')
}

function updateCar(delta) {
  if (!physicsState.ready || !physicsState.chassisBody || !physicsState.vehicleController) {
    return
  }

  physicsState.previousPosition.copy(physicsState.currentPosition)
  physicsState.previousQuaternion.copy(physicsState.currentQuaternion)

  const previousPosition = carState.position.clone()
  const trackFrame = trackSystem.getTrackFrame(carState.position, carState.trackSampleIndex)
  carState.trackSampleIndex = trackFrame.sampleIndex

  if (!physicsState.frozen) {
    const driveInput = inputSystem.getDriveInputState()
    const accelerating = driveInput.accelerate > 0.001
    const reversing = driveInput.reverse > 0.001
    const braking = driveInput.brake > 0.001
    const steeringInput = driveInput.steer
    const nearGuardrail =
      Math.abs(trackFrame.lateralOffset) > GUARDRAIL_OFFSET - 0.24
    const driveIntent =
      accelerating && !reversing
        ? 1
        : reversing && !accelerating
          ? -1
          : 0
    const boostActive = effectsSystem.isBoostActive() && driveIntent > 0
    const superboostActive = effectsSystem.isSuperboostActive() && driveIntent > 0
    if (superboostActive && !raceState.superboostActive) {
      const now = getCurrentTimeSeconds()
      const canShowSuperboostCelebration =
        now - raceState.lastSuperboostEntryTime >= SUPERBOOST_BANNER_COOLDOWN
      raceState.lastSuperboostEntryTime = now
      if (canShowSuperboostCelebration) {
        effectsSystem.triggerSuperboostCelebration()
      }
    }
    raceState.superboostActive = superboostActive
    const forwardTopSpeed = superboostActive
      ? CAR_SUPERBOOST_SPEED
      : boostActive
        ? CAR_BOOST_SPEED
        : CAR_TOP_SPEED
    const counterSteering = driveIntent !== 0 && carState.speed * driveIntent < -0.05
    const brakeOnlyDirectionChange =
      counterSteering &&
      Math.abs(carState.speed) > PHYSICS_DIRECTION_CHANGE_SPEED_THRESHOLD
    const directionBlendRatio = counterSteering
      ? THREE.MathUtils.clamp(
          1 -
            Math.abs(carState.speed) /
              PHYSICS_DIRECTION_CHANGE_ENGINE_BLEND_SPEED,
          0,
          1,
        )
      : 1
    const activeBrakeForce = braking
      ? THREE.MathUtils.lerp(0, PHYSICS_BRAKE_FORCE, driveInput.brake)
      : brakeOnlyDirectionChange
        ? PHYSICS_DIRECTION_BRAKE_FORCE
        : 0
    const brakeForce = activeBrakeForce > 0
      ? activeBrakeForce
      : driveIntent === 0
        ? PHYSICS_IDLE_BRAKE_FORCE
        : 0
    const engineDirection =
      driveIntent === 0 || (activeBrakeForce > 0 && directionBlendRatio <= 0.001)
        ? 0
        : driveIntent > 0
          ? 1
          : -0.8
    const speedRatio = getSpeedRatio(
      carState.speed,
      driveIntent < 0 ? CAR_REVERSE_SPEED : forwardTopSpeed,
    )
    const powerCurve = THREE.MathUtils.smootherstep(speedRatio, 0, 1)
    const targetEngineForce =
      engineDirection *
      directionBlendRatio *
      (driveIntent > 0
        ? driveInput.accelerate
        : driveIntent < 0
          ? driveInput.reverse
          : 0) *
      (boostActive ? BOOST_ENGINE_FORCE_MULTIPLIER : 1) *
      THREE.MathUtils.lerp(
        PHYSICS_ENGINE_FORCE,
        PHYSICS_ENGINE_FORCE_MIN,
        powerCurve,
      )
    const throttleResponse =
      driveIntent === 0 || activeBrakeForce > 0
        ? PHYSICS_THROTTLE_RELEASE
        : PHYSICS_THROTTLE_RESPONSE
    physicsState.engineForce = damp(
      physicsState.engineForce,
      targetEngineForce,
      throttleResponse,
      delta,
    )

    const steerSpeedRatio = THREE.MathUtils.smoothstep(
      Math.abs(carState.speed),
      0,
      CAR_TOP_SPEED * 0.55,
    )
    const steerLimit = THREE.MathUtils.lerp(1, 0.52, steerSpeedRatio)
    carState.steerTarget = steeringInput * steerLimit
    carState.steer = moveTowards(
      carState.steer,
      carState.steerTarget,
      (Math.abs(steeringInput) > 0.001
        ? PHYSICS_STEER_BUILD_RATE
        : PHYSICS_STEER_RELEASE_RATE) * delta,
    )
    setWheelDrive(
      physicsState.engineForce,
      carState.steer * PHYSICS_MAX_STEER_ANGLE,
      brakeForce,
    )
    applyBrakeAssist(delta, braking)
    applyDirectionChangeAssist(delta, driveIntent)
    applySteerAssist(delta, steeringInput, carState.speed, nearGuardrail)
    applyTrackEscapeAssist(trackFrame, delta, steeringInput, driveIntent)
    applyGuardrailReleaseAssist(trackFrame, delta, steeringInput, driveIntent)
    applyUprightAssist(trackFrame, delta)
    applyPitchStabilityAssist(delta, driveIntent)

    physicsState.vehicleController.updateVehicle(
      delta,
      undefined,
      undefined,
      (collider) => physicsState.drivableColliderHandles.has(collider.handle),
    )
    physicsState.world.step()
    if (shouldApplyBrakeHold(braking, driveIntent)) {
      applyBrakeHold()
    } else {
      releaseBrakeHold()
      applyGuardrailGlideAssist(trackFrame, steeringInput, driveIntent)
    }
    clampVehicleSpeed()
  }

  syncCarStateFromPhysics()

  const updatedTrackFrame = trackSystem.getTrackFrame(carState.position, carState.trackSampleIndex)
  carState.trackSampleIndex = updatedTrackFrame.sampleIndex

  if (raceState.mode === 'racing') {
    trackSystem.updateFinishState(previousPosition, carState.position, carState.trackSampleIndex)
    updatePhysicsGameOver(updatedTrackFrame, delta)
  }
}

function updateRenderState(delta, alpha = 1) {
  raceState.finishTimer = Math.max(raceState.finishTimer - delta, 0)
  const finishVisible = raceState.finishTimer > 0
  finishCelebration.classList.toggle('is-visible', finishVisible)
  if (!finishVisible) {
    finishCelebration.classList.remove('is-bursting')
  }
  gameOverCelebration.classList.toggle('is-visible', raceState.mode === 'gameOver')

  tempInterpolatedPosition
    .copy(physicsState.previousPosition)
    .lerp(physicsState.currentPosition, alpha)
  tempInterpolatedQuaternion.slerpQuaternions(
    physicsState.previousQuaternion,
    physicsState.currentQuaternion,
    alpha,
  )
  tempForwardDirection
    .set(0, 0, 1)
    .applyQuaternion(tempInterpolatedQuaternion)

  renderState.position.copy(tempInterpolatedPosition)
  renderState.quaternion.copy(tempInterpolatedQuaternion)
  renderState.rotation = Math.atan2(
    tempForwardDirection.x,
    tempForwardDirection.z,
  )
  const trackFrame = trackSystem.getTrackFrame(
    renderState.position,
    renderState.trackSampleIndex,
  )
  renderState.trackSampleIndex = trackFrame.sampleIndex
  const renderEuler = new THREE.Euler().setFromQuaternion(
    renderState.quaternion,
    'YXZ',
  )
  renderState.pitch = -renderEuler.x
  renderState.roll = renderEuler.z
  renderState.wheelSteer = damp(
    renderState.wheelSteer,
    carState.steer * FRONT_WHEEL_MAX_STEER_ANGLE,
    18,
    delta,
  )
  const fastMotionRatio =
    raceState.mode === 'racing' ? getFastMotionRatio(carState.speed) : 0
  gameScreen.style.setProperty('--speedometer-glow', fastMotionRatio.toFixed(3))
  speedometerValue.textContent = String(
    Math.round(Math.abs(carState.speed) * SPEED_TO_KMH),
  )
  trackSystem.drawMinimap(trackFrame)
  updateWheelVisuals(delta)

  raceCar.position.copy(renderState.position)
  raceCar.quaternion.copy(renderState.quaternion)
  effectsSystem.updateBoostParticles(delta)
  if (steeringWheelGroup) {
    steeringWheelGroup.rotation.z = -renderState.wheelSteer * 2.4
  }

  carShadow.position.set(
    renderState.position.x,
    trackFrame.surfacePoint.y + TRACK_SHADOW_OFFSET,
    renderState.position.z,
  )
  carShadow.material.opacity = THREE.MathUtils.lerp(
    0.35,
    0.08,
    THREE.MathUtils.clamp(
      (renderState.position.y - trackFrame.surfacePoint.y) / 3.2,
      0,
      1,
    ),
  )

  if (carFillLight) {
    const lightPosition = new THREE.Vector3(0, 2.1, -1.6)
      .applyAxisAngle(WORLD_UP, renderState.rotation)
      .add(renderState.position)
    carFillLight.position.lerp(lightPosition, 1 - Math.exp(-18 * delta))
    carFillLight.intensity = THREE.MathUtils.lerp(14, 18, fastMotionRatio)
  }

  audioSystem.updateDrivingAudio(delta, trackFrame)
}

function getOrbitCameraTarget() {
  return renderState.position.clone().add(new THREE.Vector3(0, ORBIT_CAMERA_TARGET_HEIGHT, 0))
}

function updateCamera(delta) {
  const target = renderState.position.clone().add(new THREE.Vector3(0, 0.24, 0))
  const speedVisualTarget =
    raceState.mode === 'racing' ? getFastMotionRatio(carState.speed) : 0
  cameraState.speedVisual = damp(cameraState.speedVisual, speedVisualTarget, 4.5, delta)

  if (cameraState.mode === 'orbit') {
    const orbitTarget = getOrbitCameraTarget()
    if (camera.fov !== FOLLOW_CAMERA_FOV) {
      camera.fov = FOLLOW_CAMERA_FOV
      camera.updateProjectionMatrix()
    }
    const orbitOffset = new THREE.Vector3().setFromSpherical(
      new THREE.Spherical(
        cameraState.orbitRadius,
        cameraState.orbitPitch,
        cameraState.orbitYaw,
      ),
    )
    const desiredPosition = orbitTarget.clone().add(orbitOffset)
    camera.position.lerp(desiredPosition, 1 - Math.exp(-10 * delta))
    renderState.lookTarget.lerp(orbitTarget, 1 - Math.exp(-12 * delta))
    camera.lookAt(renderState.lookTarget)
    return
  }

  if (cameraState.mode === 'firstPerson') {
    const targetFov = THREE.MathUtils.lerp(
      FIRST_PERSON_CAMERA_FOV,
      FIRST_PERSON_CAMERA_FOV_FAST,
      cameraState.speedVisual,
    )
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = targetFov
      camera.updateProjectionMatrix()
    }
    const cameraRotation = new THREE.Euler(
      -renderState.pitch - FIRST_PERSON_CAMERA_PITCH_BIAS,
      renderState.rotation,
      renderState.roll,
      'YXZ',
    )
    const cameraQuaternion = new THREE.Quaternion().setFromEuler(cameraRotation)
    const cameraOffset = new THREE.Vector3(
      0,
      FIRST_PERSON_CAMERA_HEIGHT,
      FIRST_PERSON_CAMERA_FORWARD_OFFSET,
    )
      .applyQuaternion(cameraQuaternion)
      .add(renderState.position)
    camera.position.copy(cameraOffset)

    const lookTarget = new THREE.Vector3(
      0,
      FIRST_PERSON_CAMERA_HEIGHT + FIRST_PERSON_CAMERA_LOOK_UP,
      FIRST_PERSON_CAMERA_LOOK_AHEAD,
    )
      .applyQuaternion(cameraQuaternion)
      .add(renderState.position)
    renderState.lookTarget.copy(lookTarget)
    camera.lookAt(renderState.lookTarget)
    return
  }

  const followFov = THREE.MathUtils.lerp(
    FOLLOW_CAMERA_FOV,
    FOLLOW_CAMERA_FOV_FAST,
    cameraState.speedVisual,
  )
  if (Math.abs(camera.fov - followFov) > 0.01) {
    camera.fov = followFov
    camera.updateProjectionMatrix()
  }

  const dynamicFollowDistance =
    cameraState.followDistance +
    FOLLOW_CAMERA_SPEED_DISTANCE_OFFSET * cameraState.speedVisual
  const followOffset = new THREE.Vector3(
    0,
    FOLLOW_CAMERA_HEIGHT,
    -dynamicFollowDistance,
  )
    .applyAxisAngle(WORLD_UP, renderState.rotation)
    .add(target)
  camera.position.lerp(followOffset, 1 - Math.exp(-9 * delta))

  const dynamicLookAhead = THREE.MathUtils.lerp(
    FOLLOW_CAMERA_LOOK_AHEAD,
    FOLLOW_CAMERA_LOOK_AHEAD_FAST,
    cameraState.speedVisual,
  )
  const lookTarget = new THREE.Vector3(0, 0.38, dynamicLookAhead)
    .applyAxisAngle(WORLD_UP, renderState.rotation)
    .add(renderState.position)
  renderState.lookTarget.lerp(lookTarget, 1 - Math.exp(-12 * delta))
  camera.lookAt(renderState.lookTarget)
}

function syncOrbitCameraFromCurrentView() {
  const target = getOrbitCameraTarget()
  const offset = camera.position.clone().sub(target)
  const spherical = new THREE.Spherical().setFromVector3(offset)

  cameraState.orbitRadius = THREE.MathUtils.clamp(
    spherical.radius,
    MIN_CAMERA_DISTANCE,
    MAX_CAMERA_DISTANCE,
  )
  cameraState.orbitPitch = THREE.MathUtils.clamp(
    spherical.phi,
    ORBIT_MIN_PHI,
    ORBIT_MAX_PHI,
  )
  cameraState.orbitYaw = spherical.theta
}

function onCameraPointerDown(event) {
  if (!renderer || inputSystem.isTouchDrivePointer(event)) return

  cameraState.mode = 'orbit'
  cameraState.dragging = true
  cameraState.pointerX = event.clientX
  cameraState.pointerY = event.clientY
  syncOrbitCameraFromCurrentView()
  renderer.domElement.focus()
  event.preventDefault()
}

function onCameraPointerMove(event) {
  if (!cameraState.dragging || inputSystem.isTouchDrivePointer(event)) return

  const deltaX = event.clientX - cameraState.pointerX
  const deltaY = event.clientY - cameraState.pointerY
  cameraState.pointerX = event.clientX
  cameraState.pointerY = event.clientY

  cameraState.orbitYaw -= deltaX * 0.008
  cameraState.orbitPitch = THREE.MathUtils.clamp(
    cameraState.orbitPitch + deltaY * 0.006,
    ORBIT_MIN_PHI,
    ORBIT_MAX_PHI,
  )
}

function onCameraPointerUp(event) {
  if (event && inputSystem.isTouchDrivePointer(event)) return
  cameraState.dragging = false

  if (inputSystem.hasDriveInput() || Math.abs(carState.speed) > 0.15) {
    cameraState.mode = cameraState.driveMode
  }
}

function onCameraWheel(event) {
  if (!renderer || gameScreen.classList.contains('hidden')) return

  event.preventDefault()

  if (cameraState.mode === 'orbit') {
    cameraState.orbitRadius = THREE.MathUtils.clamp(
      cameraState.orbitRadius + event.deltaY * 0.01,
      MIN_CAMERA_DISTANCE,
      MAX_CAMERA_DISTANCE,
    )
    return
  }

  cameraState.followDistance = THREE.MathUtils.clamp(
    cameraState.followDistance + event.deltaY * 0.01,
    MIN_CAMERA_DISTANCE,
    MAX_CAMERA_DISTANCE,
  )
}

function onPointerDown(event) {
  if (inputSystem.onTouchDrivePointerDown(event)) return
  onCameraPointerDown(event)
}

function onPointerMove(event) {
  if (inputSystem.onTouchDrivePointerMove(event)) return
  onCameraPointerMove(event)
}

function onPointerUp(event) {
  if (inputSystem.onTouchDrivePointerUp(event)) return
  onCameraPointerUp(event)
}

function toggleDrivingCameraMode() {
  cameraState.driveMode =
    cameraState.driveMode === 'follow' ? 'firstPerson' : 'follow'
  cameraState.mode = cameraState.driveMode
}

async function createGameScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(DAY_SKY_COLOR)
  scene.fog = new THREE.Fog(DAY_FOG_COLOR, 52, 160)

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.03,
    180,
  )
  camera.position.set(18, 2.2, 4)
  camera.lookAt(10, 0.4, -8)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.domElement.tabIndex = 0
  renderer.domElement.style.touchAction = 'none'
  canvasMount.appendChild(renderer.domElement)
  renderer.domElement.addEventListener('contextmenu', (event) => {
    event.preventDefault()
  })
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('wheel', onCameraWheel, { passive: false })
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
  trackSystem.resizeMinimapCanvas()

  addDayEnvironment({
    scene,
    createTracksidePoint,
    treeClearance: TREE_CLEARANCE,
  })

  const hemisphereLight = new THREE.HemisphereLight(0xd7f0ff, 0x6f9c57, 1.45)
  scene.add(hemisphereLight)

  const sunLight = new THREE.DirectionalLight(0xfff2c9, 2.5)
  sunLight.position.set(-20, 24, -14)
  scene.add(sunLight)

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.8)
  fillLight.position.set(12, 10, 8)
  scene.add(fillLight)

  carFillLight = new THREE.PointLight(0xfff7de, 14, 16, 2)
  carFillLight.position.set(
    CAR_START_POSITION.x,
    CAR_START_POSITION.y + 2.8,
    CAR_START_POSITION.z - 0.5,
  )
  scene.add(carFillLight)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshStandardMaterial({
      color: 0x8fcf73,
      metalness: 0,
      roughness: 1,
    }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = GROUND_LEVEL
  scene.add(ground)

  const track = new THREE.Mesh(
    trackSystem.createTrackRibbonGeometry(TRACK_HALF_WIDTH, TRACK_THICKNESS),
    new THREE.MeshStandardMaterial({
      color: 0x50545c,
      metalness: 0.02,
      roughness: 0.96,
      side: THREE.DoubleSide,
    }),
  )
  scene.add(track)

  const skidLayer = trackSystem.createTrackSkidLayer()
  scene.add(skidLayer)

  const edgeStripeOffset =
    TRACK_HALF_WIDTH - TRACK_EDGE_STRIPE_INSET - TRACK_EDGE_STRIPE_WIDTH / 2

  const innerStripe = trackSystem.createTrackEdgeStripe(-edgeStripeOffset)
  scene.add(innerStripe)

  const outerStripe = trackSystem.createTrackEdgeStripe(edgeStripeOffset)
  scene.add(outerStripe)

  const centerLaneStripe = trackSystem.createTrackCenterStripe()
  scene.add(centerLaneStripe)

  const guardrailMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.9,
    roughness: 0.42,
    emissive: 0x11161c,
    emissiveIntensity: 0.06,
    vertexColors: true,
  })
  const leftGuardrail = new THREE.Mesh(
    trackSystem.createGuardrailGeometry(-1),
    guardrailMaterial,
  )
  scene.add(leftGuardrail)

  const rightGuardrail = new THREE.Mesh(
    trackSystem.createGuardrailGeometry(1),
    guardrailMaterial,
  )
  scene.add(rightGuardrail)

  const finishLineGroup = trackSystem.createFinishLineGroup()
  scene.add(finishLineGroup)

  carShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 40),
    new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.35,
    }),
  )
  carShadow.rotation.x = -Math.PI / 2
  scene.add(carShadow)

  const raceCarModel = createRaceCar({
    boostExhaustLocalX: BOOST_EXHAUST_LOCAL_X,
    boostExhaustLocalY: BOOST_EXHAUST_LOCAL_Y,
    boostExhaustLocalZ: BOOST_EXHAUST_LOCAL_Z,
    carScale: CAR_SCALE,
  })
  raceCar = raceCarModel.car
  steeringWheelGroup = raceCarModel.steeringWheelGroup
  frontLeftWheelGroup = raceCarModel.frontLeftWheelGroup
  frontRightWheelGroup = raceCarModel.frontRightWheelGroup
  rearLeftWheelGroup = raceCarModel.rearLeftWheelGroup
  rearRightWheelGroup = raceCarModel.rearRightWheelGroup
  scene.add(raceCar)
  boostParticleSystem = effectsSystem.createBoostParticleSystem()
  scene.add(boostParticleSystem)

  await ensurePhysicsWorld(
    track.geometry,
    leftGuardrail.geometry,
    rightGuardrail.geometry,
  )

  resetRaceSession()

  clock.start()
  renderer.setAnimationLoop(() => {
    const frameDelta = Math.min(clock.getDelta(), 0.05)
    physicsState.accumulator = Math.min(
      physicsState.accumulator + frameDelta,
      PHYSICS_STEP * 3,
    )
    while (physicsState.accumulator >= PHYSICS_STEP) {
      if (raceState.mode === 'racing') {
        lapSystem.advanceLapTimer(PHYSICS_STEP)
      }
      updateCar(PHYSICS_STEP)
      physicsState.accumulator -= PHYSICS_STEP
    }

    updateRenderState(
      frameDelta,
      THREE.MathUtils.clamp(physicsState.accumulator / PHYSICS_STEP, 0, 1),
    )
    updateCamera(frameDelta)

    renderer.render(scene, camera)
  })
}

async function showGameScreen() {
  homeScreen.classList.add('hidden')
  gameScreen.classList.remove('hidden')
  audioSystem.resumeDrivingAudio()

  if (!renderer) {
    await createGameScene()
  }

  renderer.domElement.focus()
  onWindowResize()
}

function resetRaceSession() {
  inputSystem.clearDriveKeys()
  inputSystem.resetTouchDriveState()
  inputSystem.resetTouchActionState()
  inputSystem.setTouchBoostMode('none')
  raceState.mode = 'racing'
  raceState.lapArmed = false
  raceState.finishTimer = 0
  raceState.superboostActive = false
  raceState.lastSuperboostEntryTime = -Infinity
  lapSystem.resetLapTimers()

  physicsState.frozen = false
  physicsState.upsideDownTime = 0
  physicsState.offTrackTime = 0
  physicsState.engineForce = 0
  physicsState.accumulator = 0
  physicsState.brakeHoldActive = false
  physicsState.brakeHoldPosition.copy(CAR_START_BODY_POSITION)
  physicsState.brakeHoldQuaternion.setFromAxisAngle(WORLD_UP, CAR_START_ROTATION)

  carState.position.copy(CAR_START_POSITION)
  carState.rotation = CAR_START_ROTATION
  carState.speed = 0
  carState.steer = 0
  carState.steerTarget = 0
  carState.trackSampleIndex = TRACK_START_INDEX
  if (physicsState.chassisBody) {
    const startQuaternion = new THREE.Quaternion().setFromAxisAngle(
      WORLD_UP,
      CAR_START_ROTATION,
    )
    physicsState.chassisBody.setTranslation(
      threeVectorToRapier(CAR_START_BODY_POSITION),
      true,
    )
    physicsState.chassisBody.setRotation(
      quaternionToRapier(startQuaternion),
      true,
    )
    physicsState.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
    physicsState.chassisBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
    physicsState.world.propagateModifiedBodyPositionsToColliders()
  }
  syncCarStateFromPhysics()
  physicsState.previousPosition.copy(carState.position)
  physicsState.currentPosition.copy(carState.position)
  physicsState.previousQuaternion.setFromAxisAngle(WORLD_UP, carState.rotation)
  physicsState.currentQuaternion.copy(physicsState.previousQuaternion)
  setWheelDrive(0, 0, PHYSICS_IDLE_BRAKE_FORCE)

  audioSystem.resetDrivingAudioState()

  cameraState.mode = 'follow'
  cameraState.driveMode = 'follow'
  cameraState.followDistance = FOLLOW_CAMERA_DISTANCE_DEFAULT
  cameraState.speedVisual = 0

  renderState.position.copy(carState.position)
  renderState.rotation = carState.rotation
  renderState.quaternion.setFromAxisAngle(WORLD_UP, carState.rotation)
  renderState.targetQuaternion.copy(renderState.quaternion)
  renderState.pitch = 0
  renderState.roll = 0
  renderState.wheelSteer = 0
  renderState.trackSampleIndex = TRACK_START_INDEX
  wheelVisualState.forEach((wheel) => {
    wheel.suspensionLength = PHYSICS_SUSPENSION_REST
    wheel.rotation = 0
  })
  renderState.lookTarget.set(
    carState.position.x,
    carState.position.y + 0.24,
    carState.position.z,
  )

  raceCar.position.copy(carState.position)
  raceCar.quaternion.copy(renderState.quaternion)
  carShadow.position.set(
    CAR_START_POSITION.x,
    CAR_START_SAMPLE.point.y + TRACK_SHADOW_OFFSET,
    CAR_START_POSITION.z,
  )
  carShadow.material.opacity = 0.35
  finishCelebration.classList.remove('is-visible', 'is-bursting')
  effectsSystem.setFinishCelebrationContent()
  gameOverCelebration.classList.remove('is-visible')
  gameScreen.style.setProperty('--speedometer-glow', '0')
  if (carFillLight) {
    carFillLight.intensity = 14
  }
  effectsSystem.resetBoostParticles()
  speedometerValue.textContent = '0'
  updateWheelVisuals(0)
  if (steeringWheelGroup) steeringWheelGroup.rotation.z = 0
}

function onWindowResize() {
  if (!renderer || !camera) return

  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  trackSystem.resizeMinimapCanvas()
}

function respawnAtTrackStart() {
  resetRaceSession()
  renderer?.domElement.focus()
  audioSystem.resumeDrivingAudio()
}

inputSystem.updateControlHints()
inputSystem.updateTouchControlsUI()
touchBoostButton?.addEventListener('pointerdown', (event) => {
  if (!inputSystem.isTouchDrivePointer(event)) return
  event.preventDefault()
  touchBoostButton.setPointerCapture?.(event.pointerId)
  inputSystem.setTouchBoostMode('boost')
})
touchBoostButton?.addEventListener('pointerup', (event) => {
  if (!inputSystem.isTouchDrivePointer(event)) return
  event.preventDefault()
  if (touchBoostButton.hasPointerCapture?.(event.pointerId)) {
    touchBoostButton.releasePointerCapture(event.pointerId)
  }
  if (touchActionState.boostMode === 'boost') {
    inputSystem.setTouchBoostMode('none')
  }
})
touchBoostButton?.addEventListener('pointercancel', (event) => {
  if (!inputSystem.isTouchDrivePointer(event)) return
  event.preventDefault()
  if (touchBoostButton.hasPointerCapture?.(event.pointerId)) {
    touchBoostButton.releasePointerCapture(event.pointerId)
  }
  if (touchActionState.boostMode === 'boost') {
    inputSystem.setTouchBoostMode('none')
  }
})
touchBoostButton?.addEventListener('lostpointercapture', () => {
  if (touchActionState.boostMode === 'boost') {
    inputSystem.setTouchBoostMode('none')
  }
})
touchSuperBoostButton?.addEventListener('pointerdown', (event) => {
  if (!inputSystem.isTouchDrivePointer(event)) return
  event.preventDefault()
  touchSuperBoostButton.setPointerCapture?.(event.pointerId)
  inputSystem.setTouchBoostMode('superboost')
})
touchSuperBoostButton?.addEventListener('pointerup', (event) => {
  if (!inputSystem.isTouchDrivePointer(event)) return
  event.preventDefault()
  if (touchSuperBoostButton.hasPointerCapture?.(event.pointerId)) {
    touchSuperBoostButton.releasePointerCapture(event.pointerId)
  }
  if (touchActionState.boostMode === 'superboost') {
    inputSystem.setTouchBoostMode('none')
  }
})
touchSuperBoostButton?.addEventListener('pointercancel', (event) => {
  if (!inputSystem.isTouchDrivePointer(event)) return
  event.preventDefault()
  if (touchSuperBoostButton.hasPointerCapture?.(event.pointerId)) {
    touchSuperBoostButton.releasePointerCapture(event.pointerId)
  }
  if (touchActionState.boostMode === 'superboost') {
    inputSystem.setTouchBoostMode('none')
  }
})
touchSuperBoostButton?.addEventListener('lostpointercapture', () => {
  if (touchActionState.boostMode === 'superboost') {
    inputSystem.setTouchBoostMode('none')
  }
})
window.addEventListener('resize', onWindowResize)
window.addEventListener('keydown', (event) => inputSystem.setDriveKey(event, true))
window.addEventListener('keyup', (event) => inputSystem.setDriveKey(event, false))

  return {
    showGameScreen,
  }
}
