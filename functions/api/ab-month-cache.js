import { json } from "./_lib/auth.js";
import {
  loadAbMonthModel,
  normalizeAbCacheTabKey,
  normalizeMonthKey,
  normalizeMonthKeys,
  saveAbMonthModel,
} from "./_lib/ab-month-cache.js";

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!env?.DB) {
    return json({ ok: true, hit: false, availableMonthKeys: [], message: "D1 binding DB is not configured" });
  }

  const url = new URL(request.url);
  const tabKey = normalizeAbCacheTabKey(url.searchParams.get("tab"));
  const monthKeys = normalizeMonthKeys([
    ...url.searchParams.getAll("month"),
    ...String(url.searchParams.get("months") || "").split(","),
  ]);

  if (!tabKey) {
    return json({ ok: false, error: "invalid_tab" }, { status: 400 });
  }
  if (!monthKeys.length) {
    return json({ ok: false, error: "missing_months" }, { status: 400 });
  }

  try {
    const result = await loadAbMonthModel(env.DB, { tabKey, monthKeys });
    return json(result);
  } catch (error) {
    return json(
      {
        ok: false,
        hit: false,
        error: "ab_month_cache_load_failed",
        message: error instanceof Error ? error.message : "Не удалось загрузить месячный кэш AB.",
      },
      { status: 500 },
    );
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!env?.DB) {
    return json({ ok: true, saved: false, message: "D1 binding DB is not configured" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const tabKey = normalizeAbCacheTabKey(body?.tab || body?.tabKey);
  const monthKey = normalizeMonthKey(body?.month || body?.monthKey);
  const model = body?.model && typeof body.model === "object" ? body.model : null;
  if (!tabKey) {
    return json({ ok: false, error: "invalid_tab" }, { status: 400 });
  }
  if (!monthKey) {
    return json({ ok: false, error: "invalid_month" }, { status: 400 });
  }
  if (!model) {
    return json({ ok: false, error: "invalid_model" }, { status: 400 });
  }

  try {
    const result = await saveAbMonthModel(env.DB, {
      tabKey,
      monthKey,
      model,
      source: body?.source || "client",
    });
    return json(result);
  } catch (error) {
    return json(
      {
        ok: false,
        saved: false,
        error: "ab_month_cache_save_failed",
        message: error instanceof Error ? error.message : "Не удалось сохранить месячный кэш AB.",
      },
      { status: 500 },
    );
  }
}
