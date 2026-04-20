export const DEFAULT_TRACK_ID = 'default'
export const DEFAULT_ROOM_ID_PREFIX = 'room'
export const DISPLAY_NAME_MIN_LENGTH = 3
export const DISPLAY_NAME_MAX_LENGTH = 20
export const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9 _-]+$/
export const ROOM_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])?$/
export const TRACK_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-_]{0,30}[a-z0-9])?$/
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const ROOM_MAX_PLAYERS = 8
export const ROOM_COUNTDOWN_MS = 3000
export const RACE_LAPS = 3
export const PLAYER_STATE_SEND_INTERVAL_MS = 1000 / 20
export const SNAPSHOT_BROADCAST_INTERVAL_MS = 1000 / 20
export const PING_INTERVAL_MS = 15000
export const LEADERBOARD_DEFAULT_LIMIT = 20
export const LEADERBOARD_MAX_LIMIT = 100
export const MAX_WS_MESSAGE_BYTES = 4096
export const MIN_VALID_LAP_MS = 5000
export const MAX_VALID_LAP_MS = 10 * 60 * 1000
export const MAX_VALID_RACE_MS = 45 * 60 * 1000
export const MAX_MESSAGES_PER_WINDOW = 300
export const MESSAGE_WINDOW_MS = 10_000

function getRandomBytes(length) {
  const cryptoObject = globalThis.crypto
  const bytes = new Uint8Array(length)

  if (cryptoObject?.getRandomValues) {
    cryptoObject.getRandomValues(bytes)
    return bytes
  }

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256)
  }

  return bytes
}

export function createUuid() {
  const cryptoObject = globalThis.crypto
  if (typeof cryptoObject?.randomUUID === 'function') {
    return cryptoObject.randomUUID()
  }

  const bytes = getRandomBytes(16)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

export function sanitizeDisplayName(value) {
  if (typeof value !== 'string') return null

  const normalized = value.trim().replace(/\s+/g, ' ')
  if (
    normalized.length < DISPLAY_NAME_MIN_LENGTH ||
    normalized.length > DISPLAY_NAME_MAX_LENGTH
  ) {
    return null
  }

  return DISPLAY_NAME_PATTERN.test(normalized) ? normalized : null
}

export function sanitizeRoomId(value) {
  if (typeof value !== 'string') return null
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')

  return ROOM_ID_PATTERN.test(normalized) ? normalized : null
}

export function sanitizeTrackId(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return TRACK_ID_PATTERN.test(normalized) ? normalized : null
}

export function isAnonymousPlayerId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function clampLeaderboardLimit(rawValue) {
  const parsed = Number.parseInt(rawValue ?? String(LEADERBOARD_DEFAULT_LIMIT), 10)
  if (!Number.isFinite(parsed)) return LEADERBOARD_DEFAULT_LIMIT
  return Math.min(Math.max(parsed, 1), LEADERBOARD_MAX_LIMIT)
}

export function coerceFiniteNumber(value, min = -Infinity, max = Infinity) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null
  }

  return parsed
}

export function coerceFiniteInteger(value, min = -Infinity, max = Infinity) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null
  }

  return parsed
}

export function sanitizeVector3(value, limit = 10_000) {
  if (!Array.isArray(value) || value.length !== 3) return null

  const result = value.map((entry) => coerceFiniteNumber(entry, -limit, limit))
  return result.every((entry) => entry !== null) ? result : null
}

export function sanitizeQuaternion(value) {
  if (!Array.isArray(value) || value.length !== 4) return null

  const result = value.map((entry) => coerceFiniteNumber(entry, -1.25, 1.25))
  return result.every((entry) => entry !== null) ? result : null
}

export function formatLapMs(milliseconds) {
  const safeMs = Math.max(0, Math.round(milliseconds))
  const minutes = Math.floor(safeMs / 60_000)
  const seconds = Math.floor((safeMs % 60_000) / 1000)
  const millis = safeMs % 1000

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(
    millis,
  ).padStart(3, '0')}`
}

export function shortPlayerId(anonymousPlayerId) {
  if (!isAnonymousPlayerId(anonymousPlayerId)) return 'unknown'
  return anonymousPlayerId.split('-')[0]
}

export function createRandomRoomId() {
  return `${DEFAULT_ROOM_ID_PREFIX}-${createUuid().slice(0, 8)}`
}

export function buildSocketUrl(roomId, locationLike = globalThis.location) {
  const protocol = locationLike.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${locationLike.host}/ws/room/${roomId}`
}
