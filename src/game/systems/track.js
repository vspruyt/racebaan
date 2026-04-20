import * as THREE from 'three'

import {
  FINISH_LINE_ARM_DISTANCE,
  FINISH_LINE_BANNER_HEIGHT,
  FINISH_LINE_HALF_DEPTH,
  FINISH_LINE_POST_HEIGHT,
  FINISH_LINE_SURFACE_OFFSET,
  FINISH_LINE_ZONE_SAMPLES,
  GUARDRAIL_BASE_LIFT,
  GUARDRAIL_HEIGHT,
  GUARDRAIL_OFFSET,
  GUARDRAIL_THICKNESS,
  MINIMAP_LOOKAHEAD_SAMPLES_MAX,
  MINIMAP_LOOKAHEAD_SAMPLES_MIN,
  MINIMAP_PADDING,
  TRACK_CENTER_STRIPE_REPEAT,
  TRACK_CENTER_STRIPE_WIDTH,
  TRACK_EDGE_STRIPE_INSET,
  TRACK_EDGE_STRIPE_REPEAT,
  TRACK_EDGE_STRIPE_WIDTH,
  TRACK_FRAME_SEARCH_RADIUS,
  TRACK_HALF_WIDTH,
  TRACK_PAINT_LAYER_OFFSET,
  TRACK_SKID_LAYER_INSET,
  TRACK_SKID_LAYER_OFFSET,
} from '../constants.js'
import {
  getSpeedRatio,
  isTrackDistanceInZone,
  wrapTrackDistance,
} from '../lib/utils.js'

export function getTrackBounds2D(trackData) {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (const sample of trackData.samples) {
    minX = Math.min(minX, sample.point.x)
    maxX = Math.max(maxX, sample.point.x)
    minZ = Math.min(minZ, sample.point.z)
    maxZ = Math.max(maxZ, sample.point.z)
  }

  return { minX, maxX, minZ, maxZ }
}

