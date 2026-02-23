CREATE TABLE IF NOT EXISTS dashboard_state (
  state_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboard_state_updated_at
  ON dashboard_state(updated_at);
