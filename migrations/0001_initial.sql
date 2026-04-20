CREATE TABLE IF NOT EXISTS lap_times (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anonymous_player_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  room_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  lap_number INTEGER NOT NULL,
  lap_ms INTEGER NOT NULL,
  race_ms INTEGER,
  finished_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS race_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anonymous_player_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  room_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  place INTEGER NOT NULL,
  race_ms INTEGER NOT NULL,
  best_lap_ms INTEGER,
  finished_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lap_times_track_finished_at
  ON lap_times (track_id, finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_lap_times_track_lap_ms
  ON lap_times (track_id, lap_ms ASC);

CREATE INDEX IF NOT EXISTS idx_lap_times_player_track
  ON lap_times (anonymous_player_id, track_id);

CREATE INDEX IF NOT EXISTS idx_race_results_track_finished_at
  ON race_results (track_id, finished_at DESC);

CREATE INDEX IF NOT EXISTS idx_race_results_track_race_ms
  ON race_results (track_id, race_ms ASC);

CREATE INDEX IF NOT EXISTS idx_race_results_player_track
  ON race_results (anonymous_player_id, track_id);
