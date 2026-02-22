function ensureBulkProgressState() {
  if (!state.bulkProgress || typeof state.bulkProgress !== "object") {
    state.bulkProgress = {
      active: false,
      actionKey: "all",
      loadingText: "",
      total: 0,
      completed: 0,
      startedAt: 0,
      hideTimer: 0,
      finalState: "idle",
      cancelRequested: false,
    };
  }

  return state.bulkProgress;
}

function clearBulkProgressHideTimer(progress = ensureBulkProgressState()) {
  if (progress.hideTimer) {
    clearTimeout(progress.hideTimer);
    progress.hideTimer = 0;
  }
}

function formatBulkEta(totalSecondsRaw) {
  const totalSeconds = Number(totalSecondsRaw);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "меньше 1с";
  }

  const rounded = Math.max(1, Math.round(totalSeconds));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  if (minutes <= 0) {
    return `${seconds}с`;
  }
  if (minutes < 60) {
    return `${minutes}м ${seconds}с`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return `${hours}ч ${restMinutes}м`;
}

function renderBulkProgressToast() {
  const progress = ensureBulkProgressState();
  if (!el.bulkProgressToast) {
    return;
  }

  const total = Math.max(0, Math.round(Number(progress.total) || 0));
  const completedRaw = Math.max(0, Math.round(Number(progress.completed) || 0));
  const completed = total > 0 ? Math.min(total, completedRaw) : completedRaw;
  const ratio = total > 0 ? Math.min(1, completed / total) : 0;
  const percent = Math.round(ratio * 100);

  if (el.bulkProgressRing) {
    el.bulkProgressRing.style.setProperty("--bulk-progress", `${percent}%`);
  }
  if (el.bulkProgressPercent) {
    el.bulkProgressPercent.textContent = `${percent}%`;
  }
  if (el.bulkProgressTitle) {
    el.bulkProgressTitle.textContent = progress.loadingText || "Обновляю карточки…";
  }

  if (el.bulkProgressMeta) {
    const countText = total > 0 ? `${completed}/${total}` : `${completed}`;
    if (progress.finalState === "done") {
      el.bulkProgressMeta.textContent = `${countText} · завершено`;
    } else if (progress.finalState === "canceled") {
      el.bulkProgressMeta.textContent = `${countText} · остановлено`;
    } else if (progress.cancelRequested) {
      el.bulkProgressMeta.textContent = `${countText} · останавливаю…`;
    } else if (total > 0 && completed > 0 && progress.startedAt > 0) {
      const elapsedSeconds = Math.max(0.3, (Date.now() - progress.startedAt) / 1000);
      const pace = completed / elapsedSeconds;
      const remaining = Math.max(0, total - completed);
      const etaSeconds = pace > 0 ? remaining / pace : NaN;
      el.bulkProgressMeta.textContent = `${countText} · осталось ~${formatBulkEta(etaSeconds)}`;
    } else {
      el.bulkProgressMeta.textContent = `${countText} · расчёт времени…`;
    }
  }

  if (el.bulkCancelBtn) {
    el.bulkCancelBtn.hidden = progress.active !== true;
    el.bulkCancelBtn.disabled = progress.cancelRequested === true;
    el.bulkCancelBtn.textContent = progress.cancelRequested ? "Останавливаю…" : "Прервать";
  }

  const shouldShow = progress.active || progress.finalState === "done" || progress.finalState === "canceled";
  if (shouldShow) {
    el.bulkProgressToast.hidden = false;
    requestAnimationFrame(() => {
      if (el.bulkProgressToast) {
        el.bulkProgressToast.classList.add("is-visible");
      }
    });
    return;
  }

  el.bulkProgressToast.classList.remove("is-visible");
  setTimeout(() => {
    const current = ensureBulkProgressState();
    if (!current.active && current.finalState === "idle" && el.bulkProgressToast) {
      el.bulkProgressToast.hidden = true;
    }
  }, 260);
}

function isBulkLoadingCancelRequested() {
  return state.bulkCancelRequested === true;
}

function requestBulkLoadingCancel() {
  if (!state.isBulkLoading) {
    return;
  }
  state.bulkCancelRequested = true;
  if (state.singleRowAbortController && typeof state.singleRowAbortController.abort === "function") {
    try {
      state.singleRowAbortController.abort();
    } catch {
      // noop
    }
  }
  const progress = ensureBulkProgressState();
  progress.cancelRequested = true;
  renderBulkProgressToast();
}

