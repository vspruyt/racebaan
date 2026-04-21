import { DEFAULT_TRACK_ID } from '../../shared/multiplayer.js'

async function fetchJson(path, init) {
  const response = await fetch(path, init)
  const contentType = response.headers.get('content-type') ?? ''
  const bodyText = await response.text()
  const looksLikeJson = contentType.includes('application/json')

  if (!looksLikeJson) {
    throw new Error(
      'Multiplayer API is not available from the static frontend alone. Run the Cloudflare Worker preview with `pnpm build`, `pnpm db:migrate:local`, and `pnpm worker:dev`.',
    )
  }

  let data
  try {
    data = JSON.parse(bodyText)
  } catch {
    throw new Error(
      'Multiplayer API returned an unexpected response. Make sure you are loading the app through the Worker, not a static-only server.',
    )
  }

  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Request failed.')
  }

  return data
}

export async function fetchLeaderboard(trackId = DEFAULT_TRACK_ID) {
  const leaderboard = await fetchJson(
    `/api/leaderboard/all-time?trackId=${encodeURIComponent(trackId)}&limit=10`,
  )

  return leaderboard.results ?? []
}

export async function fetchPersonalBest(anonymousPlayerId, trackId = DEFAULT_TRACK_ID) {
  if (!anonymousPlayerId) {
    return null
  }

  const response = await fetchJson(
    `/api/leaderboard/personal?trackId=${encodeURIComponent(trackId)}&anonymousPlayerId=${encodeURIComponent(anonymousPlayerId)}`,
  )

  return response.result ?? null
}

export async function fetchRoomSummary(roomId) {
  return fetchJson(`/api/room/${encodeURIComponent(roomId)}`, {
    cache: 'no-store',
  })
}

export async function fetchActiveRooms(limit = 6) {
  const cacheBust = Date.now()
  const response = await fetchJson(
    `/api/rooms/active?limit=${encodeURIComponent(limit)}&t=${encodeURIComponent(cacheBust)}`,
    {
      cache: 'no-store',
    },
  )

  return response.results ?? []
}
