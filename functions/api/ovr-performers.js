import { json } from "./_lib/auth.js";

const OVR_SETTINGS_SHEET_ID = "1STPnPgj8xSrvN-F3K96bDj_pmunCICHTjaj358pRaB4";
const OVR_SETTINGS_GID = "1574673852";
const OVR_FETCH_TIMEOUT_MS = 25000;

function normalizeNumericId(valueRaw) {
  const value = String(valueRaw ?? "").trim();
  if (!value) return "";
  const digits = value.replace(/\s+/g, "").match(/\d{3,}/);
  return digits ? digits[0] : "";
}

function cellText(row, id) {
  const cell = row?.[id];
  if (!cell || typeof cell !== "object") return "";
  const formatted = String(cell.f || "").trim();
  if (formatted) return formatted;
  const value = cell.v;
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(Math.round(value)) : "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value).trim();
}

function parseGvizResponse(text) {
  const marker = "google.visualization.Query.setResponse(";
  const start = text.indexOf(marker);
  const end = text.lastIndexOf(");");
  if (start < 0 || end <= start + marker.length) {
    throw new Error("Формат ответа Google Sheets не распознан.");
  }
  const payload = JSON.parse(text.slice(start + marker.length, end).trim());
  const table = payload?.table;
  if (!table) {
    throw new Error("В ответе Google Sheets отсутствует table.");
  }
  const cols = Array.isArray(table.cols) ? table.cols : [];
  const colIds = cols.map((col, index) => String(col?.id || `COL_${index + 1}`));
  const rowsRaw = Array.isArray(table.rows) ? table.rows : [];
  return rowsRaw.map((rowRaw, rowIndex) => {
    const cells = Array.isArray(rowRaw?.c) ? rowRaw.c : [];
    const mapped = { __rowIndex: rowIndex + 1 };
    for (let index = 0; index < colIds.length; index += 1) {
      const cell = cells[index];
      mapped[colIds[index]] = cell && typeof cell === "object"
        ? {
            v: Object.prototype.hasOwnProperty.call(cell, "v") ? cell.v : "",
            f: Object.prototype.hasOwnProperty.call(cell, "f") ? cell.f : "",
          }
        : { v: "", f: "" };
    }
    return mapped;
  });
}

async function fetchOvrRows() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OVR_FETCH_TIMEOUT_MS);
  try {
    const url = new URL(`https://docs.google.com/spreadsheets/d/${OVR_SETTINGS_SHEET_ID}/gviz/tq`);
    url.searchParams.set("gid", OVR_SETTINGS_GID);
    url.searchParams.set("tqx", "out:json");
    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Google Sheets вернул ${response.status}.`);
    }
    return parseGvizResponse(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}

export async function onRequestGet() {
  try {
    const rows = await fetchOvrRows();
    const performerByArticle = {};
    for (const row of rows) {
      const article = normalizeNumericId(cellText(row, "B"));
      const performer = cellText(row, "G");
      if (!article || !performer || performerByArticle[article]) continue;
      performerByArticle[article] = performer;
    }

    return json({
      ok: true,
      source: "ovr-performers",
      fetchedAt: new Date().toISOString(),
      total: Object.keys(performerByArticle).length,
      performerByArticle,
    });
  } catch (error) {
    const isAbort = error?.name === "AbortError";
    return json(
      {
        ok: false,
        error: isAbort ? "ovr_timeout" : "ovr_fetch_failed",
        message: isAbort
          ? "Превышено время ожидания ответа ОВР."
          : error instanceof Error
            ? error.message
            : "Не удалось загрузить имена из ОВР.",
      },
      { status: 502 },
    );
  }
}
