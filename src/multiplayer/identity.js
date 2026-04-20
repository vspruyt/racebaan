import {
  createRandomRoomId,
  isAnonymousPlayerId,
  sanitizeDisplayName,
  sanitizeRoomId,
} from '../../shared/multiplayer.js'

const PLAYER_ID_STORAGE_KEY = 'racebaan-anonymous-player-id'
const DISPLAY_NAME_STORAGE_KEY = 'racebaan-display-name'
const ROOM_ID_STORAGE_KEY = 'racebaan-room-id'

export function getOrCreateAnonymousPlayerId() {
  const existing = window.localStorage.getItem(PLAYER_ID_STORAGE_KEY)
  if (isAnonymousPlayerId(existing)) {
    return existing
  }

  const anonymousPlayerId = crypto.randomUUID()
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

export function generateAndStoreRoomId() {
  const roomId = createRandomRoomId()
  window.localStorage.setItem(ROOM_ID_STORAGE_KEY, roomId)
  return roomId
}

export function getIdentitySnapshot() {
  return {
    anonymousPlayerId: getOrCreateAnonymousPlayerId(),
    displayName: getStoredDisplayName(),
    roomId: getStoredRoomId(),
  }
}
