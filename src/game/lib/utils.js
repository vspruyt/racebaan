import * as THREE from 'three'

import {
  CAR_TOP_SPEED,
  SPEED_EFFECTS_FULL_RATIO,
  SPEED_EFFECTS_START_RATIO,
} from '../constants.js'

export function randomBetween(min, max) {
  return THREE.MathUtils.lerp(min, max, Math.random())
}

export function getCurrentTimeSeconds() {
  return typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000
}

export function formatLapTime(totalSeconds) {
  const totalMilliseconds = Math.max(0, Math.round(totalSeconds * 1000))
  const minutes = Math.floor(totalMilliseconds / 60000)
  const seconds = Math.floor((totalMilliseconds % 60000) / 1000)
  const milliseconds = totalMilliseconds % 1000

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(
    milliseconds,
  ).padStart(3, '0')}`
}

export function wrapTrackDistance(distance, totalDistance) {
  if (totalDistance <= 0) return 0
  return ((distance % totalDistance) + totalDistance) % totalDistance
}

export function getTrackDistanceForward(fromDistance, toDistance, totalDistance) {
  return wrapTrackDistance(toDistance - fromDistance, totalDistance)
}

export function getTrackZoneProgress(distance, startDistance, length, totalDistance) {
  if (length <= 0) return null

  const delta = getTrackDistanceForward(startDistance, distance, totalDistance)
  if (delta > length) return null
  return THREE.MathUtils.clamp(delta / length, 0, 1)
}

export function isTrackDistanceInZone(distance, startDistance, length, totalDistance) {
  return getTrackZoneProgress(distance, startDistance, length, totalDistance) !== null
}

export function damp(current, target, smoothing, delta) {
  return THREE.MathUtils.damp(current, target, smoothing, delta)
}

export function dampAngle(current, target, smoothing, delta) {
  const deltaAngle = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI
  return current + deltaAngle * (1 - Math.exp(-smoothing * delta))
}

export function moveTowards(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target
  return current + Math.sign(target - current) * maxDelta
}

export function getSpeedRatio(speed, maxSpeed = CAR_TOP_SPEED) {
  return THREE.MathUtils.clamp(Math.abs(speed) / Math.max(maxSpeed, 0.001), 0, 1)
}

export function getFastMotionRatio(
  speed,
  maxSpeed = CAR_TOP_SPEED,
  startRatio = SPEED_EFFECTS_START_RATIO,
  fullRatio = SPEED_EFFECTS_FULL_RATIO,
) {
  return THREE.MathUtils.smoothstep(
    getSpeedRatio(speed, maxSpeed),
    startRatio,
    fullRatio,
  )
}
