import {
  createUuid,
  createRandomRoomId,
  isAnonymousPlayerId,
  sanitizeDisplayName,
  sanitizeRoomId,
} from '../../shared/multiplayer.js'

const PLAYER_ID_STORAGE_KEY = 'racebaan-anonymous-player-id'
const DISPLAY_NAME_STORAGE_KEY = 'racebaan-display-name'
const ROOM_ID_STORAGE_KEY = 'racebaan-room-id'
const ROOM_URL_QUERY_PARAM = 'room'

export function getOrCreateAnonymousPlayerId() {
  const existing = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY)
  if (isAnonymousPlayerId(existing)) {
    return existing
  }

  const anonymousPlayerId = createUuid()
  window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, anonymousPlayerId)
  return anonymousPlayerId
}

export function getStoredDisplayName() {
  const rawValue = window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY)
  return sanitizeDisplayName(rawValue)
}

export function getStoredRoomId() {
  const rawValue = window.localStorage.getItem(ROOM_ID_STORAGE_KEY)
  return sanitizeRoomId(rawValue) ?? createRandomRoomId()
}

export function saveDisplayName(displayName) {
  const sanitized = sanitizeDisplayName(displayName)
  if (!sanitized) return null

  window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, sanitized)
  return sanitized
}

export function saveRoomId(roomId) {
  const sanitized = sanitizeRoomId(roomId)
  if (!sanitized) return null

  window.localStorage.setItem(ROOM_ID_STORAGE_KEY, sanitized)
  return sanitized
}

export function getSharedRoomIdFromUrl(locationLike = globalThis.location) {
  const href = locationLike?.href
  if (typeof href !== 'string' || !href) return null

  const roomId = new URL(href).searchParams.get(ROOM_URL_QUERY_PARAM)
  return sanitizeRoomId(roomId)
}

export function buildRoomShareUrl(roomId, locationLike = globalThis.location) {
  const sanitizedRoomId = sanitizeRoomId(roomId)
  const href = locationLike?.href
  if (!sanitizedRoomId || typeof href !== 'string' || !href) return null

  const url = new URL(href)
  url.searchParams.set(ROOM_URL_QUERY_PARAM, sanitizedRoomId)
  return url.toString()
}

export function getIdentitySnapshot() {
  return {
    anonymousPlayerId: getOrCreateAnonymousPlayerId(),
    displayName: getStoredDisplayName(),
    roomId: getStoredRoomId(),
  }
}
