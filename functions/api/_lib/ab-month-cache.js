const CACHE_TABLES = [
  "ab_month_cache_meta",
  "ab_month_tests",
  "ab_month_test_metrics",
  "ab_month_test_variants",
  "ab_month_test_images",
  "ab_month_save_events",
  "ab_product_snapshots",
  "ab_xway_payloads",
  "ab_xway_payload_totals",
  "ab_xway_payload_metrics",
  "ab_xway_payload_variants",
  "ab_xway_payload_campaigns",
];

const VALID_TAB_KEYS = new Set(["ab-tests", "ab-tests-xway"]);

let tablesEnsured = false;
let tablesEnsurePromise = null;

function safeString(valueRaw, maxLen = 4000) {
  return String(valueRaw ?? "").trim().slice(0, maxLen);
}

function nullableString(valueRaw, maxLen = 4000) {
  const value = safeString(valueRaw, maxLen);
  return value || null;
}

function finiteNumberOrNull(valueRaw) {
  const value = Number(valueRaw);
  return Number.isFinite(value) ? value : null;
}

function integerOrNull(valueRaw) {
  const value = finiteNumberOrNull(valueRaw);
  return value === null ? null : Math.round(value);
}

function boolToDb(valueRaw) {
  if (valueRaw === true) return 1;
  if (valueRaw === false) return 0;
  return null;
}

function dbToBool(valueRaw) {
  const value = Number(valueRaw);
  if (value === 1) return true;
  if (value === 0) return false;
  return null;
}

function stringifyJson(valueRaw, fallback = null) {
  if (valueRaw === undefined || valueRaw === null) {
    return fallback;
  }
  try {
    return JSON.stringify(valueRaw);
  } catch {
    return fallback;
  }
}

