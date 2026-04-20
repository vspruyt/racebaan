import * as THREE from 'three'

import {
  BOOST_EXHAUST_LOCAL_X,
  BOOST_EXHAUST_LOCAL_Y,
  BOOST_EXHAUST_LOCAL_Z,
  BOOST_PARTICLE_COUNT,
  BOOST_PARTICLE_DRAG,
  BOOST_PARTICLE_GRAVITY,
  BOOST_PARTICLE_MAX_LIFETIME,
  BOOST_PARTICLE_MIN_LIFETIME,
  BOOST_PARTICLE_MIN_SPEED,
  BOOST_PARTICLE_SIZE,
  BOOST_PARTICLE_SPAWN_RATE,
  CAR_BOOST_SPEED,
  CAR_SCALE,
  CAR_SUPERBOOST_SPEED,
  CAR_SUPERBOOST_SPEED_KMH,
  CAR_TOP_SPEED,
  FINISH_NOTICE_DURATION,
  SUPERBOOST_NOTICE_DURATION,
} from '../constants.js'
import { damp, randomBetween } from '../lib/utils.js'

export function createEffectsSystem({
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
  boostFlameCooledColor,
}) {
  let boostParticleSystem
  let boostFlameTexture

  function isBoostActive() {
    return (
      raceState.mode === 'racing' &&
      (keyState.KeyB ||
        touchActionState.boostMode === 'boost' ||
        touchActionState.boostMode === 'superboost')
    )
  }

  function isSuperboostActive() {
    return (
      raceState.mode === 'racing' &&
      (touchActionState.boostMode === 'superboost' ||
        (keyState.KeyB && keyState.ArrowUp))
    )
  }

  function getCurrentForwardTopSpeed() {
    return isSuperboostActive()
      ? CAR_SUPERBOOST_SPEED
      : isBoostActive()
        ? CAR_BOOST_SPEED
        : CAR_TOP_SPEED
  }

  function setFinishCelebrationContent(
    kicker = '',
    title = 'FINISHED',
    subtitle = 'Lap Complete',
    variant = 'finish',
  ) {
    finishKicker.textContent = kicker
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

  const finishParticleNodes = createFinishParticleNodes()

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
    kicker = '',
    title,
    subtitle,
    duration,
    variant = 'finish',
  } = {}) {
    raceState.finishTimer = duration
    setFinishCelebrationContent(kicker, title, subtitle, variant)
    seedFinishParticles(variant)
    finishCelebration.classList.remove('is-visible', 'is-bursting')
    void finishCelebration.offsetWidth
    finishCelebration.classList.add('is-visible', 'is-bursting')
  }

  function triggerFinishCelebration(completeCurrentLap) {
    const { isNewRecord } = completeCurrentLap()
    showCelebration({
      kicker: isNewRecord ? 'New Record' : '',
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

    boostParticleSystem = new THREE.Points(geometry, material)
    boostParticleSystem.frustumCulled = false
    boostParticleSystem.visible = false

    resetBoostParticles()

    return boostParticleSystem
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
        .lerp(boostFlameCooledColor, coolAmount)
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

  return {
    createBoostParticleSystem,
    getCurrentForwardTopSpeed,
    isBoostActive,
    isSuperboostActive,
    resetBoostParticles,
    setFinishCelebrationContent,
    triggerFinishCelebration,
    triggerSuperboostCelebration,
    updateBoostParticles,
  }
}
