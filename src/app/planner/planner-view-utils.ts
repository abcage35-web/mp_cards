import { format } from "date-fns";

export function getFilterSummaryLabel(labels: string[], total: number) {
  if (labels.length === 0) {
    return "ничего";
  }

  if (labels.length === total) {
    return "все";
  }

  if (labels.length <= 2) {
    return labels.join(", ");
  }

  return `${labels.length} выбрано`;
}

export function getMonthlyTaskOccurrenceLabel(occurrences: number) {
  const mod10 = occurrences % 10;
  const mod100 = occurrences % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${occurrences} раз`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${occurrences} раза`;
  }

  return `${occurrences} раз`;
}

export function getMonthlyLoadTone(usagePercent: number, overloadHours: number) {
  if (overloadHours > 0) {
    return {
      badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
      barClass: "bg-gradient-to-r from-rose-500 to-red-400",
      accentTextClass: "text-rose-600",
      summaryLabel: `Перегруз ${overloadHours}ч`,
    };
  }

  if (usagePercent >= 85) {
    return {
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      barClass: "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400",
      accentTextClass: "text-amber-600",
      summaryLabel: "Почти заполнено",
    };
  }

  return {
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    barClass: "bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-400",
    accentTextClass: "text-slate-950",
    summaryLabel: "Нормальная загрузка",
  };
}

export function getWeekRangeLabel(days: Date[]) {
  if (days.length === 0) {
    return "";
  }

  return `${format(days[0], "d.MM")} - ${format(days[days.length - 1], "d.MM")}`;
}
