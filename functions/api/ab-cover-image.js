const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_HOSTS = new Set(["static.mpmpmp.ru"]);

function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function getTargetUrl(request) {
  const requestUrl = new URL(request.url);
  const raw = String(requestUrl.searchParams.get("url") || "").trim();
  if (!raw) {
    return null;
  }

  let target;
  try {
    target = new URL(raw);
  } catch {
    return null;
  }

  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return null;
  }

  return target;
}

function detectImageContentType(bytes, sourceContentType = "") {
  const sourceType = String(sourceContentType || "").split(";")[0].trim().toLowerCase();
  if (sourceType.startsWith("image/")) {
    return sourceType;
  }

  if (
    bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 6
    && bytes[0] === 0x47
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x38
  ) {
    return "image/gif";
  }

  if (
    bytes.length >= 12
    && bytes[4] === 0x66
    && bytes[5] === 0x74
    && bytes[6] === 0x79
    && bytes[7] === 0x70
  ) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    if (brand === "avif") {
      return "image/avif";
    }
  }

  return "";
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestGet(context) {
  const targetUrl = getTargetUrl(context.request);
  if (!targetUrl) {
    return errorResponse("invalid_image_url", 400);
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl.toString(), {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
  } catch {
    return errorResponse("image_fetch_failed", 502);
  }

  if (!upstream.ok) {
    return errorResponse("image_fetch_failed", upstream.status);
  }

  const contentLength = Number(upstream.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
    return errorResponse("image_too_large", 413);
  }

  const buffer = await upstream.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return errorResponse("image_too_large", 413);
  }

  const bytes = new Uint8Array(buffer.slice(0, 32));
  const contentType = detectImageContentType(bytes, upstream.headers.get("content-type") || "");
  if (!contentType) {
    return errorResponse("unsupported_image_type", 415);
  }

  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  const etag = String(upstream.headers.get("etag") || "").trim();
  if (etag) {
    headers.set("etag", etag);
  }

  return new Response(buffer, { headers });
}