function setBulkLoading(isLoading, loadingText = "Обновляю карточки...", actionKey = "all", progressMeta = null) {
  state.isBulkLoading = isLoading;
  const labels =
    typeof BULK_ACTION_LABELS === "object" && BULK_ACTION_LABELS
      ? BULK_ACTION_LABELS
      : {
          all: "Обновить карточки",
          problem: "Обновить проблемные",
        };

  const progress = ensureBulkProgressState();
  const meta = progressMeta && typeof progressMeta === "object" ? progressMeta : {};

  if (el.loadAllBtn) {
    el.loadAllBtn.textContent = state.isBulkLoading && actionKey === "all" ? loadingText : labels.all;
  }
  if (!state.isBulkLoading && el.loadProblemBtn) {
    const hasProblems = getProblemRowIds().length;
    el.loadProblemBtn.textContent = hasProblems > 0 ? `${labels.problem} (${hasProblems})` : labels.problem;
  }

  if (isLoading) {
    clearBulkProgressHideTimer(progress);
    const shouldReset = meta.reset === true || progress.active !== true || progress.actionKey !== actionKey;
    if (shouldReset) {
      progress.startedAt = Date.now();
      progress.completed = 0;
      progress.total = 0;
      progress.cancelRequested = false;
      progress.finalState = "idle";
      state.bulkCancelRequested = false;
    }

    progress.active = true;
    progress.actionKey = String(actionKey || "all");
    progress.loadingText = String(loadingText || labels[actionKey] || labels.all || "Обновляю карточки…");

    if (Number.isFinite(meta.startedAt)) {
      progress.startedAt = Math.max(0, Math.round(meta.startedAt));
    }
    if (Number.isFinite(meta.total)) {
      progress.total = Math.max(0, Math.round(meta.total));
    }
    if (Number.isFinite(meta.completed)) {
      progress.completed = Math.max(0, Math.round(meta.completed));
    }
    if (typeof meta.cancelRequested === "boolean") {
      progress.cancelRequested = meta.cancelRequested;
    } else {
      progress.cancelRequested = state.bulkCancelRequested === true;
    }
    progress.finalState = "idle";
    renderBulkProgressToast();
  } else {
    progress.active = false;
    progress.actionKey = String(actionKey || progress.actionKey || "all");
    progress.loadingText = String(loadingText || labels[actionKey] || labels.all || "Обновление завершено");
    if (Number.isFinite(meta.total)) {
      progress.total = Math.max(0, Math.round(meta.total));
    }
    if (Number.isFinite(meta.completed)) {
      progress.completed = Math.max(0, Math.round(meta.completed));
    }
    const canceled = meta.canceled === true || state.bulkCancelRequested === true;
    progress.cancelRequested = false;
    progress.finalState = canceled ? "canceled" : "done";
    state.bulkCancelRequested = false;
    if (state.singleRowAbortController && typeof state.singleRowAbortController.abort === "function") {
      state.singleRowAbortController = null;
    }
    renderBulkProgressToast();

    clearBulkProgressHideTimer(progress);
    progress.hideTimer = setTimeout(() => {
      const current = ensureBulkProgressState();
      current.finalState = "idle";
      current.cancelRequested = false;
      renderBulkProgressToast();
    }, BULK_TOAST_HIDE_DELAY_MS);
  }

  syncButtonState();
}

