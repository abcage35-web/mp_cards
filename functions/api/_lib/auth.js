const DEFAULT_COOKIE_NAME = "mp_session";
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const MIN_SESSION_TTL_SECONDS = 60 * 5;
const MAX_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const MIN_PBKDF2_ITERATIONS = 100000;
const MAX_PBKDF2_ITERATIONS = 900000;
const FALLBACK_SESSION_PREFIX = "fb1";
const DEFAULT_FALLBACK_AUTH_SECRET = "mp-cards-fallback-auth-v1";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function getCookieName(env) {
  const custom = String(env?.AUTH_COOKIE_NAME || "").trim();
  return custom || DEFAULT_COOKIE_NAME;
}

export function getSessionTtlSeconds(env) {
  const value = Number(env?.SESSION_TTL_SECONDS);
  if (!Number.isFinite(value)) {
    return DEFAULT_SESSION_TTL_SECONDS;
  }
  return Math.max(MIN_SESSION_TTL_SECONDS, Math.min(MAX_SESSION_TTL_SECONDS, Math.round(value)));
}

function isSecureRequest(request) {
  try {
    const url = new URL(request.url);
    return url.protocol === "https:";
  } catch {
    return true;
  }
}

function buildCookieValue(parts) {
  return parts.filter(Boolean).join("; ");
}

