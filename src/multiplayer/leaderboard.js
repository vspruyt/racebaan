import { DEFAULT_TRACK_ID } from '../../shared/multiplayer.js'

async function fetchJson(path) {
  const response = await fetch(path)
  const contentType = response.headers.get('content-type') ?? ''
  const bodyText = await response.text()
  const looksLikeJson = contentType.includes('application/json')

  if (!looksLikeJson) {
    throw new Error(
      'Leaderboard API is not available from the static frontend alone. Run the Cloudflare Worker preview with `pnpm build`, `pnpm db:migrate:local`, and `pnpm worker:dev`.',
    )
  }

  let data
  try {
    data = JSON.parse(bodyText)
  } catch {
    throw new Error(
      'Leaderboard API returned an unexpected response. Make sure you are loading the app through the Worker, not a static-only server.',
    )
  }

  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Request failed.')
  }

  return data
}

export async function fetchLeaderboards(trackId = DEFAULT_TRACK_ID) {
  const [weekly, allTime, recent] = await Promise.all([
    fetchJson(`/api/leaderboard/weekly?trackId=${encodeURIComponent(trackId)}&limit=10`),
    fetchJson(`/api/leaderboard/all-time?trackId=${encodeURIComponent(trackId)}&limit=10`),
    fetchJson(`/api/leaderboard/recent?trackId=${encodeURIComponent(trackId)}&limit=10`),
  ])

  return {
    weekly: weekly.results ?? [],
    allTime: allTime.results ?? [],
    recent: recent.results ?? [],
  }
}
