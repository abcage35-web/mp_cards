import { getSessionFromRequest, json } from "./_lib/auth.js";
import {
  ensureStateTables,
  errorJson,
  getClientIp,
  getStateKeyFromUrl,
  loadRowHistoryLogs,
  migrateLegacyStateToNormalizedIfNeeded,
} from "./_lib/state-store.js";

function getRowIdFromUrl(url) {
  return String(url.searchParams.get("rowId") || "").trim();
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!env?.DB) {
    return json({ ok: false, error: "D1 binding DB is not configured" }, { status: 500 });
  }

  const session = await getSessionFromRequest(request, env);
  if (!session) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureStateTables(env.DB);
    const url = new URL(request.url);
    const stateKey = getStateKeyFromUrl(url);
    const rowId = getRowIdFromUrl(url);
    if (!rowId) {
      return json({ ok: false, error: "rowId is required" }, { status: 400 });
    }

    await migrateLegacyStateToNormalizedIfNeeded(env.DB, {
      stateKey,
      actorUserId: session?.user?.id,
      actorLogin: session?.user?.login,
      actorRole: session?.user?.role,
      actorIp: getClientIp(request),
    });

    const logs = await loadRowHistoryLogs(env.DB, stateKey, rowId);
    return json({
      ok: true,
      key: stateKey,
      rowId,
      logs,
    });
  } catch (error) {
    return errorJson(error, "Не удалось загрузить историю строки");
  }
}
