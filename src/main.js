import './style.css'
import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'

const app = document.querySelector('#app')

app.innerHTML = `
  <section class="screen screen-home" data-screen="home">
    <div class="panel hero-panel">
      <p class="eyebrow">Three.js + Vite</p>
      <h1>Race with your Friends</h1>
      <p class="hint">
        Jump into the prototype and head to the game screen where we can start
        building the race track.
      </p>
      <button class="start-button" type="button">Start Game</button>
    </div>
  </section>

  <section class="screen screen-game hidden" data-screen="game">
    <div class="game-canvas"></div>
    <div class="race-hud">
      <div class="speedometer" aria-live="polite" aria-atomic="true">
        <span class="speedometer-label">Speed</span>
        <div class="speedometer-readout">
          <span class="speedometer-value">0</span>
          <span class="speedometer-unit">km/h</span>
        </div>
      </div>
      <div class="lap-timers" aria-live="polite" aria-relevant="additions text"></div>
    </div>
    <div class="minimap" aria-hidden="true">
      <span class="minimap-label">Track Map</span>
      <span class="minimap-hint">
        <span>F camera</span>
        <span>M mesh</span>
        <span>B boost</span>
      </span>
      <canvas class="minimap-canvas"></canvas>
    </div>
    <div class="finish-celebration">
      <div class="finish-particles"></div>
      <div class="finish-flare"></div>
      <div class="finish-burst-ring"></div>
      <div class="finish-notice" aria-live="polite" aria-atomic="true">FINISHED</div>
      <div class="finish-subtitle">Lap Complete</div>
    </div>
    <div class="finish-celebration finish-celebration--danger">
      <div class="finish-flare"></div>
      <div class="finish-burst-ring"></div>
      <div class="finish-notice" aria-live="assertive" aria-atomic="true">GAME OVER</div>
      <div class="finish-subtitle game-over-subtitle">Press Enter or Space to respawn</div>
    </div>
  </section>
`

const homeScreen = app.querySelector('[data-screen="home"]')
const gameScreen = app.querySelector('[data-screen="game"]')
const startButton = app.querySelector('.start-button')
const canvasMount = app.querySelector('.game-canvas')
const speedometerValue = app.querySelector('.speedometer-value')
const lapTimers = app.querySelector('.lap-timers')
const minimapCanvas = app.querySelector('.minimap-canvas')
const minimapContext = minimapCanvas.getContext('2d')
const finishCelebration = app.querySelector('.finish-celebration')
const finishParticleLayer = app.querySelector('.finish-particles')
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
const AudioContextClass =
  typeof window !== 'undefined'
    ? window.AudioContext || window.webkitAudioContext
    : null

const DAY_SKY_COLOR = 0xbfe7ff
const DAY_FOG_COLOR = 0xd9f1ff
const TRACK_BASE_Y = -0.78
const TRACK_THICKNESS = 0.045
const GROUND_LEVEL = TRACK_BASE_Y
const TRACK_HEIGHT_OFFSET = 1.68
const TRACK_HEIGHT_WAVE_1 = 0.96
const TRACK_HEIGHT_WAVE_2 = 0.46
const TRACK_HEIGHT_WAVE_3 = 0.28
const TRACK_HALF_WIDTH = 1.85
const TRACK_EDGE_STRIPE_WIDTH = 0.2
const TRACK_EDGE_STRIPE_INSET = 0.08
const TRACK_EDGE_STRIPE_REPEAT = 7
const TRACK_CENTER_STRIPE_WIDTH = 0.1
const TRACK_CENTER_STRIPE_REPEAT = 9
const TRACK_SKID_LAYER_INSET = 0.18
const TRACK_PAINT_LAYER_OFFSET = 0.006
const TRACK_SKID_LAYER_OFFSET = 0.005
const TRACK_SKID_TEXTURE_REPEAT = 6
const TRACK_SAMPLE_COUNT = 900
const TRACK_SHADOW_OFFSET = 0.01
const SLOPE_SPEED_FACTOR = 24
const TREE_CLEARANCE = TRACK_HALF_WIDTH + 6.8
const TRACK_CENTERING_START_RATIO = 0.52
const TRACK_RECOVERY_START_RATIO = 0.94
const TRACK_CORRECTION_DEADZONE = 0.035
const GUARDRAIL_OFFSET = TRACK_HALF_WIDTH
const GUARDRAIL_THICKNESS = 0.1
const GUARDRAIL_HEIGHT = 0.26
const GUARDRAIL_COLLISION_THICKNESS = 0.16
const GUARDRAIL_COLLISION_HEIGHT = 0.38
const GUARDRAIL_BASE_LIFT = 0
const GUARDRAIL_COLLISION_HALF_WIDTH = GUARDRAIL_OFFSET - 0.08
const FINISH_LINE_HALF_DEPTH = 0.42
const FINISH_LINE_SURFACE_OFFSET = 0.008
const FINISH_LINE_BANNER_HEIGHT = 3.4
const FINISH_LINE_POST_HEIGHT = 3.2
const FINISH_LINE_ZONE_SAMPLES = 30
const FINISH_LINE_ARM_DISTANCE = 180
const FINISH_NOTICE_DURATION = 3
const MAX_VISIBLE_LAP_TIMERS = 4
const CAR_SIZE_MULTIPLIER = 1.5
const CAR_SCALE = 0.31 * CAR_SIZE_MULTIPLIER
const CAR_RIDE_HEIGHT = (0.34 - 0.02) * CAR_SCALE
const FRONT_WHEEL_MAX_STEER_ANGLE = Math.PI * 0.18
const FOLLOW_CAMERA_HEIGHT = 1.2
const FOLLOW_CAMERA_DISTANCE_DEFAULT = 4.2
const FOLLOW_CAMERA_LOOK_AHEAD = 5.4
const FOLLOW_CAMERA_FOV = 60
const FOLLOW_CAMERA_FOV_FAST = 68
const FOLLOW_CAMERA_LOOK_AHEAD_FAST = 8.2
const FOLLOW_CAMERA_SPEED_DISTANCE_OFFSET = -0.7
const FIRST_PERSON_CAMERA_FOV = 72
const FIRST_PERSON_CAMERA_FOV_FAST = 82
const FIRST_PERSON_CAMERA_HEIGHT = 0.26 * CAR_SIZE_MULTIPLIER
const FIRST_PERSON_CAMERA_FORWARD_OFFSET = -0.02 * CAR_SIZE_MULTIPLIER
const FIRST_PERSON_CAMERA_LOOK_AHEAD = 11.2
const FIRST_PERSON_CAMERA_LOOK_UP = -0.04
const FIRST_PERSON_CAMERA_PITCH_BIAS = 0.05
const MIN_CAMERA_DISTANCE = 2.2
const MAX_CAMERA_DISTANCE = 8.5
const ORBIT_CAMERA_TARGET_HEIGHT = 0.9
const ORBIT_MIN_PHI = 0.45
const ORBIT_MAX_PHI = 2.45
const PHYSICS_STEP = 1 / 120
const SPEED_TO_KMH = 18
const CAR_TOP_SPEED_KMH = 220
const CAR_BOOST_SPEED_KMH = 320
const CAR_SUPERBOOST_SPEED_KMH = 420
const CAR_TOP_SPEED = CAR_TOP_SPEED_KMH / SPEED_TO_KMH
const CAR_BOOST_SPEED = CAR_BOOST_SPEED_KMH / SPEED_TO_KMH
const CAR_SUPERBOOST_SPEED = CAR_SUPERBOOST_SPEED_KMH / SPEED_TO_KMH
const CAR_MIN_FORWARD_SPEED = CAR_TOP_SPEED * 0.66
const CAR_REVERSE_SPEED = 5
const CAR_MIN_REVERSE_SPEED = 2.2
const AUDIO_SPEED_REFERENCE = CAR_SUPERBOOST_SPEED
const BOOST_ENGINE_FORCE_MULTIPLIER = 1.3
const SUPERBOOST_NOTICE_DURATION = 1.2
const SUPERBOOST_BANNER_COOLDOWN = 10
const BOOST_PARTICLE_COUNT = 144
const BOOST_PARTICLE_SIZE = 0.3
const BOOST_PARTICLE_SPAWN_RATE = 62
const BOOST_PARTICLE_DRAG = 6.8
const BOOST_PARTICLE_GRAVITY = 2.4
const BOOST_PARTICLE_MIN_LIFETIME = 0.09
const BOOST_PARTICLE_MAX_LIFETIME = 0.2
const BOOST_PARTICLE_MIN_SPEED = 4.2
const BOOST_EXHAUST_LOCAL_X = 0.52
const BOOST_EXHAUST_LOCAL_Y = 0.08
const BOOST_EXHAUST_LOCAL_Z = -1.96
const SPEED_EFFECTS_START_RATIO = 0.34
const SPEED_EFFECTS_FULL_RATIO = 1
const ENGINE_GEAR_RATIOS = [3.2, 2.36, 1.78, 1.36, 1.08, 0.86]
const ENGINE_GEAR_UPSHIFT_SPEEDS = [0.17, 0.31, 0.48, 0.66, 0.84]
const ENGINE_GEAR_DOWNSHIFT_SPEEDS = [0.09, 0.22, 0.37, 0.53, 0.71]
const ENGINE_SHIFT_COOLDOWN = 0.26
const ENGINE_CRUISE_SHIFT_MIN_DELAY = 2.8
const ENGINE_CRUISE_SHIFT_MAX_DELAY = 5.1
const MINIMAP_PADDING = 16
const MINIMAP_LOOKAHEAD_SAMPLES_MIN = 56
const MINIMAP_LOOKAHEAD_SAMPLES_MAX = 140
const TRACK_FRAME_SEARCH_RADIUS = 42
const CRASH_GAME_OVER_DELAY = 0.65
const CRASH_OUT_OF_TRACK_MARGIN = 1.4
const CRASH_BELOW_TRACK_MARGIN = 0.48
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const PHYSICS_GRAVITY = 20
const PHYSICS_ENGINE_FORCE = 86
const PHYSICS_ENGINE_FORCE_MIN = 12
const PHYSICS_FRONT_DRIVE_SHARE_FORWARD = 0.68
const PHYSICS_FRONT_DRIVE_SHARE_REVERSE = 0.38
const PHYSICS_ADDITIONAL_CHASSIS_MASS = 0.95
const PHYSICS_BRAKE_FORCE = 26
const PHYSICS_DIRECTION_BRAKE_FORCE = 44
const PHYSICS_IDLE_BRAKE_FORCE = 2.8
const PHYSICS_BRAKE_ASSIST = 12
const PHYSICS_BRAKE_ASSIST_SPEED_FACTOR = 2.4
// Keep these thresholds overlapping so space-bar braking does not leave the
// car creeping in the 3-4 km/h range without ever settling to a full stop.
const PHYSICS_BRAKE_ASSIST_MIN_SPEED = 0.18
const PHYSICS_BRAKE_HOLD_SPEED_THRESHOLD = 0.24
const PHYSICS_BRAKE_HOLD_VERTICAL_SPEED_THRESHOLD = 0.12
const PHYSICS_BRAKE_HOLD_ANGULAR_SPEED_THRESHOLD = 0.28
const PHYSICS_BRAKE_HOLD_MIN_WHEEL_CONTACTS = 2
const PHYSICS_DIRECTION_CHANGE_RESPONSE = 18
const PHYSICS_DIRECTION_CHANGE_SPEED_THRESHOLD = 0.75
const PHYSICS_DIRECTION_CHANGE_ENGINE_BLEND_SPEED = 1.45
const PHYSICS_MAX_STEER_ANGLE = Math.PI * 0.11
const PHYSICS_UPRIGHT_TORQUE = 0.18
const PHYSICS_PITCH_STABILITY_TORQUE = 0.5
const PHYSICS_STEER_ASSIST_TORQUE = 0.06
const PHYSICS_TRACK_ESCAPE_IMPULSE = 5.6
const PHYSICS_GUARDRAIL_RELEASE_IMPULSE = 8.8
const PHYSICS_GUARDRAIL_RELEASE_YAW_TORQUE = 0.14
const PHYSICS_GUARDRAIL_RELEASE_FORWARD_IMPULSE = 1.4
const PHYSICS_GUARDRAIL_GLIDE_MIN_SPEED = 1.6
const PHYSICS_GUARDRAIL_GLIDE_MAX_SPEED = 4.4
const PHYSICS_GUARDRAIL_GLIDE_MAX_INTO_SPEED = 0.18
const PHYSICS_GUARDRAIL_GLIDE_INWARD_SPEED = 0.5
const PHYSICS_THROTTLE_RESPONSE = 2.5
const PHYSICS_THROTTLE_RELEASE = 8
const PHYSICS_STEER_BUILD_RATE = 3.8
const PHYSICS_STEER_RELEASE_RATE = 6.5
const PHYSICS_ANGULAR_DAMPING = 4.8
const PHYSICS_LINEAR_DAMPING = 0.48
const PHYSICS_TRACK_FRICTION = 1.8
const PHYSICS_GROUND_FRICTION = 1.2
const PHYSICS_CHASSIS_FRICTION = 0.22
const PHYSICS_GUARDRAIL_FRICTION = 0.015
const PHYSICS_GUARDRAIL_RESTITUTION = 0.08
const PHYSICS_COLLISION_SKIN = 0.008
const PHYSICS_GUARDRAIL_SEGMENT_OVERLAP = 0.16
const PHYSICS_GUARDRAIL_JOINT_HALF_SIZE = 0.12
const PHYSICS_CHASSIS_HALF_HEIGHT = 0.085 * CAR_SIZE_MULTIPLIER
const PHYSICS_CHASSIS_HALF_LENGTH = 0.44 * CAR_SIZE_MULTIPLIER
const PHYSICS_CHASSIS_OFFSET_Y = 0.12 * CAR_SIZE_MULTIPLIER
const PHYSICS_WHEEL_RADIUS = 0.34 * CAR_SCALE
const PHYSICS_WHEEL_VISUAL_CENTER_Y = 0.02 * CAR_SCALE
const PHYSICS_WHEEL_HALF_TRACK = 0.86 * CAR_SCALE
const PHYSICS_WHEEL_HALF_WIDTH = 0.14 * CAR_SCALE
const PHYSICS_CHASSIS_HALF_WIDTH = PHYSICS_WHEEL_HALF_TRACK * 0.82
const PHYSICS_CHASSIS_FORWARD_OFFSET = 0.12
const PHYSICS_WHEEL_FRONT_Z = 1.08 * CAR_SCALE
const PHYSICS_WHEEL_REAR_Z = -1.08 * CAR_SCALE
const PHYSICS_SUSPENSION_REST = 0.1 * CAR_SIZE_MULTIPLIER
const PHYSICS_WHEEL_CONNECTION_Y =
  PHYSICS_WHEEL_VISUAL_CENTER_Y + PHYSICS_SUSPENSION_REST - 0.032 * CAR_SIZE_MULTIPLIER
