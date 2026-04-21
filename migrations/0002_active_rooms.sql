CREATE TABLE IF NOT EXISTS active_rooms (
  room_id TEXT PRIMARY KEY,
  active_player_count INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_active_rooms_player_count_updated_at
  ON active_rooms (active_player_count DESC, updated_at DESC);
