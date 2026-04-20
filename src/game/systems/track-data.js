import * as THREE from 'three'

import {
  TRACK_BASE_Y,
  TRACK_HEIGHT_OFFSET,
  TRACK_HEIGHT_WAVE_1,
  TRACK_HEIGHT_WAVE_2,
  TRACK_HEIGHT_WAVE_3,
  TRACK_JUMP_GAP_LENGTH,
  TRACK_JUMP_LANDING_FLAT_LENGTH,
  TRACK_JUMP_LANDING_LENGTH,
  TRACK_JUMP_LANDING_LIFT,
  TRACK_JUMP_LIP_FLAT_LENGTH,
  TRACK_JUMP_TAKEOFF_LENGTH,
  TRACK_JUMP_TAKEOFF_LIFT,
  TRACK_SAMPLE_COUNT,
  TRACK_STRAIGHT_TURN_THRESHOLD,
} from '../constants.js'
import { getTrackZoneProgress, wrapTrackDistance } from '../lib/utils.js'

export function createTrackData() {
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
      distance: 0,
      tangent: new THREE.Vector3(),
      flatTangent,
      side,
      turnStrength: 0,
    })
  }

  updateTrackSampleTangents(samples)
  updateTrackSampleTurnStrength(samples)
  const initialTotalDistance = updateTrackSampleDistances(samples)
  const initialJumpFeature = createTrackJumpFeature(samples, initialTotalDistance)
  applyTrackJumpProfile(samples, initialJumpFeature, initialTotalDistance)
  updateTrackSampleTangents(samples)
  const totalDistance = updateTrackSampleDistances(samples)
  const jumpFeature = createTrackJumpFeature(samples, totalDistance)

  return {
    curve: planCurve,
    samples,
    totalDistance,
    jumpFeature,
  }
}

function updateTrackSampleTangents(samples) {
  for (let index = 0; index < samples.length; index += 1) {
    const previousSample = samples[(index - 1 + samples.length) % samples.length]
    const nextSample = samples[(index + 1) % samples.length]
    samples[index].tangent = nextSample.point
      .clone()
      .sub(previousSample.point)
      .normalize()
  }
}

function updateTrackSampleTurnStrength(samples) {
  for (let index = 0; index < samples.length; index += 1) {
    const previous = samples[(index - 1 + samples.length) % samples.length].flatTangent
    const next = samples[(index + 1) % samples.length].flatTangent
    const headingDelta = Math.acos(
      THREE.MathUtils.clamp(previous.dot(next), -1, 1),
    )
    samples[index].turnStrength = Math.min(headingDelta / 0.44, 1)
  }
}

function updateTrackSampleDistances(samples) {
  let totalDistance = 0

  for (let index = 0; index < samples.length; index += 1) {
    const current = samples[index]
    const next = samples[(index + 1) % samples.length]
    current.distance = totalDistance
    totalDistance += current.point.distanceTo(next.point)
  }

  return totalDistance
}

function createTrackJumpFeature(samples, totalDistance) {
  let bestRun = null
  let currentRun = null

  const commitRun = (endPassIndex) => {
    if (!currentRun || currentRun.count >= samples.length) {
      currentRun = null
      return
    }

    if (!bestRun || currentRun.length > bestRun.length) {
      bestRun = {
        startSampleIndex: currentRun.startSampleIndex,
        endSampleIndex:
          ((endPassIndex - 1) % samples.length + samples.length) % samples.length,
        count: currentRun.count,
        length: currentRun.length,
      }
    }

    currentRun = null
  }

  for (let passIndex = 0; passIndex < samples.length * 2; passIndex += 1) {
    const sampleIndex = passIndex % samples.length
    const nextSampleIndex = (sampleIndex + 1) % samples.length
    const isStraight =
      samples[sampleIndex].turnStrength <= TRACK_STRAIGHT_TURN_THRESHOLD

    if (isStraight) {
      if (!currentRun) {
        currentRun = {
          startSampleIndex: sampleIndex,
          count: 0,
          length: 0,
        }
      }

      currentRun.count += 1
      currentRun.length += samples[sampleIndex].point.distanceTo(
        samples[nextSampleIndex].point,
      )
    } else {
      commitRun(passIndex)
    }
  }

  commitRun(samples.length * 2)

  const straightLength = bestRun?.length ?? 0
  const straightStartDistance = bestRun
    ? samples[bestRun.startSampleIndex].distance
    : 0
  const centerDistance = wrapTrackDistance(
    straightStartDistance + straightLength * 0.5,
    totalDistance,
  )
  const gapLength = Math.min(TRACK_JUMP_GAP_LENGTH, Math.max(straightLength * 0.032, 1.9))
  const takeoffLength = Math.min(
    TRACK_JUMP_TAKEOFF_LENGTH,
    Math.max(straightLength * 0.058, 3.2),
  )
  const landingLength = Math.min(
    TRACK_JUMP_LANDING_LENGTH,
    Math.max(straightLength * 0.05, 2.8),
  )
  const gapStartDistance = wrapTrackDistance(
    centerDistance - gapLength * 0.5,
    totalDistance,
  )
  const gapEndDistance = wrapTrackDistance(
    centerDistance + gapLength * 0.5,
    totalDistance,
  )

  return {
    straightLength,
    straightStartSampleIndex: bestRun?.startSampleIndex ?? 0,
    straightEndSampleIndex: bestRun?.endSampleIndex ?? 0,
    centerDistance,
    gapStartDistance,
    gapLength,
    gapEndDistance,
    takeoffStartDistance: wrapTrackDistance(
      gapStartDistance - takeoffLength,
      totalDistance,
    ),
    takeoffLength,
    landingStartDistance: gapEndDistance,
    landingLength,
  }
}

function applyTrackJumpProfile(samples, jumpFeature, totalDistance) {
  for (const sample of samples) {
    const takeoffProgress = getTrackZoneProgress(
      sample.distance,
      jumpFeature.takeoffStartDistance,
      jumpFeature.takeoffLength,
      totalDistance,
    )

    if (takeoffProgress !== null) {
      const takeoffDistance = takeoffProgress * jumpFeature.takeoffLength
      const climbLength = Math.max(
        jumpFeature.takeoffLength - TRACK_JUMP_LIP_FLAT_LENGTH,
        0.001,
      )
      const climbProgress = THREE.MathUtils.clamp(
        takeoffDistance / climbLength,
        0,
        1,
      )
      const liftProgress = THREE.MathUtils.smootherstep(climbProgress, 0, 1)
      sample.point.y += TRACK_JUMP_TAKEOFF_LIFT * liftProgress
    }

    const landingProgress = getTrackZoneProgress(
      sample.distance,
      jumpFeature.landingStartDistance,
      jumpFeature.landingLength,
      totalDistance,
    )

    if (landingProgress !== null) {
      const landingDistance = landingProgress * jumpFeature.landingLength
      const settleDistance = Math.max(
        landingDistance - TRACK_JUMP_LANDING_FLAT_LENGTH,
        0,
      )
      const settleLength = Math.max(
        jumpFeature.landingLength - TRACK_JUMP_LANDING_FLAT_LENGTH,
        0.001,
      )
      const settleProgress =
        1 - THREE.MathUtils.smootherstep(settleDistance / settleLength, 0, 1)
      sample.point.y += TRACK_JUMP_LANDING_LIFT * settleProgress
    }
  }
}