function syncButtonState() {
  const disabled = state.isBulkLoading;
  el.loadAllBtn.disabled = disabled;
  if (el.loadProblemBtn) {
    const hasProblems = getProblemRowIds().length > 0;
    el.loadProblemBtn.disabled = disabled || !hasProblems;
  }
  if (el.addSingleBtn) {
    el.addSingleBtn.disabled = disabled;
  }
  el.addBulkBtn.disabled = disabled;
  el.clearBtn.disabled = disabled;
  if (el.rowsLimitSelect) {
    el.rowsLimitSelect.disabled = disabled;
  }
  if (el.autoplayLimitInput) {
    el.autoplayLimitInput.disabled = disabled;
  }
  for (const input of document.querySelectorAll(
    "[data-autoplay-global-limit], [data-cabinet-limit], [data-tags-global-limit], [data-tags-cabinet-limit]",
  )) {
    input.disabled = disabled;
  }
  renderRowsPagination();
  if (el.pagePrevBtn) {
    el.pagePrevBtn.disabled =
      disabled || (Number(state.pagination.filtered) || 0) === 0 || state.rowsPage <= 1;
  }
  if (el.pageNextBtn) {
    el.pageNextBtn.disabled =
      disabled ||
      (Number(state.pagination.filtered) || 0) === 0 ||
      state.rowsPage >= Math.max(1, Number(state.pagination.totalPages) || 1);
  }
  if (el.resetAllFiltersBtn) {
    el.resetAllFiltersBtn.disabled = disabled;
  }
  if (typeof updatePreviewRefreshButtonState === "function") {
    updatePreviewRefreshButtonState();
  }
  if (typeof updateRichRefreshButtonState === "function") {
    updateRichRefreshButtonState();
  }
  if (typeof updateRecommendationsRefreshButtonState === "function") {
    updateRecommendationsRefreshButtonState();
  }
}

