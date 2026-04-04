import { ExternalLink, Sparkles, Trophy } from "lucide-react";

import { abFormatCompactPeriodDateTime, type ComparisonRow, type TestCard, type Variant } from "./ab-service";

interface Props {
  tests: TestCard[];
  emptyMessage?: string;
}

const BEST_RK_METRICS = ["Цена", "Откл. цены", "CTR", "CR1", "CTR*CR1"];

function parseDisplayNumber(valueRaw: string | number | null | undefined) {
  if (typeof valueRaw === "number") {
    return Number.isFinite(valueRaw) ? valueRaw : null;
  }
  const value = String(valueRaw || "").trim();
  if (!value || value === "—") return null;
  const normalized = value.replace(/\s+/g, "").replace("%", "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSignedPercentDelta(beforeRaw: number | null, afterRaw: number | null) {
  const before = Number(beforeRaw);
  const after = Number(afterRaw);
  if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0) return "";
  const delta = after / before - 1;
  if (!Number.isFinite(delta)) return "";
  const percent = delta * 100;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(0).replace(".", ",")}%`;
}

function resolveDeltaKind(beforeRaw: number | null, afterRaw: number | null) {
  const before = Number(beforeRaw);
  const after = Number(afterRaw);
  if (!Number.isFinite(before) || !Number.isFinite(after) || before === 0) return "unknown";
  const delta = after / before - 1;
  if (!Number.isFinite(delta)) return "unknown";
  if (delta > 0) return "good";
  if (delta < 0) return "bad";
  return "neutral";
}

function getComparisonRow(test: TestCard, label: string) {
  return test.comparisonRows.find((row) => String(row.label || "").trim() === label) || null;
}

function getAfterCtrCr1Score(test: TestCard) {
  const row = getComparisonRow(test, "CTR*CR1");
  return parseDisplayNumber(row?.after ?? null);
}

function isCompletedTest(test: TestCard) {
  const launchStatus = String((test as { launchStatus?: string })?.launchStatus || "").trim().toUpperCase();
  if (["DONE", "COMPLETED", "FINISHED", "REJECTED", "STOPPED"].includes(launchStatus)) return true;
  if (["LAUNCHED", "PENDING", "ACTIVE", "RUNNING", "CREATED", "IN_PROGRESS"].includes(launchStatus)) return false;
  return Boolean(String(test.endedAtIso || "").trim());
}

function sortTimestampDesc(a: TestCard, b: TestCard) {
  const aMs = a.endedAtIso ? new Date(a.endedAtIso).getTime() : a.startedAtIso ? new Date(a.startedAtIso).getTime() : 0;
  const bMs = b.endedAtIso ? new Date(b.endedAtIso).getTime() : b.startedAtIso ? new Date(b.startedAtIso).getTime() : 0;
  return bMs - aMs;
}

function getBaselineVariant(test: TestCard) {
  return test.variants[0] || null;
}

function getBestVariant(test: TestCard) {
  const explicitBest = test.variants.find((variant) => variant.isBest);
  if (explicitBest) return explicitBest;
  return test.variants.reduce<Variant | null>((best, current) => {
    if (!best) return current;
    if (!Number.isFinite(best.ctrValue) && Number.isFinite(current.ctrValue)) return current;
    if (Number.isFinite(best.ctrValue) && Number.isFinite(current.ctrValue) && Number(current.ctrValue) > Number(best.ctrValue)) {
      return current;
    }
    return best;
  }, null);
}

function formatBlockDate(isoRaw: string, fallbackRaw = "") {
  const iso = String(isoRaw || "").trim();
  if (iso) {
    return abFormatCompactPeriodDateTime(iso);
  }
  const fallback = String(fallbackRaw || "").trim();
  return fallback || "—";
}

function getVariantDateLabel(variant: Variant | null, fallbackRaw = "") {
  if (!variant) return fallbackRaw || "—";
  return formatBlockDate(variant.installedAtIso, `${variant.installedAtDate || "—"}${variant.installedAtTime ? ` (${variant.installedAtTime})` : ""}`);
}

function getVisibleComparisonRows(test: TestCard) {
  return BEST_RK_METRICS
    .map((label) => getComparisonRow(test, label))
    .filter(Boolean) as ComparisonRow[];
}

function CoverPreview({
  variant,
  fallbackLabel,
  badge,
}: {
  variant: Variant | null;
  fallbackLabel: string;
  badge?: string;
}) {
  const imageUrl = String(variant?.imageUrl || "").trim();

  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        {badge ? (
          <span className="absolute -left-2 -top-2 z-10 inline-flex h-6 items-center rounded-full border border-emerald-400/40 bg-emerald-500 px-2 text-[10px] text-white shadow-[0_10px_24px_rgba(16,185,129,0.3)]" style={{ fontWeight: 800 }}>
            {badge}
          </span>
        ) : null}
        {imageUrl ? (
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-[18px] border border-slate-700 bg-slate-900 shadow-[0_16px_32px_rgba(2,6,23,0.28)]"
          >
            <img src={imageUrl} alt={fallbackLabel} loading="lazy" decoding="async" className="block w-[112px] aspect-[3/4] object-cover" />
          </a>
        ) : (
          <div className="flex w-[112px] aspect-[3/4] items-center justify-center rounded-[18px] border border-dashed border-slate-700 bg-slate-900 px-3 text-center text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
            Нет обложки
          </div>
        )}
      </div>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex h-8 items-center rounded-full border border-slate-200/80 bg-slate-50/90 px-3 text-[12px] text-slate-600 dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-300" style={{ fontWeight: 700 }}>
      {label}: <span className="ml-1 text-slate-900 dark:text-slate-100">{value || "—"}</span>
    </span>
  );
}

function LinkChip({ href, label }: { href: string; label: string }) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 text-[12px] text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-700 dark:hover:bg-teal-950/30"
      style={{ fontWeight: 700 }}
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

function DeltaBadge({ kind, text }: { kind: string; text: string }) {
  if (!text) return <span className="text-[11px] text-slate-500">—</span>;

  const palette =
    kind === "good"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
      : kind === "bad"
        ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
        : "border-slate-600 bg-slate-800/70 text-slate-300";

  return (
    <span className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] ${palette}`} style={{ fontWeight: 800 }}>
      {text}
    </span>
  );
}

