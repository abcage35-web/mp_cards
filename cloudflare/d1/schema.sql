CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(role);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
  ON sessions(expires_at);

INSERT INTO users (login, password_hash, role, is_active, created_at)
VALUES
  ('user', 'pbkdf2_sha256$210000$Xyk2VrY4qRGg4fnlg2fBCw==$8P22oGccoWWA7nyD2nujjFuuToxvWwpwO3o6kwe1nB8=', 'user', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('admin', 'pbkdf2_sha256$210000$akVRZ3qknVvEJ0HIbtvqhg==$GpxkvT/Wb9m4nGTFBw4wxkEc+rw9gTFHMEyqxh3nFPw=', 'admin', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(login) DO UPDATE SET
  password_hash = excluded.password_hash,
  role = excluded.role,
  is_active = excluded.is_active;

CREATE TABLE IF NOT EXISTS dashboard_state (
  state_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboard_state_updated_at
  ON dashboard_state(updated_at);

CREATE TABLE IF NOT EXISTS dashboard_state_meta (
  state_key TEXT PRIMARY KEY,
  meta_json TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  actor_user_id INTEGER,
  actor_login TEXT,
  actor_role TEXT,
  actor_ip TEXT
);

CREATE INDEX IF NOT EXISTS idx_dashboard_state_meta_updated_at
  ON dashboard_state_meta(updated_at);

CREATE TABLE IF NOT EXISTS dashboard_rows_current (
  state_key TEXT NOT NULL,
  row_id TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0,
  nm_id TEXT NOT NULL,
  cabinet TEXT,
  supplier_id TEXT,
  stock_value INTEGER,
  in_stock INTEGER,
  stock_source TEXT,
  current_price INTEGER,
  base_price INTEGER,
  price_source TEXT,
  error TEXT,
  updated_at TEXT,
  card_code TEXT,
  product_name TEXT,
  category_name TEXT,
  brand_name TEXT,
  has_video INTEGER,
  has_recommendations INTEGER,
  has_rich INTEGER,
  rich_block_count INTEGER,
  has_autoplay INTEGER,
  has_tags INTEGER,
  cover_duplicate INTEGER,
  listing_slides_count INTEGER,
  rich_slides_count INTEGER,
  recommendation_known_count INTEGER,
  recommendation_refs_json TEXT,
  color_count INTEGER,
  color_nm_ids_json TEXT,
  rating REAL,
  review_count INTEGER,
  market_error TEXT,
  row_data_json TEXT,
  row_payload_json TEXT,
  row_hash TEXT NOT NULL,
  last_saved_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  saved_by_user_id INTEGER,
  saved_by_login TEXT,
  saved_by_role TEXT,
  saved_by_ip TEXT,
  PRIMARY KEY(state_key, row_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_rows_current_nm
  ON dashboard_rows_current(state_key, nm_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_rows_current_updated
  ON dashboard_rows_current(state_key, updated_at);

CREATE INDEX IF NOT EXISTS idx_dashboard_rows_current_cabinet
  ON dashboard_rows_current(state_key, cabinet);

CREATE TABLE IF NOT EXISTS dashboard_article_registry (
  state_key TEXT NOT NULL,
  nm_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_seen_by_user_id INTEGER,
  last_seen_by_login TEXT,
  last_seen_by_role TEXT,
  last_seen_by_ip TEXT,
  PRIMARY KEY(state_key, nm_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_article_registry_seen
  ON dashboard_article_registry(state_key, last_seen_at);

CREATE TABLE IF NOT EXISTS dashboard_row_versions (
  version_id INTEGER PRIMARY KEY AUTOINCREMENT,
  state_key TEXT NOT NULL,
  row_id TEXT NOT NULL,
  nm_id TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0,
  operation TEXT NOT NULL CHECK(operation IN ('upsert', 'delete', 'rollback')),
  version_saved_at TEXT NOT NULL,
  actor_user_id INTEGER,
  actor_login TEXT,
  actor_role TEXT,
  actor_ip TEXT,
  cabinet TEXT,
  supplier_id TEXT,
  stock_value INTEGER,
  in_stock INTEGER,
  stock_source TEXT,
  current_price INTEGER,
  base_price INTEGER,
  price_source TEXT,
  error TEXT,
  updated_at TEXT,
  card_code TEXT,
  product_name TEXT,
  category_name TEXT,
  brand_name TEXT,
  has_video INTEGER,
  has_recommendations INTEGER,
  has_rich INTEGER,
  rich_block_count INTEGER,
  has_autoplay INTEGER,
  has_tags INTEGER,
  cover_duplicate INTEGER,
  listing_slides_count INTEGER,
  rich_slides_count INTEGER,
  recommendation_known_count INTEGER,
  recommendation_refs_json TEXT,
  color_count INTEGER,
  color_nm_ids_json TEXT,
  rating REAL,
  review_count INTEGER,
  market_error TEXT,
  row_data_json TEXT,
  row_payload_json TEXT,
  row_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboard_row_versions_row
  ON dashboard_row_versions(state_key, row_id, version_saved_at);

CREATE INDEX IF NOT EXISTS idx_dashboard_row_versions_nm
  ON dashboard_row_versions(state_key, nm_id);

CREATE TABLE IF NOT EXISTS dashboard_row_logs (
  state_key TEXT NOT NULL,
  row_id TEXT NOT NULL,
  log_id TEXT NOT NULL,
  at TEXT NOT NULL,
  source TEXT,
  mode TEXT,
  action_key TEXT,
  status TEXT,
  error TEXT,
  changes_json TEXT,
  actor_user_id INTEGER,
  actor_login TEXT,
  actor_role TEXT,
  actor_ip TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY(state_key, row_id, log_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_row_logs_at
  ON dashboard_row_logs(state_key, row_id, at);

CREATE TABLE IF NOT EXISTS dashboard_problem_snapshots (
  state_key TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  at TEXT NOT NULL,
  source TEXT,
  action_key TEXT,
  mode TEXT,
  total_rows INTEGER,
  loaded_rows INTEGER,
  error_rows INTEGER,
  problems_json TEXT,
  cabinets_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(state_key, snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_problem_snapshots_at
  ON dashboard_problem_snapshots(state_key, at);

CREATE TABLE IF NOT EXISTS dashboard_save_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  state_key TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_changed INTEGER NOT NULL DEFAULT 0,
  rows_deleted INTEGER NOT NULL DEFAULT 0,
  logs_upserted INTEGER NOT NULL DEFAULT 0,
  payload_size INTEGER NOT NULL DEFAULT 0,
  actor_user_id INTEGER,
  actor_login TEXT,
  actor_role TEXT,
  actor_ip TEXT,
  source TEXT,
  action_key TEXT,
  mode TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboard_save_events_saved_at
  ON dashboard_save_events(state_key, saved_at);

CREATE TABLE IF NOT EXISTS ab_month_cache_meta (
  tab_key TEXT NOT NULL,
  month_key TEXT NOT NULL,
  source TEXT,
  fetched_at TEXT NOT NULL,
  total_tests INTEGER NOT NULL DEFAULT 0,
  row_count_catalog INTEGER NOT NULL DEFAULT 0,
  row_count_technical INTEGER NOT NULL DEFAULT 0,
  row_count_results INTEGER NOT NULL DEFAULT 0,
  live_done INTEGER NOT NULL DEFAULT 0,
  live_launched INTEGER NOT NULL DEFAULT 0,
  live_pending INTEGER NOT NULL DEFAULT 0,
  live_rejected INTEGER NOT NULL DEFAULT 0,
  live_views INTEGER NOT NULL DEFAULT 0,
  live_estimated_expense REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(tab_key, month_key)
);

CREATE INDEX IF NOT EXISTS idx_ab_month_cache_meta_updated
  ON ab_month_cache_meta(tab_key, updated_at);

CREATE TABLE IF NOT EXISTS ab_month_tests (
  tab_key TEXT NOT NULL,
  month_key TEXT NOT NULL,
  test_id TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0,
  xway_url TEXT,
  wb_url TEXT,
  article TEXT,
  title TEXT,
  product_name TEXT,
  type TEXT,
  campaign_external_id TEXT,
  cabinet TEXT,
  started_at TEXT,
  started_at_iso TEXT,
  ended_at TEXT,
  ended_at_iso TEXT,
  ab_activity_started_at_iso TEXT,
  ab_activity_ended_at_iso TEXT,
  final_status_raw TEXT,
  final_status_kind TEXT,
  summary_test_ctr TEXT,
  summary_test_price TEXT,
  summary_test_ctr_cr1 TEXT,
  summary_overall TEXT,
  xway_summary_test_ctr TEXT,
  xway_summary_test_price TEXT,
  xway_summary_test_ctr_cr1 TEXT,
  xway_summary_overall TEXT,
  price_deviation_count TEXT,
  report_text TEXT,
  xway_before_adjustment_json TEXT,
  shop_id INTEGER,
  product_id INTEGER,
  launch_status TEXT,
  progress REAL,
  views INTEGER,
  cpm REAL,
  estimated_expense REAL,
  images_num INTEGER,
  main_image_url TEXT,
  sheet_price_decision_raw TEXT,
  sheet_price_deviation_count TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(tab_key, month_key, test_id)
);

CREATE INDEX IF NOT EXISTS idx_ab_month_tests_article
  ON ab_month_tests(tab_key, month_key, article);

CREATE INDEX IF NOT EXISTS idx_ab_month_tests_started
  ON ab_month_tests(tab_key, started_at_iso);

CREATE TABLE IF NOT EXISTS ab_month_test_metrics (
  tab_key TEXT NOT NULL,
  month_key TEXT NOT NULL,
  test_id TEXT NOT NULL,
  metric_scope TEXT NOT NULL,
  metric_index INTEGER NOT NULL,
  metric_key TEXT,
  label TEXT,
  value_text TEXT,
  status_raw TEXT,
  status_kind TEXT,
  before_text TEXT,
  during_text TEXT,
  after_text TEXT,
  delta_text TEXT,
  delta_kind TEXT,
  delta_value REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(tab_key, month_key, test_id, metric_scope, metric_index)
);

CREATE INDEX IF NOT EXISTS idx_ab_month_test_metrics_test
  ON ab_month_test_metrics(tab_key, month_key, test_id);

CREATE TABLE IF NOT EXISTS ab_month_test_variants (
  tab_key TEXT NOT NULL,
  month_key TEXT NOT NULL,
  test_id TEXT NOT NULL,
  variant_index INTEGER NOT NULL,
  image_url TEXT,
  image_src TEXT,
  views_value INTEGER,
  clicks_value INTEGER,
  ctr_value REAL,
  installed_at_iso TEXT,
  views_text TEXT,
  clicks_text TEXT,
  ctr_text TEXT,
  installed_at_date TEXT,
  installed_at_time TEXT,
  hours_text TEXT,
  is_best INTEGER,
  ctr_boost_value REAL,
  ctr_boost_text TEXT,
  ctr_boost_kind TEXT,
  status_raw TEXT,
  is_pending INTEGER,
  is_active INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(tab_key, month_key, test_id, variant_index)
);

CREATE TABLE IF NOT EXISTS ab_month_test_images (
  tab_key TEXT NOT NULL,
  month_key TEXT NOT NULL,
  test_id TEXT NOT NULL,
  image_index INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(tab_key, month_key, test_id, image_index)
);

CREATE TABLE IF NOT EXISTS ab_month_save_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab_key TEXT NOT NULL,
  month_key TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  source TEXT,
  tests_total INTEGER NOT NULL DEFAULT 0,
  metrics_total INTEGER NOT NULL DEFAULT 0,
  variants_total INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ab_month_save_events_saved
  ON ab_month_save_events(tab_key, month_key, saved_at);

CREATE TABLE IF NOT EXISTS ab_product_snapshots (
  product_key TEXT PRIMARY KEY,
  article TEXT,
  shop_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  name TEXT,
  main_image_url TEXT,
  stock_value INTEGER,
  in_stock INTEGER,
  fetched_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ab_product_snapshots_product
  ON ab_product_snapshots(shop_id, product_id);

CREATE TABLE IF NOT EXISTS ab_xway_payloads (
  request_key TEXT PRIMARY KEY,
  month_key TEXT NOT NULL,
  test_id TEXT NOT NULL,
  campaign_type TEXT,
  campaign_external_id TEXT,
  requested_started_at TEXT,
  requested_ended_at TEXT,
  requested_before_date TEXT,
  requested_after_date TEXT,
  fetched_at TEXT NOT NULL,
  source TEXT,
  range_time_zone TEXT,
  range_before TEXT,
  range_before_original TEXT,
  range_before_shifted INTEGER,
  range_before_manual INTEGER,
  range_during_from TEXT,
  range_during_to TEXT,
  range_after TEXT,
  range_after_available INTEGER,
  range_after_manual INTEGER,
  before_adjustment_json TEXT,
  product_shop_id INTEGER,
  product_product_id INTEGER,
  product_article TEXT,
  product_name TEXT,
  test_name TEXT,
  test_started_at TEXT,
  test_ended_at TEXT,
  test_avg_ctr REAL,
  test_progress REAL,
  test_launch_status TEXT,
  test_status TEXT,
  price_before REAL,
  price_during REAL,
  price_after REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ab_xway_payloads_test
  ON ab_xway_payloads(test_id, month_key);

CREATE TABLE IF NOT EXISTS ab_xway_payload_totals (
  request_key TEXT NOT NULL,
  phase TEXT NOT NULL,
  matched_count INTEGER,
  views INTEGER,
  clicks INTEGER,
  atbs INTEGER,
  orders_count INTEGER,
  sum_price REAL,
  bid REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(request_key, phase)
);

CREATE TABLE IF NOT EXISTS ab_xway_payload_metrics (
  request_key TEXT NOT NULL,
  metric_index INTEGER NOT NULL,
  metric_key TEXT,
  label TEXT,
  kind TEXT,
  before_value REAL,
  during_value REAL,
  after_value REAL,
  delta_value REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(request_key, metric_index)
);

CREATE TABLE IF NOT EXISTS ab_xway_payload_variants (
  request_key TEXT NOT NULL,
  variant_index INTEGER NOT NULL,
  url TEXT,
  views INTEGER,
  clicks INTEGER,
  spend REAL,
  ctr REAL,
  ctr_to_avg REAL,
  ctr_to_max REAL,
  avg_ctr REAL,
  status TEXT,
  date_start TEXT,
  main INTEGER,
  sort_index INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(request_key, variant_index)
);

CREATE TABLE IF NOT EXISTS ab_xway_payload_campaigns (
  request_key TEXT NOT NULL,
  phase TEXT NOT NULL,
  campaign_index INTEGER NOT NULL,
  campaign_id INTEGER,
  external_id TEXT,
  name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(request_key, phase, campaign_index)
);