async function runWithConcurrency(items, limit, worker, options = {}) {
  let pointer = 0;
  const shouldStop =
    typeof options === "function" ? options : options && typeof options.shouldStop === "function" ? options.shouldStop : null;

  async function runner() {
    while (pointer < items.length) {
      if (shouldStop && shouldStop()) {
        break;
      }
      const current = items[pointer];
      pointer += 1;
      if (shouldStop && shouldStop()) {
        break;
      }
      await worker(current);
    }
  }

  const workers = [];
  const count = Math.min(limit, items.length);
  for (let index = 0; index < count; index += 1) {
    workers.push(runner());
  }

  await Promise.all(workers);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function persistState() {
  const payload = {
    rows: state.rows.map((row) => ({
      id: row.id,
      nmId: row.nmId,
      cabinet: row.cabinet,
      supplierId: row.supplierId,
      stockValue: row.stockValue,
      inStock: row.inStock,
      stockSource: row.stockSource,
      currentPrice: row.currentPrice,
      basePrice: row.basePrice,
      priceSource: row.priceSource,
      error: row.error,
      data: row.data,
      updatedAt: row.updatedAt,
      updateLogs: normalizeRowUpdateLogs(row.updateLogs),
    })),
    basketByVol: state.basketByVol,
    lastSyncAt: state.lastSyncAt,
    filters: state.filters,
    controlsCollapsed: state.controlsCollapsed,
    rowsLimit: state.rowsLimit,
    autoplayLimitPerCabinet: state.autoplayLimitPerCabinet,
    autoplayLimitByCabinet: state.autoplayLimitByCabinet,
    tagsLimitPerCabinet: state.tagsLimitPerCabinet,
    tagsLimitByCabinet: state.tagsLimitByCabinet,
    onlyErrors: state.onlyErrors,
    notLoadedOnly: state.notLoadedOnly,
    checksFiltersOpen: state.checksFiltersOpen,
    globalFiltersCollapsed: state.globalFiltersCollapsed,
    globalCategoriesOpen: state.globalCategoriesOpen,
    categorySearchQuery: state.categorySearchQuery,
    globalColumnsOpen: state.globalColumnsOpen,
    filterCountMode: state.filterCountMode,
    autoplayProblemOnly: state.autoplayProblemOnly,
    tagsProblemOnly: state.tagsProblemOnly,
    sellerSettings: state.sellerSettings,
    colorVariantsCache: state.colorVariantsCache,
    updateSnapshots: normalizeProblemSnapshots(state.updateSnapshots),
    chartCabinetFilter: state.chartCabinetFilter,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];

    state.rows = rows.map((row) => ({
      id: row.id || `row-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      nmId: String(row.nmId || "").trim(),
      cabinet: String(row.cabinet || "").trim(),
      supplierId: normalizeSupplierId(row.supplierId),
      stockValue: Number.isFinite(row.stockValue) ? row.stockValue : null,
      inStock: typeof row.inStock === "boolean" ? row.inStock : null,
      stockSource: String(row.stockSource || ""),
      currentPrice: Number.isFinite(row.currentPrice)
        ? row.currentPrice
        : Number.isFinite(row?.data?.currentPrice)
          ? row.data.currentPrice
          : null,
      basePrice: Number.isFinite(row.basePrice)
        ? row.basePrice
        : Number.isFinite(row?.data?.basePrice)
          ? row.data.basePrice
          : null,
      priceSource: String(row.priceSource || ""),
      loading: false,
      error: row.error ? String(row.error) : "",
      data: normalizeRowData(row.data),
      updatedAt: row.updatedAt || null,
      updateLogs: normalizeRowUpdateLogs(row.updateLogs),
    }));

    state.basketByVol = parsed.basketByVol && typeof parsed.basketByVol === "object" ? parsed.basketByVol : {};
    state.lastSyncAt = parsed.lastSyncAt || null;
    state.controlsCollapsed = Boolean(parsed.controlsCollapsed);
    state.rowsLimit = normalizeRowsLimit(parsed.rowsLimit);
    state.autoplayLimitPerCabinet = normalizeAutoplayLimit(parsed.autoplayLimitPerCabinet);
    state.autoplayLimitByCabinet = normalizeAutoplayLimitMap(parsed.autoplayLimitByCabinet);
    state.tagsLimitPerCabinet = normalizeTagsLimit(parsed.tagsLimitPerCabinet);
    state.tagsLimitByCabinet = normalizeTagsLimitMap(parsed.tagsLimitByCabinet);
    state.onlyErrors = Boolean(parsed.onlyErrors);
    state.notLoadedOnly = Boolean(parsed.notLoadedOnly);
    state.checksFiltersOpen = Boolean(parsed.checksFiltersOpen);
    state.globalFiltersCollapsed = Boolean(parsed.globalFiltersCollapsed);
    state.globalCategoriesOpen = Boolean(parsed.globalCategoriesOpen);
    state.categorySearchQuery = String(parsed.categorySearchQuery || "").slice(0, 120);
    state.globalColumnsOpen = Boolean(parsed.globalColumnsOpen);
    state.filterCountMode =
      typeof normalizeFilterCountMode === "function"
        ? normalizeFilterCountMode(parsed.filterCountMode)
        : String(parsed.filterCountMode || "problems") === "rows"
          ? "rows"
          : "problems";
    state.autoplayProblemOnly = Boolean(parsed.autoplayProblemOnly);
    state.tagsProblemOnly = Boolean(parsed.tagsProblemOnly);
    state.sellerSettings = normalizeSellerSettings(parsed.sellerSettings);
    state.colorVariantsCache = normalizeColorVariantCache(parsed.colorVariantsCache);
    state.updateSnapshots = normalizeProblemSnapshots(parsed.updateSnapshots);
    state.chartCabinetFilter =
      typeof normalizeProblemsChartCabinetFilter === "function"
        ? normalizeProblemsChartCabinetFilter(parsed.chartCabinetFilter, state.updateSnapshots)
        : normalizeDashboardCabinet(parsed.chartCabinetFilter, state.rows);
    state.rowsPage = 1;

    state.filters = {
      ...FILTER_DEFAULTS,
      ...(parsed.filters && typeof parsed.filters === "object" ? parsed.filters : {}),
    };
    if (state.filters.recommendations === "na") {
      state.filters.recommendations = "no";
    }
    if (state.filters.autoplay === "na") {
      state.filters.autoplay = "no";
    }
    if (state.filters.video === "na") {
      state.filters.video = "no";
    }
    if (state.filters.tags === "na") {
      state.filters.tags = "no";
    }
    state.filters.cabinet = normalizeDashboardCabinet(state.filters.cabinet, state.rows);
    state.filters.categoryGroup = normalizeCategoryGroupValue(state.filters.categoryGroup, state.rows);
  } catch {
    state.rows = [];
    state.basketByVol = {};
    state.lastSyncAt = null;
    state.controlsCollapsed = false;
    state.rowsLimit = ROWS_LIMIT_DEFAULT;
    state.autoplayLimitPerCabinet = AUTOPLAY_LIMIT_DEFAULT;
    state.autoplayLimitByCabinet = {};
    state.tagsLimitPerCabinet = TAGS_LIMIT_DEFAULT;
    state.tagsLimitByCabinet = {};
    state.onlyErrors = false;
    state.notLoadedOnly = false;
    state.checksFiltersOpen = false;
    state.globalFiltersCollapsed = false;
    state.globalCategoriesOpen = false;
    state.categorySearchQuery = "";
    state.globalColumnsOpen = false;
    state.filterCountMode = "problems";
    state.autoplayProblemOnly = false;
    state.tagsProblemOnly = false;
    state.sellerSettings = createDefaultSellerSettings();
    state.colorVariantsCache = {};
    state.updateSnapshots = [];
    state.chartCabinetFilter = "all";
    state.rowsPage = 1;
    state.filters = { ...FILTER_DEFAULTS };
  }
}

function normalizeProblemSnapshots(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const normalized = raw
    .map((entry) => normalizeProblemSnapshotEntry(entry))
    .filter(Boolean)
    .slice(-PROBLEM_SNAPSHOT_LIMIT);

  return normalized.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function normalizeProblemSnapshotEntry(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const atRaw = String(raw.at || "").trim();
  const atDate = atRaw ? new Date(atRaw) : null;
  const at = atDate && !Number.isNaN(atDate.getTime()) ? atDate.toISOString() : new Date().toISOString();
  const source = String(raw.source || "").trim().toLowerCase() === "system" ? "system" : "manual";
  const actionKey = String(raw.actionKey || "").trim() || "all";
  const modeRaw = String(raw.mode || "").trim();
  const mode = modeRaw || "full";

  const problemsRaw = raw.problems && typeof raw.problems === "object" ? raw.problems : {};
  const problems = {
    recommendationsNo: Number(problemsRaw.recommendationsNo) || 0,
    richNo: Number(problemsRaw.richNo) || 0,
    videoNo: Number(problemsRaw.videoNo) || 0,
    autoplayNo: Number(problemsRaw.autoplayNo) || 0,
    autoplayOver: Number(problemsRaw.autoplayOver) || 0,
    tagsNo: Number(problemsRaw.tagsNo) || 0,
    tagsOver: Number(problemsRaw.tagsOver) || 0,
    coverDuplicate: Number(problemsRaw.coverDuplicate) || 0,
    total: Number(problemsRaw.total) || 0,
  };

  const cabinetsRaw = Array.isArray(raw.cabinets) ? raw.cabinets : [];
  const cabinets = cabinetsRaw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const cabinet = String(item.cabinet || "").trim();
      if (!cabinet) {
        return null;
      }
      const itemProblemsRaw = item.problems && typeof item.problems === "object" ? item.problems : {};
      return {
        cabinet,
        totalRows: Number(item.totalRows) || 0,
        loadedRows: Number(item.loadedRows) || 0,
        errorRows: Number(item.errorRows) || 0,
        problems: {
          recommendationsNo: Number(itemProblemsRaw.recommendationsNo) || 0,
          richNo: Number(itemProblemsRaw.richNo) || 0,
          videoNo: Number(itemProblemsRaw.videoNo) || 0,
          autoplayNo: Number(itemProblemsRaw.autoplayNo) || 0,
          autoplayOver: Number(itemProblemsRaw.autoplayOver) || 0,
          tagsNo: Number(itemProblemsRaw.tagsNo) || 0,
          tagsOver: Number(itemProblemsRaw.tagsOver) || 0,
          coverDuplicate: Number(itemProblemsRaw.coverDuplicate) || 0,
          total: Number(itemProblemsRaw.total) || 0,
        },
      };
    })
    .filter(Boolean);

  return {
    id:
      String(raw.id || "").trim() ||
      `snap-${Math.floor(new Date(at).getTime())}-${Math.random().toString(16).slice(2, 8)}`,
    at,
    source,
    actionKey,
    mode,
    totalRows: Number(raw.totalRows) || 0,
    loadedRows: Number(raw.loadedRows) || 0,
    errorRows: Number(raw.errorRows) || 0,
    problems,
    cabinets,
  };
}

function toSlideThumbUrl(urlRaw) {
  const url = String(urlRaw || "").trim();
  if (!url) {
    return "";
  }
  return url
    .replace("/images/big/", "/images/c246x328/")
    .replace("/images/large/", "/images/c246x328/")
    .replace("/images/c516x688/", "/images/c246x328/");
}

function toSlidePreviewUrl(urlRaw) {
  const url = String(urlRaw || "").trim();
  if (!url) {
    return "";
  }
  return url
    .replace("/images/c246x328/", "/images/big/")
    .replace("/images/c516x688/", "/images/big/")
    .replace("/images/tm/", "/images/big/");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