function BestTestCard({ test, rank }: { test: TestCard; rank: number }) {
  const baselineVariant = getBaselineVariant(test);
  const bestVariant = getBestVariant(test) || baselineVariant;
  const abCtrDeltaText = formatSignedPercentDelta(baselineVariant?.ctrValue ?? null, bestVariant?.ctrValue ?? null);
  const abCtrDeltaKind = resolveDeltaKind(baselineVariant?.ctrValue ?? null, bestVariant?.ctrValue ?? null);
  const rkCtrCr1Row = getComparisonRow(test, "CTR*CR1");
  const rkRows = getVisibleComparisonRows(test);
  const beforeAbDate = getVariantDateLabel(baselineVariant, formatBlockDate(test.startedAtIso, test.startedAt));
  const afterAbDate = getVariantDateLabel(bestVariant, formatBlockDate(test.endedAtIso, test.endedAt));
  const beforeRkDate = formatBlockDate(test.startedAtIso, test.startedAt);
  const afterRkDate = formatBlockDate(test.endedAtIso, test.endedAt);

  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_16px_48px_-28px_rgba(15,23,42,0.45)] dark:border-slate-700/80 dark:bg-slate-900">
      <header className="border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-white px-5 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl bg-slate-900 px-3 text-[14px] text-white shadow-[0_16px_32px_rgba(15,23,42,0.24)] dark:bg-slate-100 dark:text-slate-900" style={{ fontWeight: 900 }}>
                #{rank}
              </span>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-[12px] text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300" style={{ fontWeight: 800 }}>
                <Trophy className="h-3.5 w-3.5" />
                CTR*CR1 после {rkCtrCr1Row?.after || "—"}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/60 bg-teal-50 px-3 py-1 text-[12px] text-teal-800 dark:border-teal-700/60 dark:bg-teal-950/30 dark:text-teal-300" style={{ fontWeight: 800 }}>
                <Sparkles className="h-3.5 w-3.5" />
                Завершён
              </div>
            </div>

            <h3 className="mt-3 text-[22px] text-slate-900 dark:text-slate-50" style={{ fontWeight: 900, lineHeight: 1.1 }}>
              {test.title || test.productName || `Тест ${test.testId}`}
            </h3>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>
              Тест {test.testId} · Период: {formatBlockDate(test.startedAtIso, test.startedAt)} — {formatBlockDate(test.endedAtIso, test.endedAt)}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <MetaPill label="Артикул" value={test.article || "—"} />
              <MetaPill label="Тип РК" value={test.type || "—"} />
              <MetaPill label="Кабинет" value={test.cabinet || "—"} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LinkChip href={test.xwayUrl} label="XWAY" />
            <LinkChip href={test.wbUrl} label="WB" />
          </div>
        </div>
      </header>

      <div className="space-y-4 bg-slate-950 px-4 py-4 md:px-5 md:py-5">
        <section className="overflow-hidden rounded-[24px] border border-slate-800 bg-slate-900 shadow-[0_18px_40px_rgba(2,6,23,0.28)]">
          <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-[16px] text-white" style={{ fontWeight: 900 }}>
              AB-тест
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="inline-flex h-8 items-center rounded-full border border-slate-700 bg-slate-950/80 px-3 text-slate-300" style={{ fontWeight: 700 }}>
                До: {beforeAbDate}
              </span>
              <span className="inline-flex h-8 items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 text-emerald-300" style={{ fontWeight: 700 }}>
                После: {afterAbDate}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-r border-slate-800 bg-slate-800/70 px-4 py-3 text-left text-[12px] uppercase tracking-[0.12em] text-slate-300" style={{ fontWeight: 800 }}>
                    Метрика
                  </th>
                  <th className="border-b border-r border-slate-800 bg-slate-950/60 px-4 py-3 text-center text-[13px] text-slate-100" style={{ fontWeight: 900 }}>
                    <div>До</div>
                    <div className="mt-1 text-[11px] text-slate-400" style={{ fontWeight: 700 }}>{beforeAbDate}</div>
                  </th>
                  <th className="border-b border-slate-800 bg-slate-950/60 px-4 py-3 text-center text-[13px] text-emerald-300" style={{ fontWeight: 900 }}>
                    <div>После</div>
                    <div className="mt-1 text-[11px] text-slate-400" style={{ fontWeight: 700 }}>{afterAbDate}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-b border-r border-slate-800 bg-slate-800/55 px-4 py-4 text-[13px] text-slate-200" style={{ fontWeight: 800 }}>
                    Обложка
                  </td>
                  <td className="border-b border-r border-slate-800 px-4 py-4">
                    <CoverPreview variant={baselineVariant} fallbackLabel={`Тест ${test.testId} до`} />
                  </td>
                  <td className="border-b border-slate-800 px-4 py-4">
                    <CoverPreview variant={bestVariant} fallbackLabel={`Тест ${test.testId} после`} badge="Лучшая" />
                  </td>
                </tr>
                <tr>
                  <td className="border-b border-r border-slate-800 bg-slate-800/55 px-4 py-3 text-[13px] text-slate-200" style={{ fontWeight: 800 }}>
                    Показы
                  </td>
                  <td className="border-b border-r border-slate-800 px-4 py-3 text-center font-mono text-[15px] text-slate-100" style={{ fontWeight: 800 }}>
                    {baselineVariant?.views || "—"}
                  </td>
                  <td className="border-b border-slate-800 px-4 py-3 text-center font-mono text-[15px] text-slate-100" style={{ fontWeight: 800 }}>
                    {bestVariant?.views || "—"}
                  </td>
                </tr>
                <tr>
                  <td className="border-b border-r border-slate-800 bg-slate-800/55 px-4 py-3 text-[13px] text-slate-200" style={{ fontWeight: 800 }}>
                    Клики
                  </td>
                  <td className="border-b border-r border-slate-800 px-4 py-3 text-center font-mono text-[15px] text-slate-100" style={{ fontWeight: 800 }}>
                    {baselineVariant?.clicks || "—"}
                  </td>
                  <td className="border-b border-slate-800 px-4 py-3 text-center font-mono text-[15px] text-slate-100" style={{ fontWeight: 800 }}>
                    {bestVariant?.clicks || "—"}
                  </td>
                </tr>
                <tr>
                  <td className="border-r border-slate-800 bg-slate-800/55 px-4 py-3 text-[13px] text-slate-200" style={{ fontWeight: 800 }}>
                    CTR
                  </td>
                  <td className="border-r border-slate-800 px-4 py-3 text-center font-mono text-[15px] text-slate-100" style={{ fontWeight: 800 }}>
                    {baselineVariant?.ctr || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono text-[15px] text-slate-100" style={{ fontWeight: 800 }}>
                        {bestVariant?.ctr || "—"}
                      </span>
                      <DeltaBadge kind={abCtrDeltaKind} text={abCtrDeltaText} />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-[24px] border border-slate-800 bg-slate-900 shadow-[0_18px_40px_rgba(2,6,23,0.28)]">
          <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div className="text-[16px] text-white" style={{ fontWeight: 900 }}>
              РК
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="inline-flex h-8 items-center rounded-full border border-slate-700 bg-slate-950/80 px-3 text-slate-300" style={{ fontWeight: 700 }}>
                До: {beforeRkDate}
              </span>
              <span className="inline-flex h-8 items-center rounded-full border border-sky-500/40 bg-sky-500/10 px-3 text-sky-300" style={{ fontWeight: 700 }}>
                После: {afterRkDate}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-r border-slate-800 bg-slate-800/70 px-4 py-3 text-left text-[12px] uppercase tracking-[0.12em] text-slate-300" style={{ fontWeight: 800 }}>
                    Метрика
                  </th>
                  <th className="border-b border-r border-slate-800 bg-slate-950/60 px-4 py-3 text-center text-[13px] text-slate-100" style={{ fontWeight: 900 }}>
                    До
                  </th>
                  <th className="border-b border-r border-slate-800 bg-slate-950/60 px-4 py-3 text-center text-[13px] text-slate-100" style={{ fontWeight: 900 }}>
                    После
                  </th>
                  <th className="border-b border-slate-800 bg-slate-950/60 px-4 py-3 text-center text-[13px] text-slate-100" style={{ fontWeight: 900 }}>
                    Прирост
                  </th>
                </tr>
              </thead>
              <tbody>
                {rkRows.map((row) => {
                  const isKeyMetric = String(row.label || "").trim() === "CTR*CR1";
                  return (
                    <tr key={`${test.testId}-${row.label}`} className={isKeyMetric ? "bg-slate-950/70" : ""}>
                      <td className={`border-b border-r border-slate-800 px-4 py-3 text-[13px] ${isKeyMetric ? "bg-slate-800/75 text-white" : "bg-slate-800/55 text-slate-200"}`} style={{ fontWeight: 800 }}>
                        {row.label}
                      </td>
                      <td className="border-b border-r border-slate-800 px-4 py-3 text-center font-mono text-[15px] text-slate-100" style={{ fontWeight: 800 }}>
                        {row.before || "—"}
                      </td>
                      <td className="border-b border-r border-slate-800 px-4 py-3 text-center font-mono text-[15px] text-slate-100" style={{ fontWeight: 800 }}>
                        {row.after || "—"}
                      </td>
                      <td className="border-b border-slate-800 px-4 py-3 text-center">
                        <DeltaBadge kind={row.deltaKind || "unknown"} text={row.deltaText || ""} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </article>
  );
}

export function getBestCompletedTests<T extends TestCard>(testsRaw: T[]) {
  const tests = Array.isArray(testsRaw) ? testsRaw : [];

  return [...tests]
    .filter((test) => isCompletedTest(test) && Number.isFinite(getAfterCtrCr1Score(test)))
    .sort((a, b) => {
      const scoreDiff = Number(getAfterCtrCr1Score(b)) - Number(getAfterCtrCr1Score(a));
      if (scoreDiff !== 0) return scoreDiff;
      return sortTimestampDesc(a, b);
    });
}

export function BestTestsSection({
  tests,
  emptyMessage = "Нет завершённых тестов с рассчитанным CTR*CR1 после под выбранные фильтры.",
}: Props) {
  if (!tests.length) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-8 text-center text-[14px] text-slate-500 shadow-sm dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-400" style={{ fontWeight: 600 }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-[22px] text-slate-900 dark:text-slate-50" style={{ fontWeight: 900, lineHeight: 1.1 }}>
              Лучшие
            </h2>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400" style={{ fontWeight: 600 }}>
              Завершённые тесты, отсортированные по `CTR*CR1 после` по убыванию.
            </p>
          </div>
          <div className="inline-flex h-10 items-center rounded-2xl border border-slate-200/80 bg-slate-50 px-4 text-[13px] text-slate-700 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200" style={{ fontWeight: 800 }}>
            Найдено: {tests.length}
          </div>
        </div>
      </div>

      {tests.map((test, index) => (
        <BestTestCard key={test.testId || `${test.article}-${index}`} test={test} rank={index + 1} />
      ))}
    </section>
  );
}