const PHYSICS_SUSPENSION_TRAVEL = 0.1 * CAR_SIZE_MULTIPLIER
const PHYSICS_VISUAL_RIDE_BIAS = 0.004 * CAR_SIZE_MULTIPLIER
const PHYSICS_BODY_RIDE_HEIGHT =
  PHYSICS_WHEEL_RADIUS +
  PHYSICS_SUSPENSION_REST -
  PHYSICS_WHEEL_CONNECTION_Y
const PHYSICS_GUARDRAIL_WHEEL_CLEARANCE =
  Math.max(
    0,
    PHYSICS_WHEEL_HALF_TRACK +
      PHYSICS_WHEEL_HALF_WIDTH -
      PHYSICS_CHASSIS_HALF_WIDTH,
  ) + 0.03
const PHYSICS_GUARDRAIL_COLLISION_OFFSET =
  GUARDRAIL_OFFSET - PHYSICS_GUARDRAIL_WHEEL_CLEARANCE
const PHYSICS_GUARDRAIL_COLLISION_MESH_THICKNESS =
  GUARDRAIL_COLLISION_THICKNESS + PHYSICS_GUARDRAIL_WHEEL_CLEARANCE
const clock = new THREE.Clock()
const TRACK_DATA = createTrackData()
const TRACK_MINIMAP_BOUNDS = getTrackBounds2D()
const TRACK_START_INDEX = 18
const CAR_START_SAMPLE = TRACK_DATA.samples[TRACK_START_INDEX]
const CAR_START_POSITION = CAR_START_SAMPLE.point.clone()
CAR_START_POSITION.y += PHYSICS_BODY_RIDE_HEIGHT
const CAR_START_BODY_POSITION = CAR_START_POSITION.clone()
const CAR_START_ROTATION = Math.atan2(
  CAR_START_SAMPLE.flatTangent.x,
  CAR_START_SAMPLE.flatTangent.z,
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
  position: CAR_START_POSITION.clone(),
  rotation: CAR_START_ROTATION,
  speed: 0,
  steer: 0,
  steerTarget: 0,
  trackSampleIndex: TRACK_START_INDEX,
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
const renderState = {
  position: CAR_START_POSITION.clone(),
  rotation: CAR_START_ROTATION,
  quaternion: new THREE.Quaternion(),
  targetQuaternion: new THREE.Quaternion(),
  lookTarget: new THREE.Vector3(),
  pitch: 0,
  roll: 0,
  wheelSteer: 0,
  trackSampleIndex: TRACK_START_INDEX,
}
const wheelVisualState = Array.from({ length: 4 }, () => ({
  suspensionLength: PHYSICS_SUSPENSION_REST,
  rotation: 0,
}))
const WHEEL_VISUAL_LAYOUT = [
  { x: 0.86, z: 1.08, steer: true },
  { x: -0.86, z: 1.08, steer: true },
  { x: 0.86, z: -1.08, steer: false },
  { x: -0.86, z: -1.08, steer: false },
]
const raceState = {
  lapArmed: false,
  finishTimer: 0,
  laps: [],
  nextLapNumber: 1,
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
  brakeHoldPosition: CAR_START_BODY_POSITION.clone(),
  brakeHoldQuaternion: new THREE.Quaternion().setFromAxisAngle(
    WORLD_UP,
    CAR_START_ROTATION,
  ),
  previousPosition: CAR_START_POSITION.clone(),
  currentPosition: CAR_START_POSITION.clone(),
  previousQuaternion: new THREE.Quaternion().setFromAxisAngle(
    WORLD_UP,
    CAR_START_ROTATION,
  ),
  currentQuaternion: new THREE.Quaternion().setFromAxisAngle(
    WORLD_UP,
    CAR_START_ROTATION,
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
const BOOST_FLAME_COOLED_COLOR = new THREE.Color(0.82, 0.16, 0.02)
const BOOST_FLAME_LOCAL_AXIS = new THREE.Vector3(0, 0, 1)
const BOOST_HIDDEN_POSITION = new THREE.Vector3(10_000, 10_000, 10_000)
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
const debugViewState = {
  meshMode: false,
  meshMaterials: new Set(),
}
const boostState = {
  active: false,
  visualIntensity: 0,
  emitAccumulator: 0,
  nextParticleIndex: 0,
  positions: null,
  colors: null,
  lifetimes: new Float32Array(BOOST_PARTICLE_COUNT),
  maxLifetimes: new Float32Array(BOOST_PARTICLE_COUNT),
  velocities: Array.from({ length: BOOST_PARTICLE_COUNT }, () => new THREE.Vector3()),
  baseColors: Array.from({ length: BOOST_PARTICLE_COUNT }, () => new THREE.Color()),
}
if (typeof window !== 'undefined') {
  window.__racebaanDebug = {
    carState,
    physicsState,
    raceState,
    debugViewState,
    boostState,
  }
}
const finishParticleNodes = createFinishParticleNodes()

function randomBetween(min, max) {
  return THREE.MathUtils.lerp(min, max, Math.random())
}

function getCurrentTimeSeconds() {
  return typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000
}

function isBoostActive() {
  return raceState.mode === 'racing' && keyState.KeyB
}

function isSuperboostActive() {
  return raceState.mode === 'racing' && keyState.KeyB && keyState.ArrowUp
}

function getCurrentForwardTopSpeed() {
  return isSuperboostActive()
    ? CAR_SUPERBOOST_SPEED
    : isBoostActive()
      ? CAR_BOOST_SPEED
      : CAR_TOP_SPEED
}

function setFinishCelebrationContent(
  title = 'FINISHED',
  subtitle = 'Lap Complete',
  variant = 'finish',
) {
  finishNotice.textContent = title
  finishSubtitle.textContent = subtitle
  finishCelebration.classList.toggle(
    'finish-celebration--superboost',
    variant === 'superboost',
  )
}

function createFinishParticleNodes() {
  const particles = []

  for (let index = 0; index < 28; index += 1) {
    const particle = document.createElement('span')
    particle.className = 'finish-particle'
    finishParticleLayer.append(particle)
    particles.push(particle)
  }

  return particles
}

function seedFinishParticles(variant = 'finish') {
  const palette =
    variant === 'superboost'
      ? ['#eff6ff', '#dbeafe', '#7dd3fc', '#38bdf8', '#60a5fa']
      : ['#fff4da', '#ffd166', '#ef4444', '#ffffff', '#ff8a65']

  finishParticleNodes.forEach((particle, index) => {
    const baseAngle = (index / finishParticleNodes.length) * Math.PI * 2
    const angle = baseAngle + randomBetween(-0.28, 0.28)
    const distance = randomBetween(90, 340)
    const lift = randomBetween(50, 180)
    const width = randomBetween(6, 16)
    const height = randomBetween(6, 24)
    const offsetX = Math.cos(angle) * distance
    const offsetY = Math.sin(angle) * distance * 0.62 - lift
    const rotation = randomBetween(-220, 220)
    const duration = randomBetween(0.9, 1.45)
    const delay = randomBetween(0, 0.18)
    const radius = Math.random() > 0.55 ? '999px' : '4px'
    const color = palette[Math.floor(Math.random() * palette.length)]

    particle.style.setProperty('--finish-particle-width', `${width.toFixed(1)}px`)
    particle.style.setProperty('--finish-particle-height', `${height.toFixed(1)}px`)
    particle.style.setProperty('--finish-particle-radius', radius)
    particle.style.setProperty('--finish-particle-color', color)
    particle.style.setProperty('--finish-particle-x', `${offsetX.toFixed(1)}px`)
    particle.style.setProperty('--finish-particle-y', `${offsetY.toFixed(1)}px`)
    particle.style.setProperty('--finish-particle-rotation', `${rotation.toFixed(1)}deg`)
    particle.style.setProperty('--finish-particle-duration', `${duration.toFixed(2)}s`)
    particle.style.setProperty('--finish-particle-delay', `${delay.toFixed(2)}s`)
  })
}

function showCelebration({
  title,
  subtitle,
  duration,
  variant = 'finish',
} = {}) {
  raceState.finishTimer = duration
  setFinishCelebrationContent(title, subtitle, variant)
  seedFinishParticles(variant)
  finishCelebration.classList.remove('is-visible', 'is-bursting')
  void finishCelebration.offsetWidth
  finishCelebration.classList.add('is-visible', 'is-bursting')
}

function triggerFinishCelebration() {
  completeCurrentLap()
  showCelebration({
    title: 'FINISHED',
    subtitle: 'Lap Complete',
    duration: FINISH_NOTICE_DURATION,
    variant: 'finish',
  })
}

function triggerSuperboostCelebration() {
  showCelebration({
    title: 'SUPERBOOST',
    subtitle: `${CAR_SUPERBOOST_SPEED_KMH} km/h`,
    duration: SUPERBOOST_NOTICE_DURATION,
    variant: 'superboost',
  })
}

function createBoostFlameTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128

  const context = canvas.getContext('2d')
  if (!context) return null

  context.clearRect(0, 0, canvas.width, canvas.height)

  const outerGlow = context.createRadialGradient(64, 64, 6, 64, 64, 54)
  outerGlow.addColorStop(0, 'rgba(255, 255, 255, 1)')
  outerGlow.addColorStop(0.2, 'rgba(255, 248, 196, 0.98)')
  outerGlow.addColorStop(0.45, 'rgba(255, 200, 64, 0.82)')
  outerGlow.addColorStop(0.72, 'rgba(255, 104, 24, 0.32)')
  outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
  context.fillStyle = outerGlow
  context.fillRect(0, 0, canvas.width, canvas.height)

  const coreGlow = context.createRadialGradient(64, 64, 2, 64, 64, 20)
  coreGlow.addColorStop(0, 'rgba(255, 255, 255, 0.96)')
  coreGlow.addColorStop(0.55, 'rgba(255, 246, 220, 0.84)')
  coreGlow.addColorStop(1, 'rgba(255, 246, 220, 0)')
  context.fillStyle = coreGlow
  context.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter

  return texture
}

function createBoostParticleSystem() {
  const positions = new Float32Array(BOOST_PARTICLE_COUNT * 3)
  const colors = new Float32Array(BOOST_PARTICLE_COUNT * 3)
  positions.fill(10_000)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  boostFlameTexture ??= createBoostFlameTexture()
  const material = new THREE.PointsMaterial({
    size: BOOST_PARTICLE_SIZE,
    vertexColors: true,
    map: boostFlameTexture,
    alphaMap: boostFlameTexture,
    transparent: true,
    opacity: 1,
    alphaTest: 0.02,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })

  boostState.positions = positions
  boostState.colors = colors

  const particles = new THREE.Points(geometry, material)
  particles.frustumCulled = false
  particles.visible = false

  resetBoostParticles()

  return particles
}

function resetBoostParticles() {
  boostState.active = false
  boostState.visualIntensity = 0
  boostState.emitAccumulator = 0
  boostState.nextParticleIndex = 0
  boostState.lifetimes.fill(0)
  boostState.maxLifetimes.fill(0)
  boostState.velocities.forEach((velocity) => velocity.set(0, 0, 0))
  boostState.baseColors.forEach((color) => color.setRGB(0, 0, 0))

  if (!boostState.positions || !boostState.colors) {
    return
  }

  boostState.positions.fill(10_000)
  boostState.colors.fill(0)

  if (!boostParticleSystem) return

  boostParticleSystem.visible = false
  boostParticleSystem.geometry.attributes.position.needsUpdate = true
  boostParticleSystem.geometry.attributes.color.needsUpdate = true
}

function getBoostExhaustWorldPosition(target) {
  target
    .set(
      BOOST_EXHAUST_LOCAL_X * CAR_SCALE,
      BOOST_EXHAUST_LOCAL_Y * CAR_SCALE,
      BOOST_EXHAUST_LOCAL_Z * CAR_SCALE,
    )
    .applyQuaternion(renderState.quaternion)
    .add(renderState.position)

  return target
}

function spawnBoostParticle() {
  if (!boostState.positions || !boostState.colors) return

  const particleIndex = boostState.nextParticleIndex
  const attributeIndex = particleIndex * 3
  const velocity = boostState.velocities[particleIndex]
  const baseColor = boostState.baseColors[particleIndex]
  const paletteChoice = Math.random()

  getBoostExhaustWorldPosition(tempBoostWheelPosition)
  boostState.positions[attributeIndex] = tempBoostWheelPosition.x
  boostState.positions[attributeIndex + 1] = tempBoostWheelPosition.y
  boostState.positions[attributeIndex + 2] = tempBoostWheelPosition.z

  tempBoostForward.set(0, 0, 1).applyQuaternion(renderState.quaternion).normalize()
  tempBoostRight.set(1, 0, 0).applyQuaternion(renderState.quaternion).normalize()
  tempBoostUp.set(0, 1, 0).applyQuaternion(renderState.quaternion).normalize()

  velocity.copy(tempBoostForward).multiplyScalar(-randomBetween(7.2, 11.6))
  velocity.addScaledVector(tempBoostRight, randomBetween(-0.18, 0.18))
  velocity.addScaledVector(tempBoostUp, randomBetween(-0.05, 0.05))

  const lifetime = randomBetween(
    BOOST_PARTICLE_MIN_LIFETIME,
    BOOST_PARTICLE_MAX_LIFETIME,
  )
  boostState.lifetimes[particleIndex] = lifetime
  boostState.maxLifetimes[particleIndex] = lifetime

  if (paletteChoice > 0.72) {
    baseColor.setRGB(1, 0.98, 0.86)
  } else if (paletteChoice > 0.34) {
    baseColor.setRGB(1, 0.78, 0.2)
  } else {
    baseColor.setRGB(1, 0.46, 0.06)
  }

  boostState.colors[attributeIndex] = baseColor.r
  boostState.colors[attributeIndex + 1] = baseColor.g
  boostState.colors[attributeIndex + 2] = baseColor.b
  boostState.nextParticleIndex =
    (boostState.nextParticleIndex + 1) % BOOST_PARTICLE_COUNT
}

function updateBoostParticles(delta) {
  if (!boostParticleSystem || !boostState.positions || !boostState.colors) return

  const boostEnabled =
    isBoostActive() && Math.abs(carState.speed) > BOOST_PARTICLE_MIN_SPEED
  const forwardTopSpeed = getCurrentForwardTopSpeed()
  const speedRatio = THREE.MathUtils.clamp(
    THREE.MathUtils.inverseLerp(
      CAR_TOP_SPEED * 0.55,
      forwardTopSpeed,
      Math.abs(carState.speed),
    ),
    0,
    1,
  )
  let hasVisibleParticles = false

  boostState.active = boostEnabled
  boostState.visualIntensity = damp(
    boostState.visualIntensity,
    boostEnabled ? 1 : 0,
    boostEnabled ? 14 : 8,
    delta,
  )

  if (boostEnabled) {
    boostState.emitAccumulator +=
      BOOST_PARTICLE_SPAWN_RATE *
      (0.55 + speedRatio * 0.95) *
      boostState.visualIntensity *
      delta

    while (boostState.emitAccumulator >= 1) {
      spawnBoostParticle()
      boostState.emitAccumulator -= 1
    }
  } else {
    boostState.emitAccumulator = 0
  }

  for (let particleIndex = 0; particleIndex < BOOST_PARTICLE_COUNT; particleIndex += 1) {
    const remainingLife = boostState.lifetimes[particleIndex]
    if (remainingLife <= 0) {
      continue
    }

    const nextLife = Math.max(remainingLife - delta, 0)
    const attributeIndex = particleIndex * 3
    const velocity = boostState.velocities[particleIndex]

    boostState.lifetimes[particleIndex] = nextLife

    if (nextLife <= 0) {
      boostState.positions[attributeIndex] = 10_000
      boostState.positions[attributeIndex + 1] = 10_000
      boostState.positions[attributeIndex + 2] = 10_000
      boostState.colors[attributeIndex] = 0
      boostState.colors[attributeIndex + 1] = 0
      boostState.colors[attributeIndex + 2] = 0
      velocity.set(0, 0, 0)
      continue
    }

    const lifeRatio = nextLife / Math.max(boostState.maxLifetimes[particleIndex], 0.001)
    const glow = Math.pow(lifeRatio, 0.55)
    const coolAmount = Math.min((1 - lifeRatio) * 0.85, 1)
    const baseColor = boostState.baseColors[particleIndex]

    velocity.multiplyScalar(Math.exp(-BOOST_PARTICLE_DRAG * delta))
    velocity.y -= BOOST_PARTICLE_GRAVITY * delta

    boostState.positions[attributeIndex] += velocity.x * delta
    boostState.positions[attributeIndex + 1] += velocity.y * delta
    boostState.positions[attributeIndex + 2] += velocity.z * delta

    tempBoostColor
      .copy(baseColor)
      .lerp(BOOST_FLAME_COOLED_COLOR, coolAmount)
      .multiplyScalar(0.45 + glow * 1.02)

    boostState.colors[attributeIndex] = tempBoostColor.r
    boostState.colors[attributeIndex + 1] = tempBoostColor.g
    boostState.colors[attributeIndex + 2] = tempBoostColor.b

    hasVisibleParticles = true
  }

  boostParticleSystem.visible = hasVisibleParticles
  boostParticleSystem.geometry.attributes.position.needsUpdate = true
  boostParticleSystem.geometry.attributes.color.needsUpdate = true
}

function formatLapTime(totalSeconds) {
  const totalMilliseconds = Math.max(0, Math.round(totalSeconds * 1000))
  const minutes = Math.floor(totalMilliseconds / 60000)
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000)
  const milliseconds = totalMilliseconds % 1000

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(
    milliseconds,
  ).padStart(3, '0')}`
}

function createLapTimerEntry(lapNumber) {
  const card = document.createElement('div')
  card.className = 'lap-timer is-active'
  card.setAttribute('aria-atomic', 'true')

  const header = document.createElement('div')
  header.className = 'lap-timer-header'

  const label = document.createElement('span')
  label.className = 'speedometer-label'
  label.textContent = `Lap ${lapNumber}`

  const status = document.createElement('span')
  status.className = 'lap-timer-status'

  const readout = document.createElement('div')
  readout.className = 'lap-timer-readout'

  const value = document.createElement('span')
  value.className = 'lap-timer-value'

  header.append(label, status)
  readout.append(value)
  card.append(header, readout)

  return {
    lapNumber,
    elapsed: 0,
    completed: false,
    isRecord: false,
    node: card,
    statusNode: status,
    valueNode: value,
  }
}

function syncLapTimerEntry(entry) {
  entry.statusNode.textContent = entry.isRecord
    ? 'Record'
    : entry.completed
      ? 'Finished'
      : 'Current'
  entry.valueNode.textContent = formatLapTime(entry.elapsed)
  entry.node.classList.toggle('is-active', !entry.completed)
  entry.node.classList.toggle('is-complete', entry.completed)
  entry.node.classList.toggle('is-record', entry.isRecord)
}

function refreshLapTimerRecordState() {
  let fastestCompletedEntry = null

  for (const entry of raceState.laps) {
    if (!entry.completed) continue

    if (!fastestCompletedEntry || entry.elapsed < fastestCompletedEntry.elapsed) {
      fastestCompletedEntry = entry
    }
  }

  for (const entry of raceState.laps) {
    entry.isRecord = entry === fastestCompletedEntry
    syncLapTimerEntry(entry)
  }
}

function trimLapTimerEntries() {
  while (raceState.laps.length > MAX_VISIBLE_LAP_TIMERS) {
    let slowestLapIndex = -1

    for (let index = 0; index < raceState.laps.length; index += 1) {
      const entry = raceState.laps[index]

      if (!entry.completed) continue

      if (
        slowestLapIndex === -1 ||
        entry.elapsed > raceState.laps[slowestLapIndex].elapsed
      ) {
        slowestLapIndex = index
      }
    }

    const removalIndex = slowestLapIndex === -1 ? 0 : slowestLapIndex
    const [removedEntry] = raceState.laps.splice(removalIndex, 1)
    removedEntry.node.remove()
  }

  refreshLapTimerRecordState()
}

function appendLapTimerEntry() {
  const entry = createLapTimerEntry(raceState.nextLapNumber)
  raceState.nextLapNumber += 1
  raceState.laps.push(entry)
  lapTimers.append(entry.node)
  trimLapTimerEntries()
  return entry
}

function getCurrentLapEntry() {
  for (let index = raceState.laps.length - 1; index >= 0; index -= 1) {
    if (!raceState.laps[index].completed) {
      return raceState.laps[index]
    }
  }

  return null
}

function resetLapTimers() {
  raceState.laps = []
  raceState.nextLapNumber = 1
  lapTimers.replaceChildren()
  appendLapTimerEntry()
}

function completeCurrentLap() {
  const currentLapEntry = getCurrentLapEntry()

  if (!currentLapEntry) return

  currentLapEntry.completed = true
  syncLapTimerEntry(currentLapEntry)
  appendLapTimerEntry()
}

function advanceLapTimer(delta) {
  if (raceState.mode !== 'racing') return

  const currentLapEntry = getCurrentLapEntry()

  if (!currentLapEntry) return

  currentLapEntry.elapsed += delta
  syncLapTimerEntry(currentLapEntry)
}

function createTrackData() {
  const planControlPoints = [
    new THREE.Vector3(40, 0, 2),
    new THREE.Vector3(44, 0, 14),
    new THREE.Vector3(40, 0, 28),
    new THREE.Vector3(26, 0, 36),
    new THREE.Vector3(10, 0, 36),
    new THREE.Vector3(-2, 0, 28),
    new THREE.Vector3(-16, 0, 34),
    new THREE.Vector3(-30, 0, 30),
    new THREE.Vector3(-42, 0, 18),
    new THREE.Vector3(-46, 0, 4),
    new THREE.Vector3(-44, 0, -10),
    new THREE.Vector3(-34, 0, -18),
    new THREE.Vector3(-20, 0, -18),
    new THREE.Vector3(-8, 0, -14),
    new THREE.Vector3(2, 0, -8),
    new THREE.Vector3(12, 0, -12),
    new THREE.Vector3(24, 0, -18),
    new THREE.Vector3(36, 0, -20),
    new THREE.Vector3(44, 0, -28),
    new THREE.Vector3(46, 0, -42),
    new THREE.Vector3(32, 0, -54),
    new THREE.Vector3(10, 0, -58),
    new THREE.Vector3(-12, 0, -56),
    new THREE.Vector3(-30, 0, -48),
    new THREE.Vector3(-42, 0, -36),
    new THREE.Vector3(-46, 0, -20),
  ]

  const planCurve = new THREE.CatmullRomCurve3(
    planControlPoints,
    true,
    'centripetal',
  )
  const samples = []

  for (let index = 0; index < TRACK_SAMPLE_COUNT; index += 1) {
    const t = index / TRACK_SAMPLE_COUNT
    const angle = t * Math.PI * 2
    const point = planCurve.getPointAt(t)
    point.y =
      TRACK_BASE_Y +
      TRACK_HEIGHT_OFFSET +
      Math.sin(angle - 0.4) * TRACK_HEIGHT_WAVE_1 +
      Math.sin(angle * 2 + 0.85) * TRACK_HEIGHT_WAVE_2 +
      Math.cos(angle * 3 - 0.22) * TRACK_HEIGHT_WAVE_3
    const flatTangent = planCurve.getTangentAt(t)
    flatTangent.y = 0

    if (flatTangent.lengthSq() < 0.0001) {
      if (samples.length > 0) {
        flatTangent.copy(samples[samples.length - 1].flatTangent)
      } else {
        flatTangent.set(0, 0, 1)
      }
    } else {
      flatTangent.normalize()
    }

    const side = new THREE.Vector3(flatTangent.z, 0, -flatTangent.x)
    samples.push({
      t,
      point,
      tangent: new THREE.Vector3(),
      flatTangent,
      side,
      turnStrength: 0,
    })
  }

  for (let index = 0; index < samples.length; index += 1) {
    const previousSample = samples[(index - 1 + samples.length) % samples.length]
    const nextSample = samples[(index + 1) % samples.length]
    samples[index].tangent = nextSample.point
      .clone()
      .sub(previousSample.point)
      .normalize()

    const previous = samples[(index - 1 + samples.length) % samples.length].flatTangent
    const next = samples[(index + 1) % samples.length].flatTangent
    const headingDelta = Math.acos(
      THREE.MathUtils.clamp(previous.dot(next), -1, 1),
    )
    samples[index].turnStrength = Math.min(headingDelta / 0.44, 1)
  }

  return {
    curve: planCurve,
    samples,
  }
}

function getTrackBounds2D() {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (const sample of TRACK_DATA.samples) {
    minX = Math.min(minX, sample.point.x)
    maxX = Math.max(maxX, sample.point.x)
    minZ = Math.min(minZ, sample.point.z)
    maxZ = Math.max(maxZ, sample.point.z)
  }

  return { minX, maxX, minZ, maxZ }
}

function addQuad(positions, a, b, c, d) {
  positions.push(
    a.x, a.y, a.z,
    b.x, b.y, b.z,
    c.x, c.y, c.z,
    a.x, a.y, a.z,
    c.x, c.y, c.z,
    d.x, d.y, d.z,
  )
}

function addColoredQuad(positions, colors, a, b, c, d, color) {
  addQuad(positions, a, b, c, d)

  for (let index = 0; index < 6; index += 1) {
    colors.push(color.r, color.g, color.b)
  }
}

function createTrackRibbonGeometry(halfWidth, thickness, verticalOffset = 0) {
  const positions = []

  for (let index = 0; index < TRACK_DATA.samples.length; index += 1) {
    const current = TRACK_DATA.samples[index]
    const next = TRACK_DATA.samples[(index + 1) % TRACK_DATA.samples.length]

    const currentLeftTop = current.point
      .clone()
      .addScaledVector(current.side, -halfWidth)
    currentLeftTop.y += verticalOffset

    const currentRightTop = current.point
      .clone()
      .addScaledVector(current.side, halfWidth)
    currentRightTop.y += verticalOffset

    const nextLeftTop = next.point.clone().addScaledVector(next.side, -halfWidth)
    nextLeftTop.y += verticalOffset

    const nextRightTop = next.point.clone().addScaledVector(next.side, halfWidth)
    nextRightTop.y += verticalOffset

    const currentLeftBottom = currentLeftTop.clone()
    currentLeftBottom.y -= thickness

    const currentRightBottom = currentRightTop.clone()
    currentRightBottom.y -= thickness

    const nextLeftBottom = nextLeftTop.clone()
    nextLeftBottom.y -= thickness

    const nextRightBottom = nextRightTop.clone()
    nextRightBottom.y -= thickness

    addQuad(
      positions,
      currentLeftTop,
      currentRightTop,
      nextRightTop,
      nextLeftTop,
    )
    addQuad(
      positions,
      currentLeftBottom,
      currentLeftTop,
      nextLeftTop,
      nextLeftBottom,
    )
    addQuad(
      positions,
      currentRightTop,
      currentRightBottom,
      nextRightBottom,
      nextRightTop,
    )
    addQuad(
      positions,
      currentRightBottom,
      currentLeftBottom,
      nextLeftBottom,
      nextRightBottom,
    )
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.computeVertexNormals()
  return geometry
}

function createTrackSurfaceColliderData(halfWidth) {
  const positions = []
  const indices = []
  let vertexIndex = 0

  for (let index = 0; index < TRACK_DATA.samples.length; index += 1) {
    const current = TRACK_DATA.samples[index]
    const next = TRACK_DATA.samples[(index + 1) % TRACK_DATA.samples.length]

    const currentLeft = current.point
      .clone()
      .addScaledVector(current.side, -halfWidth)
    const currentRight = current.point
      .clone()
      .addScaledVector(current.side, halfWidth)
    const nextLeft = next.point.clone().addScaledVector(next.side, -halfWidth)
    const nextRight = next.point.clone().addScaledVector(next.side, halfWidth)

    positions.push(
      currentLeft.x, currentLeft.y, currentLeft.z,
      currentRight.x, currentRight.y, currentRight.z,
      nextRight.x, nextRight.y, nextRight.z,
      nextLeft.x, nextLeft.y, nextLeft.z,
    )

    // Front face.
    indices.push(
      vertexIndex,
      vertexIndex + 1,
      vertexIndex + 2,
      vertexIndex,
      vertexIndex + 2,
      vertexIndex + 3,
    )

    // Back face so wheel rays still hit even if triangle winding is unfavorable.
    indices.push(
      vertexIndex + 2,
      vertexIndex + 1,
      vertexIndex,
      vertexIndex + 3,
      vertexIndex + 2,
      vertexIndex,
    )

    vertexIndex += 4
  }

  return {
    vertices: new Float32Array(positions),
    indices: new Uint32Array(indices),
  }
}

function createTrackLine(offset, color) {
  const points = TRACK_DATA.samples.map((sample) => {
    const point = sample.point.clone().addScaledVector(sample.side, offset)
    point.y += 0.03
    return point
  })
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({ color })

  return new THREE.LineLoop(geometry, material)
}

function createTrackStripeGeometry(
  offset,
  width,
  verticalOffset = TRACK_PAINT_LAYER_OFFSET,
) {
  const positions = []
  const uvs = []
  const sampleDistances = [0]
  let totalDistance = 0

  for (let index = 0; index < TRACK_DATA.samples.length; index += 1) {
    const current = TRACK_DATA.samples[index]
    const next = TRACK_DATA.samples[(index + 1) % TRACK_DATA.samples.length]
    totalDistance += current.point.distanceTo(next.point)
    sampleDistances.push(totalDistance)
  }

  const normalizedDistances = sampleDistances.map((distance) =>
    totalDistance > 0 ? distance / totalDistance : 0,
  )

  for (let index = 0; index < TRACK_DATA.samples.length; index += 1) {
    const current = TRACK_DATA.samples[index]
    const next = TRACK_DATA.samples[(index + 1) % TRACK_DATA.samples.length]
    const currentInner = current.point
      .clone()
      .addScaledVector(current.side, offset - width / 2)
    currentInner.y += verticalOffset

    const currentOuter = current.point
      .clone()
      .addScaledVector(current.side, offset + width / 2)
    currentOuter.y += verticalOffset

    const nextInner = next.point
      .clone()
      .addScaledVector(next.side, offset - width / 2)
    nextInner.y += verticalOffset

    const nextOuter = next.point
      .clone()
      .addScaledVector(next.side, offset + width / 2)
    nextOuter.y += verticalOffset

    addQuad(
      positions,
      currentInner,
      currentOuter,
      nextOuter,
      nextInner,
    )

    const currentU = normalizedDistances[index]
    const nextU = normalizedDistances[index + 1]
    uvs.push(
      currentU, 0,
      currentU, 1,
      nextU, 1,
      currentU, 0,
      nextU, 1,
      nextU, 0,
    )
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}

function createSeededRandom(seed) {
  let currentSeed = seed >>> 0
  return () => {
    currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0
    return currentSeed / 4294967296
  }
}

function createTrackPaintStripeTexture(
  seed,
  {
    colors,
    dirtColor,
    repeat,
    speckleCount,
    smearCount,
    wearCount,
    speckleAlphaRange,
    smearAlphaRange,
    wearAlphaRange,
  },
) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 128
  const context = canvas.getContext('2d')
  const random = createSeededRandom(seed)
  const stripeSafeTop = canvas.height * 0.16
  const stripeSafeBottom = canvas.height * 0.84
  const stripeSafeHeight = stripeSafeBottom - stripeSafeTop

  context.clearRect(0, 0, canvas.width, canvas.height)

  const baseGradient = context.createLinearGradient(0, 0, 0, canvas.height)
  for (const [stop, color] of colors) {
    baseGradient.addColorStop(stop, color)
  }
  context.fillStyle = baseGradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  for (let index = 0; index < speckleCount; index += 1) {
    const x = random() * canvas.width
    const y = random() * canvas.height
    const size = 1 + random() * 2.6
    const alpha =
      speckleAlphaRange[0] + random() * (speckleAlphaRange[1] - speckleAlphaRange[0])
    context.fillStyle =
      random() > 0.6
        ? `${dirtColor(alpha * 0.55)}`
        : `rgba(255, 255, 255, ${alpha})`
    context.beginPath()
    context.arc(x, y, size, 0, Math.PI * 2)
    context.fill()
  }

  for (let index = 0; index < smearCount; index += 1) {
    const smearWidth = 24 + random() * 84
    const smearHeight = 8 + random() * 22
    const x = random() * (canvas.width - smearWidth)
    const y = stripeSafeTop + random() * stripeSafeHeight - smearHeight / 2
    const alpha =
      smearAlphaRange[0] + random() * (smearAlphaRange[1] - smearAlphaRange[0])
    context.fillStyle = dirtColor(alpha)
    context.fillRect(x, y, smearWidth, smearHeight)
  }

  context.globalCompositeOperation = 'destination-out'
  for (let index = 0; index < wearCount; index += 1) {
    const wearWidth = 12 + random() * 34
    const wearHeight = 6 + random() * 14
    const centerX = random() * canvas.width
    const centerY = stripeSafeTop + random() * stripeSafeHeight
    const wearGradient = context.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      Math.max(wearWidth, wearHeight),
    )
    const wearCoreAlpha =
      wearAlphaRange[0] + random() * (wearAlphaRange[1] - wearAlphaRange[0])
    wearGradient.addColorStop(0, `rgba(0, 0, 0, ${wearCoreAlpha})`)
    wearGradient.addColorStop(0.55, `rgba(0, 0, 0, ${wearCoreAlpha * 0.35})`)
    wearGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = wearGradient
    context.beginPath()
    context.ellipse(centerX, centerY, wearWidth, wearHeight, random(), 0, Math.PI * 2)
    context.fill()
  }
  context.globalCompositeOperation = 'source-over'

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.repeat.set(repeat, 1)
  texture.anisotropy = renderer?.capabilities.getMaxAnisotropy?.() ?? 1
  return texture
}

function createTrackEdgeStripeTexture(seed) {
  return createTrackPaintStripeTexture(seed, {
    colors: [
      [0, 'rgba(232, 236, 238, 0)'],
      [0.12, 'rgba(248, 250, 252, 0.82)'],
      [0.25, 'rgba(250, 252, 253, 0.96)'],
      [0.5, 'rgba(255, 255, 255, 0.98)'],
      [0.75, 'rgba(248, 250, 252, 0.96)'],
      [0.88, 'rgba(248, 250, 252, 0.82)'],
      [1, 'rgba(232, 236, 238, 0)'],
    ],
    dirtColor: (alpha) => `rgba(132, 103, 71, ${alpha})`,
    repeat: TRACK_EDGE_STRIPE_REPEAT,
    speckleCount: 1100,
    smearCount: 24,
    wearCount: 18,
    speckleAlphaRange: [0.015, 0.055],
    smearAlphaRange: [0.05, 0.12],
    wearAlphaRange: [0.035, 0.08],
  })
}

function createTrackEdgeStripe(offset) {
  const texture = createTrackEdgeStripeTexture(offset < 0 ? 17 : 43)
  return new THREE.Mesh(
    createTrackStripeGeometry(offset, TRACK_EDGE_STRIPE_WIDTH),
    new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.08,
      metalness: 0,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.DoubleSide,
    }),
  )
}

function createTrackCenterStripeTexture() {
  return createTrackPaintStripeTexture(91, {
    colors: [
      [0, 'rgba(180, 83, 9, 0)'],
      [0.14, 'rgba(229, 112, 18, 0.8)'],
      [0.28, 'rgba(245, 136, 32, 0.94)'],
      [0.5, 'rgba(251, 146, 60, 0.98)'],
      [0.72, 'rgba(245, 136, 32, 0.94)'],
      [0.86, 'rgba(229, 112, 18, 0.8)'],
      [1, 'rgba(180, 83, 9, 0)'],
    ],
    dirtColor: (alpha) => `rgba(118, 79, 36, ${alpha})`,
    repeat: TRACK_CENTER_STRIPE_REPEAT,
    speckleCount: 680,
    smearCount: 16,
    wearCount: 12,
    speckleAlphaRange: [0.012, 0.038],
    smearAlphaRange: [0.035, 0.08],
    wearAlphaRange: [0.02, 0.05],
  })
}

function createTrackCenterStripe() {
  const texture = createTrackCenterStripeTexture()
  return new THREE.Mesh(
    createTrackStripeGeometry(0, TRACK_CENTER_STRIPE_WIDTH),
    new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.08,
      metalness: 0,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.DoubleSide,
    }),
  )
}

function createTrackSkidTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 256
  const context = canvas.getContext('2d')
  const random = createSeededRandom(137)

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.lineCap = 'round'
  context.lineJoin = 'round'

  for (let clusterIndex = 0; clusterIndex < 26; clusterIndex += 1) {
    const startX = random() * (canvas.width - 240)
    const centerY = canvas.height * (0.18 + random() * 0.64)
    const length = 70 + random() * 220
    const curve = (random() - 0.5) * 42
    const pairGap = 10 + random() * 12
    const lineWidth = 2.2 + random() * 3.6
    const alpha = 0.045 + random() * 0.06

    for (const side of [-1, 1]) {
      const lateralOffset = side * pairGap * 0.5
      context.strokeStyle = `rgba(22, 24, 28, ${alpha})`
      context.lineWidth = lineWidth
      context.shadowBlur = 5
      context.shadowColor = `rgba(12, 14, 18, ${alpha * 0.55})`
      context.beginPath()
      context.moveTo(startX, centerY + lateralOffset)
      context.bezierCurveTo(
        startX + length * 0.28,
        centerY + lateralOffset + curve * 0.2,
        startX + length * 0.72,
        centerY + lateralOffset + curve * 0.8,
        startX + length,
        centerY + lateralOffset + curve,
      )
      context.stroke()

      if (random() > 0.45) {
        const patchStart = startX + length * (0.15 + random() * 0.45)
        const patchLength = 18 + random() * 54
        context.lineWidth = Math.max(1.6, lineWidth - 0.7)
        context.strokeStyle = `rgba(18, 20, 24, ${alpha * 1.15})`
        context.beginPath()
        context.moveTo(patchStart, centerY + lateralOffset + curve * 0.25)
        context.lineTo(
          patchStart + patchLength,
          centerY + lateralOffset + curve * (0.35 + random() * 0.25),
        )
        context.stroke()
      }
    }
  }

  context.shadowBlur = 0

  for (let streakIndex = 0; streakIndex < 36; streakIndex += 1) {
    const x = random() * canvas.width
    const y = canvas.height * (0.16 + random() * 0.68)
    const width = 20 + random() * 120
    const height = 4 + random() * 10
    const gradient = context.createLinearGradient(x, y, x + width, y)
    const alpha = 0.015 + random() * 0.03
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
    gradient.addColorStop(0.3, `rgba(22, 24, 28, ${alpha})`)
    gradient.addColorStop(0.7, `rgba(22, 24, 28, ${alpha * 0.9})`)
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = gradient
    context.fillRect(x, y, width, height)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.repeat.set(TRACK_SKID_TEXTURE_REPEAT, 1)
  texture.anisotropy = renderer?.capabilities.getMaxAnisotropy?.() ?? 1
  return texture
}

function createTrackSkidLayer() {
  return new THREE.Mesh(
    createTrackStripeGeometry(
      0,
      TRACK_HALF_WIDTH * 2 - TRACK_SKID_LAYER_INSET * 2,
      TRACK_SKID_LAYER_OFFSET,
    ),
    new THREE.MeshStandardMaterial({
      map: createTrackSkidTexture(),
      transparent: true,
      depthWrite: false,
      metalness: 0,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  )
}

function createGuardrailGeometry(
  sideSign,
  {
    offset = GUARDRAIL_OFFSET,
    thickness = GUARDRAIL_THICKNESS,
    height = GUARDRAIL_HEIGHT,
    baseLift = GUARDRAIL_BASE_LIFT,
  } = {},
) {
  const positions = []
  const colors = []
  const stripeColorA = new THREE.Color(0xf8fafc)
  const stripeColorB = new THREE.Color(0xd72f2f)
  const isRightGuardrail = sideSign > 0

  for (let index = 0; index < TRACK_DATA.samples.length; index += 1) {
    const current = TRACK_DATA.samples[index]
    const next = TRACK_DATA.samples[(index + 1) % TRACK_DATA.samples.length]
    const stripeColor = Math.floor(index / 10) % 2 === 0 ? stripeColorA : stripeColorB

    const currentInner = current.point
      .clone()
      .addScaledVector(current.side, sideSign * offset)
    currentInner.y += baseLift

    const currentOuter = current.point
      .clone()
      .addScaledVector(
        current.side,
        sideSign * (offset + thickness),
      )
    currentOuter.y += baseLift

    const nextInner = next.point
      .clone()
      .addScaledVector(next.side, sideSign * offset)
    nextInner.y += baseLift

    const nextOuter = next.point
      .clone()
      .addScaledVector(
        next.side,
        sideSign * (offset + thickness),
      )
    nextOuter.y += baseLift

    const currentInnerTop = currentInner.clone()
    currentInnerTop.y += height

    const currentOuterTop = currentOuter.clone()
    currentOuterTop.y += height

    const nextInnerTop = nextInner.clone()
    nextInnerTop.y += height

    const nextOuterTop = nextOuter.clone()
    nextOuterTop.y += height

    if (isRightGuardrail) {
      addColoredQuad(
        positions,
        colors,
        currentInnerTop,
        currentInner,
        nextInner,
        nextInnerTop,
        stripeColor,
      )
      addColoredQuad(
        positions,
        colors,
        currentOuter,
        currentOuterTop,
        nextOuterTop,
        nextOuter,
        stripeColor,
      )
      addColoredQuad(
        positions,
        colors,
        currentOuterTop,
        currentInnerTop,
        nextInnerTop,
        nextOuterTop,
        stripeColor,
      )
    } else {
      addColoredQuad(
        positions,
        colors,
        currentInner,
        currentInnerTop,
        nextInnerTop,
        nextInner,
        stripeColor,
      )
      addColoredQuad(
        positions,
        colors,
        currentOuterTop,
        currentOuter,
        nextOuter,
        nextOuterTop,
        stripeColor,
      )
      addColoredQuad(
        positions,
        colors,
        currentInnerTop,
        currentOuterTop,
        nextOuterTop,
        nextInnerTop,
        stripeColor,
      )
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(colors, 3),
  )
  geometry.computeVertexNormals()
  return geometry
}

function createFinishLineTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const context = canvas.getContext('2d')

  for (let x = 0; x < canvas.width; x += 32) {
    for (let y = 0; y < canvas.height; y += 32) {
      const isDark = (x / 32 + y / 32) % 2 === 0
      context.fillStyle = isDark ? '#0f172a' : '#f8fafc'
      context.fillRect(x, y, 32, 32)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 1)
  return texture
}

function createFinishBannerTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const context = canvas.getContext('2d')

  context.fillStyle = '#f8fafc'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#d72f2f'
  context.fillRect(0, 0, canvas.width, 16)
  context.fillRect(0, canvas.height - 16, canvas.width, 16)

  for (let x = 0; x < canvas.width; x += 64) {
    context.fillStyle = (x / 64) % 2 === 0 ? '#111827' : '#f8fafc'
    context.fillRect(x, 0, 32, 16)
    context.fillRect(x, canvas.height - 16, 32, 16)
  }

  context.fillStyle = '#111827'
  context.font = 'bold 66px Arial'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('FINISH', canvas.width / 2, canvas.height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createFinishLineGroup() {
  const finishSample = TRACK_DATA.samples[TRACK_START_INDEX]
  const heading = Math.atan2(
    finishSample.flatTangent.x,
    finishSample.flatTangent.z,
  )
  const group = new THREE.Group()
  group.position.copy(finishSample.point)
  group.rotation.y = heading

  const lineTexture = createFinishLineTexture()
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK_HALF_WIDTH * 2 - 0.08, FINISH_LINE_HALF_DEPTH * 2),
    new THREE.MeshStandardMaterial({
      map: lineTexture,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  )
  line.rotation.x = -Math.PI / 2
  line.position.y = FINISH_LINE_SURFACE_OFFSET
  group.add(line)

  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x5b6470,
    metalness: 0.75,
    roughness: 0.38,
  })
  const bannerOffset = GUARDRAIL_OFFSET + 0.8

  const leftPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, FINISH_LINE_POST_HEIGHT, 10),
    postMaterial,
  )
  leftPost.position.set(-bannerOffset, FINISH_LINE_POST_HEIGHT / 2, 0)
  group.add(leftPost)

  const rightPost = leftPost.clone()
  rightPost.position.x = bannerOffset
  group.add(rightPost)

  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(bannerOffset * 2 + 0.28, 0.12, 0.12),
    postMaterial,
  )
  crossbar.position.y = FINISH_LINE_POST_HEIGHT
  group.add(crossbar)

  const bannerTexture = createFinishBannerTexture()
  const bannerGeometry = new THREE.PlaneGeometry(bannerOffset * 2 - 0.4, 0.95)
  const bannerMaterial = new THREE.MeshStandardMaterial({
    map: bannerTexture,
    side: THREE.FrontSide,
    transparent: true,
  })
  const bannerDepthOffset = -0.12
  const bannerFront = new THREE.Mesh(bannerGeometry, bannerMaterial)
  bannerFront.position.set(0, FINISH_LINE_BANNER_HEIGHT, bannerDepthOffset - 0.01)
  bannerFront.rotation.y = Math.PI
  group.add(bannerFront)

  const bannerBack = new THREE.Mesh(bannerGeometry, bannerMaterial)
  bannerBack.position.set(0, FINISH_LINE_BANNER_HEIGHT, bannerDepthOffset + 0.01)
  group.add(bannerBack)

  return group
}

function getCircularSampleDistance(a, b) {
  const totalSamples = TRACK_DATA.samples.length
  const directDistance = Math.abs(a - b)
  return Math.min(directDistance, totalSamples - directDistance)
}

function getFinishLineSignedDistance(position) {
  return position.clone().sub(CAR_START_SAMPLE.point).dot(CAR_START_SAMPLE.flatTangent)
}

function updateFinishState(previousPosition, currentPosition, currentSampleIndex) {
  if (raceState.mode !== 'racing') return

  if (!raceState.lapArmed) {
    if (
      getCircularSampleDistance(currentSampleIndex, TRACK_START_INDEX) >
      FINISH_LINE_ARM_DISTANCE
    ) {
      raceState.lapArmed = true
    }
  } else {
    const previousSignedDistance = getFinishLineSignedDistance(previousPosition)
    const currentSignedDistance = getFinishLineSignedDistance(currentPosition)
    const nearFinishLine =
      getCircularSampleDistance(currentSampleIndex, TRACK_START_INDEX) <=
      FINISH_LINE_ZONE_SAMPLES

    if (
      nearFinishLine &&
      previousSignedDistance < 0 &&
      currentSignedDistance >= 0 &&
      carState.speed > 0.8
    ) {
      triggerFinishCelebration()
      raceState.lapArmed = false
    }
  }
}

function createTracksideTreeLayout() {
  return [
    { sampleIndex: 22, side: -1, offset: 4.8, tangentOffset: -1.4, scale: 1.08 },
    { sampleIndex: 74, side: 1, offset: 5.0, tangentOffset: 1.8, scale: 0.96 },
    { sampleIndex: 128, side: -1, offset: 4.6, tangentOffset: -1.1, scale: 1.1 },
    { sampleIndex: 184, side: 1, offset: 5.2, tangentOffset: 1.0, scale: 0.92 },
    { sampleIndex: 238, side: -1, offset: 4.9, tangentOffset: -1.6, scale: 1.04 },
    { sampleIndex: 292, side: 1, offset: 5.3, tangentOffset: 0.7, scale: 0.9 },
    { sampleIndex: 346, side: -1, offset: 4.7, tangentOffset: 1.8, scale: 1.12 },
    { sampleIndex: 402, side: 1, offset: 5.1, tangentOffset: -0.9, scale: 0.94 },
    { sampleIndex: 456, side: -1, offset: 5.0, tangentOffset: 1.2, scale: 1.05 },
    { sampleIndex: 510, side: 1, offset: 4.8, tangentOffset: -1.5, scale: 0.98 },
    { sampleIndex: 566, side: -1, offset: 5.2, tangentOffset: 0.8, scale: 1.09 },
    { sampleIndex: 620, side: 1, offset: 4.9, tangentOffset: -1.7, scale: 0.9 },
    { sampleIndex: 676, side: -1, offset: 5.3, tangentOffset: 1.1, scale: 1.02 },
    { sampleIndex: 732, side: 1, offset: 4.8, tangentOffset: -0.8, scale: 1.14 },
    { sampleIndex: 788, side: -1, offset: 5.1, tangentOffset: 1.6, scale: 0.95 },
    { sampleIndex: 846, side: 1, offset: 5.0, tangentOffset: -1.2, scale: 1.06 },
  ]
}

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
    const trackFrame = getTrackFrame(point)
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

function damp(current, target, smoothing, delta) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-smoothing * delta))
}

function dampAngle(current, target, smoothing, delta) {
  const deltaAngle = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI
  return current + deltaAngle * (1 - Math.exp(-smoothing * delta))
}

function moveTowards(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target
  return current + Math.sign(target - current) * maxDelta
}

function getSpeedRatio(speed, maxSpeed = CAR_TOP_SPEED) {
  return THREE.MathUtils.clamp(Math.abs(speed) / Math.max(maxSpeed, 0.001), 0, 1)
}

function getFastMotionRatio(speed) {
  return THREE.MathUtils.smoothstep(
    getSpeedRatio(speed),
    SPEED_EFFECTS_START_RATIO,
    SPEED_EFFECTS_FULL_RATIO,
  )
}

function createNoiseBuffer(audioContext, duration = 2) {
  const frameCount = Math.max(1, Math.floor(audioContext.sampleRate * duration))
  const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate)
  const channel = buffer.getChannelData(0)
  let lastSample = 0

  for (let index = 0; index < frameCount; index += 1) {
    const whiteNoise = Math.random() * 2 - 1
    lastSample = lastSample * 0.84 + whiteNoise * 0.16
    channel[index] = lastSample
  }

  return buffer
}

function createLoopingNoiseSource(audioContext, buffer, playbackRate = 1) {
  const source = audioContext.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.playbackRate.value = playbackRate
  return source
}

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

  // Hysteresis keeps the gearbox from fluttering while throttle and slope change.
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

function triggerGuardrailImpactSound(intensity) {
  if (!audioState.context || audioState.context.state !== 'running') return
  if (!audioState.noiseBuffer) return

  const now = audioState.context.currentTime
  if (now - audioState.lastGuardrailImpactTime < 0.12) return

  audioState.lastGuardrailImpactTime = now

  const clampedIntensity = THREE.MathUtils.clamp(intensity, 0, 1)
  const impactGain = audioState.context.createGain()
  impactGain.gain.setValueAtTime(0.0001, now)
  impactGain.gain.exponentialRampToValueAtTime(
    0.08 + clampedIntensity * 0.22,
    now + 0.012,
  )
  impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26)
  impactGain.connect(audioState.masterGain)

  const metallicOscillator = audioState.context.createOscillator()
  metallicOscillator.type = 'triangle'
  metallicOscillator.frequency.setValueAtTime(
    THREE.MathUtils.lerp(320, 680, clampedIntensity),
    now,
  )
  metallicOscillator.frequency.exponentialRampToValueAtTime(
    THREE.MathUtils.lerp(120, 210, clampedIntensity),
    now + 0.22,
  )

  const metallicFilter = audioState.context.createBiquadFilter()
  metallicFilter.type = 'bandpass'
  metallicFilter.frequency.setValueAtTime(
    THREE.MathUtils.lerp(900, 1800, clampedIntensity),
    now,
  )
  metallicFilter.Q.value = 3.2

  const noiseSource = audioState.context.createBufferSource()
  noiseSource.buffer = audioState.noiseBuffer

  const noiseFilter = audioState.context.createBiquadFilter()
  noiseFilter.type = 'highpass'
  noiseFilter.frequency.setValueAtTime(1100, now)

  const noiseGain = audioState.context.createGain()
  noiseGain.gain.setValueAtTime(0.0001, now)
  noiseGain.gain.exponentialRampToValueAtTime(
    0.03 + clampedIntensity * 0.12,
    now + 0.01,
  )
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)

  metallicOscillator.connect(metallicFilter)
  metallicFilter.connect(impactGain)
  noiseSource.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(impactGain)

  metallicOscillator.start(now)
  metallicOscillator.stop(now + 0.28)
  noiseSource.start(now)
  noiseSource.stop(now + 0.2)
}

function triggerGearShiftSound(direction, intensity) {
  if (!audioState.context || audioState.context.state !== 'running') return
  if (!audioState.noiseBuffer) return

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

  const hissSource = audioState.context.createBufferSource()
  hissSource.buffer = audioState.noiseBuffer

  const hissFilter = audioState.context.createBiquadFilter()
  hissFilter.type = 'highpass'
  hissFilter.frequency.setValueAtTime(direction > 0 ? 1800 : 1200, now)

  const hissGain = audioState.context.createGain()
  hissGain.gain.setValueAtTime(0.0001, now)
  hissGain.gain.exponentialRampToValueAtTime(
    0.006 + clampedIntensity * 0.018,
    now + 0.01,
  )
  hissGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)

  chirpOscillator.connect(chirpFilter)
  chirpFilter.connect(shiftGain)
  hissSource.connect(hissFilter)
  hissFilter.connect(hissGain)
  hissGain.connect(shiftGain)

  chirpOscillator.start(now)
  chirpOscillator.stop(now + 0.18)
  hissSource.start(now)
  hissSource.stop(now + 0.16)
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

  const noiseBuffer = createNoiseBuffer(audioContext)
  audioState.noiseBuffer = noiseBuffer

  const roadSource = createLoopingNoiseSource(audioContext, noiseBuffer, 0.86)
  const roadHighpass = audioContext.createBiquadFilter()
  roadHighpass.type = 'highpass'
  roadHighpass.frequency.value = 55
  const roadFilter = audioContext.createBiquadFilter()
  roadFilter.type = 'lowpass'
  roadFilter.frequency.value = 640
  const roadGain = audioContext.createGain()
  roadGain.gain.value = 0
  roadSource.connect(roadHighpass)
  roadHighpass.connect(roadFilter)
  roadFilter.connect(roadGain)
  roadGain.connect(masterGain)

  const windSource = createLoopingNoiseSource(audioContext, noiseBuffer, 1.08)
  const windFilter = audioContext.createBiquadFilter()
  windFilter.type = 'highpass'
  windFilter.frequency.value = 1800
  const windGain = audioContext.createGain()
  windGain.gain.value = 0
  windSource.connect(windFilter)
  windFilter.connect(windGain)
  windGain.connect(masterGain)

  const skidSource = createLoopingNoiseSource(audioContext, noiseBuffer, 1.42)
  const skidFilter = audioContext.createBiquadFilter()
  skidFilter.type = 'bandpass'
  skidFilter.frequency.value = 1800
  skidFilter.Q.value = 0.9
  const skidGain = audioContext.createGain()
  skidGain.gain.value = 0
  skidSource.connect(skidFilter)
  skidFilter.connect(skidGain)
  skidGain.connect(masterGain)

  const brakeSource = createLoopingNoiseSource(audioContext, noiseBuffer, 1.72)
  const brakeFilter = audioContext.createBiquadFilter()
  brakeFilter.type = 'bandpass'
  brakeFilter.frequency.value = 2400
  brakeFilter.Q.value = 1.1
  const brakeGain = audioContext.createGain()
  brakeGain.gain.value = 0
  brakeSource.connect(brakeFilter)
  brakeFilter.connect(brakeGain)
  brakeGain.connect(masterGain)

  enginePrimaryOscillator.start()
  engineSecondaryOscillator.start()
  engineLfo.start()
  roadSource.start()
  windSource.start()
  skidSource.start()
  brakeSource.start()

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
  audioState.road = {
    source: roadSource,
    filter: roadFilter,
    gain: roadGain,
  }
  audioState.wind = {
    source: windSource,
    filter: windFilter,
    gain: windGain,
  }
  audioState.skid = {
    source: skidSource,
    filter: skidFilter,
    gain: skidGain,
  }
  audioState.brake = {
    source: brakeSource,
    filter: brakeFilter,
    gain: brakeGain,
  }
}

function resumeDrivingAudio() {
  if (!audioState.supported) return

  initializeDrivingAudio()

  if (audioState.context?.state === 'suspended') {
    audioState.context.resume().catch(() => {})
  }
}

function updateDrivingAudio(delta, trackFrame) {
  if (!audioState.context || audioState.context.state !== 'running') return

  const accelerating = isForwardInputActive()
  const reversing = keyState.ArrowDown || keyState.KeyS
  const braking = keyState.Space
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
  const throttleTarget = accelerating ? 1 : reversing ? 0.72 : 0.14
  const brakeTarget = braking ? 1 : 0
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
  const roadVolume =
    0.0015 + Math.pow(audioState.smoothedSpeed, 1.2) * 0.042
  const windVolume =
    Math.pow(audioState.smoothedSpeed, 1.7) * 0.032
  const skidAmount =
    Math.pow(audioState.smoothedCornerLoad, 1.4) *
    THREE.MathUtils.smoothstep(audioState.smoothedSpeed, 0.18, 0.95)
  const hardTurnAmount =
    THREE.MathUtils.smoothstep(Math.abs(carState.steer), 0.34, 0.82) *
    THREE.MathUtils.smoothstep(audioState.smoothedSpeed, 0.24, 0.9) *
    THREE.MathUtils.smoothstep(trackFrame.turnStrength, 0.18, 0.78)
  const tireScreechAmount = THREE.MathUtils.clamp(
    skidAmount * 0.42 +
      hardTurnAmount * (0.72 + audioState.smoothedThrottle * 0.18),
    0,
    1,
  )
  const brakeAmount =
    audioState.smoothedBrake *
    THREE.MathUtils.smoothstep(audioState.smoothedSpeed, 0.08, 0.9)

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

  setAudioParam(
    audioState.road.filter.frequency,
    THREE.MathUtils.lerp(420, 820, audioState.smoothedSpeed),
  )
  setAudioParam(audioState.road.gain.gain, roadVolume)

  setAudioParam(
    audioState.wind.filter.frequency,
    THREE.MathUtils.lerp(1700, 2800, audioState.smoothedSpeed),
  )
  setAudioParam(audioState.wind.gain.gain, windVolume)

  setAudioParam(
    audioState.skid.filter.frequency,
    THREE.MathUtils.lerp(1550, 3250, tireScreechAmount),
  )
  setAudioParam(
    audioState.skid.filter.Q,
    THREE.MathUtils.lerp(0.9, 4.4, hardTurnAmount),
  )
  setAudioParam(
    audioState.skid.source.playbackRate,
    THREE.MathUtils.lerp(1.36, 2.28, tireScreechAmount),
  )
  setAudioParam(
    audioState.skid.gain.gain,
    tireScreechAmount *
      (0.008 + hardTurnAmount * 0.12 + audioState.smoothedSpeed * 0.028),
  )

  setAudioParam(
    audioState.brake.filter.frequency,
    THREE.MathUtils.lerp(1900, 3000, brakeAmount),
  )
  setAudioParam(
    audioState.brake.gain.gain,
    brakeAmount * (0.018 + audioState.smoothedSpeed * 0.04),
  )
}

function resizeMinimapCanvas() {
  if (!minimapContext) return

  const bounds = minimapCanvas.getBoundingClientRect()
  if (bounds.width < 1 || bounds.height < 1) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  minimapCanvas.width = Math.round(bounds.width * dpr)
  minimapCanvas.height = Math.round(bounds.height * dpr)

  minimapState.width = bounds.width
  minimapState.height = bounds.height
  minimapState.dpr = dpr

  const trackWidth = TRACK_MINIMAP_BOUNDS.maxX - TRACK_MINIMAP_BOUNDS.minX
  const trackHeight = TRACK_MINIMAP_BOUNDS.maxZ - TRACK_MINIMAP_BOUNDS.minZ
  const availableWidth = Math.max(bounds.width - MINIMAP_PADDING * 2, 1)
  const availableHeight = Math.max(bounds.height - MINIMAP_PADDING * 2, 1)
  const scale = Math.min(
    availableWidth / Math.max(trackWidth, 0.001),
    availableHeight / Math.max(trackHeight, 0.001),
  )
  const contentWidth = trackWidth * scale
  const contentHeight = trackHeight * scale

  minimapState.scale = scale
  minimapState.offsetX = (bounds.width - contentWidth) / 2 - TRACK_MINIMAP_BOUNDS.minX * scale
  minimapState.offsetY = (bounds.height - contentHeight) / 2 + TRACK_MINIMAP_BOUNDS.maxZ * scale
  minimapState.roadWidth = Math.max(TRACK_HALF_WIDTH * scale * 2, 8)
  minimapState.trackPoints = TRACK_DATA.samples.map((sample) =>
    projectPointToMinimap(sample.point),
  )
}

function projectPointToMinimap(point) {
  return {
    x: point.x * minimapState.scale + minimapState.offsetX,
    y: minimapState.offsetY - point.z * minimapState.scale,
  }
}

function strokeMinimapPath(points, lineWidth, strokeStyle) {
  if (!minimapContext || points.length === 0) return

  minimapContext.beginPath()
  minimapContext.moveTo(points[0].x, points[0].y)

  for (let index = 1; index < points.length; index += 1) {
    minimapContext.lineTo(points[index].x, points[index].y)
  }

  minimapContext.lineCap = 'round'
  minimapContext.lineJoin = 'round'
  minimapContext.lineWidth = lineWidth
  minimapContext.strokeStyle = strokeStyle
  minimapContext.stroke()
}

function drawMinimap(trackFrame) {
  if (!minimapContext) return

  if (minimapState.width === 0 || minimapState.height === 0) {
    resizeMinimapCanvas()
  }

  if (minimapState.width === 0 || minimapState.height === 0) return

  minimapContext.setTransform(
    minimapState.dpr,
    0,
    0,
    minimapState.dpr,
    0,
    0,
  )
  minimapContext.clearRect(0, 0, minimapState.width, minimapState.height)

  const facingDirection = new THREE.Vector3(
    Math.sin(carState.rotation),
    0,
    Math.cos(carState.rotation),
  )
  const lookaheadDirection = facingDirection.dot(trackFrame.flatTangent) >= 0 ? 1 : -1
  const lookaheadRatio = getSpeedRatio(carState.speed)
  const lookaheadSamples = Math.round(
    THREE.MathUtils.lerp(
      MINIMAP_LOOKAHEAD_SAMPLES_MIN,
      MINIMAP_LOOKAHEAD_SAMPLES_MAX,
      lookaheadRatio,
    ),
  )
  const futurePoints = [projectPointToMinimap(trackFrame.surfacePoint)]
  let sampleIndex =
    lookaheadDirection > 0 ? trackFrame.nextSampleIndex : trackFrame.sampleIndex

  strokeMinimapPath(
    minimapState.trackPoints,
    minimapState.roadWidth + 5,
    'rgba(148, 163, 184, 0.18)',
  )
  strokeMinimapPath(
    minimapState.trackPoints,
    minimapState.roadWidth,
    'rgba(15, 23, 42, 0.82)',
  )
  strokeMinimapPath(
    minimapState.trackPoints,
    Math.max(minimapState.roadWidth * 0.1, 1.5),
    'rgba(226, 232, 240, 0.32)',
  )

  const finishSpan = TRACK_HALF_WIDTH + 1.35
  const finishLeftPoint = projectPointToMinimap(
    CAR_START_SAMPLE.point.clone().addScaledVector(CAR_START_SAMPLE.side, finishSpan),
  )
  const finishRightPoint = projectPointToMinimap(
    CAR_START_SAMPLE.point.clone().addScaledVector(CAR_START_SAMPLE.side, -finishSpan),
  )
  const finishVectorX = finishRightPoint.x - finishLeftPoint.x
  const finishVectorY = finishRightPoint.y - finishLeftPoint.y
  const finishLength = Math.hypot(finishVectorX, finishVectorY)
  const finishSegments = 6

  minimapContext.save()
  minimapContext.lineCap = 'butt'
  minimapContext.lineWidth = Math.max(minimapState.roadWidth * 0.72, 8)
  minimapContext.strokeStyle = 'rgba(248, 250, 252, 0.2)'
  minimapContext.beginPath()
  minimapContext.moveTo(finishLeftPoint.x, finishLeftPoint.y)
  minimapContext.lineTo(finishRightPoint.x, finishRightPoint.y)
  minimapContext.stroke()
  minimapContext.lineWidth = Math.min(
    Math.max(minimapState.roadWidth * 0.52, 6),
    Math.max(finishLength / finishSegments - 0.25, 3.5),
  )
  for (let index = 0; index < finishSegments; index += 1) {
    const startRatio = index / finishSegments
    const endRatio = (index + 1) / finishSegments
    minimapContext.strokeStyle =
      index % 2 === 0 ? 'rgba(15, 23, 42, 0.98)' : 'rgba(255, 248, 232, 0.98)'
    minimapContext.beginPath()
    minimapContext.moveTo(
      finishLeftPoint.x + finishVectorX * startRatio,
      finishLeftPoint.y + finishVectorY * startRatio,
    )
    minimapContext.lineTo(
      finishLeftPoint.x + finishVectorX * endRatio,
      finishLeftPoint.y + finishVectorY * endRatio,
    )
    minimapContext.stroke()
  }
  minimapContext.restore()

  for (let step = 0; step < lookaheadSamples; step += 1) {
    futurePoints.push(minimapState.trackPoints[sampleIndex])
    sampleIndex =
      (sampleIndex + lookaheadDirection + TRACK_DATA.samples.length) %
      TRACK_DATA.samples.length
  }

  strokeMinimapPath(
    futurePoints,
    Math.max(minimapState.roadWidth * 0.42, 3),
    'rgba(249, 115, 22, 0.92)',
  )

  const carPoint = projectPointToMinimap(trackFrame.surfacePoint)
  minimapContext.fillStyle = 'rgba(249, 115, 22, 0.28)'
  minimapContext.beginPath()
  minimapContext.arc(
    carPoint.x,
    carPoint.y,
    Math.max(minimapState.roadWidth * 0.72, 7),
    0,
    Math.PI * 2,
  )
  minimapContext.fill()

  minimapContext.save()
  minimapContext.translate(carPoint.x, carPoint.y)
  minimapContext.rotate(renderState.rotation)
  minimapContext.beginPath()
  minimapContext.moveTo(0, -8)
  minimapContext.lineTo(5.8, 7)
  minimapContext.lineTo(0, 3.2)
  minimapContext.lineTo(-5.8, 7)
  minimapContext.closePath()
  minimapContext.fillStyle = '#f8fafc'
  minimapContext.fill()
  minimapContext.lineWidth = 2
  minimapContext.strokeStyle = '#f97316'
  minimapContext.stroke()
  minimapContext.restore()
}

function createWheel() {
  const wheel = new THREE.Group()
  wheel.rotation.order = 'YXZ'

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.28, 24),
    new THREE.MeshStandardMaterial({
      color: 0x05070b,
      roughness: 0.9,
      metalness: 0.05,
    }),
  )
  tire.rotation.z = Math.PI / 2
  wheel.add(tire)

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.3, 18),
    new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.25,
      metalness: 0.95,
    }),
  )
  rim.rotation.z = Math.PI / 2
  wheel.add(rim)

  return wheel
}

function createRaceCar() {
  const car = new THREE.Group()
  car.rotation.order = 'YXZ'

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    metalness: 0.6,
    roughness: 0.28,
  })

  const detailMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    metalness: 0.8,
    roughness: 0.2,
  })

  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    metalness: 0.35,
    roughness: 0.36,
  })

  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.32, 3.2),
    bodyMaterial,
  )
  chassis.position.y = 0.2
  car.add(chassis)

  const nose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.34, 1.1, 20),
    bodyMaterial,
  )
  nose.rotation.x = Math.PI / 2
  nose.position.set(0, 0.22, 1.95)
  car.add(nose)

  const cockpitFloor = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.12, 0.96),
    darkMaterial,
  )
  cockpitFloor.position.set(0, 0.36, 0.14)
  car.add(cockpitFloor)

  const cockpitSeat = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.2, 0.36),
    darkMaterial,
  )
  cockpitSeat.position.set(0, 0.48, -0.08)
  car.add(cockpitSeat)

  const cockpitLeftWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.34, 0.86),
    darkMaterial,
  )
  cockpitLeftWall.position.set(0.37, 0.5, 0.16)
  car.add(cockpitLeftWall)

  const cockpitRightWall = cockpitLeftWall.clone()
  cockpitRightWall.position.x = -0.37
  car.add(cockpitRightWall)

  const cockpitDash = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.22, 0.14),
    darkMaterial,
  )
  cockpitDash.position.set(0, 0.54, 0.48)
  car.add(cockpitDash)

  const windshieldFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.08, 0.08),
    detailMaterial,
  )
  windshieldFrame.position.set(0, 0.68, 0.56)
  car.add(windshieldFrame)

  const windshield = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      metalness: 0,
      roughness: 0.08,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    }),
  )
  windshield.position.set(0, 0.6, 0.52)
  windshield.rotation.x = -0.32
  car.add(windshield)

  const rollHoop = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.42, 0.08),
    detailMaterial,
  )
  rollHoop.position.set(0, 0.72, -0.06)
  car.add(rollHoop)

  const steeringColumn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 0.38, 12),
    darkMaterial,
  )
  steeringColumn.position.set(0, 0.5, 0.38)
  steeringColumn.rotation.x = Math.PI * 0.34
  car.add(steeringColumn)

  const steeringWheel = new THREE.Group()
  steeringWheel.position.set(0, 0.52, 0.44)
  steeringWheel.rotation.x = -0.36
  car.add(steeringWheel)
  steeringWheelGroup = steeringWheel

  const steeringWheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.022, 12, 28),
    detailMaterial,
  )
  steeringWheel.add(steeringWheelRim)

  const steeringWheelHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12),
    detailMaterial,
  )
  steeringWheelHub.rotation.x = Math.PI / 2
  steeringWheel.add(steeringWheelHub)

  const steeringWheelSpokeTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, 0.12, 0.02),
    detailMaterial,
  )
  steeringWheelSpokeTop.position.set(0, 0.06, 0)
  steeringWheel.add(steeringWheelSpokeTop)

  const steeringWheelSpokeLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.026, 0.02),
    detailMaterial,
  )
  steeringWheelSpokeLeft.position.set(-0.055, -0.03, 0)
  steeringWheelSpokeLeft.rotation.z = -0.5
  steeringWheel.add(steeringWheelSpokeLeft)

  const steeringWheelSpokeRight = steeringWheelSpokeLeft.clone()
  steeringWheelSpokeRight.position.x = 0.055
  steeringWheelSpokeRight.rotation.z = 0.5
  steeringWheel.add(steeringWheelSpokeRight)

  const accentStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.02, 3),
    detailMaterial,
  )
  accentStripe.position.set(0, 0.37, 0.08)
  car.add(accentStripe)

  const sidePodLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.18, 1.3),
    bodyMaterial,
  )
  sidePodLeft.position.set(0.62, 0.2, 0.1)
  car.add(sidePodLeft)

  const sidePodRight = sidePodLeft.clone()
  sidePodRight.position.x = -0.62
  car.add(sidePodRight)

  const engineCover = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.18, 0.66),
    bodyMaterial,
  )
  engineCover.position.set(0, 0.4, -1.08)
  car.add(engineCover)

  const exhaustPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 0.34, 18),
    detailMaterial,
  )
  exhaustPipe.rotation.x = Math.PI / 2
  exhaustPipe.position.set(BOOST_EXHAUST_LOCAL_X, BOOST_EXHAUST_LOCAL_Y, -1.79)
  car.add(exhaustPipe)

  const exhaustInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.085, 0.28, 18),
    darkMaterial,
  )
  exhaustInner.rotation.x = Math.PI / 2
  exhaustInner.position.set(BOOST_EXHAUST_LOCAL_X, BOOST_EXHAUST_LOCAL_Y, -1.83)
  car.add(exhaustInner)

  const frontLeftWheel = createWheel()
  frontLeftWheel.position.set(0.86, 0.02, 1.08)
  car.add(frontLeftWheel)
  frontLeftWheelGroup = frontLeftWheel

  const frontRightWheel = createWheel()
  frontRightWheel.position.set(-0.86, 0.02, 1.08)
  car.add(frontRightWheel)
  frontRightWheelGroup = frontRightWheel

  const rearLeftWheel = createWheel()
  rearLeftWheel.position.set(0.86, 0.02, -1.08)
  car.add(rearLeftWheel)
  rearLeftWheelGroup = rearLeftWheel

  const rearRightWheel = createWheel()
  rearRightWheel.position.set(-0.86, 0.02, -1.08)
  car.add(rearRightWheel)
  rearRightWheelGroup = rearRightWheel

  const headlightLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.08, 0.12),
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.5,
    }),
  )
  headlightLeft.position.set(0.36, 0.2, 2.42)
  car.add(headlightLeft)

  const headlightRight = headlightLeft.clone()
  headlightRight.position.x = -0.36
  car.add(headlightRight)

  car.scale.setScalar(CAR_SCALE)

  return car
}

function createTree(scale = 1, crownColor = 0x2f855a) {
  const tree = new THREE.Group()

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 1.6, 10),
    new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.95,
      metalness: 0,
    }),
  )
  trunk.position.y = 0.8
  tree.add(trunk)

  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.4, 12),
    new THREE.MeshStandardMaterial({
      color: crownColor,
      roughness: 0.95,
      metalness: 0,
    }),
  )
  crown.position.y = 2.35
  tree.add(crown)

  const crownLower = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 1.8, 12),
    new THREE.MeshStandardMaterial({
      color: crownColor,
      roughness: 0.95,
      metalness: 0,
    }),
  )
  crownLower.position.y = 1.65
  tree.add(crownLower)

  tree.scale.setScalar(scale)
  return tree
}

function addDayEnvironment() {
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(90, 32, 16),
    new THREE.MeshBasicMaterial({
      color: 0xbfe7ff,
      side: THREE.BackSide,
    }),
  )
  scene.add(skyDome)

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff1a8 }),
  )
  sun.position.set(-30, 32, -34)
  scene.add(sun)

  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(3.6, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfff8d6,
      transparent: true,
      opacity: 0.25,
    }),
  )
  sunHalo.position.copy(sun.position)
  scene.add(sunHalo)

  const treePlacements = createTracksideTreeLayout()

  for (const placement of treePlacements) {
    const treePoint = createTracksidePoint(placement, TREE_CLEARANCE)

    const tree = createTree(
      placement.scale,
      treePoint.x > 0 ? 0x3a8b54 : 0x2f7a4b,
    )
    tree.position.set(treePoint.x, -1.2, treePoint.z)
    scene.add(tree)
  }

}

function clearDriveKeys() {
  Object.keys(keyState).forEach((code) => {
    keyState[code] = false
  })
}

function isForwardInputActive() {
  return keyState.ArrowUp || keyState.KeyW || keyState.KeyB
}

function hasDriveInput() {
  return (
    isForwardInputActive() ||
    keyState.ArrowDown ||
    keyState.ArrowLeft ||
    keyState.ArrowRight ||
    keyState.Space ||
    keyState.KeyA ||
    keyState.KeyS ||
    keyState.KeyD
  )
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
  const { vertices, indices } = createTrackSurfaceColliderData(halfWidth)
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

function createGuardrailSegmentColliders(
  sideSign,
  {
    thickness = GUARDRAIL_COLLISION_THICKNESS,
    height = GUARDRAIL_COLLISION_HEIGHT,
  } = {},
) {
  const worldUp = new THREE.Vector3(0, 1, 0)
  const jointHalfSize = Math.max(
    thickness * 0.5,
    PHYSICS_GUARDRAIL_JOINT_HALF_SIZE,
  )

  for (let index = 0; index < TRACK_DATA.samples.length; index += 1) {
    const current = TRACK_DATA.samples[index]
    const next = TRACK_DATA.samples[(index + 1) % TRACK_DATA.samples.length]
    const currentCenter = current.point
      .clone()
      .addScaledVector(
        current.side,
        sideSign * (GUARDRAIL_OFFSET + thickness * 0.5),
      )
    currentCenter.y += GUARDRAIL_BASE_LIFT + height * 0.5

    const jointColliderDesc = RAPIER.ColliderDesc.cuboid(
      jointHalfSize,
      height * 0.5,
      jointHalfSize,
    )
      .setTranslation(currentCenter.x, currentCenter.y, currentCenter.z)
      .setFriction(PHYSICS_GUARDRAIL_FRICTION)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setRestitution(PHYSICS_GUARDRAIL_RESTITUTION)
      .setContactSkin(PHYSICS_COLLISION_SKIN * 2)
    physicsState.world.createCollider(jointColliderDesc)

    const nextCenter = next.point
      .clone()
      .addScaledVector(
        next.side,
        sideSign * (GUARDRAIL_OFFSET + thickness * 0.5),
      )
    nextCenter.y += GUARDRAIL_BASE_LIFT + height * 0.5

    const forward = nextCenter.clone().sub(currentCenter)
    const segmentLength = forward.length()
    if (segmentLength < 0.001) continue
    forward.normalize()

    let right = new THREE.Vector3().crossVectors(worldUp, forward)
    if (right.lengthSq() < 0.000001) {
      right.set(1, 0, 0)
    } else {
      right.normalize()
    }
    const up = new THREE.Vector3().crossVectors(forward, right).normalize()
    const rotation = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(right, up, forward),
    )
    const center = currentCenter.clone().lerp(nextCenter, 0.5)

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      thickness * 0.5,
      height * 0.5,
      segmentLength * 0.5 + PHYSICS_GUARDRAIL_SEGMENT_OVERLAP,
    )
      .setTranslation(center.x, center.y, center.z)
      .setRotation(quaternionToRapier(rotation))
      .setFriction(PHYSICS_GUARDRAIL_FRICTION)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setRestitution(PHYSICS_GUARDRAIL_RESTITUTION)
      .setContactSkin(PHYSICS_COLLISION_SKIN * 2)

    physicsState.world.createCollider(colliderDesc)
  }
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
  const trackFrame = getTrackFrame(visualPosition, carState.trackSampleIndex)
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
    getCurrentForwardTopSpeed(),
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
  const upDot = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(renderState.quaternion)
    .dot(WORLD_UP)
  const upsideDown =
    upDot < -0.35 &&
    carState.position.y <= surfaceHeight + 0.16
  const belowTrack = carState.position.y < surfaceHeight - CRASH_BELOW_TRACK_MARGIN
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
  const leftGuardrailCollisionGeometry = createGuardrailGeometry(-1, {
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
  const rightGuardrailCollisionGeometry = createGuardrailGeometry(1, {
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

function projectTrackFrameOnSegment(position, startSample, endSample) {
  const segment = endSample.point.clone().sub(startSample.point)
  const segmentXZLengthSq =
    segment.x * segment.x +
    segment.z * segment.z

  let alpha = 0
  if (segmentXZLengthSq > 0.0001) {
    alpha = THREE.MathUtils.clamp(
      (
        (position.x - startSample.point.x) * segment.x +
        (position.z - startSample.point.z) * segment.z
      ) / segmentXZLengthSq,
      0,
      1,
    )
  }

  const centerPoint = startSample.point.clone().lerp(endSample.point, alpha)
  const tangent = startSample.tangent.clone().lerp(endSample.tangent, alpha)
  if (tangent.lengthSq() < 0.0001) {
    tangent.copy(endSample.tangent)
  }
  tangent.normalize()

  const flatTangent = new THREE.Vector3(tangent.x, 0, tangent.z)
  if (flatTangent.lengthSq() < 0.0001) {
    flatTangent.copy(startSample.flatTangent)
  } else {
    flatTangent.normalize()
  }

  const side = new THREE.Vector3(flatTangent.z, 0, -flatTangent.x)
  const lateralOffset =
    (position.x - centerPoint.x) * side.x +
    (position.z - centerPoint.z) * side.z
  const projectedX = centerPoint.x + side.x * lateralOffset
  const projectedY = centerPoint.y
  const projectedZ = centerPoint.z + side.z * lateralOffset
  const distanceSq =
    (position.x - projectedX) * (position.x - projectedX) +
    (position.y - projectedY) * (position.y - projectedY) +
    (position.z - projectedZ) * (position.z - projectedZ)

  return {
    centerPoint,
    tangent,
    flatTangent,
    side,
    lateralOffset,
    turnStrength: THREE.MathUtils.lerp(
      startSample.turnStrength,
      endSample.turnStrength,
      alpha,
    ),
    distanceSq,
  }
}

function getTrackFrame(
  position,
  sampleIndexHint = null,
  lateralLimit = TRACK_HALF_WIDTH,
) {
  const totalSamples = TRACK_DATA.samples.length
  let bestProjection
  let bestSampleIndex = 0
  let startIndex = 0
  let endIndex = totalSamples

  if (sampleIndexHint !== null) {
    startIndex = sampleIndexHint - TRACK_FRAME_SEARCH_RADIUS
    endIndex = sampleIndexHint + TRACK_FRAME_SEARCH_RADIUS + 1
  }

  for (let offsetIndex = startIndex; offsetIndex < endIndex; offsetIndex += 1) {
    const sampleIndex =
      ((offsetIndex % totalSamples) + totalSamples) % totalSamples
    const nextSampleIndex = (sampleIndex + 1) % totalSamples
    const projection = projectTrackFrameOnSegment(
      position,
      TRACK_DATA.samples[sampleIndex],
      TRACK_DATA.samples[nextSampleIndex],
    )

    if (!bestProjection || projection.distanceSq < bestProjection.distanceSq) {
      bestProjection = projection
      bestSampleIndex = sampleIndex
    }
  }

  const projection = bestProjection
  const sampleIndex = bestSampleIndex
  const nextSampleIndex = (sampleIndex + 1) % TRACK_DATA.samples.length

  const limitedOffset = THREE.MathUtils.clamp(
    projection.lateralOffset,
    -lateralLimit,
    lateralLimit,
  )
  const clampedOffset = THREE.MathUtils.clamp(
    projection.lateralOffset,
    -TRACK_HALF_WIDTH,
    TRACK_HALF_WIDTH,
  )
  const surfacePoint = projection.centerPoint
    .clone()
    .addScaledVector(projection.side, clampedOffset)
  const limitedSurfacePoint = projection.centerPoint
    .clone()
    .addScaledVector(projection.side, limitedOffset)

  return {
    centerPoint: projection.centerPoint,
    tangent: projection.tangent,
    flatTangent: projection.flatTangent,
    normal: projection.side,
    lateralOffset: projection.lateralOffset,
    surfacePoint,
    limitedSurfacePoint,
    collisionOffset: limitedOffset,
    hitLimit: Math.abs(projection.lateralOffset) > lateralLimit + 0.0001,
    section: projection.turnStrength > 0.34 ? 'corner' : 'flow',
    turnStrength: projection.turnStrength,
    sampleIndex,
    nextSampleIndex,
  }
}

function clampToTrack(position, sampleIndexHint = null) {
  const trackFrame = getTrackFrame(
    position,
    sampleIndexHint,
    GUARDRAIL_COLLISION_HALF_WIDTH,
  )
  position.set(
    trackFrame.limitedSurfacePoint.x,
    trackFrame.limitedSurfacePoint.y + PHYSICS_BODY_RIDE_HEIGHT,
    trackFrame.limitedSurfacePoint.z,
  )
  return trackFrame
}

function triggerGameOver(reason = 'wrecked') {
  if (raceState.mode === 'gameOver') return

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
  setFinishCelebrationContent()
  gameOverSubtitle.textContent =
    reason === 'upsideDown'
      ? 'Upside down. Press Space to respawn'
      : reason === 'offTrack'
        ? 'Press Space to respawn'
        : 'Press Space to respawn'
  gameOverCelebration.classList.add('is-visible')
}

function updateCar(delta) {
  if (!physicsState.ready || !physicsState.chassisBody || !physicsState.vehicleController) {
    return
  }

  physicsState.previousPosition.copy(physicsState.currentPosition)
  physicsState.previousQuaternion.copy(physicsState.currentQuaternion)

  const previousPosition = carState.position.clone()
  const trackFrame = getTrackFrame(carState.position, carState.trackSampleIndex)
  carState.trackSampleIndex = trackFrame.sampleIndex

  if (!physicsState.frozen) {
    const accelerating = isForwardInputActive()
    const reversing = keyState.ArrowDown || keyState.KeyS
    const braking = keyState.Space
    const steeringLeft = keyState.ArrowLeft || keyState.KeyA
    const steeringRight = keyState.ArrowRight || keyState.KeyD
    const steeringInput = (steeringLeft ? 1 : 0) - (steeringRight ? 1 : 0)
    const nearGuardrail =
      Math.abs(trackFrame.lateralOffset) > GUARDRAIL_OFFSET - 0.24
    const driveIntent =
      accelerating && !reversing
        ? 1
        : reversing && !accelerating
          ? -1
          : 0
    const boostActive = isBoostActive() && driveIntent > 0
    const superboostActive = isSuperboostActive() && driveIntent > 0
    if (superboostActive && !raceState.superboostActive) {
      const now = getCurrentTimeSeconds()
      const canShowSuperboostCelebration =
        now - raceState.lastSuperboostEntryTime >= SUPERBOOST_BANNER_COOLDOWN
      raceState.lastSuperboostEntryTime = now
      if (canShowSuperboostCelebration) {
        triggerSuperboostCelebration()
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
      ? PHYSICS_BRAKE_FORCE
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

  const updatedTrackFrame = getTrackFrame(carState.position, carState.trackSampleIndex)
  carState.trackSampleIndex = updatedTrackFrame.sampleIndex

  if (raceState.mode === 'racing') {
    updateFinishState(previousPosition, carState.position, carState.trackSampleIndex)
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
  const trackFrame = getTrackFrame(
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
  drawMinimap(trackFrame)
  updateWheelVisuals(delta)

  raceCar.position.copy(renderState.position)
  raceCar.quaternion.copy(renderState.quaternion)
  updateBoostParticles(delta)
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

  updateDrivingAudio(delta, trackFrame)
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
  if (!renderer) return

  cameraState.mode = 'orbit'
  cameraState.dragging = true
  cameraState.pointerX = event.clientX
  cameraState.pointerY = event.clientY
  syncOrbitCameraFromCurrentView()
  renderer.domElement.focus()
  event.preventDefault()
}

function onCameraPointerMove(event) {
  if (!cameraState.dragging) return

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

function onCameraPointerUp() {
  cameraState.dragging = false

  if (hasDriveInput() || Math.abs(carState.speed) > 0.15) {
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

function toggleDrivingCameraMode() {
  cameraState.driveMode =
    cameraState.driveMode === 'follow' ? 'firstPerson' : 'follow'
  cameraState.mode = cameraState.driveMode
}

function cacheMeshModeMaterials(root) {
  debugViewState.meshMaterials.clear()

  root.traverse((child) => {
    if (!child.isMesh) return

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material]

    materials.forEach((material) => {
      if (material) {
        debugViewState.meshMaterials.add(material)
      }
    })
  })
}

function setMeshMode(enabled) {
  debugViewState.meshMode = enabled

  if (!scene) return

  if (debugViewState.meshMaterials.size === 0) {
    cacheMeshModeMaterials(scene)
  }

  debugViewState.meshMaterials.forEach((material) => {
    if ('wireframe' in material) {
      material.wireframe = enabled
      material.needsUpdate = true
    }
  })

  scene.background = new THREE.Color(enabled ? 0xf8fafc : DAY_SKY_COLOR)
  scene.fog = enabled ? null : new THREE.Fog(DAY_FOG_COLOR, 52, 160)

  if (carShadow) carShadow.visible = !enabled
}

function toggleMeshMode() {
  setMeshMode(!debugViewState.meshMode)
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
  renderer.domElement.addEventListener('pointerdown', onCameraPointerDown)
  renderer.domElement.addEventListener('wheel', onCameraWheel, { passive: false })
  window.addEventListener('pointermove', onCameraPointerMove)
  window.addEventListener('pointerup', onCameraPointerUp)
  resizeMinimapCanvas()

  addDayEnvironment()

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
    createTrackRibbonGeometry(TRACK_HALF_WIDTH, TRACK_THICKNESS),
    new THREE.MeshStandardMaterial({
      color: 0x50545c,
      metalness: 0.02,
      roughness: 0.96,
      side: THREE.DoubleSide,
    }),
  )
  scene.add(track)

  const skidLayer = createTrackSkidLayer()
  scene.add(skidLayer)

  const edgeStripeOffset =
    TRACK_HALF_WIDTH - TRACK_EDGE_STRIPE_INSET - TRACK_EDGE_STRIPE_WIDTH / 2

  const innerStripe = createTrackEdgeStripe(-edgeStripeOffset)
  scene.add(innerStripe)

  const outerStripe = createTrackEdgeStripe(edgeStripeOffset)
  scene.add(outerStripe)

  const centerLaneStripe = createTrackCenterStripe()
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
    createGuardrailGeometry(-1),
    guardrailMaterial,
  )
  scene.add(leftGuardrail)

  const rightGuardrail = new THREE.Mesh(
    createGuardrailGeometry(1),
    guardrailMaterial,
  )
  scene.add(rightGuardrail)

  const finishLineGroup = createFinishLineGroup()
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

  raceCar = createRaceCar()
  scene.add(raceCar)
  boostParticleSystem = createBoostParticleSystem()
  scene.add(boostParticleSystem)

  cacheMeshModeMaterials(scene)
  setMeshMode(debugViewState.meshMode)

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
        advanceLapTimer(PHYSICS_STEP)
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
  resumeDrivingAudio()

  if (!renderer) {
    await createGameScene()
  }

  renderer.domElement.focus()
  onWindowResize()
}

function resetRaceSession() {
  clearDriveKeys()
  raceState.mode = 'racing'
  raceState.lapArmed = false
  raceState.finishTimer = 0
  raceState.superboostActive = false
  raceState.lastSuperboostEntryTime = -Infinity
  resetLapTimers()

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
  audioState.guardrailContactActive = false

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
  setFinishCelebrationContent()
  gameOverCelebration.classList.remove('is-visible')
  gameScreen.style.setProperty('--speedometer-glow', '0')
  if (carFillLight) {
    carFillLight.intensity = 14
  }
  resetBoostParticles()
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
  resizeMinimapCanvas()
}

function setDriveKey(event, isPressed) {
  if (
    raceState.mode === 'gameOver' &&
    isPressed &&
    (event.code === 'Enter' || event.code === 'Space')
  ) {
    resetRaceSession()
    renderer?.domElement.focus()
    resumeDrivingAudio()
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

  if (event.code === 'KeyM') {
    if (isPressed && !event.repeat) {
      toggleMeshMode()
    }
    event.preventDefault()
    return
  }

  if (!(event.code in keyState)) return

  if (raceState.mode !== 'racing') {
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

startButton.addEventListener('click', () => {
  void showGameScreen()
})
window.addEventListener('resize', onWindowResize)
window.addEventListener('keydown', (event) => setDriveKey(event, true))
window.addEventListener('keyup', (event) => setDriveKey(event, false))
