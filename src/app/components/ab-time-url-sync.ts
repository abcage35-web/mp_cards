import { abBuildDateRangeFromMonthKeys, type Filters } from "./ab-service";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

function normalizeMonthKeys(monthKeysRaw: unknown): string[] {
  return (Array.isArray(monthKeysRaw) ? monthKeysRaw : [])
    .map((value) => String(value || "").trim())
    .filter((value) => MONTH_PATTERN.test(value))
    .sort();
}

function readMonthKeys(params: URLSearchParams) {
  const raw = params.get("months") || params.get("month") || "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => MONTH_PATTERN.test(value))
    .sort();
}

function getCurrentSearch() {
  return typeof window === "undefined" ? "" : window.location.search;
}

function readDateParam(params: URLSearchParams, key: string, fallbackKey: string) {
  const value = String(params.get(key) || params.get(fallbackKey) || "").trim();
  return DATE_PATTERN.test(value) ? value : "";
}

export function applyAbTimeFiltersFromUrl(baseFilters: Filters, searchRaw = getCurrentSearch()): Filters {
  const params = new URLSearchParams(searchRaw);
  const monthKeys = readMonthKeys(params);

  if (monthKeys.length) {
    const range = abBuildDateRangeFromMonthKeys(monthKeys);
    return {
      ...baseFilters,
      monthKeys,
      dateFrom: range.from || baseFilters.dateFrom,
      dateTo: range.to || baseFilters.dateTo,
    };
  }

  const dateFrom = readDateParam(params, "from", "dateFrom");
  const dateTo = readDateParam(params, "to", "dateTo");
  if (dateFrom || dateTo) {
    return {
      ...baseFilters,
      dateFrom,
      dateTo,
      monthKeys: [],
    };
  }

  return baseFilters;
}

export function buildAbTimeFilterSearch(filters: Filters, searchRaw = getCurrentSearch()) {
  const params = new URLSearchParams(searchRaw);
  params.delete("month");
  params.delete("months");
  params.delete("from");
  params.delete("to");
  params.delete("dateFrom");
  params.delete("dateTo");

  const monthKeys = normalizeMonthKeys(filters.monthKeys);
  if (monthKeys.length) {
    params.set("months", monthKeys.join(","));
  } else {
    const dateFrom = String(filters.dateFrom || "").trim();
    const dateTo = String(filters.dateTo || "").trim();
    if (DATE_PATTERN.test(dateFrom)) params.set("from", dateFrom);
    if (DATE_PATTERN.test(dateTo)) params.set("to", dateTo);
  }

  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
}

export function replaceAbTimeFiltersInUrl(filters: Filters) {
  if (typeof window === "undefined") return;
  const nextSearch = buildAbTimeFilterSearch(filters, window.location.search);
  const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, "", nextUrl);
  }
}
