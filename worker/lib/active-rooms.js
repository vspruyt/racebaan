import { clampLeaderboardLimit } from '../../shared/multiplayer.js'

const DEFAULT_ACTIVE_ROOMS_LIMIT = 6
const ACTIVE_ROOM_STALE_MS = 45_000

export function getActiveRoomsQueryParams(url) {
  return {
    limit: clampLeaderboardLimit(
      url.searchParams.get('limit') ?? String(DEFAULT_ACTIVE_ROOMS_LIMIT),
    ),
  }
}

export async function queryActiveRooms(env, { limit = DEFAULT_ACTIVE_ROOMS_LIMIT } = {}) {
  const cutoffTimestamp = Date.now() - ACTIVE_ROOM_STALE_MS
  const result = await env.DB.prepare(
    `
      SELECT
        room_id AS roomId,
        active_player_count AS activePlayerCount,
        updated_at AS updatedAt
      FROM active_rooms
      WHERE active_player_count > 0
        AND updated_at >= ?1
      ORDER BY active_player_count DESC, updated_at DESC, room_id ASC
      LIMIT ?2
    `,
  )
    .bind(cutoffTimestamp, limit)
    .all()

  return result.results ?? []
}
