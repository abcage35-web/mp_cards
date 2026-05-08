import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, ClipboardCopy, ExternalLink, Loader2, Star, X } from "lucide-react";

import {
  abFormatInt,
  abGetXwayBestTestRows,
  abLoadOvrPerformerByWbArticle,
  type TestCard,
  type XwayBestTestRow,
} from "./ab-service";

type CopyStatus = "idle" | "copying" | "copied" | "error";
type NamesStatus = "idle" | "loading" | "ready" | "error";

interface Props {
  tests: TestCard[];
  disabled?: boolean;
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const copied = document.execCommand("copy");
    if (!copied) throw new Error("Clipboard copy failed.");
  } finally {
    document.body.removeChild(textarea);
  }
}

function buildCopyLine(row: XwayBestTestRow) {
  return `${row.article} (${row.xwayUrl || "—"}) - ${row.performer || "—"}`;
}

function buildPerformerCounts(rows: XwayBestTestRow[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const performer = row.performer || "Без имени";
    map.set(performer, (map.get(performer) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"));
}

export function XwayBestTestsButton({ tests, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [namesStatus, setNamesStatus] = useState<NamesStatus>("idle");
  const [namesError, setNamesError] = useState("");
  const [performerByArticle, setPerformerByArticle] = useState<Record<string, string>>({});
  const copyResetTimerRef = useRef<number | null>(null);

  const baseRows = useMemo(() => abGetXwayBestTestRows(tests), [tests]);
  const rows = useMemo(() => abGetXwayBestTestRows(tests, performerByArticle), [performerByArticle, tests]);
  const performerCounts = useMemo(() => buildPerformerCounts(rows), [rows]);
  const copyText = useMemo(() => rows.map(buildCopyLine).join("\n"), [rows]);
  const isNamesLoading = namesStatus === "loading";
  const hasRows = baseRows.length > 0;
  const triggerDisabled = disabled || !hasRows;
  const copyDisabled = !rows.length || !copyText || isNamesLoading || copyStatus === "copying";

  useEffect(() => () => {
    if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || namesStatus === "ready" || namesStatus === "loading") return;
    let cancelled = false;
    setNamesStatus("loading");
    setNamesError("");
    abLoadOvrPerformerByWbArticle()
      .then((map) => {
        if (cancelled) return;
        setPerformerByArticle(map);
        setNamesStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setNamesError(error instanceof Error ? error.message : "Не удалось загрузить имена из ОВР.");
        setNamesStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [namesStatus, open]);

  const scheduleCopyReset = () => {
    if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current);
    copyResetTimerRef.current = window.setTimeout(() => setCopyStatus("idle"), 1800);
  };

  const handleCopy = async () => {
    if (copyDisabled) return;
    setCopyStatus("copying");
    try {
      await copyTextToClipboard(copyText);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    } finally {
      scheduleCopyReset();
    }
  };

  const handleRetryNames = () => {
    setNamesStatus("loading");
    setNamesError("");
    abLoadOvrPerformerByWbArticle({ force: true })
      .then((map) => {
        setPerformerByArticle(map);
        setNamesStatus("ready");
      })
      .catch((error) => {
        setNamesError(error instanceof Error ? error.message : "Не удалось загрузить имена из ОВР.");
        setNamesStatus("error");
      });
  };

  const CopyIcon = copyStatus === "copied" ? Check : copyStatus === "error" ? AlertCircle : ClipboardCopy;
  const copyLabel = copyStatus === "copied" ? "Скопировано" : copyStatus === "error" ? "Не скопировано" : "Копировать артикулы";
  const overlay = open ? (
    <div className="fixed inset-0 z-[100000]">
      <button
        type="button"
        aria-label="Закрыть список лучших AB-тестов"
        className="absolute inset-0 bg-slate-950/62 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      <div className="absolute inset-0 flex items-start justify-center overflow-y-auto px-4 py-6 md:px-8">
        <div className="relative flex max-h-[calc(100vh-48px)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_32px_90px_-40px_rgba(15,23,42,0.6)] dark:border-slate-700/80 dark:bg-slate-950">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
            <div>
              <h3 className="text-[24px] text-slate-900 dark:text-slate-50" style={{ fontWeight: 800 }}>
                Лучшие XWAY AB-тесты
              </h3>
              <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400" style={{ fontWeight: 500 }}>
                Успешные по этапу «Итог» в текущей выборке: {abFormatInt(rows.length)}
                {isNamesLoading ? " · загружаю имена из ОВР…" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={copyDisabled}
                className={`h-10 px-4 rounded-2xl border text-[13px] inline-flex items-center gap-2 transition-all ${
                  copyStatus === "copied"
                    ? "border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                    : copyStatus === "error"
                      ? "border-red-200 dark:border-red-800/70 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                } ${copyDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                style={{ fontWeight: 700 }}
              >
                <CopyIcon className="h-4 w-4" />
                {copyLabel}
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="overflow-y-auto px-6 py-5">
            {namesStatus === "error" ? (
              <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="text-[13px]" style={{ fontWeight: 700 }}>Имена не загрузились</div>
                    <div className="mt-0.5 text-[12px]" style={{ fontWeight: 500 }}>{namesError}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRetryNames}
                  className="h-8 shrink-0 rounded-xl border border-amber-200 bg-white px-3 text-[12px] text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                  style={{ fontWeight: 700 }}
                >
                  Повторить
                </button>
              </div>
            ) : null}

            <div className="mb-4 flex flex-wrap gap-2">
              <span className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300" style={{ fontWeight: 700 }}>
                Всего: {abFormatInt(rows.length)}
              </span>
              {isNamesLoading ? (
                <span className="inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400" style={{ fontWeight: 700 }}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Имена загружаются
                </span>
              ) : (
                performerCounts.map(([performer, count]) => (
                  <span
                    key={performer}
                    className="inline-flex h-8 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[12px] text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-900/20 dark:text-emerald-300"
                    style={{ fontWeight: 700 }}
                  >
                    {performer}: {abFormatInt(count)}
                  </span>
                ))
              )}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[minmax(130px,0.8fr)_minmax(260px,1.4fr)_minmax(160px,0.9fr)] border-b border-slate-200/80 bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400" style={{ fontWeight: 800 }}>
                  <div className="px-4 py-3">Артикул WB</div>
                  <div className="px-4 py-3">AB-тест XWAY</div>
                  <div className="px-4 py-3">Проводил</div>
                </div>

                {rows.length ? (
                  rows.map((row, index) => (
                    <div
                      key={`${row.testId || row.article}-${index}`}
                      className="grid grid-cols-[minmax(130px,0.8fr)_minmax(260px,1.4fr)_minmax(160px,0.9fr)] border-b border-slate-100 text-[13px] last:border-b-0 dark:border-slate-800"
                    >
                      <div className="px-4 py-3 text-slate-900 dark:text-slate-100" style={{ fontWeight: 800, fontFamily: "JetBrains Mono, monospace" }}>
                        {row.article}
                      </div>
                      <div className="px-4 py-3">
                        {row.xwayUrl ? (
                          <a
                            href={row.xwayUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-teal-700 hover:text-teal-600 dark:text-teal-300 dark:hover:text-teal-200"
                            style={{ fontWeight: 700 }}
                          >
                            Тест {row.testId || "XWAY"}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                      <div className="px-4 py-3 text-slate-700 dark:text-slate-300" style={{ fontWeight: 700 }}>
                        {isNamesLoading ? "…" : row.performer || "—"}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-[14px] text-slate-400" style={{ fontWeight: 600 }}>
                    В текущей выборке нет успешных XWAY AB-тестов.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={triggerDisabled}
        title={hasRows ? "Показать успешные XWAY AB-тесты" : "В текущей выборке нет успешных XWAY AB-тестов"}
        className={`h-8 px-3 rounded-xl border text-[12px] inline-flex items-center gap-1.5 transition-all ${
          triggerDisabled
            ? "cursor-not-allowed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 opacity-70"
            : "cursor-pointer border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:border-emerald-300"
        }`}
        style={{ fontWeight: 700 }}
      >
        <Star className="w-3.5 h-3.5" />
        Лучшие
      </button>

      {overlay && typeof document !== "undefined" ? createPortal(overlay, document.body) : null}
    </>
  );
}
