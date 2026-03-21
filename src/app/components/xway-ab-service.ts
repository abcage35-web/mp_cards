import { AB_TEST_LIMIT_OPTIONS, abGetCurrentMonthRange, abNormalizeStatus } from "./ab-service";

export interface XwayAbApiItem {
  id: number;
  name: string;
  productName: string;
  productWbId: string;
  shopName: string;
  type: string;
  status: string;
  launchStatus: string;
  startedAt: string;
  finishedAt: string;
  progress: number;
  views: number;
  cpm: number;
  estimatedExpense: number;
  imagesNum: number;
  shopId: number;
  productId: number;
  imageUrls: string[];
}

export interface XwayAbProductImage {
  article: string;
  name: string;
  imageUrl: string;
}

interface XwayAbApiResponse {
  ok: boolean;
  source: string;
  fetchedAt: string;
  total: number;
  items: XwayAbApiItem[];
  productImages: XwayAbProductImage[];
  message?: string;
}

export interface XwayAbTest {
  testId: string;
  title: string;
  productName: string;
  article: string;
  cabinet: string;
  type: string;
  statusRaw: string;
  statusKind: "good" | "bad" | "neutral" | "unknown";
  launchStatus: string;
  startedAtIso: string;
  finishedAtIso: string;
  startedAtLabel: string;
  finishedAtLabel: string;
  progress: number;
  views: number;
  cpm: number;
  estimatedExpense: number;
  imagesNum: number;
  imageUrls: string[];
  mainImageUrl: string;
  xwayUrl: string;
}

export interface XwayAbProduct {
  article: string;
  title: string;
  type: string;
  cabinets: string[];
  tests: XwayAbTest[];
  testsCount: number;
  good: number;
  bad: number;
  unknown: number;
  latestAt: string;
}

export interface XwayAbModel {
  fetchedAt: string;
  total: number;
  tests: XwayAbTest[];
  products: XwayAbProduct[];
  cabinets: string[];
  totals: {
    good: number;
    bad: number;
    neutral: number;
    unknown: number;
    done: number;
    launched: number;
    pending: number;
    rejected: number;
    products: number;
    views: number;
    estimatedExpense: number;
  };
}

export interface XwayAbFilters {
  search: string;
  cabinet: string;
  verdict: string;
  launchStatus: string;
  dateFrom: string;
  dateTo: string;
  limit: string;
  view: "tests" | "products" | "both";
}

function formatDateLabel(valueRaw: string): string {
  const value = String(valueRaw || "").trim();
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeLaunchStatus(rawValue: string) {
  return String(rawValue || "").trim().toUpperCase();
}

export function xwayAbLaunchStatusLabel(rawValue: string) {
  switch (normalizeLaunchStatus(rawValue)) {
    case "DONE":
      return "Завершён";
    case "LAUNCHED":
      return "Запущен";
    case "PENDING":
      return "Ожидает";
    case "REJECTED":
      return "Отклонён";
    default:
      return rawValue || "—";
  }
}

function normalizeVerdict(rawValue: string): XwayAbTest["statusKind"] {
  const launchStatus = normalizeLaunchStatus(rawValue);
  if (launchStatus === "REJECTED") {
    return "bad";
  }
  if (launchStatus === "PENDING" || launchStatus === "LAUNCHED") {
    return "neutral";
  }

  const statusKind = abNormalizeStatus(rawValue);
  if (statusKind === "good" || statusKind === "bad" || statusKind === "neutral") {
    return statusKind;
  }
  return "unknown";
}

function buildXwayUrl(item: XwayAbApiItem) {
  if (item.shopId && item.productId && item.id) {
    return `https://am.xway.ru/wb/shop/${item.shopId}/product/${item.productId}/ab-test/${item.id}`;
  }
  return "https://am.xway.ru/wb/ab-tests";
}

export function groupXwayAbProducts(tests: XwayAbTest[]): XwayAbProduct[] {
  const map = new Map<string, XwayAbProduct>();

  for (const test of tests) {
    const key = (test.article || test.testId || "").trim();
    if (!key) {
      continue;
    }

    if (!map.has(key)) {
      map.set(key, {
        article: key,
        title: test.productName || test.title,
        type: test.type,
        cabinets: [],
        tests: [],
        testsCount: 0,
        good: 0,
        bad: 0,
        unknown: 0,
        latestAt: test.startedAtLabel,
      });
    }

    const item = map.get(key)!;
    const latestKnownIso = item.tests[0]?.startedAtIso || "";
    const latestKnownMs = latestKnownIso ? new Date(latestKnownIso).getTime() : 0;
    const currentMs = test.startedAtIso ? new Date(test.startedAtIso).getTime() : 0;

    item.tests.push(test);
    if (test.cabinet && !item.cabinets.includes(test.cabinet)) {
      item.cabinets.push(test.cabinet);
    }
    if (test.statusKind === "good") item.good += 1;
    else if (test.statusKind === "bad") item.bad += 1;
    else item.unknown += 1;
    item.testsCount += 1;

    if (!latestKnownMs || currentMs > latestKnownMs) {
      item.latestAt = test.startedAtLabel;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.testsCount !== a.testsCount) {
      return b.testsCount - a.testsCount;
    }
    return b.tests[0]?.startedAtIso.localeCompare(a.tests[0]?.startedAtIso || "") || 0;
  });
}