export function buildSessionCookie(request, env, sid, maxAgeSeconds = getSessionTtlSeconds(env)) {
  const cookieName = getCookieName(env);
  const maxAge = Math.max(1, Math.round(Number(maxAgeSeconds) || DEFAULT_SESSION_TTL_SECONDS));
  return buildCookieValue([
    `${cookieName}=${sid}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    isSecureRequest(request) ? "Secure" : "",
  ]);
}

export function buildClearSessionCookie(request, env) {
  const cookieName = getCookieName(env);
  return buildCookieValue([
    `${cookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    isSecureRequest(request) ? "Secure" : "",
  ]);
}

function parseCookieHeader(cookieHeaderRaw) {
  const header = String(cookieHeaderRaw || "");
  if (!header) {
    return {};
  }

  return header.split(";").reduce((acc, segment) => {
    const trimmed = segment.trim();
    if (!trimmed) {
      return acc;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      return acc;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
}

export function getSessionIdFromRequest(request, env) {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const sid = String(cookies[getCookieName(env)] || "").trim();
  if (!sid) {
    return "";
  }
  return sid.slice(0, 200);
}

function generateSessionId() {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  return Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeSessionRole(roleRaw) {
  const role = String(roleRaw || "").trim().toLowerCase();
  return role === "admin" || role === "user" ? role : "";
}

function bytesToBase64Url(bytesRaw) {
  const bytes = bytesRaw instanceof Uint8Array ? bytesRaw : new Uint8Array(0);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(base64UrlRaw) {
  const base64Url = String(base64UrlRaw || "").trim();
  if (!base64Url) {
    return new Uint8Array(0);
  }

  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  const binary = atob(base64);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

function textToBase64Url(valueRaw) {
  return bytesToBase64Url(textEncoder.encode(String(valueRaw || "")));
}

function base64UrlToText(valueRaw) {
  return textDecoder.decode(base64UrlToBytes(valueRaw));
}

function getFallbackAuthSecret(env) {
  const custom = String(env?.AUTH_FALLBACK_SECRET || env?.AUTH_SECRET || env?.JWT_SECRET || "").trim();
  return custom || DEFAULT_FALLBACK_AUTH_SECRET;
}

async function signFallbackSession(env, payloadPart) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(getFallbackAuthSecret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(String(payloadPart || "")));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createFallbackSession(env, userRaw) {
  const login = sanitizeLogin(userRaw?.login);
  const role = normalizeSessionRole(userRaw?.role);
  if (!login || !role) {
    throw new Error("Invalid fallback user");
  }

  const ttlSeconds = getSessionTtlSeconds(env);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const payloadPart = textToBase64Url(JSON.stringify({
    login,
    role,
    exp: Math.floor(new Date(expiresAt).getTime() / 1000),
  }));
  const signaturePart = await signFallbackSession(env, payloadPart);

  return {
    sid: `${FALLBACK_SESSION_PREFIX}.${payloadPart}.${signaturePart}`,
    expiresAt,
    ttlSeconds,
  };
}

async function getFallbackSessionFromId(env, sidRaw) {
  const sid = String(sidRaw || "").trim();
  const parts = sid.split(".");
  if (parts.length !== 3 || parts[0] !== FALLBACK_SESSION_PREFIX) {
    return null;
  }

  const [, payloadPart, signaturePart] = parts;
  const expectedSignature = await signFallbackSession(env, payloadPart);
  if (!constantTimeEqual(base64UrlToBytes(signaturePart), base64UrlToBytes(expectedSignature))) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlToText(payloadPart));
  } catch {
    return null;
  }

  const login = sanitizeLogin(payload?.login);
  const role = normalizeSessionRole(payload?.role);
  const expiresAtMs = Math.round(Number(payload?.exp) || 0) * 1000;
  if (!login || !role || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return null;
  }

  return {
    sid,
    user: {
      id: 0,
      login,
      role,
    },
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export async function createSession(db, env, userIdRaw) {
  const userId = Number(userIdRaw);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("Invalid user id");
  }

  const sid = generateSessionId();
  const now = new Date();
  const ttlSeconds = getSessionTtlSeconds(env);
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  await db.prepare(`DELETE FROM sessions WHERE expires_at <= ?1`).bind(now.toISOString()).run();

  await db.prepare(
    `INSERT INTO sessions (sid, user_id, expires_at, created_at)
     VALUES (?1, ?2, ?3, ?4)`,
  )
    .bind(sid, userId, expiresAt, now.toISOString())
    .run();

  return {
    sid,
    expiresAt,
    ttlSeconds,
  };
}

export async function deleteSessionById(db, sidRaw) {
  const sid = String(sidRaw || "").trim();
  if (!db || !sid) {
    return;
  }
  await db.prepare(`DELETE FROM sessions WHERE sid = ?1`).bind(sid).run();
}

export async function getSessionFromRequest(request, env) {
  const sid = getSessionIdFromRequest(request, env);
  if (!sid) {
    return null;
  }

  const db = env?.DB;
  if (!db) {
    return getFallbackSessionFromId(env, sid);
  }

  const row = await db
    .prepare(
      `SELECT
         s.sid,
         s.user_id,
         s.expires_at,
         u.login,
         u.role,
         u.is_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.sid = ?1
       LIMIT 1`,
    )
    .bind(sid)
    .first();

  if (!row) {
    return null;
  }

  const expiresAt = String(row.expires_at || "").trim();
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    await deleteSessionById(db, sid);
    return null;
  }

  if (Number(row.is_active) !== 1) {
    await deleteSessionById(db, sid);
    return null;
  }

  const role = String(row.role || "").trim().toLowerCase();
  const login = String(row.login || "").trim().toLowerCase();
  if (!login || (role !== "admin" && role !== "user")) {
    await deleteSessionById(db, sid);
    return null;
  }

  return {
    sid,
    user: {
      id: Number(row.user_id) || 0,
      login,
      role,
    },
    expiresAt,
  };
}

export function sanitizeLogin(loginRaw) {
  const login = String(loginRaw || "")
    .trim()
    .toLowerCase()
    .slice(0, 60);
  if (!login) {
    return "";
  }
  if (!/^[a-z0-9._-]{1,60}$/.test(login)) {
    return "";
  }
  return login;
}

function base64ToBytes(base64Raw) {
  const base64 = String(base64Raw || "").trim();
  if (!base64) {
    return new Uint8Array(0);
  }
  const binary = atob(base64);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

function constantTimeEqual(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array)) {
    return false;
  }
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

async function derivePbkdf2(password, saltBytes, iterations, keyLength = 32) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(String(password || "")),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations,
    },
    keyMaterial,
    keyLength * 8,
  );
  return new Uint8Array(derivedBits);
}

export async function verifyPassword(plainPasswordRaw, passwordHashRaw) {
  const plainPassword = String(plainPasswordRaw || "");
  const passwordHash = String(passwordHashRaw || "").trim();
  if (!plainPassword || !passwordHash) {
    return false;
  }

  const parts = passwordHash.split("$");
  if (parts.length !== 4) {
    return false;
  }

  const algorithm = String(parts[0] || "").trim().toLowerCase();
  if (algorithm !== "pbkdf2_sha256") {
    return false;
  }

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < MIN_PBKDF2_ITERATIONS || iterations > MAX_PBKDF2_ITERATIONS) {
    return false;
  }

  let saltBytes;
  let expectedBytes;
  try {
    saltBytes = base64ToBytes(parts[2]);
    expectedBytes = base64ToBytes(parts[3]);
  } catch {
    return false;
  }

  if (saltBytes.length < 8 || expectedBytes.length < 16) {
    return false;
  }

  try {
    const actualBytes = await derivePbkdf2(plainPassword, saltBytes, iterations, expectedBytes.length);
    return constantTimeEqual(actualBytes, expectedBytes);
  } catch {
    return false;
  }
}
