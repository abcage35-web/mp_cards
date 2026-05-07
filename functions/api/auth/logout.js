import { buildClearSessionCookie, deleteSessionById, getSessionFromRequest, json } from "../_lib/auth.js";

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const session = await getSessionFromRequest(request, env);
  if (env?.DB && session?.sid) {
    await deleteSessionById(env.DB, session.sid);
  }

  const headers = new Headers();
  headers.append("set-cookie", buildClearSessionCookie(request, env));

  return json({ ok: true }, { headers });
}
