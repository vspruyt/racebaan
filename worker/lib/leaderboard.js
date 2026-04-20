import {
  DEFAULT_TRACK_ID,
  clampLeaderboardLimit,
  sanitizeTrackId,
} from '../../shared/multiplayer.js'

const LEADERBOARD_SELECT = `
  WITH best_per_player AS (
    SELECT
      anonymous_player_id,
      MIN(lap_ms) AS best_lap_ms
    FROM lap_times
    WHERE track_id = ?1
      AND (?2 IS NULL OR finished_at >= ?2)
    GROUP BY anonymous_player_id
  ),
  latest_names AS (
    SELECT
      anonymous_player_id,
      display_name,
      MAX(finished_at) AS latest_seen_at
    FROM lap_times
    WHERE track_id = ?1
    GROUP BY anonymous_player_id
  )
  SELECT
    best_per_player.anonymous_player_id,
    latest_names.display_name,
    best_per_player.best_lap_ms,
    ?1 AS track_id,
    latest_names.latest_seen_at
  FROM best_per_player
  INNER JOIN latest_names
    ON latest_names.anonymous_player_id = best_per_player.anonymous_player_id
  ORDER BY best_per_player.best_lap_ms ASC, latest_names.latest_seen_at DESC
  LIMIT ?3
`

const RECENT_SELECT = `
  SELECT
    anonymous_player_id,
    display_name,
    track_id,
    lap_ms AS best_lap_ms,
    finished_at AS latest_seen_at,
    room_id
  FROM lap_times
  WHERE track_id = ?1
  ORDER BY finished_at DESC
  LIMIT ?2
`

export function getLeaderboardQueryParams(url) {
  const trackId =
    sanitizeTrackId(url.searchParams.get('trackId') ?? DEFAULT_TRACK_ID) ??
    DEFAULT_TRACK_ID
  const limit = clampLeaderboardLimit(url.searchParams.get('limit'))

  return {
    trackId,
    limit,
  }
}

export async function queryLeaderboard(env, period, { trackId, limit }) {
  const since =
    period === 'weekly' ? Date.now() - 7 * 24 * 60 * 60 * 1000 : null

  const statement = env.DB.prepare(LEADERBOARD_SELECT).bind(trackId, since, limit)
  const { results = [] } = await statement.all()

  return results.map((row, index) => ({
    rank: index + 1,
    anonymousPlayerId: row.anonymous_player_id,
    displayName: row.display_name,
    bestLapMs: row.best_lap_ms,
    trackId: row.track_id,
    latestSeenAt: row.latest_seen_at,
  }))
}

export async function queryRecentLaps(env, { trackId, limit }) {
  const statement = env.DB.prepare(RECENT_SELECT).bind(trackId, limit)
  const { results = [] } = await statement.all()

  return results.map((row, index) => ({
    rank: index + 1,
    anonymousPlayerId: row.anonymous_player_id,
    displayName: row.display_name,
    bestLapMs: row.best_lap_ms,
    trackId: row.track_id,
    latestSeenAt: row.latest_seen_at,
    roomId: row.room_id,
  }))
}