export function createTrackSystem({
  trackData,
  trackJump,
  trackStartIndex,
  carStartSample,
  raceState,
  carState,
  renderState,
  minimapCanvas,
  minimapContext,
  minimapState,
  onFinishLineCrossed,
}) {
  const trackMinimapBounds = getTrackBounds2D(trackData)

  function isTrackSegmentVisible(sampleIndex) {
    const totalSamples = trackData.samples.length
    const normalizedSampleIndex =
      ((sampleIndex % totalSamples) + totalSamples) % totalSamples
    const current = trackData.samples[normalizedSampleIndex]
    const next = trackData.samples[(normalizedSampleIndex + 1) % totalSamples]
    const currentInGap = isTrackDistanceInZone(
      current.distance,
      trackJump.gapStartDistance,
      trackJump.gapLength,
      trackData.totalDistance,
    )
    const nextInGap = isTrackDistanceInZone(
      next.distance,
      trackJump.gapStartDistance,
      trackJump.gapLength,
      trackData.totalDistance,
    )

    return !currentInGap && !nextInGap
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

  function addTrackCrossSectionCap(
    positions,
    sample,
    halfWidth,
    thickness,
    verticalOffset = 0,
  ) {
    const leftTop = sample.point.clone().addScaledVector(sample.side, -halfWidth)
    leftTop.y += verticalOffset

    const rightTop = sample.point.clone().addScaledVector(sample.side, halfWidth)
    rightTop.y += verticalOffset

    const leftBottom = leftTop.clone()
    leftBottom.y -= thickness

    const rightBottom = rightTop.clone()
    rightBottom.y -= thickness

    addQuad(positions, leftBottom, rightBottom, rightTop, leftTop)
  }

  function isTrackFrameInJumpZone(trackFrame) {
    return isTrackDistanceInZone(
      trackFrame.distance,
      trackJump.takeoffStartDistance,
      trackJump.takeoffLength + trackJump.gapLength + trackJump.landingLength,
      trackData.totalDistance,
    )
  }

  function createTrackRibbonGeometry(halfWidth, thickness, verticalOffset = 0) {
    const positions = []

    for (let index = 0; index < trackData.samples.length; index += 1) {
      if (!isTrackSegmentVisible(index)) continue

      const current = trackData.samples[index]
      const next = trackData.samples[(index + 1) % trackData.samples.length]

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

      if (!isTrackSegmentVisible(index - 1)) {
        addTrackCrossSectionCap(
          positions,
          current,
          halfWidth,
          thickness,
          verticalOffset,
        )
      }

      if (!isTrackSegmentVisible(index + 1)) {
        addTrackCrossSectionCap(
          positions,
          next,
          halfWidth,
          thickness,
          verticalOffset,
        )
      }
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

    for (let index = 0; index < trackData.samples.length; index += 1) {
      if (!isTrackSegmentVisible(index)) continue

      const current = trackData.samples[index]
      const next = trackData.samples[(index + 1) % trackData.samples.length]

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

      indices.push(
        vertexIndex,
        vertexIndex + 1,
        vertexIndex + 2,
        vertexIndex,
        vertexIndex + 2,
        vertexIndex + 3,
      )
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

  function createTrackStripeGeometry(
    offset,
    width,
    verticalOffset = TRACK_PAINT_LAYER_OFFSET,
  ) {
    const positions = []
    const uvs = []
    const segmentStartDistances = new Array(trackData.samples.length).fill(0)
    let totalDistance = 0

    for (let index = 0; index < trackData.samples.length; index += 1) {
      if (!isTrackSegmentVisible(index)) continue

      const current = trackData.samples[index]
      const next = trackData.samples[(index + 1) % trackData.samples.length]
      segmentStartDistances[index] = totalDistance
      totalDistance += current.point.distanceTo(next.point)
    }

    for (let index = 0; index < trackData.samples.length; index += 1) {
      if (!isTrackSegmentVisible(index)) continue

      const current = trackData.samples[index]
      const next = trackData.samples[(index + 1) % trackData.samples.length]
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

      const segmentLength = current.point.distanceTo(next.point)
      const currentU =
        totalDistance > 0 ? segmentStartDistances[index] / totalDistance : 0
      const nextU =
        totalDistance > 0
          ? (segmentStartDistances[index] + segmentLength) / totalDistance
          : 0
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
      context.fillStyle = `rgba(255, 255, 255, ${
        THREE.MathUtils.lerp(...speckleAlphaRange, random())
      })`
      context.beginPath()
      context.arc(x, y, size, 0, Math.PI * 2)
      context.fill()
    }

    for (let index = 0; index < wearCount; index += 1) {
      const x = random() * canvas.width
      const y = stripeSafeTop + random() * stripeSafeHeight
      const width = 24 + random() * 84
      const height = 6 + random() * 20
      const alpha = THREE.MathUtils.lerp(...wearAlphaRange, random())
      context.fillStyle = `rgba(255, 255, 255, ${alpha})`
      context.save()
      context.translate(x, y)
      context.rotate((random() - 0.5) * 0.2)
      context.fillRect(-width / 2, -height / 2, width, height)
      context.restore()
    }

    for (let index = 0; index < smearCount; index += 1) {
      const x = random() * canvas.width
      const y = stripeSafeTop + random() * stripeSafeHeight
      const width = 34 + random() * 120
      const height = 10 + random() * 18
      const alpha = THREE.MathUtils.lerp(...smearAlphaRange, random())
      context.fillStyle = `rgba(255, 255, 255, ${alpha})`
      context.save()
      context.translate(x, y)
      context.rotate((random() - 0.5) * 0.08)
      context.fillRect(-width / 2, -height / 2, width, height)
      context.restore()
    }

    context.globalCompositeOperation = 'multiply'
    for (let index = 0; index < smearCount * 0.75; index += 1) {
      const x = random() * canvas.width
      const y = stripeSafeTop + random() * stripeSafeHeight
      const width = 26 + random() * 96
      const height = 10 + random() * 16
      context.fillStyle = `rgba(0, 0, 0, ${0.03 + random() * 0.08})`
      context.save()
      context.translate(x, y)
      context.rotate((random() - 0.5) * 0.08)
      context.fillRect(-width / 2, -height / 2, width, height)
      context.restore()
    }

    context.globalCompositeOperation = 'source-over'
    for (let index = 0; index < smearCount; index += 1) {
      const x = random() * canvas.width
      const y = stripeSafeTop + random() * stripeSafeHeight
      const width = 48 + random() * 140
      const height = 8 + random() * 18
      context.fillStyle = `rgba(${dirtColor.r}, ${dirtColor.g}, ${dirtColor.b}, ${
        0.03 + random() * 0.08
      })`
      context.save()
      context.translate(x, y)
      context.rotate((random() - 0.5) * 0.16)
      context.fillRect(-width / 2, -height / 2, width, height)
      context.restore()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeat, 1)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }

  function createTrackEdgeStripeTexture(seed) {
    return createTrackPaintStripeTexture(seed, {
      colors: [
        [0, 'rgba(232, 236, 238, 0)'],
        [0.12, 'rgba(248, 250, 252, 0.82)'],
        [0.25, 'rgba(250, 252, 253, 0.96)'],
        [0.5, 'rgba(255, 255, 255, 0.98)'],
        [0.75, 'rgba(250, 252, 253, 0.96)'],
        [0.88, 'rgba(248, 250, 252, 0.82)'],
        [1, 'rgba(232, 236, 238, 0)'],
      ],
      dirtColor: { r: 149, g: 115, b: 55 },
      repeat: TRACK_EDGE_STRIPE_REPEAT,
      speckleCount: 72,
      smearCount: 16,
      wearCount: 20,
      speckleAlphaRange: [0.04, 0.1],
      smearAlphaRange: [0.03, 0.08],
      wearAlphaRange: [0.06, 0.16],
    })
  }

  function createTrackEdgeStripe(offset) {
    return new THREE.Mesh(
      createTrackStripeGeometry(offset, TRACK_EDGE_STRIPE_WIDTH),
      new THREE.MeshStandardMaterial({
        map: createTrackEdgeStripeTexture(offset > 0 ? 9021 : 1351),
        color: 0xffffff,
        metalness: 0.02,
        roughness: 0.86,
        transparent: true,
        alphaTest: 0.08,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.DoubleSide,
      }),
    )
  }

  function createTrackCenterStripeTexture() {
    return createTrackPaintStripeTexture(6027, {
      colors: [
        [0, 'rgba(180, 83, 9, 0)'],
        [0.14, 'rgba(229, 112, 18, 0.8)'],
        [0.28, 'rgba(245, 136, 32, 0.94)'],
        [0.5, 'rgba(251, 146, 60, 0.98)'],
        [0.72, 'rgba(245, 136, 32, 0.94)'],
        [0.86, 'rgba(229, 112, 18, 0.8)'],
        [1, 'rgba(180, 83, 9, 0)'],
      ],
      dirtColor: { r: 134, g: 93, b: 35 },
      repeat: TRACK_CENTER_STRIPE_REPEAT,
      speckleCount: 54,
      smearCount: 13,
      wearCount: 16,
      speckleAlphaRange: [0.03, 0.08],
      smearAlphaRange: [0.025, 0.07],
      wearAlphaRange: [0.05, 0.14],
    })
  }

  function createTrackCenterStripe() {
    return new THREE.Mesh(
      createTrackStripeGeometry(0, TRACK_CENTER_STRIPE_WIDTH),
      new THREE.MeshStandardMaterial({
        map: createTrackCenterStripeTexture(),
        color: 0xffffff,
        metalness: 0.02,
        roughness: 0.86,
        transparent: true,
        alphaTest: 0.08,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.DoubleSide,
      }),
    )
  }

  function createTrackSkidTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const context = canvas.getContext('2d')
    const random = createSeededRandom(2843)

    context.clearRect(0, 0, canvas.width, canvas.height)

    for (let index = 0; index < 96; index += 1) {
      const x = random() * canvas.width
      const y = random() * canvas.height
      const width = 36 + random() * 160
      const height = 5 + random() * 18
      const alpha = 0.02 + random() * 0.08
      context.fillStyle = `rgba(15, 23, 42, ${alpha})`
      context.save()
      context.translate(x, y)
      context.rotate((random() - 0.5) * 0.22)
      context.fillRect(-width / 2, -height / 2, width, height)
      context.restore()
    }

    for (let index = 0; index < 140; index += 1) {
      const x = random() * canvas.width
      const y = random() * canvas.height
      const size = 1 + random() * 2.5
      context.fillStyle = `rgba(15, 23, 42, ${0.012 + random() * 0.04})`
      context.beginPath()
      context.arc(x, y, size, 0, Math.PI * 2)
      context.fill()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(6, 1)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
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

    for (let index = 0; index < trackData.samples.length; index += 1) {
      if (!isTrackSegmentVisible(index)) continue

      const current = trackData.samples[index]
      const next = trackData.samples[(index + 1) % trackData.samples.length]
      const stripeColor = Math.floor(index / 10) % 2 === 0 ? stripeColorA : stripeColorB

      const currentInner = current.point
        .clone()
        .addScaledVector(current.side, sideSign * offset)
      currentInner.y += baseLift

      const currentOuter = current.point
        .clone()
        .addScaledVector(current.side, sideSign * (offset + thickness))
      currentOuter.y += baseLift

      const nextInner = next.point
        .clone()
        .addScaledVector(next.side, sideSign * offset)
      nextInner.y += baseLift

      const nextOuter = next.point
        .clone()
        .addScaledVector(next.side, sideSign * (offset + thickness))
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
    const finishSample = trackData.samples[trackStartIndex]
    const finishLineRoadHalfWidth =
      TRACK_HALF_WIDTH -
      TRACK_EDGE_STRIPE_INSET -
      TRACK_EDGE_STRIPE_WIDTH
    const heading = Math.atan2(
      finishSample.flatTangent.x,
      finishSample.flatTangent.z,
    )
    const group = new THREE.Group()
    group.position.copy(finishSample.point)
    group.rotation.y = heading

    const lineTexture = createFinishLineTexture()
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(
        finishLineRoadHalfWidth * 2,
        FINISH_LINE_HALF_DEPTH * 2,
      ),
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
    const totalSamples = trackData.samples.length
    const directDistance = Math.abs(a - b)
    return Math.min(directDistance, totalSamples - directDistance)
  }

  function getFinishLineSignedDistance(position) {
    return position.clone().sub(carStartSample.point).dot(carStartSample.flatTangent)
  }

  function updateFinishState(previousPosition, currentPosition, currentSampleIndex) {
    if (raceState.mode !== 'racing') return

    if (!raceState.lapArmed) {
      if (
        getCircularSampleDistance(currentSampleIndex, trackStartIndex) >
        FINISH_LINE_ARM_DISTANCE
      ) {
        raceState.lapArmed = true
      }
    } else {
      const previousSignedDistance = getFinishLineSignedDistance(previousPosition)
      const currentSignedDistance = getFinishLineSignedDistance(currentPosition)
      const nearFinishLine =
        getCircularSampleDistance(currentSampleIndex, trackStartIndex) <=
        FINISH_LINE_ZONE_SAMPLES

      if (
        nearFinishLine &&
        previousSignedDistance < 0 &&
        currentSignedDistance >= 0 &&
        carState.speed > 0.8
      ) {
        onFinishLineCrossed()
        raceState.lapArmed = false
      }
    }
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
    const segmentLength = startSample.point.distanceTo(endSample.point)
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
      distance: wrapTrackDistance(
        startSample.distance + segmentLength * alpha,
        trackData.totalDistance,
      ),
      distanceSq,
    }
  }

  function getTrackFrame(
    position,
    sampleIndexHint = null,
    lateralLimit = TRACK_HALF_WIDTH,
  ) {
    const totalSamples = trackData.samples.length
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
      const nextSampleIndex = (sampleIndex + 1) % trackData.samples.length
      const projection = projectTrackFrameOnSegment(
        position,
        trackData.samples[sampleIndex],
        trackData.samples[nextSampleIndex],
      )

      if (!bestProjection || projection.distanceSq < bestProjection.distanceSq) {
        bestProjection = projection
        bestSampleIndex = sampleIndex
      }
    }

    const projection = bestProjection
    const sampleIndex = bestSampleIndex
    const nextSampleIndex = (sampleIndex + 1) % trackData.samples.length

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
      distance: projection.distance,
      sampleIndex,
      nextSampleIndex,
    }
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

    const trackWidth = trackMinimapBounds.maxX - trackMinimapBounds.minX
    const trackHeight = trackMinimapBounds.maxZ - trackMinimapBounds.minZ
    const availableWidth = Math.max(bounds.width - MINIMAP_PADDING * 2, 1)
    const availableHeight = Math.max(bounds.height - MINIMAP_PADDING * 2, 1)
    const scale = Math.min(
      availableWidth / Math.max(trackWidth, 0.001),
      availableHeight / Math.max(trackHeight, 0.001),
    )
    const contentWidth = trackWidth * scale
    const contentHeight = trackHeight * scale

    minimapState.scale = scale
    minimapState.offsetX = (bounds.width - contentWidth) / 2 - trackMinimapBounds.minX * scale
    minimapState.offsetY = (bounds.height - contentHeight) / 2 + trackMinimapBounds.maxZ * scale
    minimapState.roadWidth = Math.max(TRACK_HALF_WIDTH * scale * 2, 8)
    minimapState.trackPoints = trackData.samples.map((sample) =>
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
      carStartSample.point.clone().addScaledVector(carStartSample.side, finishSpan),
    )
    const finishRightPoint = projectPointToMinimap(
      carStartSample.point.clone().addScaledVector(carStartSample.side, -finishSpan),
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
        (sampleIndex + lookaheadDirection + trackData.samples.length) %
        trackData.samples.length
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

  return {
    createFinishLineGroup,
    createGuardrailGeometry,
    createTrackCenterStripe,
    createTrackEdgeStripe,
    createTrackRibbonGeometry,
    createTrackSkidLayer,
    createTrackSurfaceColliderData,
    drawMinimap,
    getTrackFrame,
    isTrackFrameInJumpZone,
    resizeMinimapCanvas,
    updateFinishState,
  }
}
