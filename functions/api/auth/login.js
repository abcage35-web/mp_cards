import {
  buildSessionCookie,
  createSession,
  json,
  sanitizeLogin,
  verifyPassword,
} from "../_lib/auth.js";

const MAX_PASSWORD_LENGTH = 200;
const DEFAULT_BOOTSTRAP_USERS = Object.freeze([
  Object.freeze({
    login: "user",
    password: "user",
    role: "user",
    passwordHash:
      "pbkdf2_sha256$210000$Xyk2VrY4qRGg4fnlg2fBCw==$8P22oGccoWWA7nyD2nujjFuuToxvWwpwO3o6kwe1nB8=",
  }),
  Object.freeze({
    login: "admin",
    password: "admin 1",
    role: "admin",
    passwordHash:
      "pbkdf2_sha256$210000$akVRZ3qknVvEJ0HIbtvqhg==$GpxkvT/Wb9m4nGTFBw4wxkEc+rw9gTFHMEyqxh3nFPw=",
  }),
]);

function unauthorizedResponse() {
  return json({ ok: false, error: "Invalid login or password" }, { status: 401 });
}

function getBootstrapUserByCredentials(loginRaw, passwordRaw) {
  const login = sanitizeLogin(loginRaw);
  const password = String(passwordRaw || "");
  if (!login || !password) {
    return null;
  }

  for (const user of DEFAULT_BOOTSTRAP_USERS) {
    if (login === user.login && password === user.password) {
      return user;
    }
  }

  return null;
}

async function readUserByLogin(db, login) {
  return db
    .prepare(
      `SELECT id, login, role, password_hash, is_active
       FROM users
       WHERE login = ?1
       LIMIT 1`,
    )
    .bind(login)
    .first();
}

async function upsertBootstrapUser(db, bootstrapUser) {
  if (!bootstrapUser || typeof bootstrapUser !== "object") {
    return;
  }

  await db.prepare(
    `INSERT INTO users (login, password_hash, role, is_active, created_at)
     VALUES (?1, ?2, ?3, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(login) DO UPDATE SET
       password_hash = excluded.password_hash,
       role = excluded.role,
       is_active = 1`,
  )
    .bind(bootstrapUser.login, bootstrapUser.passwordHash, bootstrapUser.role)
    .run();
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env?.DB) {
    return json({ ok: false, error: "D1 binding DB is not configured" }, { status: 500 });
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const login = sanitizeLogin(body?.login);
  const password = String(body?.password || "");
  if (!login || !password || password.length > MAX_PASSWORD_LENGTH) {
    return unauthorizedResponse();
  }

  let user = await readUserByLogin(env.DB, login);
  let isValidPassword = false;
  if (user && Number(user.is_active) === 1) {
    isValidPassword = await verifyPassword(password, user.password_hash);
  }

  if (!isValidPassword) {
    const bootstrapUser = getBootstrapUserByCredentials(login, password);
    if (!bootstrapUser) {
      return unauthorizedResponse();
    }
    await upsertBootstrapUser(env.DB, bootstrapUser);
    user = await readUserByLogin(env.DB, bootstrapUser.login);
    if (!user || Number(user.is_active) !== 1) {
      return unauthorizedResponse();
    }
  }

  const role = String(user.role || "").trim().toLowerCase();
  if (role !== "admin" && role !== "user") {
    return unauthorizedResponse();
  }
  const session = await createSession(env.DB, env, user.id);
  const headers = new Headers();
  headers.append("set-cookie", buildSessionCookie(request, env, session.sid, session.ttlSeconds));

  return json(
    {
      ok: true,
      user: {
        login: String(user.login || "").trim().toLowerCase(),
        role,
      },
      expiresAt: session.expiresAt,
    },
    { headers },
  );
}
