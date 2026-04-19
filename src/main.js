import './style.css'
import * as THREE from 'three'

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
const gameOverCelebration = app.querySelector('.finish-celebration--danger')
const gameOverSubtitle = app.querySelector('.game-over-subtitle')

let renderer
let scene
let camera
let raceCar
let trackGlow
let carShadow
let carFillLight
let frontLeftWheelGroup
let frontRightWheelGroup
let steeringWheelGroup
const AudioContextClass =
  typeof window !== 'undefined'
    ? window.AudioContext || window.webkitAudioContext
    : null

const TRACK_BASE_Y = -0.78
const TRACK_THICKNESS = 0.16
const TRACK_HALF_WIDTH = 1.85
const TRACK_GLOW_HALF_WIDTH = TRACK_HALF_WIDTH + 0.95
const TRACK_SAMPLE_COUNT = 900
const TRACK_SHADOW_OFFSET = 0.01
const SLOPE_SPEED_FACTOR = 24
const TREE_CLEARANCE = TRACK_HALF_WIDTH + 6.8
const TRACK_CENTERING_START_RATIO = 0.52
const TRACK_RECOVERY_START_RATIO = 0.94
const TRACK_CORRECTION_DEADZONE = 0.035
const GUARDRAIL_OFFSET = TRACK_HALF_WIDTH + 0.26
const GUARDRAIL_THICKNESS = 0.18
const GUARDRAIL_HEIGHT = 0.42
const GUARDRAIL_BASE_LIFT = 0.04
const GUARDRAIL_COLLISION_HALF_WIDTH = GUARDRAIL_OFFSET - 0.3
const FINISH_LINE_HALF_DEPTH = 0.42
const FINISH_LINE_BANNER_HEIGHT = 3.4
const FINISH_LINE_POST_HEIGHT = 3.2
const FINISH_LINE_ZONE_SAMPLES = 30
const FINISH_LINE_ARM_DISTANCE = 180
const FINISH_NOTICE_DURATION = 3
const MAX_VISIBLE_LAP_TIMERS = 4
const CAR_SCALE = 0.31
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
const FIRST_PERSON_CAMERA_HEIGHT = 0.26
const FIRST_PERSON_CAMERA_FORWARD_OFFSET = 0.02
const FIRST_PERSON_CAMERA_LOOK_AHEAD = 10
const FIRST_PERSON_CAMERA_LOOK_UP = 0.05
const MIN_CAMERA_DISTANCE = 2.2
const MAX_CAMERA_DISTANCE = 8.5
const ORBIT_CAMERA_TARGET_HEIGHT = 0.9
const ORBIT_MIN_PHI = 0.45
const ORBIT_MAX_PHI = 2.45
const PHYSICS_STEP = 1 / 120
const SPEED_TO_KMH = 18
const CAR_TOP_SPEED_KMH = 220
const CAR_TOP_SPEED = CAR_TOP_SPEED_KMH / SPEED_TO_KMH
const CAR_MIN_FORWARD_SPEED = CAR_TOP_SPEED * 0.66
const CAR_REVERSE_SPEED = 5
const CAR_MIN_REVERSE_SPEED = 2.2
const AUDIO_SPEED_REFERENCE = CAR_TOP_SPEED
const SPEED_EFFECTS_START_RATIO = 0.34
const SPEED_EFFECTS_FULL_RATIO = 1
const TRACK_GLOW_BASE_OPACITY = 0.06
const TRACK_GLOW_FAST_OPACITY = 0.18
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
const CRASH_TRIGGER_IMPACT_INTENSITY = 0.72
const CRASH_TRIGGER_SPEED = 4.6
const CRASH_GRAVITY = 18
const CRASH_LINEAR_DAMPING = 0.9
const CRASH_ANGULAR_DAMPING = 1.8
const CRASH_GROUND_FRICTION = 5.8
const CRASH_BOUNCE_DAMPING = 0.22
const CRASH_GAME_OVER_DELAY = 0.65
const CRASH_SETTLE_SPEED = 1.2
const CRASH_OUT_OF_TRACK_MARGIN = 1.4
const WORLD_UP = new THREE.Vector3(0, 1, 0)
const clock = new THREE.Clock()
const TRACK_DATA = createTrackData()
const TRACK_MINIMAP_BOUNDS = getTrackBounds2D()
const TRACK_START_INDEX = 18
const CAR_START_SAMPLE = TRACK_DATA.samples[TRACK_START_INDEX]
const CAR_START_POSITION = CAR_START_SAMPLE.point.clone()
CAR_START_POSITION.y += CAR_RIDE_HEIGHT
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
  lookTarget: new THREE.Vector3(),
  pitch: 0,
  roll: 0,
  wheelSteer: 0,
  trackSampleIndex: TRACK_START_INDEX,
}
const raceState = {
  lapArmed: false,
  finishTimer: 0,
  laps: [],
  nextLapNumber: 1,
  mode: 'racing',
}
const crashState = {
  active: false,
  timer: 0,
  groundContactTime: 0,
  reason: '',
  velocity: new THREE.Vector3(),
  angularVelocity: new THREE.Vector3(),
  orientation: new THREE.Euler(0, CAR_START_ROTATION, 0, 'XYZ'),
}
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
const finishParticleNodes = createFinishParticleNodes()

