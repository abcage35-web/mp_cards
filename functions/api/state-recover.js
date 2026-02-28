import { getSessionFromRequest, json } from "./_lib/auth.js";
import {
  DEFAULT_STATE_KEY,
  ensureStateTables,
  errorJson,
  getClientIp,
  recoverStateRowsFromVersions,
} from "./_lib/state-store.js";

function getStateKeyFromBody(bodyRaw) {
  const body = bodyRaw && typeof bodyRaw === "object" ? bodyRaw : {};
  const key = String(body.key || "").trim();
  return key || DEFAULT_STATE_KEY;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!env?.DB) {
    return json({ ok: false, error: "D1 binding DB is not configured" }, { status: 500 });
  }

  const session = await getSessionFromRequest(request, env);
  if (!session) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const role = String(session?.user?.role || "").trim().toLowerCase();
  if (role !== "admin") {
    return json({ ok: false, error: "Only admin can recover rows." }, { status: 403 });
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    await ensureStateTables(env.DB);
    const stateKey = getStateKeyFromBody(body);
    const recovered = await recoverStateRowsFromVersions(env.DB, {
      stateKey,
      actorUserId: session?.user?.id,
      actorLogin: session?.user?.login,
      actorRole: session?.user?.role,
      actorIp: getClientIp(request),
    });
    return json({
      ok: true,
      ...recovered,
    });
  } catch (error) {
    return errorJson(error, "Не удалось восстановить товары из версий");
  }
}

