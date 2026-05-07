import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ClipboardCopy } from "lucide-react";

import { abFormatInt, abGetXwayOverallPassedWbArticles, type TestCard } from "./ab-service";

type CopyStatus = "idle" | "copying" | "copied" | "error";

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

export function CopyXwayArticlesButton({ tests, disabled = false }: Props) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimerRef = useRef<number | null>(null);
  const articles = useMemo(() => abGetXwayOverallPassedWbArticles(tests), [tests]);
  const copyText = useMemo(() => articles.join("\n"), [articles]);
  const hasArticles = articles.length > 0;
  const isBusy = status === "copying";
  const isDisabled = disabled || isBusy || !hasArticles;

  useEffect(() => () => {
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
  }, []);

  const scheduleReset = () => {
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => setStatus("idle"), 1800);
  };

  const handleCopy = async () => {
    if (!copyText || isDisabled) return;
    setStatus("copying");
    try {
      await copyTextToClipboard(copyText);
      setStatus("copied");
    } catch {
      setStatus("error");
    } finally {
      scheduleReset();
    }
  };

  const Icon = status === "copied" ? Check : status === "error" ? AlertCircle : ClipboardCopy;
  const label = status === "copied" ? "Скопировано" : status === "error" ? "Не скопировано" : "Копировать артикулы";
  const title = hasArticles
    ? `Скопировать WB-артикулы товаров из успешных XWAY-тестов: ${abFormatInt(articles.length)}`
    : "В текущей выборке нет успешных XWAY-тестов с WB-артикулами товаров";

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={isDisabled}
      title={title}
      className={`h-8 px-3 rounded-xl border text-[12px] inline-flex items-center gap-1.5 transition-all ${
        status === "copied"
          ? "border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
          : status === "error"
            ? "border-red-200 dark:border-red-800/70 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300"
      } ${isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      style={{ fontWeight: 600 }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