function randomBetween(min, max) {
  return THREE.MathUtils.lerp(min, max, Math.random())
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

function seedFinishParticles() {
  const palette = ['#fff4da', '#ffd166', '#ef4444', '#ffffff', '#ff8a65']

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

function triggerFinishCelebration() {
  completeCurrentLap()
  raceState.finishTimer = FINISH_NOTICE_DURATION
  seedFinishParticles()
  finishCelebration.classList.remove('is-visible', 'is-bursting')
  void finishCelebration.offsetWidth
  finishCelebration.classList.add('is-visible', 'is-bursting')
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
    node: card,
    statusNode: status,
    valueNode: value,
  }
}

function syncLapTimerEntry(entry) {
  entry.statusNode.textContent = entry.completed ? 'Finished' : 'Current'
  entry.valueNode.textContent = formatLapTime(entry.elapsed)
  entry.node.classList.toggle('is-active', !entry.completed)
  entry.node.classList.toggle('is-complete', entry.completed)
}

function trimLapTimerEntries() {
  while (raceState.laps.length > MAX_VISIBLE_LAP_TIMERS) {
    const removedEntry = raceState.laps.shift()
    removedEntry.node.remove()
  }
}

function appendLapTimerEntry() {
  const entry = createLapTimerEntry(raceState.nextLapNumber)
  raceState.nextLapNumber += 1
  syncLapTimerEntry(entry)
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
      1.68 +
      Math.sin(angle - 0.4) * 0.96 +
      Math.sin(angle * 2 + 0.85) * 0.46 +
      Math.cos(angle * 3 - 0.22) * 0.28
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

function createGuardrailGeometry(sideSign) {
  const positions = []
  const colors = []
  const stripeColorA = new THREE.Color(0xf8fafc)
  const stripeColorB = new THREE.Color(0xd72f2f)
  const topColor = new THREE.Color(0x98a3ad)
  const isRightGuardrail = sideSign > 0

  for (let index = 0; index < TRACK_DATA.samples.length; index += 1) {
    const current = TRACK_DATA.samples[index]
    const next = TRACK_DATA.samples[(index + 1) % TRACK_DATA.samples.length]
    const stripeColor = Math.floor(index / 10) % 2 === 0 ? stripeColorA : stripeColorB

    const currentInner = current.point
      .clone()
      .addScaledVector(current.side, sideSign * GUARDRAIL_OFFSET)
    currentInner.y += GUARDRAIL_BASE_LIFT

    const currentOuter = current.point
      .clone()
      .addScaledVector(
        current.side,
        sideSign * (GUARDRAIL_OFFSET + GUARDRAIL_THICKNESS),
      )
    currentOuter.y += GUARDRAIL_BASE_LIFT

    const nextInner = next.point
      .clone()
      .addScaledVector(next.side, sideSign * GUARDRAIL_OFFSET)
    nextInner.y += GUARDRAIL_BASE_LIFT

    const nextOuter = next.point
      .clone()
      .addScaledVector(
        next.side,
        sideSign * (GUARDRAIL_OFFSET + GUARDRAIL_THICKNESS),
      )
    nextOuter.y += GUARDRAIL_BASE_LIFT

    const currentInnerTop = currentInner.clone()
    currentInnerTop.y += GUARDRAIL_HEIGHT

    const currentOuterTop = currentOuter.clone()
    currentOuterTop.y += GUARDRAIL_HEIGHT

    const nextInnerTop = nextInner.clone()
    nextInnerTop.y += GUARDRAIL_HEIGHT

    const nextOuterTop = nextOuter.clone()
    nextOuterTop.y += GUARDRAIL_HEIGHT

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
        topColor,
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
        topColor,
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
  line.position.y = 0.03
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

  const accelerating = keyState.ArrowUp || keyState.KeyW
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

  const rearRightWheel = createWheel()
  rearRightWheel.position.set(-0.86, 0.02, -1.08)
  car.add(rearRightWheel)

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

function hasDriveInput() {
  return (
    keyState.ArrowUp ||
    keyState.ArrowDown ||
    keyState.ArrowLeft ||
    keyState.ArrowRight ||
    keyState.Space ||
    keyState.KeyW ||
    keyState.KeyA ||
    keyState.KeyS ||
    keyState.KeyD
  )
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
  const projectedZ = centerPoint.z + side.z * lateralOffset
  const distanceSq =
    (position.x - projectedX) * (position.x - projectedX) +
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
    trackFrame.limitedSurfacePoint.y + CAR_RIDE_HEIGHT,
    trackFrame.limitedSurfacePoint.z,
  )
  return trackFrame
}

function triggerGameOver(reason = 'wrecked') {
  if (raceState.mode === 'gameOver') return

  raceState.mode = 'gameOver'
  raceState.finishTimer = 0
  crashState.active = false
  crashState.reason = reason
  crashState.velocity.set(0, 0, 0)
  crashState.angularVelocity.set(0, 0, 0)
  carState.speed = 0
  audioState.guardrailContactActive = false

  finishCelebration.classList.remove('is-visible', 'is-bursting')
  gameOverSubtitle.textContent =
    reason === 'upsideDown'
      ? 'Upside down. Press Space to respawn'
      : reason === 'offTrack'
        ? 'Press Space to respawn'
        : 'Press Space to respawn'
  gameOverCelebration.classList.add('is-visible')
}

function beginCrash(trackFrame, impactIntensity, impactSpeed, forwardDirection) {
  const impactSide = Math.sign(trackFrame.lateralOffset) || 1
  const outwardDirection = trackFrame.normal.clone().multiplyScalar(impactSide)
  const tangentialVelocity = forwardDirection
    .clone()
    .multiplyScalar(Math.max(impactSpeed * (0.48 - impactIntensity * 0.12), 1.4))
  const outwardVelocity = outwardDirection.multiplyScalar(
    THREE.MathUtils.lerp(3.8, 8.6, impactIntensity),
  )
  const upwardVelocity = new THREE.Vector3(
    0,
    THREE.MathUtils.lerp(1.8, 4.8, impactIntensity),
    0,
  )

  raceState.mode = 'crashed'
  crashState.active = true
  crashState.timer = 0
  crashState.groundContactTime = 0
  crashState.reason = ''
  crashState.velocity.copy(tangentialVelocity).add(outwardVelocity).add(upwardVelocity)
  crashState.angularVelocity.set(
    Math.sign(carState.speed || 1) * THREE.MathUtils.lerp(2.8, 7.2, impactIntensity),
    -impactSide * THREE.MathUtils.lerp(1.2, 3.8, impactIntensity),
    -impactSide *
      THREE.MathUtils.lerp(4.8, 11.2, impactIntensity) *
      (0.76 + Math.abs(carState.steer) * 0.28),
  )
  crashState.orientation.set(
    -renderState.pitch,
    renderState.rotation,
    renderState.roll,
    'XYZ',
  )

  clearDriveKeys()
  audioState.guardrailContactActive = false
  carState.speed = impactSpeed
  carState.position.addScaledVector(outwardDirection, 0.18)
  carState.position.y += 0.12
}

function updateCrash(delta) {
  if (!crashState.active) return

  crashState.timer += delta
  crashState.velocity.y -= CRASH_GRAVITY * delta
  crashState.velocity.multiplyScalar(Math.exp(-CRASH_LINEAR_DAMPING * delta))
  crashState.angularVelocity.multiplyScalar(Math.exp(-CRASH_ANGULAR_DAMPING * delta))

  crashState.orientation.x += crashState.angularVelocity.x * delta
  crashState.orientation.y += crashState.angularVelocity.y * delta
  crashState.orientation.z += crashState.angularVelocity.z * delta
  carState.position.addScaledVector(crashState.velocity, delta)
  carState.rotation = crashState.orientation.y

  const trackFrame = getTrackFrame(carState.position, carState.trackSampleIndex)
  carState.trackSampleIndex = trackFrame.sampleIndex
  const surfaceHeight = trackFrame.surfacePoint.y + CAR_RIDE_HEIGHT

  if (carState.position.y <= surfaceHeight) {
    carState.position.y = surfaceHeight

    if (Math.abs(crashState.velocity.y) < 0.55) {
      crashState.velocity.y = 0
    } else if (crashState.velocity.y < 0) {
      crashState.velocity.y = -crashState.velocity.y * CRASH_BOUNCE_DAMPING
    }

    const groundDrag = Math.exp(-CRASH_GROUND_FRICTION * delta)
    crashState.velocity.x *= groundDrag
    crashState.velocity.z *= groundDrag
    crashState.angularVelocity.x *= Math.exp(-5.4 * delta)
    crashState.angularVelocity.z *= Math.exp(-5.1 * delta)
    crashState.groundContactTime += delta
  } else {
    crashState.groundContactTime = 0
  }

  const crashForward = new THREE.Vector3(
    Math.sin(crashState.orientation.y),
    0,
    Math.cos(crashState.orientation.y),
  )
  const crashSpeed = crashState.velocity.length()
  carState.speed =
    crashSpeed *
    (crashState.velocity.dot(crashForward) >= 0 ? 1 : -1)

  const upDot = new THREE.Vector3(0, 1, 0)
    .applyEuler(crashState.orientation)
    .dot(WORLD_UP)
  const upsideDown =
    upDot < -0.35 &&
    carState.position.y <= surfaceHeight + 0.14
  const outOfTrack =
    Math.abs(trackFrame.lateralOffset) >
    GUARDRAIL_OFFSET + GUARDRAIL_THICKNESS + CRASH_OUT_OF_TRACK_MARGIN
  const settled =
    crashState.groundContactTime > 0.18 &&
    crashState.velocity.length() < CRASH_SETTLE_SPEED

  if (
    crashState.timer >= CRASH_GAME_OVER_DELAY &&
    (upsideDown || outOfTrack || settled)
  ) {
    triggerGameOver(
      outOfTrack ? 'offTrack' : upsideDown ? 'upsideDown' : 'wrecked',
    )
  }
}

function updateCar(delta) {
  const previousPosition = carState.position.clone()
  const accelerating = keyState.ArrowUp || keyState.KeyW
  const reversing = keyState.ArrowDown || keyState.KeyS
  const braking = keyState.Space
  const steeringLeft = keyState.ArrowLeft || keyState.KeyA
  const steeringRight = keyState.ArrowRight || keyState.KeyD
  const steeringInput = (steeringLeft ? 1 : 0) - (steeringRight ? 1 : 0)
  let trackFrame = getTrackFrame(carState.position, carState.trackSampleIndex)
  carState.trackSampleIndex = trackFrame.sampleIndex
  carState.steer = damp(carState.steer, steeringInput, 24, delta)

  const forwardDirection = new THREE.Vector3(
    Math.sin(carState.rotation),
    0,
    Math.cos(carState.rotation),
  )
  const signedTravelDirection =
    Math.abs(carState.speed) > 0.02
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

  if (accelerating) {
    const accelerationForce = THREE.MathUtils.lerp(
      10.2,
      2.6,
      getSpeedRatio(carState.speed),
    )
    carState.speed += accelerationForce * delta
  }

  if (reversing) {
    const reverseForce = THREE.MathUtils.lerp(
      9.6,
      2.6,
      Math.min(Math.abs(carState.speed) / 4.8, 1),
    )
    carState.speed -= reverseForce * delta
  }

  if (braking) {
    const brakeForce = accelerating || reversing ? 12 : 18
    const brakeAmount = Math.min(Math.abs(carState.speed), brakeForce * delta)
    carState.speed -= Math.sign(carState.speed) * brakeAmount
  }

  if (!accelerating && !reversing && !braking) {
    const drag = Math.min(Math.abs(carState.speed), 4.2 * delta)
    carState.speed -= Math.sign(carState.speed) * drag
  }

  const slopeAcceleration = -gradeLoad * SLOPE_SPEED_FACTOR
  carState.speed += slopeAcceleration * delta

  const maxForwardSpeed = THREE.MathUtils.clamp(
    CAR_TOP_SPEED - uphillLoad * 38 + downhillAssist * 18,
    CAR_MIN_FORWARD_SPEED,
    CAR_TOP_SPEED,
  )
  const maxReverseSpeed = THREE.MathUtils.clamp(
    3.6 - uphillLoad * 14 + downhillAssist * 8,
    CAR_MIN_REVERSE_SPEED,
    CAR_REVERSE_SPEED,
  )
  carState.speed = THREE.MathUtils.clamp(
    carState.speed,
    -maxReverseSpeed,
    maxForwardSpeed,
  )

  if (Math.abs(carState.steer) > 0.001 && Math.abs(carState.speed) > 0.03) {
    const speedFactor = getSpeedRatio(carState.speed)
    const steerDirection = carState.speed >= 0 ? 1 : -1
    const turnRate = THREE.MathUtils.lerp(2.9, 1.75, speedFactor)
    carState.rotation += carState.steer * steerDirection * turnRate * delta

    const cornerDrag = 1 - Math.min(Math.abs(carState.steer) * speedFactor * 0.42 * delta, 0.018)
    carState.speed *= cornerDrag
  }

  if (Math.abs(carState.speed) > 0.08) {
    const assistSpeedFactor = getSpeedRatio(carState.speed)
    const trackHeading = Math.atan2(
      trackFrame.flatTangent.x,
      trackFrame.flatTangent.z,
    )
    const targetHeading = carState.speed >= 0 ? trackHeading : trackHeading + Math.PI
    const headingError =
      THREE.MathUtils.euclideanModulo(targetHeading - carState.rotation + Math.PI, Math.PI * 2) -
      Math.PI
    const headingAssistStrength = 0
    carState.rotation += headingError * headingAssistStrength * assistSpeedFactor * delta
  }

  trackFrame = getTrackFrame(carState.position, carState.trackSampleIndex)
  carState.trackSampleIndex = trackFrame.sampleIndex
  carState.speed = THREE.MathUtils.clamp(
    carState.speed,
    -maxReverseSpeed,
    maxForwardSpeed,
  )

  const proposedPosition = carState.position
    .clone()
    .addScaledVector(forwardDirection, carState.speed * delta)

  const unclampedPosition = proposedPosition.clone()
  trackFrame = clampToTrack(proposedPosition, carState.trackSampleIndex)
  carState.trackSampleIndex = trackFrame.sampleIndex

  const correctionDistance = proposedPosition.distanceTo(unclampedPosition)
  if (trackFrame.hitLimit && correctionDistance > TRACK_CORRECTION_DEADZONE) {
    const excessCorrection = correctionDistance - TRACK_CORRECTION_DEADZONE
    const impactSpeed = Math.abs(carState.speed)
    const impactIntensity = THREE.MathUtils.clamp(
      excessCorrection * 18 + impactSpeed / AUDIO_SPEED_REFERENCE * 0.85,
      0,
      1,
    )
    carState.position.copy(proposedPosition)

    if (
      impactIntensity >= CRASH_TRIGGER_IMPACT_INTENSITY &&
      impactSpeed >= CRASH_TRIGGER_SPEED
    ) {
      triggerGuardrailImpactSound(Math.min(1, impactIntensity + 0.15))
      beginCrash(trackFrame, impactIntensity, impactSpeed, forwardDirection)
      return
    }

    if (!audioState.guardrailContactActive) {
      triggerGuardrailImpactSound(impactIntensity)
    }
    audioState.guardrailContactActive = true
    carState.speed *= 1 - Math.min(excessCorrection * 0.34, 0.22)
  } else {
    audioState.guardrailContactActive = false
    carState.position.copy(proposedPosition)
  }

  updateFinishState(previousPosition, carState.position, carState.trackSampleIndex)
}

function updateRenderState(delta) {
  raceState.finishTimer = Math.max(raceState.finishTimer - delta, 0)
  const finishVisible = raceState.finishTimer > 0
  finishCelebration.classList.toggle('is-visible', finishVisible)
  if (!finishVisible) {
    finishCelebration.classList.remove('is-bursting')
  }
  gameOverCelebration.classList.toggle('is-visible', raceState.mode === 'gameOver')

  renderState.position.lerp(carState.position, 1 - Math.exp(-30 * delta))
  renderState.rotation = dampAngle(
    renderState.rotation,
    carState.rotation,
    raceState.mode === 'racing' ? 28 : 14,
    delta,
  )
  const trackFrame = getTrackFrame(
    renderState.position,
    renderState.trackSampleIndex,
  )
  renderState.trackSampleIndex = trackFrame.sampleIndex
  if (raceState.mode === 'racing') {
    const targetPitch = Math.atan2(
      trackFrame.tangent.y,
      Math.hypot(trackFrame.tangent.x, trackFrame.tangent.z),
    )
    renderState.pitch = damp(renderState.pitch, targetPitch, 10, delta)
    renderState.roll = damp(
      renderState.roll,
      -carState.steer * Math.min(Math.abs(carState.speed) * 0.012, 0.045),
      16,
      delta,
    )
  } else {
    renderState.pitch = damp(renderState.pitch, -crashState.orientation.x, 10, delta)
    renderState.roll = damp(renderState.roll, crashState.orientation.z, 10, delta)
  }
  renderState.wheelSteer = damp(
    renderState.wheelSteer,
    raceState.mode === 'racing'
      ? carState.steer * FRONT_WHEEL_MAX_STEER_ANGLE
      : 0,
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

  raceCar.position.copy(renderState.position)
  raceCar.rotation.x = -renderState.pitch
  raceCar.rotation.y = renderState.rotation
  raceCar.rotation.z = renderState.roll
  if (frontLeftWheelGroup) frontLeftWheelGroup.rotation.y = renderState.wheelSteer
  if (frontRightWheelGroup) frontRightWheelGroup.rotation.y = renderState.wheelSteer
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

  if (trackGlow?.material) {
    trackGlow.material.opacity = THREE.MathUtils.lerp(
      TRACK_GLOW_BASE_OPACITY,
      TRACK_GLOW_FAST_OPACITY,
      fastMotionRatio,
    )
  }

  updateDrivingAudio(delta, trackFrame)
}

function getOrbitCameraTarget() {
  return renderState.position.clone().add(new THREE.Vector3(0, ORBIT_CAMERA_TARGET_HEIGHT, 0))
}

function updateCamera(delta) {
  const target = renderState.position.clone().add(new THREE.Vector3(0, 0.24, 0))
  const isRacing = hasDriveInput() || Math.abs(carState.speed) > 0.15
  const speedVisualTarget =
    raceState.mode === 'racing' ? getFastMotionRatio(carState.speed) : 0
  cameraState.speedVisual = damp(cameraState.speedVisual, speedVisualTarget, 4.5, delta)

  if (isRacing && cameraState.mode === 'orbit') {
    cameraState.mode = cameraState.driveMode
  }

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
    desiredPosition.y = Math.max(
      desiredPosition.y,
      getTrackFrame(orbitTarget).surfacePoint.y + 0.08,
    )
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
      -renderState.pitch,
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

function createGameScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xbfe7ff)
  scene.fog = new THREE.Fog(0xd9f1ff, 52, 160)

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
  ground.position.y = -1.2
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

  const innerStripe = createTrackLine(-(TRACK_HALF_WIDTH - 0.16), 0xf8fafc)
  scene.add(innerStripe)

  const outerStripe = createTrackLine(TRACK_HALF_WIDTH - 0.16, 0xf8fafc)
  scene.add(outerStripe)

  const centerLaneStripe = createTrackLine(0, 0xf59e0b)
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

  trackGlow = new THREE.Mesh(
    createTrackRibbonGeometry(TRACK_GLOW_HALF_WIDTH, 0.02, -0.34),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: TRACK_GLOW_BASE_OPACITY,
      side: THREE.DoubleSide,
    }),
  )
  scene.add(trackGlow)

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

  resetRaceSession()

  clock.start()
  renderer.setAnimationLoop(() => {
    const frameDelta = Math.min(clock.getDelta(), 0.05)
    let remaining = frameDelta
    while (remaining > 0) {
      const step = Math.min(remaining, PHYSICS_STEP)
      if (raceState.mode === 'racing') {
        advanceLapTimer(step)
        updateCar(step)
      } else if (raceState.mode === 'crashed') {
        updateCrash(step)
      }
      remaining -= step
    }

    updateRenderState(frameDelta)
    updateCamera(frameDelta)

    renderer.render(scene, camera)
  })
}

function showGameScreen() {
  homeScreen.classList.add('hidden')
  gameScreen.classList.remove('hidden')
  resumeDrivingAudio()

  if (!renderer) {
    createGameScene()
  }

  renderer.domElement.focus()
  onWindowResize()
}

function resetRaceSession() {
  clearDriveKeys()
  raceState.mode = 'racing'
  raceState.lapArmed = false
  raceState.finishTimer = 0
  resetLapTimers()

  crashState.active = false
  crashState.timer = 0
  crashState.groundContactTime = 0
  crashState.reason = ''
  crashState.velocity.set(0, 0, 0)
  crashState.angularVelocity.set(0, 0, 0)
  crashState.orientation.set(0, CAR_START_ROTATION, 0, 'XYZ')

  carState.position.copy(CAR_START_POSITION)
  carState.rotation = CAR_START_ROTATION
  carState.speed = 0
  carState.steer = 0
  carState.trackSampleIndex = TRACK_START_INDEX

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
  renderState.pitch = 0
  renderState.roll = 0
  renderState.wheelSteer = 0
  renderState.trackSampleIndex = TRACK_START_INDEX
  renderState.lookTarget.set(
    carState.position.x,
    carState.position.y + 0.24,
    carState.position.z,
  )

  raceCar.position.copy(carState.position)
  raceCar.rotation.set(0, carState.rotation, 0)
  carShadow.position.set(
    CAR_START_POSITION.x,
    CAR_START_SAMPLE.point.y + TRACK_SHADOW_OFFSET,
    CAR_START_POSITION.z,
  )
  carShadow.material.opacity = 0.35
  finishCelebration.classList.remove('is-visible', 'is-bursting')
  gameOverCelebration.classList.remove('is-visible')
  gameScreen.style.setProperty('--speedometer-glow', '0')
  if (trackGlow?.material) {
    trackGlow.material.opacity = TRACK_GLOW_BASE_OPACITY
  }
  if (carFillLight) {
    carFillLight.intensity = 14
  }
  speedometerValue.textContent = '0'
  if (frontLeftWheelGroup) frontLeftWheelGroup.rotation.y = 0
  if (frontRightWheelGroup) frontRightWheelGroup.rotation.y = 0
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

startButton.addEventListener('click', showGameScreen)
window.addEventListener('resize', onWindowResize)
window.addEventListener('keydown', (event) => setDriveKey(event, true))
window.addEventListener('keyup', (event) => setDriveKey(event, false))
