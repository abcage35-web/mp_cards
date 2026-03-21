import { json } from "./_lib/auth.js";
import {
  XWAY_REFERERS,
  buildXwayCookieHeader,
  getXwayStorageState,
  xwayFetchJson,
} from "./_lib/xway-client.js";

function normalizeAbTestItem(item) {
  const id = Number(item?.id) || 0;
  const shopId = Number(item?.shop) || 0;
  const productId = Number(item?.product_wb) || 0;

  return {
    id,
    name: String(item?.name || "").trim(),
    productName: String(item?.product_name || "").trim(),
    productWbId: String(item?.product_wb_id || "").trim(),
    shopName: String(item?.shop_name || "").trim(),
    type: String(item?.type || "").trim(),
    status: String(item?.status || "").trim(),
    launchStatus: String(item?.launch_status || "").trim(),
    startedAt: String(item?.started_at || "").trim(),
    finishedAt: String(item?.finished_at || "").trim(),
    progress: Number(item?.progress) || 0,
    views: Number(item?.views) || 0,
    cpm: Number(item?.cpm) || 0,
    estimatedExpense: Number(item?.estimated_expense) || 0,
    imagesNum: Number(item?.images_num) || 0,
    shopId,
    productId,
    imageUrls: (Array.isArray(item?.images) ? item.images : [])
      .map((image) => String(image?.url || "").trim())
      .filter(Boolean),
  };
}

function normalizeProductImage(item) {
  return {
    article: String(item?.article || "").trim(),
    name: String(item?.name || "").trim(),
    imageUrl: String(item?.image_url || "").trim(),
  };
}

export async function onRequestGet(context) {
  const { env } = context;

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

  try {
    const [listResponse, productImagesResponse] = await Promise.all([
      xwayFetchJson(env, "/api/ab-test/ab-tests-list", {
        referer: XWAY_REFERERS.abTests,
      }),
      xwayFetchJson(env, "/api/ab-test/product/main-image", {
        referer: XWAY_REFERERS.abTests,
      }),
    ]);

    const itemsRaw = Array.isArray(listResponse?.items) ? listResponse.items : [];
    const productImagesRaw = Array.isArray(productImagesResponse) ? productImagesResponse : [];

    return json({
      ok: true,
      source: "xway-ab-tests",
      fetchedAt: new Date().toISOString(),
      total: Number(listResponse?.total) || itemsRaw.length,
      items: itemsRaw.map(normalizeAbTestItem),
      productImages: productImagesRaw.map(normalizeProductImage),
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: "xway_ab_tests_fetch_failed",
        message: error instanceof Error ? error.message : "Не удалось получить список AB-тестов из XWAY.",
      },
      { status: 502 },
    );
  }
}