function parseJson(valueRaw, fallback = null) {
  const value = safeString(valueRaw, 200000);
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeChecks(valueRaw) {
  const value = valueRaw && typeof valueRaw === "object" ? valueRaw : {};
  return {
    testCtr: safeString(value.testCtr, 100),
    testPrice: safeString(value.testPrice, 100),
    testCtrCr1: safeString(value.testCtrCr1, 100),
    overall: safeString(value.overall, 100),
  };
}

function checksOrNull(row, prefix) {
  const checks = {
    testCtr: safeString(row?.[`${prefix}_test_ctr`], 100),
    testPrice: safeString(row?.[`${prefix}_test_price`], 100),
    testCtrCr1: safeString(row?.[`${prefix}_test_ctr_cr1`], 100),
    overall: safeString(row?.[`${prefix}_overall`], 100),
  };
  return checks.testCtr || checks.testPrice || checks.testCtrCr1 || checks.overall ? checks : null;
}

export function normalizeAbCacheTabKey(valueRaw) {
  const value = safeString(valueRaw, 40);
  return VALID_TAB_KEYS.has(value) ? value : "";
}

export function normalizeMonthKey(valueRaw) {
  const value = safeString(valueRaw, 20);
  return /^\d{4}-\d{2}$/.test(value) ? value : "";
}

export function normalizeMonthKeys(valueRaw) {
  const values = Array.isArray(valueRaw)
    ? valueRaw
    : safeString(valueRaw, 1000).split(",");
  return Array.from(
    new Set(
      values
        .map((value) => normalizeMonthKey(value))
        .filter(Boolean),
    ),
  ).sort();
}

function monthKeyFromDate(valueRaw) {
  const value = safeString(valueRaw, 100);
  if (/^\d{4}-\d{2}/.test(value)) {
    return value.slice(0, 7);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthKeyFromTest(testRaw) {
  const test = testRaw && typeof testRaw === "object" ? testRaw : {};
  return (
    monthKeyFromDate(test.startedAtIso)
    || monthKeyFromDate(test.endedAtIso)
    || monthKeyFromDate(test.abActivityStartedAtIso)
    || monthKeyFromDate(test.abActivityEndedAtIso)
  );
}

function monthKeyFromPayload(payloadRaw, fallbackRaw = "") {
  const payload = payloadRaw && typeof payloadRaw === "object" ? payloadRaw : {};
  return (
    monthKeyFromDate(payload?.test?.startedAt)
    || monthKeyFromDate(payload?.test?.endedAt)
    || monthKeyFromDate(fallbackRaw)
  );
}

function sortTests(a, b) {
  const sortA = Number(a?.sortIndex);
  const sortB = Number(b?.sortIndex);
  if (Number.isFinite(sortA) && Number.isFinite(sortB) && sortA !== sortB) {
    return sortA - sortB;
  }
  const aMs = a?.startedAtIso ? new Date(a.startedAtIso).getTime() : 0;
  const bMs = b?.startedAtIso ? new Date(b.startedAtIso).getTime() : 0;
  if (aMs !== bMs) return bMs - aMs;
  return Number(b?.testId || 0) - Number(a?.testId || 0);
}

function buildProducts(testsRaw) {
  const tests = Array.isArray(testsRaw) ? testsRaw : [];
  const map = new Map();

  for (const test of tests) {
    const key = safeString(test?.article || test?.testId, 120);
    if (!key) continue;
    const currentMs = test?.startedAtIso ? new Date(test.startedAtIso).getTime() : 0;
    if (!map.has(key)) {
      map.set(key, {
        article: key,
        title: safeString(test?.productName || test?.title || key, 500),
        type: safeString(test?.type, 120),
        cabinets: new Set(),
        tests: [],
        testsCount: 0,
        good: 0,
        bad: 0,
        unknown: 0,
        latestAt: safeString(test?.startedAt || test?.endedAt, 120),
        latestAtIso: safeString(test?.startedAtIso || test?.endedAtIso, 120),
        latestMs: currentMs,
        shopId: integerOrNull(test?.shopId) || 0,
        productId: integerOrNull(test?.productId) || 0,
        wbUrl: safeString(test?.wbUrl, 1000),
        currentImageUrl: safeString(test?.mainImageUrl, 2000),
        currentStockValue: null,
        currentInStock: null,
      });
    }

    const item = map.get(key);
    item.tests.push(test);
    item.testsCount += 1;
    if (test?.cabinet) item.cabinets.add(safeString(test.cabinet, 300));
    if (test?.finalStatusKind === "good") item.good += 1;
    else if (test?.finalStatusKind === "bad") item.bad += 1;
    else item.unknown += 1;

    if (currentMs > item.latestMs) {
      item.latestMs = currentMs;
      item.latestAt = safeString(test?.startedAt || test?.endedAt, 120);
      item.latestAtIso = safeString(test?.startedAtIso || test?.endedAtIso, 120);
      item.title = safeString(test?.productName || test?.title || item.title, 500);
      item.type = safeString(test?.type || item.type, 120);
      item.shopId = integerOrNull(test?.shopId) || item.shopId;
      item.productId = integerOrNull(test?.productId) || item.productId;
      item.wbUrl = safeString(test?.wbUrl || item.wbUrl, 1000);
      item.currentImageUrl = safeString(test?.mainImageUrl || item.currentImageUrl, 2000);
    }
  }

  return Array.from(map.values())
    .map((item) => ({
      article: item.article,
      title: item.title,
      type: item.type,
      cabinets: Array.from(item.cabinets),
      tests: item.tests,
      testsCount: item.testsCount,
      good: item.good,
      bad: item.bad,
      unknown: item.unknown,
      latestAt: item.latestAt,
      latestAtIso: item.latestAtIso,
      shopId: item.shopId,
      productId: item.productId,
      wbUrl: item.wbUrl,
      currentImageUrl: item.currentImageUrl,
      currentStockValue: item.currentStockValue,
      currentInStock: item.currentInStock,
    }))
    .sort((a, b) => b.testsCount - a.testsCount);
}

function buildStatusTotals(testsRaw) {
  return (Array.isArray(testsRaw) ? testsRaw : []).reduce(
    (acc, test) => {
      if (test?.finalStatusKind === "good") acc.good += 1;
      else if (test?.finalStatusKind === "bad") acc.bad += 1;
      else if (test?.finalStatusKind === "neutral") acc.neutral += 1;
      else acc.unknown += 1;
      return acc;
    },
    { good: 0, bad: 0, neutral: 0, unknown: 0 },
  );
}

function buildLiveTotals(testsRaw) {
  return (Array.isArray(testsRaw) ? testsRaw : []).reduce(
    (acc, test) => {
      acc.views += Number(test?.views) || 0;
      acc.estimatedExpense += Number(test?.estimatedExpense) || 0;
      const launchStatus = safeString(test?.launchStatus, 80).toUpperCase();
      if (launchStatus === "DONE") acc.done += 1;
      else if (launchStatus === "LAUNCHED") acc.launched += 1;
      else if (launchStatus === "PENDING") acc.pending += 1;
      else if (launchStatus === "REJECTED") acc.rejected += 1;
      return acc;
    },
    { done: 0, launched: 0, pending: 0, rejected: 0, views: 0, estimatedExpense: 0 },
  );
}

async function runStatements(db, statementsRaw, chunkSize = 60) {
  const statements = (Array.isArray(statementsRaw) ? statementsRaw : []).filter(Boolean);
  for (let start = 0; start < statements.length; start += chunkSize) {
    const chunk = statements.slice(start, start + chunkSize);
    if (typeof db.batch === "function") {
      await db.batch(chunk);
    } else {
      for (const statement of chunk) {
        await statement.run();
      }
    }
  }
}

export function buildXwayRequestKey(metaRaw) {
  const meta = metaRaw && typeof metaRaw === "object" ? metaRaw : {};
  return [
    safeString(meta.testId, 120),
    safeString(meta.campaignType, 120),
    safeString(meta.campaignExternalId, 200),
    safeString(meta.startedAt, 120),
    safeString(meta.endedAt, 120),
    safeString(meta.beforeDate, 20),
    safeString(meta.afterDate, 20),
  ].join("|");
}

export async function ensureAbMonthCacheTables(db) {
  if (!db) return;
  if (tablesEnsured) return;

  if (!tablesEnsurePromise) {
    tablesEnsurePromise = (async () => {
      const placeholders = CACHE_TABLES.map((_, index) => `?${index + 1}`).join(", ");
      const result = await db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`)
        .bind(...CACHE_TABLES)
        .all();
      const existing = new Set(
        Array.isArray(result?.results)
          ? result.results.map((row) => safeString(row?.name, 120)).filter(Boolean)
          : [],
      );
      if (CACHE_TABLES.every((tableName) => existing.has(tableName))) {
        tablesEnsured = true;
        return;
      }

      const schemaSql = `
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
      `;

      for (const statement of schemaSql.split(";").map((part) => part.trim()).filter(Boolean)) {
        await db.exec(statement.replace(/\s+/g, " ").trim());
      }
      tablesEnsured = true;
    })()
      .catch((error) => {
        tablesEnsured = false;
        throw error;
      })
      .finally(() => {
        tablesEnsurePromise = null;
      });
  }

  await tablesEnsurePromise;
}

function pushMetricStatements(statements, db, tabKey, monthKey, testId, scope, rowsRaw, nowIso) {
  const rows = Array.isArray(rowsRaw) ? rowsRaw : [];
  rows.forEach((rowRaw, index) => {
    const row = rowRaw && typeof rowRaw === "object" ? rowRaw : {};
    statements.push(
      db.prepare(
        `INSERT INTO ab_month_test_metrics (
          tab_key, month_key, test_id, metric_scope, metric_index, metric_key, label,
          value_text, status_raw, status_kind, before_text, during_text, after_text,
          delta_text, delta_kind, delta_value, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`,
      ).bind(
        tabKey,
        monthKey,
        testId,
        scope,
        index,
        nullableString(row.checkName ?? row.key, 120),
        nullableString(row.label, 200),
        nullableString(row.valueText, 200),
        nullableString(row.statusRaw, 120),
        nullableString(row.statusKind, 120),
        nullableString(row.before, 200),
        nullableString(row.during, 200),
        nullableString(row.after, 200),
        nullableString(row.deltaText, 200),
        nullableString(row.deltaKind, 120),
        finiteNumberOrNull(row.deltaValue),
        nowIso,
        nowIso,
      ),
    );
  });
}

export async function saveAbMonthModel(db, optionsRaw) {
  if (!db) return { ok: false, saved: false };
  const options = optionsRaw && typeof optionsRaw === "object" ? optionsRaw : {};
  const tabKey = normalizeAbCacheTabKey(options.tabKey);
  const monthKey = normalizeMonthKey(options.monthKey);
  const model = options.model && typeof options.model === "object" ? options.model : null;
  if (!tabKey || !monthKey || !model) {
    throw new Error("Invalid AB month cache payload.");
  }

  await ensureAbMonthCacheTables(db);

  const nowIso = new Date().toISOString();
  const fetchedAt = safeString(model.fetchedAt, 100) || nowIso;
  const allTests = Array.isArray(model.tests) ? model.tests : [];
  const tests = allTests
    .filter((test) => monthKeyFromTest(test) === monthKey)
    .sort(sortTests);
  const rowCounts = model.rowCounts && typeof model.rowCounts === "object" ? model.rowCounts : {};
  const liveTotals = model.liveTotals && typeof model.liveTotals === "object" ? model.liveTotals : {};

  await runStatements(db, [
    db.prepare(`DELETE FROM ab_month_test_metrics WHERE tab_key = ?1 AND month_key = ?2`).bind(tabKey, monthKey),
    db.prepare(`DELETE FROM ab_month_test_variants WHERE tab_key = ?1 AND month_key = ?2`).bind(tabKey, monthKey),
    db.prepare(`DELETE FROM ab_month_test_images WHERE tab_key = ?1 AND month_key = ?2`).bind(tabKey, monthKey),
    db.prepare(`DELETE FROM ab_month_tests WHERE tab_key = ?1 AND month_key = ?2`).bind(tabKey, monthKey),
  ]);

  const statements = [];
  statements.push(
    db.prepare(
      `INSERT INTO ab_month_cache_meta (
        tab_key, month_key, source, fetched_at, total_tests, row_count_catalog, row_count_technical,
        row_count_results, live_done, live_launched, live_pending, live_rejected, live_views,
        live_estimated_expense, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
      ON CONFLICT(tab_key, month_key) DO UPDATE SET
        source = excluded.source,
        fetched_at = excluded.fetched_at,
        total_tests = excluded.total_tests,
        row_count_catalog = excluded.row_count_catalog,
        row_count_technical = excluded.row_count_technical,
        row_count_results = excluded.row_count_results,
        live_done = excluded.live_done,
        live_launched = excluded.live_launched,
        live_pending = excluded.live_pending,
        live_rejected = excluded.live_rejected,
        live_views = excluded.live_views,
        live_estimated_expense = excluded.live_estimated_expense,
        updated_at = excluded.updated_at`,
    ).bind(
      tabKey,
      monthKey,
      nullableString(options.source || model.source || "client"),
      fetchedAt,
      tests.length,
      integerOrNull(rowCounts.catalog) || 0,
      integerOrNull(rowCounts.technical) || 0,
      integerOrNull(rowCounts.results) || 0,
      integerOrNull(liveTotals.done) || 0,
      integerOrNull(liveTotals.launched) || 0,
      integerOrNull(liveTotals.pending) || 0,
      integerOrNull(liveTotals.rejected) || 0,
      integerOrNull(liveTotals.views) || 0,
      finiteNumberOrNull(liveTotals.estimatedExpense) || 0,
      nowIso,
      nowIso,
    ),
  );

  let metricsTotal = 0;
  let variantsTotal = 0;

  tests.forEach((testRaw, sortIndex) => {
    const test = testRaw && typeof testRaw === "object" ? testRaw : {};
    const testId = safeString(test.testId, 120) || `${monthKey}-${sortIndex + 1}`;
    const summary = normalizeChecks(test.summaryChecks);
    const xwaySummary = normalizeChecks(test.xwaySummaryChecks);
    const reportText = Array.isArray(test.reportLines)
      ? test.reportLines.map((line) => String(line ?? "")).join("\n")
      : safeString(test.reportText, 20000);

    statements.push(
      db.prepare(
        `INSERT INTO ab_month_tests (
          tab_key, month_key, test_id, sort_index, xway_url, wb_url, article, title, product_name,
          type, campaign_external_id, cabinet, started_at, started_at_iso, ended_at, ended_at_iso,
          ab_activity_started_at_iso, ab_activity_ended_at_iso, final_status_raw, final_status_kind,
          summary_test_ctr, summary_test_price, summary_test_ctr_cr1, summary_overall,
          xway_summary_test_ctr, xway_summary_test_price, xway_summary_test_ctr_cr1, xway_summary_overall,
          price_deviation_count, report_text, xway_before_adjustment_json, shop_id, product_id,
          launch_status, progress, views, cpm, estimated_expense, images_num, main_image_url,
          sheet_price_decision_raw, sheet_price_deviation_count, created_at, updated_at
        ) VALUES (
          ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16,
          ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30,
          ?31, ?32, ?33, ?34, ?35, ?36, ?37, ?38, ?39, ?40, ?41, ?42, ?43, ?44
        )`,
      ).bind(
        tabKey,
        monthKey,
        testId,
        sortIndex,
        nullableString(test.xwayUrl, 1200),
        nullableString(test.wbUrl, 1200),
        nullableString(test.article, 120),
        nullableString(test.title, 1000),
        nullableString(test.productName, 1000),
        nullableString(test.type, 120),
        nullableString(test.campaignExternalId, 200),
        nullableString(test.cabinet, 300),
        nullableString(test.startedAt, 120),
        nullableString(test.startedAtIso, 120),
        nullableString(test.endedAt, 120),
        nullableString(test.endedAtIso, 120),
        nullableString(test.abActivityStartedAtIso, 120),
        nullableString(test.abActivityEndedAtIso, 120),
        nullableString(test.finalStatusRaw, 120),
        nullableString(test.finalStatusKind, 120),
        nullableString(summary.testCtr, 120),
        nullableString(summary.testPrice, 120),
        nullableString(summary.testCtrCr1, 120),
        nullableString(summary.overall, 120),
        nullableString(xwaySummary.testCtr, 120),
        nullableString(xwaySummary.testPrice, 120),
        nullableString(xwaySummary.testCtrCr1, 120),
        nullableString(xwaySummary.overall, 120),
        nullableString(test.priceDeviationCount, 120),
        reportText || null,
        stringifyJson(test.xwayBeforeAdjustment, null),
        integerOrNull(test.shopId),
        integerOrNull(test.productId),
        nullableString(test.launchStatus, 120),
        finiteNumberOrNull(test.progress),
        integerOrNull(test.views),
        finiteNumberOrNull(test.cpm),
        finiteNumberOrNull(test.estimatedExpense),
        integerOrNull(test.imagesNum),
        nullableString(test.mainImageUrl, 2000),
        nullableString(test.sheetPriceDecisionRaw, 120),
        nullableString(test.sheetPriceDeviationCount, 120),
        nowIso,
        nowIso,
      ),
    );

    pushMetricStatements(statements, db, tabKey, monthKey, testId, "metrics", test.metrics, nowIso);
    pushMetricStatements(statements, db, tabKey, monthKey, testId, "comparison", test.comparisonRows, nowIso);
    pushMetricStatements(statements, db, tabKey, monthKey, testId, "xwayComparison", test.xwayComparisonRows, nowIso);
    pushMetricStatements(statements, db, tabKey, monthKey, testId, "sheetPrice", test.sheetPriceRows, nowIso);
    metricsTotal +=
      (Array.isArray(test.metrics) ? test.metrics.length : 0)
      + (Array.isArray(test.comparisonRows) ? test.comparisonRows.length : 0)
      + (Array.isArray(test.xwayComparisonRows) ? test.xwayComparisonRows.length : 0)
      + (Array.isArray(test.sheetPriceRows) ? test.sheetPriceRows.length : 0);

    const variants = Array.isArray(test.variants) ? test.variants : [];
    variants.forEach((variantRaw, index) => {
      const variant = variantRaw && typeof variantRaw === "object" ? variantRaw : {};
      statements.push(
        db.prepare(
          `INSERT INTO ab_month_test_variants (
            tab_key, month_key, test_id, variant_index, image_url, image_src, views_value,
            clicks_value, ctr_value, installed_at_iso, views_text, clicks_text, ctr_text,
            installed_at_date, installed_at_time, hours_text, is_best, ctr_boost_value,
            ctr_boost_text, ctr_boost_kind, status_raw, is_pending, is_active, created_at, updated_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)`,
        ).bind(
          tabKey,
          monthKey,
          testId,
          integerOrNull(variant.index) || index + 1,
          nullableString(variant.imageUrl, 2000),
          nullableString(variant.imageSrc, 2000),
          integerOrNull(variant.viewsValue),
          integerOrNull(variant.clicksValue),
          finiteNumberOrNull(variant.ctrValue),
          nullableString(variant.installedAtIso, 120),
          nullableString(variant.views, 120),
          nullableString(variant.clicks, 120),
          nullableString(variant.ctr, 120),
          nullableString(variant.installedAtDate, 120),
          nullableString(variant.installedAtTime, 120),
          nullableString(variant.hours, 120),
          boolToDb(variant.isBest),
          finiteNumberOrNull(variant.ctrBoostValue),
          nullableString(variant.ctrBoostText, 120),
          nullableString(variant.ctrBoostKind, 120),
          nullableString(variant.statusRaw, 120),
          boolToDb(variant.isPending),
          boolToDb(variant.isActive),
          nowIso,
          nowIso,
        ),
      );
    });
    variantsTotal += variants.length;

    (Array.isArray(test.imageUrls) ? test.imageUrls : []).forEach((imageUrlRaw, index) => {
      const imageUrl = safeString(imageUrlRaw, 2000);
      if (!imageUrl) return;
      statements.push(
        db.prepare(
          `INSERT INTO ab_month_test_images (
            tab_key, month_key, test_id, image_index, image_url, created_at, updated_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        ).bind(tabKey, monthKey, testId, index, imageUrl, nowIso, nowIso),
      );
    });
  });

  statements.push(
    db.prepare(
      `INSERT INTO ab_month_save_events (
        tab_key, month_key, saved_at, source, tests_total, metrics_total, variants_total, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(tabKey, monthKey, nowIso, nullableString(options.source || model.source || "client"), tests.length, metricsTotal, variantsTotal, nowIso),
  );

  await runStatements(db, statements);

  return { ok: true, saved: true, tabKey, monthKey, testsTotal: tests.length, metricsTotal, variantsTotal };
}

function buildMetricRowsByScope(rowsRaw) {
  const output = {};
  for (const row of Array.isArray(rowsRaw) ? rowsRaw : []) {
    const scope = safeString(row?.metric_scope, 80);
    if (!scope) continue;
    if (!output[scope]) output[scope] = [];
    output[scope].push(row);
  }

  for (const rows of Object.values(output)) {
    rows.sort((a, b) => (Number(a.metric_index) || 0) - (Number(b.metric_index) || 0));
  }
  return output;
}

function restoreCheckMetric(row) {
  return {
    checkName: safeString(row?.metric_key, 120),
    label: safeString(row?.label, 200),
    valueText: safeString(row?.value_text, 200),
    statusRaw: safeString(row?.status_raw, 120),
    statusKind: safeString(row?.status_kind, 120),
  };
}

function restoreComparisonMetric(row) {
  return {
    label: safeString(row?.label, 200),
    before: safeString(row?.before_text, 200) || "—",
    during: safeString(row?.during_text, 200) || "—",
    after: safeString(row?.after_text, 200) || "—",
    deltaText: safeString(row?.delta_text, 200) || "—",
    deltaKind: safeString(row?.delta_kind, 120) || "unknown",
    deltaValue: finiteNumberOrNull(row?.delta_value),
  };
}

function restoreVariant(row) {
  return {
    index: integerOrNull(row?.variant_index) || 0,
    imageUrl: safeString(row?.image_url, 2000),
    imageSrc: safeString(row?.image_src, 2000),
    viewsValue: integerOrNull(row?.views_value),
    clicksValue: integerOrNull(row?.clicks_value),
    ctrValue: finiteNumberOrNull(row?.ctr_value),
    installedAtIso: safeString(row?.installed_at_iso, 120),
    views: safeString(row?.views_text, 120) || "—",
    clicks: safeString(row?.clicks_text, 120) || "—",
    ctr: safeString(row?.ctr_text, 120) || "—",
    installedAtDate: safeString(row?.installed_at_date, 120) || "—",
    installedAtTime: safeString(row?.installed_at_time, 120),
    hours: safeString(row?.hours_text, 120) || "—",
    isBest: dbToBool(row?.is_best) === true,
    ctrBoostValue: finiteNumberOrNull(row?.ctr_boost_value),
    ctrBoostText: safeString(row?.ctr_boost_text, 120),
    ctrBoostKind: safeString(row?.ctr_boost_kind, 120),
    statusRaw: safeString(row?.status_raw, 120),
    isPending: dbToBool(row?.is_pending) === true,
    isActive: dbToBool(row?.is_active) === true,
  };
}

async function selectRowsForMonths(db, tableName, tabKey, monthKeys, orderBy) {
  if (!monthKeys.length) return [];
  const placeholders = monthKeys.map((_, index) => `?${index + 2}`).join(", ");
  const result = await db
    .prepare(
      `SELECT * FROM ${tableName}
       WHERE tab_key = ?1
         AND month_key IN (${placeholders})
       ${orderBy ? `ORDER BY ${orderBy}` : ""}`,
    )
    .bind(tabKey, ...monthKeys)
    .all();
  return Array.isArray(result?.results) ? result.results : [];
}

export async function loadAbMonthModel(db, optionsRaw) {
  if (!db) return { ok: false, hit: false, availableMonthKeys: [] };
  const options = optionsRaw && typeof optionsRaw === "object" ? optionsRaw : {};
  const tabKey = normalizeAbCacheTabKey(options.tabKey);
  const monthKeys = normalizeMonthKeys(options.monthKeys);
  if (!tabKey || !monthKeys.length) {
    return { ok: true, hit: false, availableMonthKeys: [] };
  }

  await ensureAbMonthCacheTables(db);

  const availableResult = await db
    .prepare(
      `SELECT month_key, fetched_at, updated_at
       FROM ab_month_cache_meta
       WHERE tab_key = ?1
       ORDER BY month_key DESC`,
    )
    .bind(tabKey)
    .all();
  const availableRows = Array.isArray(availableResult?.results) ? availableResult.results : [];
  const availableMonthKeys = availableRows.map((row) => safeString(row?.month_key, 20)).filter(Boolean);
  const availableSet = new Set(availableMonthKeys);
  const missingMonthKeys = monthKeys.filter((monthKey) => !availableSet.has(monthKey));
  if (missingMonthKeys.length) {
    return { ok: true, hit: false, availableMonthKeys, missingMonthKeys };
  }

  const [metaRows, testRows, metricRows, variantRows, imageRows] = await Promise.all([
    selectRowsForMonths(db, "ab_month_cache_meta", tabKey, monthKeys, "month_key DESC"),
    selectRowsForMonths(db, "ab_month_tests", tabKey, monthKeys, "month_key DESC, sort_index ASC"),
    selectRowsForMonths(db, "ab_month_test_metrics", tabKey, monthKeys, "month_key DESC, test_id ASC, metric_scope ASC, metric_index ASC"),
    selectRowsForMonths(db, "ab_month_test_variants", tabKey, monthKeys, "month_key DESC, test_id ASC, variant_index ASC"),
    selectRowsForMonths(db, "ab_month_test_images", tabKey, monthKeys, "month_key DESC, test_id ASC, image_index ASC"),
  ]);

  const metricsByTest = new Map();
  for (const row of metricRows) {
    const key = `${safeString(row?.month_key, 20)}|${safeString(row?.test_id, 120)}`;
    if (!metricsByTest.has(key)) metricsByTest.set(key, []);
    metricsByTest.get(key).push(row);
  }

  const variantsByTest = new Map();
  for (const row of variantRows) {
    const key = `${safeString(row?.month_key, 20)}|${safeString(row?.test_id, 120)}`;
    if (!variantsByTest.has(key)) variantsByTest.set(key, []);
    variantsByTest.get(key).push(row);
  }

  const imagesByTest = new Map();
  for (const row of imageRows) {
    const key = `${safeString(row?.month_key, 20)}|${safeString(row?.test_id, 120)}`;
    if (!imagesByTest.has(key)) imagesByTest.set(key, []);
    imagesByTest.get(key).push(safeString(row?.image_url, 2000));
  }

  const tests = testRows.map((row) => {
    const testId = safeString(row?.test_id, 120);
    const key = `${safeString(row?.month_key, 20)}|${testId}`;
    const groupedMetrics = buildMetricRowsByScope(metricsByTest.get(key) || []);
    const summaryChecks = checksOrNull(row, "summary") || { testCtr: "?", testPrice: "?", testCtrCr1: "?", overall: "?" };
    const xwaySummaryChecks = checksOrNull(row, "xway_summary");
    const reportText = safeString(row?.report_text, 20000);

    return {
      testId,
      xwayUrl: safeString(row?.xway_url, 1200),
      wbUrl: safeString(row?.wb_url, 1200),
      article: safeString(row?.article, 120),
      title: safeString(row?.title, 1000),
      productName: safeString(row?.product_name, 1000),
      type: safeString(row?.type, 120),
      campaignExternalId: safeString(row?.campaign_external_id, 200),
      cabinet: safeString(row?.cabinet, 300),
      startedAt: safeString(row?.started_at, 120),
      startedAtIso: safeString(row?.started_at_iso, 120),
      endedAt: safeString(row?.ended_at, 120),
      endedAtIso: safeString(row?.ended_at_iso, 120),
      abActivityStartedAtIso: safeString(row?.ab_activity_started_at_iso, 120),
      abActivityEndedAtIso: safeString(row?.ab_activity_ended_at_iso, 120),
      metrics: (groupedMetrics.metrics || []).map(restoreCheckMetric),
      finalStatusRaw: safeString(row?.final_status_raw, 120),
      finalStatusKind: safeString(row?.final_status_kind, 120) || "unknown",
      summaryChecks,
      xwaySummaryChecks,
      xwayComparisonRows: groupedMetrics.xwayComparison?.length
        ? groupedMetrics.xwayComparison.map(restoreComparisonMetric)
        : null,
      xwayBeforeAdjustment: parseJson(row?.xway_before_adjustment_json, null),
      variants: (variantsByTest.get(key) || []).map(restoreVariant).sort((a, b) => a.index - b.index),
      priceDeviationCount: safeString(row?.price_deviation_count, 120),
      comparisonRows: (groupedMetrics.comparison || []).map(restoreComparisonMetric),
      reportLines: reportText ? reportText.split("\n") : [],
      reportText,
      shopId: integerOrNull(row?.shop_id) || 0,
      productId: integerOrNull(row?.product_id) || 0,
      launchStatus: safeString(row?.launch_status, 120),
      progress: finiteNumberOrNull(row?.progress) || 0,
      views: integerOrNull(row?.views) || 0,
      cpm: finiteNumberOrNull(row?.cpm) || 0,
      estimatedExpense: finiteNumberOrNull(row?.estimated_expense) || 0,
      imagesNum: integerOrNull(row?.images_num) || 0,
      imageUrls: imagesByTest.get(key) || [],
      mainImageUrl: safeString(row?.main_image_url, 2000),
      sheetPriceRows: (groupedMetrics.sheetPrice || []).map(restoreComparisonMetric),
      sheetPriceDecisionRaw: safeString(row?.sheet_price_decision_raw, 120),
      sheetPriceDeviationCount: safeString(row?.sheet_price_deviation_count, 120),
      sortIndex: integerOrNull(row?.sort_index) || 0,
    };
  }).sort(sortTests);

  const cabinets = Array.from(new Set(tests.map((test) => safeString(test.cabinet, 300)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
  const latestFetchedAt = metaRows
    .map((row) => safeString(row?.fetched_at, 120))
    .filter(Boolean)
    .sort()
    .at(-1) || "";
  const rowCounts = metaRows.reduce(
    (acc, row) => {
      acc.catalog += integerOrNull(row?.row_count_catalog) || 0;
      acc.technical += integerOrNull(row?.row_count_technical) || 0;
      acc.results += integerOrNull(row?.row_count_results) || 0;
      return acc;
    },
    { catalog: 0, technical: 0, results: 0 },
  );

  return {
    ok: true,
    hit: true,
    tabKey,
    monthKeys,
    availableMonthKeys,
    model: {
      fetchedAt: latestFetchedAt,
      total: tests.length,
      tests,
      products: buildProducts(tests),
      cabinets,
      statusTotals: buildStatusTotals(tests),
      rowCounts,
      liveTotals: buildLiveTotals(tests),
      availableMonthKeys,
      cache: {
        source: "d1",
        tabKey,
        monthKeys,
      },
    },
  };
}

export async function saveProductSnapshots(db, snapshotsRaw) {
  if (!db) return;
  const snapshots = Array.isArray(snapshotsRaw) ? snapshotsRaw : [];
  if (!snapshots.length) return;
  await ensureAbMonthCacheTables(db);
  const nowIso = new Date().toISOString();
  const statements = [];
  for (const snapshotRaw of snapshots) {
    const snapshot = snapshotRaw && typeof snapshotRaw === "object" ? snapshotRaw : {};
    const shopId = integerOrNull(snapshot.shopId);
    const productId = integerOrNull(snapshot.productId);
    const productKey = safeString(snapshot.key, 120) || (shopId && productId ? `${shopId}:${productId}` : "");
    if (!productKey || !shopId || !productId) continue;
    statements.push(
      db.prepare(
        `INSERT INTO ab_product_snapshots (
          product_key, article, shop_id, product_id, name, main_image_url, stock_value,
          in_stock, fetched_at, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        ON CONFLICT(product_key) DO UPDATE SET
          article = excluded.article,
          shop_id = excluded.shop_id,
          product_id = excluded.product_id,
          name = excluded.name,
          main_image_url = excluded.main_image_url,
          stock_value = excluded.stock_value,
          in_stock = excluded.in_stock,
          fetched_at = excluded.fetched_at,
          updated_at = excluded.updated_at`,
      ).bind(
        productKey,
        nullableString(snapshot.article, 120),
        shopId,
        productId,
        nullableString(snapshot.name, 1000),
        nullableString(snapshot.mainImageUrl, 2000),
        integerOrNull(snapshot.stockValue),
        boolToDb(snapshot.inStock),
        nowIso,
        nowIso,
        nowIso,
      ),
    );
  }
  await runStatements(db, statements);
}

export async function loadProductSnapshots(db, productKeysRaw) {
  if (!db) return new Map();
  const productKeys = Array.from(new Set((Array.isArray(productKeysRaw) ? productKeysRaw : []).map((key) => safeString(key, 120)).filter(Boolean)));
  if (!productKeys.length) return new Map();
  await ensureAbMonthCacheTables(db);
  const output = new Map();
  for (let start = 0; start < productKeys.length; start += 80) {
    const chunk = productKeys.slice(start, start + 80);
    const placeholders = chunk.map((_, index) => `?${index + 1}`).join(", ");
    const result = await db
      .prepare(`SELECT * FROM ab_product_snapshots WHERE product_key IN (${placeholders})`)
      .bind(...chunk)
      .all();
    for (const row of Array.isArray(result?.results) ? result.results : []) {
      const key = safeString(row?.product_key, 120);
      if (!key) continue;
      output.set(key, {
        key,
        article: safeString(row?.article, 120),
        shopId: integerOrNull(row?.shop_id) || 0,
        productId: integerOrNull(row?.product_id) || 0,
        name: safeString(row?.name, 1000),
        mainImageUrl: safeString(row?.main_image_url, 2000),
        stockValue: integerOrNull(row?.stock_value),
        inStock: dbToBool(row?.in_stock),
      });
    }
  }
  return output;
}

export async function saveXwayPayload(db, optionsRaw) {
  if (!db) return;
  const options = optionsRaw && typeof optionsRaw === "object" ? optionsRaw : {};
  const payload = options.payload && typeof options.payload === "object" ? options.payload : null;
  const requestKey = safeString(options.requestKey, 1000) || buildXwayRequestKey(options.meta);
  if (!payload?.ok || !requestKey) return;
  await ensureAbMonthCacheTables(db);

  const nowIso = new Date().toISOString();
  const meta = options.meta && typeof options.meta === "object" ? options.meta : {};
  const monthKey = normalizeMonthKey(options.monthKey) || monthKeyFromPayload(payload, meta.startedAt);
  if (!monthKey) return;

  await runStatements(db, [
    db.prepare(`DELETE FROM ab_xway_payload_totals WHERE request_key = ?1`).bind(requestKey),
    db.prepare(`DELETE FROM ab_xway_payload_metrics WHERE request_key = ?1`).bind(requestKey),
    db.prepare(`DELETE FROM ab_xway_payload_variants WHERE request_key = ?1`).bind(requestKey),
    db.prepare(`DELETE FROM ab_xway_payload_campaigns WHERE request_key = ?1`).bind(requestKey),
  ]);

  const statements = [];
  statements.push(
    db.prepare(
      `INSERT INTO ab_xway_payloads (
        request_key, month_key, test_id, campaign_type, campaign_external_id, requested_started_at,
        requested_ended_at, requested_before_date, requested_after_date, fetched_at, source,
        range_time_zone, range_before, range_before_original, range_before_shifted, range_before_manual,
        range_during_from, range_during_to, range_after, range_after_available, range_after_manual,
        before_adjustment_json, product_shop_id, product_product_id, product_article, product_name,
        test_name, test_started_at, test_ended_at, test_avg_ctr, test_progress, test_launch_status,
        test_status, price_before, price_during, price_after, created_at, updated_at
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19,
        ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32, ?33, ?34, ?35, ?36, ?37, ?38
      )
      ON CONFLICT(request_key) DO UPDATE SET
        month_key = excluded.month_key,
        test_id = excluded.test_id,
        campaign_type = excluded.campaign_type,
        campaign_external_id = excluded.campaign_external_id,
        requested_started_at = excluded.requested_started_at,
        requested_ended_at = excluded.requested_ended_at,
        requested_before_date = excluded.requested_before_date,
        requested_after_date = excluded.requested_after_date,
        fetched_at = excluded.fetched_at,
        source = excluded.source,
        range_time_zone = excluded.range_time_zone,
        range_before = excluded.range_before,
        range_before_original = excluded.range_before_original,
        range_before_shifted = excluded.range_before_shifted,
        range_before_manual = excluded.range_before_manual,
        range_during_from = excluded.range_during_from,
        range_during_to = excluded.range_during_to,
        range_after = excluded.range_after,
        range_after_available = excluded.range_after_available,
        range_after_manual = excluded.range_after_manual,
        before_adjustment_json = excluded.before_adjustment_json,
        product_shop_id = excluded.product_shop_id,
        product_product_id = excluded.product_product_id,
        product_article = excluded.product_article,
        product_name = excluded.product_name,
        test_name = excluded.test_name,
        test_started_at = excluded.test_started_at,
        test_ended_at = excluded.test_ended_at,
        test_avg_ctr = excluded.test_avg_ctr,
        test_progress = excluded.test_progress,
        test_launch_status = excluded.test_launch_status,
        test_status = excluded.test_status,
        price_before = excluded.price_before,
        price_during = excluded.price_during,
        price_after = excluded.price_after,
        updated_at = excluded.updated_at`,
    ).bind(
      requestKey,
      monthKey,
      safeString(payload.testId, 120),
      nullableString(payload.campaignType, 120),
      nullableString(payload.campaignExternalId, 200),
      nullableString(meta.startedAt, 120),
      nullableString(meta.endedAt, 120),
      nullableString(meta.beforeDate, 20),
      nullableString(meta.afterDate, 20),
      nowIso,
      nullableString(payload.source || "xway", 120),
      nullableString(payload.range?.timeZone, 120),
      nullableString(payload.range?.before, 20),
      nullableString(payload.range?.beforeOriginal, 20),
      boolToDb(payload.range?.beforeShifted),
      boolToDb(payload.range?.beforeManual),
      nullableString(payload.range?.during?.from, 20),
      nullableString(payload.range?.during?.to, 20),
      nullableString(payload.range?.after, 20),
      boolToDb(payload.range?.afterAvailable),
      boolToDb(payload.range?.afterManual),
      stringifyJson(payload.range?.beforeAdjustment, null),
      integerOrNull(payload.product?.shopId),
      integerOrNull(payload.product?.productId),
      nullableString(payload.product?.article, 120),
      nullableString(payload.product?.name, 1000),
      nullableString(payload.test?.name, 1000),
      nullableString(payload.test?.startedAt, 120),
      nullableString(payload.test?.endedAt, 120),
      finiteNumberOrNull(payload.test?.avgCtr),
      finiteNumberOrNull(payload.test?.progress),
      nullableString(payload.test?.launchStatus, 120),
      nullableString(payload.test?.status, 120),
      finiteNumberOrNull(payload.priceTimeline?.before),
      finiteNumberOrNull(payload.priceTimeline?.during),
      finiteNumberOrNull(payload.priceTimeline?.after),
      nowIso,
      nowIso,
    ),
  );

  for (const phase of ["before", "during", "after"]) {
    const totals = payload.totals?.[phase];
    if (!totals) continue;
    statements.push(
      db.prepare(
        `INSERT INTO ab_xway_payload_totals (
          request_key, phase, matched_count, views, clicks, atbs, orders_count, sum_price, bid, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      ).bind(
        requestKey,
        phase,
        integerOrNull(totals.matchedCount),
        integerOrNull(totals.views),
        integerOrNull(totals.clicks),
        integerOrNull(totals.atbs),
        integerOrNull(totals.orders),
        finiteNumberOrNull(totals.sumPrice),
        finiteNumberOrNull(totals.bid),
        nowIso,
        nowIso,
      ),
    );
  }

  (Array.isArray(payload.metrics) ? payload.metrics : []).forEach((rowRaw, index) => {
    const row = rowRaw && typeof rowRaw === "object" ? rowRaw : {};
    statements.push(
      db.prepare(
        `INSERT INTO ab_xway_payload_metrics (
          request_key, metric_index, metric_key, label, kind, before_value, during_value,
          after_value, delta_value, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      ).bind(
        requestKey,
        index,
        nullableString(row.key, 120),
        nullableString(row.label, 200),
        nullableString(row.kind, 120),
        finiteNumberOrNull(row.before),
        finiteNumberOrNull(row.during),
        finiteNumberOrNull(row.after),
        finiteNumberOrNull(row.delta),
        nowIso,
        nowIso,
      ),
    );
  });

  (Array.isArray(payload.variantStats) ? payload.variantStats : []).forEach((rowRaw, index) => {
    const row = rowRaw && typeof rowRaw === "object" ? rowRaw : {};
    statements.push(
      db.prepare(
        `INSERT INTO ab_xway_payload_variants (
          request_key, variant_index, url, views, clicks, spend, ctr, ctr_to_avg, ctr_to_max,
          avg_ctr, status, date_start, main, sort_index, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`,
      ).bind(
        requestKey,
        index,
        nullableString(row.url, 2000),
        integerOrNull(row.views),
        integerOrNull(row.clicks),
        finiteNumberOrNull(row.spend),
        finiteNumberOrNull(row.ctr),
        finiteNumberOrNull(row.ctrToAvg),
        finiteNumberOrNull(row.ctrToMax),
        finiteNumberOrNull(row.avgCtr),
        nullableString(row.status, 120),
        nullableString(row.dateStart, 120),
        boolToDb(row.main),
        integerOrNull(row.sortIndex),
        nowIso,
        nowIso,
      ),
    );
  });

  for (const phase of ["before", "during", "after"]) {
    const campaigns = Array.isArray(payload.matchedCampaigns?.[phase]) ? payload.matchedCampaigns[phase] : [];
    campaigns.forEach((campaignRaw, index) => {
      const campaign = campaignRaw && typeof campaignRaw === "object" ? campaignRaw : {};
      statements.push(
        db.prepare(
          `INSERT INTO ab_xway_payload_campaigns (
            request_key, phase, campaign_index, campaign_id, external_id, name, created_at, updated_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
        ).bind(
          requestKey,
          phase,
          index,
          integerOrNull(campaign.id),
          nullableString(campaign.externalId, 200),
          nullableString(campaign.name, 1000),
          nowIso,
          nowIso,
        ),
      );
    });
  }

  await runStatements(db, statements);
}

function restoreTotals(row) {
  return {
    matchedCount: integerOrNull(row?.matched_count) || 0,
    views: integerOrNull(row?.views) || 0,
    clicks: integerOrNull(row?.clicks) || 0,
    atbs: integerOrNull(row?.atbs) || 0,
    orders: integerOrNull(row?.orders_count) || 0,
    sumPrice: finiteNumberOrNull(row?.sum_price) || 0,
    bid: finiteNumberOrNull(row?.bid),
  };
}

export async function loadXwayPayload(db, requestKeyRaw) {
  if (!db) return null;
  const requestKey = safeString(requestKeyRaw, 1000);
  if (!requestKey) return null;
  await ensureAbMonthCacheTables(db);
  const payloadResult = await db
    .prepare(`SELECT * FROM ab_xway_payloads WHERE request_key = ?1`)
    .bind(requestKey)
    .first();
  if (!payloadResult) return null;

  const [totalsResult, metricsResult, variantsResult, campaignsResult] = await Promise.all([
    db.prepare(`SELECT * FROM ab_xway_payload_totals WHERE request_key = ?1`).bind(requestKey).all(),
    db.prepare(`SELECT * FROM ab_xway_payload_metrics WHERE request_key = ?1 ORDER BY metric_index ASC`).bind(requestKey).all(),
    db.prepare(`SELECT * FROM ab_xway_payload_variants WHERE request_key = ?1 ORDER BY variant_index ASC`).bind(requestKey).all(),
    db.prepare(`SELECT * FROM ab_xway_payload_campaigns WHERE request_key = ?1 ORDER BY phase ASC, campaign_index ASC`).bind(requestKey).all(),
  ]);

  const totals = {};
  for (const row of Array.isArray(totalsResult?.results) ? totalsResult.results : []) {
    const phase = safeString(row?.phase, 40);
    if (phase) totals[phase] = restoreTotals(row);
  }

  const matchedCampaigns = { before: [], during: [], after: [] };
  for (const row of Array.isArray(campaignsResult?.results) ? campaignsResult.results : []) {
    const phase = safeString(row?.phase, 40);
    if (!matchedCampaigns[phase]) continue;
    matchedCampaigns[phase].push({
      id: integerOrNull(row?.campaign_id) || 0,
      externalId: safeString(row?.external_id, 200),
      name: safeString(row?.name, 1000),
    });
  }

  return {
    ok: true,
    source: "xway",
    testId: safeString(payloadResult?.test_id, 120),
    campaignType: safeString(payloadResult?.campaign_type, 120),
    campaignExternalId: safeString(payloadResult?.campaign_external_id, 200),
    range: {
      timeZone: safeString(payloadResult?.range_time_zone, 120),
      before: safeString(payloadResult?.range_before, 20),
      beforeOriginal: safeString(payloadResult?.range_before_original, 20),
      beforeShifted: dbToBool(payloadResult?.range_before_shifted) === true,
      beforeManual: dbToBool(payloadResult?.range_before_manual) === true,
      beforeAdjustment: parseJson(payloadResult?.before_adjustment_json, null),
      during: {
        from: safeString(payloadResult?.range_during_from, 20),
        to: safeString(payloadResult?.range_during_to, 20),
      },
      after: safeString(payloadResult?.range_after, 20),
      afterAvailable: dbToBool(payloadResult?.range_after_available) === true,
      afterManual: dbToBool(payloadResult?.range_after_manual) === true,
    },
    product: {
      shopId: integerOrNull(payloadResult?.product_shop_id) || 0,
      productId: integerOrNull(payloadResult?.product_product_id) || 0,
      article: safeString(payloadResult?.product_article, 120),
      name: safeString(payloadResult?.product_name, 1000),
    },
    test: {
      id: integerOrNull(payloadResult?.test_id) || 0,
      name: safeString(payloadResult?.test_name, 1000),
      startedAt: safeString(payloadResult?.test_started_at, 120),
      endedAt: safeString(payloadResult?.test_ended_at, 120),
      avgCtr: finiteNumberOrNull(payloadResult?.test_avg_ctr),
      progress: finiteNumberOrNull(payloadResult?.test_progress) || 0,
      launchStatus: safeString(payloadResult?.test_launch_status, 120),
      status: safeString(payloadResult?.test_status, 120),
    },
    variantStats: (Array.isArray(variantsResult?.results) ? variantsResult.results : []).map((row) => ({
      url: safeString(row?.url, 2000),
      views: integerOrNull(row?.views),
      clicks: integerOrNull(row?.clicks),
      spend: finiteNumberOrNull(row?.spend),
      ctr: finiteNumberOrNull(row?.ctr),
      ctrToAvg: finiteNumberOrNull(row?.ctr_to_avg),
      ctrToMax: finiteNumberOrNull(row?.ctr_to_max),
      avgCtr: finiteNumberOrNull(row?.avg_ctr),
      status: safeString(row?.status, 120),
      dateStart: safeString(row?.date_start, 120),
      main: dbToBool(row?.main),
      sortIndex: integerOrNull(row?.sort_index),
    })),
    matchedCampaigns,
    totals,
    priceTimeline: {
      before: finiteNumberOrNull(payloadResult?.price_before),
      during: finiteNumberOrNull(payloadResult?.price_during),
      after: finiteNumberOrNull(payloadResult?.price_after),
    },
    metrics: (Array.isArray(metricsResult?.results) ? metricsResult.results : []).map((row) => ({
      key: safeString(row?.metric_key, 120),
      label: safeString(row?.label, 200),
      kind: safeString(row?.kind, 120),
      before: finiteNumberOrNull(row?.before_value),
      during: finiteNumberOrNull(row?.during_value),
      after: finiteNumberOrNull(row?.after_value),
      delta: finiteNumberOrNull(row?.delta_value),
    })),
    cache: {
      source: "d1",
      fetchedAt: safeString(payloadResult?.fetched_at, 120),
    },
  };
}
