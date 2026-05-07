import {
  buildSessionCookie,
  createFallbackSession,
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

async function ensureAuthTables(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         login TEXT NOT NULL UNIQUE,
         password_hash TEXT NOT NULL,
         role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
         is_active INTEGER NOT NULL DEFAULT 1,
         created_at TEXT NOT NULL
       )`,
    )
    .run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`).run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS sessions (
         sid TEXT PRIMARY KEY,
         user_id INTEGER NOT NULL,
         expires_at TEXT NOT NULL,
         created_at TEXT NOT NULL,
         FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
       )`,
    )
    .run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`).run();
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

  if (!env?.DB) {
    const bootstrapUser = getBootstrapUserByCredentials(login, password);
    if (!bootstrapUser) {
      return unauthorizedResponse();
    }

    const session = await createFallbackSession(env, bootstrapUser);
    const headers = new Headers();
    headers.append("set-cookie", buildSessionCookie(request, env, session.sid, session.ttlSeconds));

    return json(
      {
        ok: true,
        user: {
          login: bootstrapUser.login,
          role: bootstrapUser.role,
        },
        expiresAt: session.expiresAt,
      },
      { headers },
    );
  }

  await ensureAuthTables(env.DB);
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
