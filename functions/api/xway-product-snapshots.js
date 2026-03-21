import { json } from "./_lib/auth.js";
import {
  buildXwayCookieHeader,
  getXwayStorageState,
  xwayFetchJson,
} from "./_lib/xway-client.js";

function toFiniteNumber(valueRaw) {
  const value = Number(valueRaw);
  return Number.isFinite(value) ? value : null;
}

function buildProductPageReferer(shopIdRaw, productIdRaw) {
  const shopId = String(shopIdRaw || "").trim();
  const productId = String(productIdRaw || "").trim();
  if (!shopId || !productId) {
    return "https://am.xway.ru/wb/ab-tests";
  }
  return `https://am.xway.ru/wb/shop/${shopId}/product/${productId}`;
}

function parseItemToken(tokenRaw) {
  const token = String(tokenRaw || "").trim();
  if (!token) {
    return null;
  }

  const [shopIdRaw = "", productIdRaw = "", articleRaw = ""] = token.split(":");
  const shopId = Number(shopIdRaw);
  const productId = Number(productIdRaw);
  const article = String(articleRaw || "").trim();

  if (!Number.isFinite(shopId) || shopId <= 0 || !Number.isFinite(productId) || productId <= 0) {
    return null;
  }

  return {
    key: `${shopId}:${productId}`,
    shopId,
    productId,
    article,
  };
}

function parseSnapshotItems(url) {
  const values = [
    ...url.searchParams.getAll("item"),
    ...String(url.searchParams.get("items") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ];

  const unique = new Map();
  for (const value of values) {
    const item = parseItemToken(value);
    if (!item || unique.has(item.key)) {
      continue;
    }
    unique.set(item.key, item);
  }
  return Array.from(unique.values());
}

function normalizeSnapshot(item, productInfo) {
  const stockValue = toFiniteNumber(
    productInfo?.stock
      ?? productInfo?.stock_value
      ?? productInfo?.stocks?.total
      ?? productInfo?.balance
      ?? null,
  );

  return {
    key: item.key,
    article: item.article || String(productInfo?.external_id || "").trim(),
    shopId: item.shopId,
    productId: item.productId,
    name: String(productInfo?.name || productInfo?.name_custom || "").trim(),
    mainImageUrl: String(productInfo?.main_image_url || productInfo?.mainImageUrl || "").trim(),
    stockValue,
    inStock: Number.isFinite(stockValue) ? stockValue > 0 : null,
  };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
  return results;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const storageState = getXwayStorageState(env);
  if (!storageState || !buildXwayCookieHeader(storageState)) {
    return json(
      {
        ok: false,
        error: "xway_not_configured",
        message:
          "На сервере не настроена XWAY-сессия. Нужен secret XWAY_STORAGE_STATE_JSON или XWAY_STORAGE_STATE_BASE64.",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const items = parseSnapshotItems(url);
  if (!items.length) {
    return json({ ok: true, source: "xway-product-snapshots", items: [] });
  }

  try {
    const snapshots = await mapWithConcurrency(items, 8, async (item) => {
      try {
        const productInfo = await xwayFetchJson(
          env,
          `/api/adv/shop/${item.shopId}/product/${item.productId}/info`,
          { referer: buildProductPageReferer(item.shopId, item.productId) },
        );
        return normalizeSnapshot(item, productInfo);
      } catch {
        return {
          key: item.key,
          article: item.article,
          shopId: item.shopId,
          productId: item.productId,
          name: "",
          mainImageUrl: "",
          stockValue: null,
          inStock: null,
        };
      }
    });

    return json({
      ok: true,
      source: "xway-product-snapshots",
      fetchedAt: new Date().toISOString(),
      items: snapshots,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: "xway_product_snapshots_failed",
        message: error instanceof Error ? error.message : "Не удалось получить текущие данные товаров из XWAY.",
      },
      { status: 502 },
    );
  }
}
