import { useCallback, useMemo, useState, type MouseEvent } from "react";

import { type Product, abFormatInt } from "./ab-service";

interface Props {
  products: Product[];
}

type SortKey = "stock" | "latest" | null;
type SortDirection = "desc" | "asc";

export function ProductsTable({ products }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  if (!products.length) return null;

  const sortedProducts = useMemo(() => {
    if (!sortKey) {
      return products;
    }

    const next = [...products];
    next.sort((a, b) => {
      if (sortKey === "stock") {
        const aValue = Number(a.currentStockValue);
        const bValue = Number(b.currentStockValue);
        const aMissing = !Number.isFinite(aValue);
        const bMissing = !Number.isFinite(bValue);
        if (aMissing && bMissing) return 0;
        if (aMissing) return 1;
        if (bMissing) return -1;
        return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
      }

      const aDate = parseProductDate(a.latestAtIso, a.latestAt);
      const bDate = parseProductDate(b.latestAtIso, b.latestAt);
      const aValue = aDate ? aDate.getTime() : Number.NaN;
      const bValue = bDate ? bDate.getTime() : Number.NaN;
      const aMissing = !Number.isFinite(aValue);
      const bMissing = !Number.isFinite(bValue);
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
    });

    return next;
  }, [products, sortDirection, sortKey]);

  const handleSortToggle = useCallback((nextKey: Exclude<SortKey, null>) => {
    if (sortKey !== nextKey) {
      setSortKey(nextKey);
      setSortDirection("desc");
      return;
    }

    if (sortDirection === "desc") {
      setSortDirection("asc");
      return;
    }

    setSortKey(null);
    setSortDirection("desc");
  }, [sortDirection, sortKey]);

  return (
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-5 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="text-[16px] text-slate-800 dark:text-slate-100" style={{ fontWeight: 700 }}>
            Товары и все проведенные AB-тесты
          </h3>
          <p className="text-[12px] text-slate-400 dark:text-slate-500 mt-1" style={{ fontWeight: 500 }}>
            Текущая обложка и остаток подтягиваются из XWAY. Хорошо и плохо считаются по XWAY.
          </p>
        </div>
        <span className="text-[13px] text-slate-400 dark:text-slate-500" style={{ fontWeight: 500 }}>
          Группировка по артикулу
        </span>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80">
        <table className="w-full min-w-[1360px] border-collapse">
          <thead>
            <tr>
              {["Обложка WB", "Артикул", "Название", "Остаток", "Кабинеты", "Тестов", "Хорошо XWAY", "Плохо XWAY", "Последний старт", "Тесты"].map((header) => (
                <th
                  key={header}
                  className="sticky top-0 z-[1] border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-left text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  style={{ fontWeight: 700 }}
                >
                  {header === "Остаток" ? (
                    <SortHeaderButton
                      label={header}
                      active={sortKey === "stock"}
                      direction={sortDirection}
                      onClick={() => handleSortToggle("stock")}
                    />
                  ) : header === "Последний старт" ? (
                    <SortHeaderButton
                      label={header}
                      active={sortKey === "latest"}
                      direction={sortDirection}
                      onClick={() => handleSortToggle("latest")}
                    />
                  ) : (
                    header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((item) => (
              <tr key={item.article} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors">
                <td className="border-b border-slate-50 dark:border-slate-700/50 px-3 py-2 w-[92px] min-w-[92px]">
                  <CurrentCoverCell product={item} />
                </td>
                <td
                  className="border-b border-slate-50 dark:border-slate-700/50 px-3 py-2 text-[12px] text-slate-700 dark:text-slate-300 whitespace-nowrap"
                  style={{ fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}
                >
                  {item.article}
                </td>
                <td className="border-b border-slate-50 dark:border-slate-700/50 px-3 py-2 min-w-[280px] max-w-[320px]">
                  <div className="text-[12px] text-slate-700 dark:text-slate-300" style={{ fontWeight: 600 }} title={item.title}>
                    {item.title || "—"}
                  </div>
                </td>
                <td className="border-b border-slate-50 dark:border-slate-700/50 px-3 py-2">
                  <StockBadge value={item.currentStockValue} inStock={item.currentInStock} />
                </td>
                <td className="border-b border-slate-50 dark:border-slate-700/50 px-3 py-2 text-[12px] text-slate-600 dark:text-slate-400" style={{ fontWeight: 500 }}>
                  {item.cabinets.join(", ") || "—"}
                </td>
                <td className="border-b border-slate-50 dark:border-slate-700/50 px-3 py-2 text-[12px] text-slate-700 dark:text-slate-300" style={{ fontWeight: 700 }}>
                  {abFormatInt(item.testsCount)}
                </td>
                <td className="border-b border-slate-50 dark:border-slate-700/50 px-3 py-2">
                  <InlineStatus value={item.good} type="good" />
                </td>
                <td className="border-b border-slate-50 dark:border-slate-700/50 px-3 py-2">
                  <InlineStatus value={item.bad} type="bad" />
                </td>
                <td className="border-b border-slate-50 dark:border-slate-700/50 px-3 py-2 text-[12px] text-slate-500 dark:text-slate-400 whitespace-nowrap" style={{ fontWeight: 500 }}>
                  <LastStartCell product={item} />
                </td>
                <td className="border-b border-slate-50 dark:border-slate-700/50 px-3 py-2 min-w-[220px]">
                  <div className="flex flex-wrap gap-1">
                    {item.tests.slice(0, 12).map((test) => (
                      <a
                        key={test.testId}
                        href={test.xwayUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center h-[22px] px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-teal-700 dark:text-teal-400 text-[11px] no-underline hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:border-teal-200 dark:hover:border-teal-700 transition-all"
                        style={{ fontWeight: 700 }}
                        title={test.title}
                      >
                        #{test.testId}
                      </a>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHeaderButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 bg-transparent border-0 p-0 m-0 text-[10px] uppercase tracking-wider leading-none cursor-pointer transition-colors ${
        active
          ? "text-slate-700 dark:text-slate-200"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
      }`}
      style={{ fontWeight: 700 }}
      title={active ? `Сейчас: ${direction === "desc" ? "по убыванию" : "по возрастанию"}` : "Нажмите для сортировки"}
    >
      <span>{label}</span>
      <SortHeaderIcon active={active} direction={direction} />
    </button>
  );
}

function SortHeaderIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (active) {
    return (
      <span className="inline-flex items-center justify-center w-3 text-[8px] leading-none" aria-hidden="true">
        {direction === "desc" ? "▼" : "▲"}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-center justify-center w-3 leading-none" aria-hidden="true">
      <span className="text-[6px] -mb-[1px]">▲</span>
      <span className="text-[6px]">▼</span>
    </span>
  );
}

function CurrentCoverCell({ product }: { product: Product }) {
  const [preview, setPreview] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });
  const imageUrl = String(product.currentImageUrl || "").trim();

  const handleMouseMove = useCallback((event: MouseEvent) => {
    const previewW = 220;
    const previewH = 293;
    let x = event.clientX;
    let y = event.clientY - previewH / 2 - 10;
    if (x + previewW / 2 > window.innerWidth) x = window.innerWidth - previewW / 2 - 8;
    if (x - previewW / 2 < 0) x = previewW / 2 + 8;
    if (y < 8) y = 8;
    if (y + previewH > window.innerHeight - 8) y = window.innerHeight - previewH - 8;
    setPreview({ visible: true, x, y });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setPreview({ visible: false, x: 0, y: 0 });
  }, []);

  if (!imageUrl) {
    return (
      <div className="w-[52px] h-[72px] rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-700/80 bg-slate-100/80 dark:bg-slate-800/70 flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-500 text-center px-1" style={{ fontWeight: 600 }}>
        нет
      </div>
    );
  }

  const triggerInner = (
    <div className="w-[52px] h-[72px] rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-700/80 bg-slate-100/80 dark:bg-slate-800/70 shadow-sm">
      <img src={imageUrl} alt={product.title || product.article || "Обложка"} className="w-full h-full object-cover" loading="lazy" />
    </div>
  );

  const trigger = product.wbUrl ? (
    <a
      href={product.wbUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex no-underline"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {triggerInner}
    </a>
  ) : (
    <div className="inline-flex" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {triggerInner}
    </div>
  );

  return (
    <div className="relative">
      {trigger}
      {preview.visible ? (
        <div
          className="fixed pointer-events-none z-[10000] transition-opacity duration-150"
          style={{ left: preview.x, top: preview.y, width: 220, transform: "translateX(-50%)", opacity: 1 }}
        >
          <img
            src={imageUrl}
            alt={`${product.title || product.article || "Обложка"} (увеличенная)`}
            className="w-full aspect-[3/4] object-cover block rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700/80"
            style={{ boxShadow: "0 22px 44px rgba(16,31,41,0.24), 0 4px 12px rgba(16,31,41,0.16)" }}
          />
        </div>
      ) : null}
    </div>
  );
}

function LastStartCell({ product }: { product: Product }) {
  const date = parseProductDate(product.latestAtIso, product.latestAt);
  const daysAgoText = date ? formatDaysAgo(date) : "";

  return (
    <div className="flex flex-col">
      <span>{product.latestAt || "—"}</span>
      {daysAgoText ? (
        <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5" style={{ fontWeight: 600 }}>
          {daysAgoText}
        </span>
      ) : null}
    </div>
  );
}

function parseProductDate(isoRaw: string | undefined, displayRaw: string | undefined) {
  const iso = String(isoRaw || "").trim();
  if (iso) {
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const display = String(displayRaw || "").trim();
  const match = display.match(/^(\d{2})\.(\d{2})\.(\d{4}),\s*(\d{2}):(\d{2})$/);
  if (match) {
    const date = new Date(
      Number(match[3]),
      Number(match[2]) - 1,
      Number(match[1]),
      Number(match[4]),
      Number(match[5]),
    );
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  if (display) {
    const fallback = new Date(display);
    if (!Number.isNaN(fallback.getTime())) {
      return fallback;
    }
  }

  return null;
}

function formatDaysAgo(date: Date) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.max(0, Math.round((todayStart - targetStart) / 86_400_000));

  if (diffDays === 0) return "сегодня";
  if (diffDays === 1) return "1 день назад";

  const mod10 = diffDays % 10;
  const mod100 = diffDays % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${abFormatInt(diffDays)} дня назад`;
  }
  return `${abFormatInt(diffDays)} дней назад`;
}

function StockBadge({ value, inStock }: { value: number | null | undefined; inStock: boolean | null | undefined }) {
  const stockValue = Number(value);
  if (Number.isFinite(stockValue)) {
    const styles = stockValue > 20
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
      : stockValue > 0
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : "border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-400";

    return (
      <span className={`inline-flex items-center justify-center h-[28px] min-w-[92px] rounded-full border px-3 text-[12px] whitespace-nowrap ${styles}`} style={{ fontWeight: 700 }}>
        {abFormatInt(stockValue)} шт
      </span>
    );
  }

  if (inStock === false) {
    return (
      <span className="inline-flex items-center justify-center h-[28px] min-w-[92px] rounded-full border px-3 text-[12px] whitespace-nowrap border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-400" style={{ fontWeight: 700 }}>
        Нет
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center h-[28px] min-w-[92px] rounded-full border px-3 text-[12px] whitespace-nowrap border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400" style={{ fontWeight: 700 }}>
      —
    </span>
  );
}

function InlineStatus({ value, type }: { value: number; type: "good" | "bad" }) {
  const styles = type === "good"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
    : "border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-400";

  return (
    <span className={`inline-flex items-center justify-center min-w-[32px] h-[22px] rounded-full border px-2 text-[12px] ${styles}`} style={{ fontWeight: 700 }}>
      {abFormatInt(value)}
    </span>
  );
}
