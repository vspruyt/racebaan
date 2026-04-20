import {
  DEFAULT_TRACK_ID,
  sanitizeRoomId,
  sanitizeTrackId,
} from '../shared/multiplayer.js'
import { RaceRoom } from './durable-objects/race-room.js'
import { errorJson, json } from './lib/http.js'
import {
  getLeaderboardQueryParams,
  queryLeaderboard,
  queryPersonalBest,
} from './lib/leaderboard.js'

async function handleLeaderboardRequest(env, url) {
  const params = getLeaderboardQueryParams(url)
  const kind = url.pathname.split('/').at(-1)

  if (kind === 'personal') {
    const result = await queryPersonalBest(env, params)

    return json({
      ok: true,
      period: kind,
      trackId: params.trackId,
      anonymousPlayerId: params.anonymousPlayerId,
      result,
    })
  }

  if (kind !== 'all-time') {
    return errorJson(404, 'not_found', 'Unknown leaderboard endpoint.')
  }

  if (!sanitizeTrackId(params.trackId ?? DEFAULT_TRACK_ID)) {
    return errorJson(400, 'invalid_track_id', 'Track ID was invalid.')
  }

  const rows = await queryLeaderboard(env, params)

  return json({
    ok: true,
    period: kind,
    trackId: params.trackId,
    limit: params.limit,
    results: rows,
  })
}

async function handleRoomSummaryRequest(env, url) {
  const roomId = sanitizeRoomId(url.pathname.split('/').at(-1) ?? '')
  if (!roomId) {
    return errorJson(400, 'invalid_room_id', 'Room ID must use lowercase letters, numbers, or dashes.')
  }

  const stub = env.RACE_ROOM.get(env.RACE_ROOM.idFromName(roomId))
  const forwardUrl = new URL(url)
  forwardUrl.pathname = `/room/${roomId}/summary`

  return stub.fetch(new Request(forwardUrl, { method: 'GET' }))
}

async function handleRoomSocket(request, env, url) {
  const roomId = sanitizeRoomId(url.pathname.split('/').at(-1) ?? '')
  if (!roomId) {
    return errorJson(400, 'invalid_room_id', 'Room ID must use lowercase letters, numbers, or dashes.')
  }

  if (request.headers.get('Upgrade') !== 'websocket') {
    return errorJson(426, 'upgrade_required', 'Expected a websocket upgrade request.')
  }

  const stub = env.RACE_ROOM.get(env.RACE_ROOM.idFromName(roomId))
  const forwardUrl = new URL(request.url)
  forwardUrl.pathname = `/room/${roomId}`

  return stub.fetch(new Request(forwardUrl, request))
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return json({
        ok: true,
        service: 'racebaan',
        trackId: DEFAULT_TRACK_ID,
        now: Date.now(),
      })
    }

    if (url.pathname.startsWith('/api/leaderboard/')) {
      return handleLeaderboardRequest(env, url)
    }

    if (url.pathname.startsWith('/api/room/')) {
      return handleRoomSummaryRequest(env, url)
    }

    if (url.pathname.startsWith('/ws/room/')) {
      return handleRoomSocket(request, env, url)
    }

    return env.ASSETS.fetch(request)
  },
}

export { RaceRoom }