function buildModel(payload: XwayAbApiResponse): XwayAbModel {
  const productImageMap = new Map<string, XwayAbProductImage>();
  for (const item of Array.isArray(payload.productImages) ? payload.productImages : []) {
    const article = String(item?.article || "").trim();
    if (!article || productImageMap.has(article)) {
      continue;
    }
    productImageMap.set(article, item);
  }

  const tests = (Array.isArray(payload.items) ? payload.items : [])
    .map((item) => {
      const article = String(item?.productWbId || "").trim();
      const fallbackImage = productImageMap.get(article)?.imageUrl || "";
      return {
        testId: String(item.id || "").trim(),
        title: String(item.name || "").trim(),
        productName: String(item.productName || productImageMap.get(article)?.name || "").trim(),
        article,
        cabinet: String(item.shopName || "").trim(),
        type: String(item.type || "").trim(),
        statusRaw: String(item.status || "").trim(),
        statusKind: normalizeVerdict(String(item.status || item.launchStatus || "")),
        launchStatus: String(item.launchStatus || "").trim(),
        startedAtIso: String(item.startedAt || "").trim(),
        finishedAtIso: String(item.finishedAt || "").trim(),
        startedAtLabel: formatDateLabel(String(item.startedAt || "")),
        finishedAtLabel: formatDateLabel(String(item.finishedAt || "")),
        progress: Number(item.progress) || 0,
        views: Number(item.views) || 0,
        cpm: Number(item.cpm) || 0,
        estimatedExpense: Number(item.estimatedExpense) || 0,
        imagesNum: Number(item.imagesNum) || 0,
        imageUrls: (Array.isArray(item.imageUrls) ? item.imageUrls : []).filter(Boolean),
        mainImageUrl: fallbackImage,
        xwayUrl: buildXwayUrl(item),
      } satisfies XwayAbTest;
    })
    .sort((a, b) => {
      const aMs = a.startedAtIso ? new Date(a.startedAtIso).getTime() : 0;
      const bMs = b.startedAtIso ? new Date(b.startedAtIso).getTime() : 0;
      if (aMs !== bMs) {
        return bMs - aMs;
      }
      return Number(b.testId) - Number(a.testId);
    });

  const products = groupXwayAbProducts(tests);
  const cabinets = Array.from(new Set(tests.map((test) => test.cabinet).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "ru"),
  );

  return {
    fetchedAt: String(payload.fetchedAt || "").trim(),
    total: Number(payload.total) || tests.length,
    tests,
    products,
    cabinets,
    totals: tests.reduce(
      (acc, test) => {
        acc.views += test.views;
        acc.estimatedExpense += test.estimatedExpense;
        if (test.statusKind === "good") acc.good += 1;
        else if (test.statusKind === "bad") acc.bad += 1;
        else if (test.statusKind === "neutral") acc.neutral += 1;
        else acc.unknown += 1;

        switch (normalizeLaunchStatus(test.launchStatus)) {
          case "DONE":
            acc.done += 1;
            break;
          case "LAUNCHED":
            acc.launched += 1;
            break;
          case "PENDING":
            acc.pending += 1;
            break;
          case "REJECTED":
            acc.rejected += 1;
            break;
          default:
            break;
        }
        return acc;
      },
      {
        good: 0,
        bad: 0,
        neutral: 0,
        unknown: 0,
        done: 0,
        launched: 0,
        pending: 0,
        rejected: 0,
        products: products.length,
        views: 0,
        estimatedExpense: 0,
      },
    ),
  };
}

export async function loadXwayAbDashboardData(): Promise<XwayAbModel> {
  const response = await fetch("/api/xway-ab-tests", {
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  const responseText = await response.text();
  let payload: XwayAbApiResponse | null = null;

  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText) as XwayAbApiResponse;
    } catch {
      throw new Error("Сервер вернул невалидный ответ XWAY.");
    }
  }

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || "Не удалось получить список AB-тестов XWAY.");
  }

  return buildModel(payload);
}

export function createDefaultXwayAbFilters(): XwayAbFilters {
  const currentMonth = abGetCurrentMonthRange();
  return {
    search: "",
    cabinet: "all",
    verdict: "all",
    launchStatus: "all",
    dateFrom: currentMonth.from,
    dateTo: currentMonth.to,
    limit: String(AB_TEST_LIMIT_OPTIONS[0]),
    view: "tests",
  };
}

export function filterXwayAbTests(model: XwayAbModel, filters: XwayAbFilters) {
  const tests = Array.isArray(model.tests) ? model.tests : [];
  const search = String(filters.search || "").trim().toLowerCase();
  const cabinet = String(filters.cabinet || "all").trim();
  const verdict = String(filters.verdict || "all").trim();
  const launchStatus = normalizeLaunchStatus(filters.launchStatus || "all");
  const dateFrom = String(filters.dateFrom || "").trim();
  const dateTo = String(filters.dateTo || "").trim();

  return tests.filter((test) => {
    if (cabinet !== "all" && test.cabinet !== cabinet) return false;
    if (verdict !== "all" && test.statusKind !== verdict) return false;
    if (launchStatus !== "ALL" && normalizeLaunchStatus(test.launchStatus) !== launchStatus) return false;

    const testDate = test.startedAtIso ? test.startedAtIso.slice(0, 10) : "";
    if (dateFrom && (!testDate || testDate < dateFrom)) return false;
    if (dateTo && (!testDate || testDate > dateTo)) return false;

    if (!search) return true;
    const haystack = [test.testId, test.article, test.productName, test.title, test.cabinet, test.type]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });
}

export function buildXwayAbSourceMetaText(fetchedLabel = "") {
  return `Источник: XWAY /wb/ab-tests.${fetchedLabel ? ` Обновлено: ${fetchedLabel}` : ""}`;
}

export { AB_TEST_LIMIT_OPTIONS };
