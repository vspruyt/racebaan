import {
  DEFAULT_TRACK_ID,
  clampLeaderboardLimit,
  isAnonymousPlayerId,
  sanitizeTrackId,
} from '../../shared/multiplayer.js'

const LEADERBOARD_SELECT = `
  WITH ranked_laps AS (
    SELECT
      anonymous_player_id,
      display_name,
      room_id,
      lap_ms,
      finished_at,
      ROW_NUMBER() OVER (
        PARTITION BY anonymous_player_id
        ORDER BY lap_ms ASC, finished_at DESC
      ) AS row_number
    FROM lap_times
    WHERE track_id = ?1
  )
  SELECT
    anonymous_player_id,
    display_name,
    room_id,
    lap_ms AS best_lap_ms,
    ?1 AS track_id,
    finished_at
  FROM ranked_laps
  WHERE row_number = 1
  ORDER BY best_lap_ms ASC, finished_at DESC
  LIMIT ?2
`

const PERSONAL_BEST_SELECT = `
  SELECT
    anonymous_player_id,
    display_name,
    room_id,
    lap_ms AS best_lap_ms,
    ?1 AS track_id,
    finished_at
  FROM lap_times
  WHERE track_id = ?1
    AND anonymous_player_id = ?2
  ORDER BY lap_ms ASC, finished_at DESC
  LIMIT 1
`

export function getLeaderboardQueryParams(url) {
  const trackId =
    sanitizeTrackId(url.searchParams.get('trackId') ?? DEFAULT_TRACK_ID) ??
    DEFAULT_TRACK_ID
  const limit = clampLeaderboardLimit(url.searchParams.get('limit'))
  const anonymousPlayerId = url.searchParams.get('anonymousPlayerId')

  return {
    anonymousPlayerId: isAnonymousPlayerId(anonymousPlayerId)
      ? anonymousPlayerId
      : null,
    trackId,
    limit,
  }
}

export async function queryLeaderboard(env, { trackId, limit }) {
  const statement = env.DB.prepare(LEADERBOARD_SELECT).bind(trackId, limit)
  const { results = [] } = await statement.all()

  return results.map((row, index) => ({
    rank: index + 1,
    anonymousPlayerId: row.anonymous_player_id,
    displayName: row.display_name,
    roomId: row.room_id,
    bestLapMs: row.best_lap_ms,
    trackId: row.track_id,
    bestLapRecordedAt: row.finished_at,
  }))
}

export async function queryPersonalBest(env, { trackId, anonymousPlayerId }) {
  if (!isAnonymousPlayerId(anonymousPlayerId)) {
    return null
  }

  const statement = env.DB.prepare(PERSONAL_BEST_SELECT).bind(trackId, anonymousPlayerId)
  const result = await statement.first()
  if (!result) {
    return null
  }

  return {
    anonymousPlayerId: result.anonymous_player_id,
    displayName: result.display_name,
    roomId: result.room_id,
    bestLapMs: result.best_lap_ms,
    trackId: result.track_id,
    bestLapRecordedAt: result.finished_at,
  }
}
