/*
 * Stage 2 split from app.js:
 * фильтры, лимиты, кабинеты и bulk-обработчики.
 */

function normalizeRowsLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return ROWS_LIMIT_DEFAULT;
  }

  return Math.min(ROWS_LIMIT_MAX, Math.max(ROWS_LIMIT_DEFAULT, parsed));
}

function normalizeAutoplayLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return AUTOPLAY_LIMIT_DEFAULT;
  }

  return Math.min(AUTOPLAY_LIMIT_MAX, Math.max(AUTOPLAY_LIMIT_MIN, parsed));
}

function normalizeAutoplayLimitMap(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const normalized = {};
  for (const [cabinetRaw, limitRaw] of Object.entries(raw)) {
    const cabinet = String(cabinetRaw || "").trim();
    if (!cabinet) {
      continue;
    }
    normalized[cabinet] = normalizeAutoplayLimit(limitRaw);
  }

  return normalized;
}

function normalizeTagsLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return TAGS_LIMIT_DEFAULT;
  }

  return Math.min(AUTOPLAY_LIMIT_MAX, Math.max(AUTOPLAY_LIMIT_MIN, parsed));
}

function normalizeTagsLimitMap(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const normalized = {};
  for (const [cabinetRaw, limitRaw] of Object.entries(raw)) {
    const cabinet = String(cabinetRaw || "").trim();
    if (!cabinet) {
      continue;
    }
    normalized[cabinet] = normalizeTagsLimit(limitRaw);
  }

  return normalized;
}

function createDefaultSellerSettings() {
  return DEFAULT_SELLER_SETTINGS.map((item) => ({
    supplierId: String(item.supplierId || "").trim(),
    cabinet: String(item.cabinet || "").trim(),
    url: String(item.url || "").trim(),
  }));
}

function buildSellerUrl(supplierIdRaw) {
  const supplierId = normalizeSupplierId(supplierIdRaw);
  return supplierId ? `https://www.wildberries.ru/seller/${supplierId}` : "";
}

function extractSellerIdFromInput(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }
  const text = String(raw).trim();
  if (!text) {
    return null;
  }

  const fromUrl = text.match(/wildberries\.ru\/seller\/(\d{2,})/i);
  if (fromUrl?.[1]) {
    return normalizeSupplierId(fromUrl[1]);
  }

  const direct = text.match(/\b(\d{2,})\b/);
  if (direct?.[1]) {
    return normalizeSupplierId(direct[1]);
  }

  return null;
}

function normalizeSellerSettings(raw) {
  const source = Array.isArray(raw) ? raw : [];
  const normalized = [];
  const seen = new Set();

  for (const item of source) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const supplierId = normalizeSupplierId(item.supplierId || extractSellerIdFromInput(item.url || ""));
    if (!supplierId || seen.has(supplierId)) {
      continue;
    }

    const cabinet = String(item.cabinet || "").trim().replace(/\s+/g, " ").slice(0, 64);
    if (!cabinet) {
      continue;
    }

    const urlRaw = String(item.url || "").trim();
    const url = /wildberries\.ru\/seller\/\d+/i.test(urlRaw) ? urlRaw : buildSellerUrl(supplierId);
    if (!url) {
      continue;
    }

    seen.add(supplierId);
    normalized.push({
      supplierId,
      cabinet,
      url,
    });

    if (normalized.length >= SELLER_SETTINGS_LIMIT) {
      break;
    }
  }

  if (normalized.length > 0) {
    return normalized;
  }
  return createDefaultSellerSettings();
}

function getSellerSettings() {
  const settings = normalizeSellerSettings(state.sellerSettings);
  state.sellerSettings = settings;
  return settings;
}

function normalizeColorVariantCache(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const now = Date.now();
  const out = {};
  for (const [nmIdRaw, entryRaw] of Object.entries(raw)) {
    const nmId = String(nmIdRaw || "").trim();
    if (!/^\d{6,}$/.test(nmId)) {
      continue;
    }
    if (!entryRaw || typeof entryRaw !== "object") {
      continue;
    }

    const updatedAt = Number(entryRaw.updatedAt);
    const data = entryRaw.data && typeof entryRaw.data === "object" ? entryRaw.data : null;
    if (!data || !Number.isFinite(updatedAt) || updatedAt <= 0) {
      continue;
    }

    if (now - updatedAt > COLOR_VARIANT_CACHE_TTL_MS * 3) {
      continue;
    }

    out[nmId] = {
      updatedAt,
      data: {
        nmId,
        link: String(data.link || `https://www.wildberries.ru/catalog/${nmId}/detail.aspx`),
        name: String(data.name || ""),
        category: String(data.category || ""),
        brand: String(data.brand || ""),
        cover: String(data.cover || ""),
        stockValue: Number.isFinite(data.stockValue) ? Math.max(0, Math.round(data.stockValue)) : null,
        inStock: typeof data.inStock === "boolean" ? data.inStock : null,
        currentPrice: Number.isFinite(data.currentPrice) ? Math.max(0, Math.round(data.currentPrice)) : null,
        rating: Number.isFinite(data.rating) ? Math.round(Number(data.rating) * 10) / 10 : null,
      },
    };
  }

  return out;
}

function applyAutoplayLimitControl() {
  state.autoplayLimitPerCabinet = normalizeAutoplayLimit(state.autoplayLimitPerCabinet);
  const globalLimit = state.autoplayLimitPerCabinet;
  const normalizedMap = normalizeAutoplayLimitMap(state.autoplayLimitByCabinet);
  const cleanedMap = {};
  for (const [cabinet, limitRaw] of Object.entries(normalizedMap)) {
    const normalizedLimit = normalizeAutoplayLimit(limitRaw);
    if (normalizedLimit !== globalLimit) {
      cleanedMap[cabinet] = normalizedLimit;
    }
  }
  state.autoplayLimitByCabinet = cleanedMap;
  const globalInputs = [];
  if (el.autoplayLimitInput) {
    globalInputs.push(el.autoplayLimitInput);
  }
  for (const input of document.querySelectorAll("[data-autoplay-global-limit]")) {
    globalInputs.push(input);
  }
  for (const input of globalInputs) {
    input.value = String(state.autoplayLimitPerCabinet);
  }
}

function handleAutoplayLimitChange(event) {
  const targetInput = event?.target?.closest?.("[data-autoplay-global-limit], #autoplayLimitInput");
  if (event && !targetInput) {
    return;
  }

  const input = targetInput || el.autoplayLimitInput || document.querySelector("[data-autoplay-global-limit]");
  if (!input) {
    return;
  }

  const previousGlobalLimit = normalizeAutoplayLimit(state.autoplayLimitPerCabinet);
  const nextGlobalLimit = normalizeAutoplayLimit(input.value);
  state.autoplayLimitPerCabinet = nextGlobalLimit;
  const normalizedMap = normalizeAutoplayLimitMap(state.autoplayLimitByCabinet);
  const migratedMap = {};
  for (const [cabinet, limitRaw] of Object.entries(normalizedMap)) {
    const normalizedLimit = normalizeAutoplayLimit(limitRaw);
    if (normalizedLimit === previousGlobalLimit || normalizedLimit === nextGlobalLimit) {
      continue;
    }
    migratedMap[cabinet] = normalizedLimit;
  }
  state.autoplayLimitByCabinet = migratedMap;
  applyAutoplayLimitControl();
  render();
}

function applyTagsLimitControl() {
  state.tagsLimitPerCabinet = normalizeTagsLimit(state.tagsLimitPerCabinet);
  const globalLimit = state.tagsLimitPerCabinet;
  const normalizedMap = normalizeTagsLimitMap(state.tagsLimitByCabinet);
  const cleanedMap = {};
  for (const [cabinet, limitRaw] of Object.entries(normalizedMap)) {
    const normalizedLimit = normalizeTagsLimit(limitRaw);
    if (normalizedLimit !== globalLimit) {
      cleanedMap[cabinet] = normalizedLimit;
    }
  }
  state.tagsLimitByCabinet = cleanedMap;
  for (const input of document.querySelectorAll("[data-tags-global-limit]")) {
    input.value = String(state.tagsLimitPerCabinet);
  }
}

function handleTagsLimitChange(event) {
  const targetInput = event?.target?.closest?.("[data-tags-global-limit]");
  if (event && !targetInput) {
    return;
  }

  const input = targetInput || document.querySelector("[data-tags-global-limit]");
  if (!input) {
    return;
  }

  const previousGlobalLimit = normalizeTagsLimit(state.tagsLimitPerCabinet);
  const nextGlobalLimit = normalizeTagsLimit(input.value);
  state.tagsLimitPerCabinet = nextGlobalLimit;
  const normalizedMap = normalizeTagsLimitMap(state.tagsLimitByCabinet);
  const migratedMap = {};
  for (const [cabinet, limitRaw] of Object.entries(normalizedMap)) {
    const normalizedLimit = normalizeTagsLimit(limitRaw);
    if (normalizedLimit === previousGlobalLimit || normalizedLimit === nextGlobalLimit) {
      continue;
    }
    migratedMap[cabinet] = normalizedLimit;
  }
  state.tagsLimitByCabinet = migratedMap;
  applyTagsLimitControl();
  render();
}

function handleAutoplayCabinetLimitChange(event) {
  const input = event.target?.closest?.("[data-cabinet-limit]");
  if (!input) {
    return;
  }

  const cabinet = String(input.dataset.cabinetLimit || "").trim();
  if (!cabinet) {
    return;
  }

  const raw = String(input.value || "").trim();
  if (!raw) {
    delete state.autoplayLimitByCabinet[cabinet];
    render();
    return;
  }

  const normalizedLimit = normalizeAutoplayLimit(raw);
  if (normalizedLimit === normalizeAutoplayLimit(state.autoplayLimitPerCabinet)) {
    delete state.autoplayLimitByCabinet[cabinet];
  } else {
    state.autoplayLimitByCabinet[cabinet] = normalizedLimit;
  }
  render();
}

function handleTagsCabinetLimitChange(event) {
  const input = event.target?.closest?.("[data-tags-cabinet-limit]");
  if (!input) {
    return;
  }

  const cabinet = String(input.dataset.tagsCabinetLimit || "").trim();
  if (!cabinet) {
    return;
  }

  const raw = String(input.value || "").trim();
  if (!raw) {
    delete state.tagsLimitByCabinet[cabinet];
    render();
    return;
  }

  const normalizedLimit = normalizeTagsLimit(raw);
  if (normalizedLimit === normalizeTagsLimit(state.tagsLimitPerCabinet)) {
    delete state.tagsLimitByCabinet[cabinet];
  } else {
    state.tagsLimitByCabinet[cabinet] = normalizedLimit;
  }
  render();
}

function applyRowsLimitControl() {
  state.rowsLimit = normalizeRowsLimit(state.rowsLimit);
  if (!el.rowsLimitSelect) {
    return;
  }

  const expected = String(state.rowsLimit);
  const optionExists = Array.from(el.rowsLimitSelect.options).some((option) => option.value === expected);
  if (optionExists) {
    el.rowsLimitSelect.value = expected;
  } else {
    el.rowsLimitSelect.value = String(ROWS_LIMIT_DEFAULT);
    state.rowsLimit = ROWS_LIMIT_DEFAULT;
  }
}

function handleRowsLimitChange() {
  if (!el.rowsLimitSelect) {
    return;
  }

  state.rowsLimit = normalizeRowsLimit(el.rowsLimitSelect.value);
  state.rowsPage = 1;
  applyRowsLimitControl();
  render();
}

function shiftRowsPage(delta) {
  const next = state.rowsPage + Number(delta || 0);
  const totalPages = Math.max(1, Number(state.pagination.totalPages) || 1);
  state.rowsPage = Math.max(1, Math.min(totalPages, next));
  render();
}

function handleGlobalCategorySearchInput() {
  if (!el.globalCategorySearchInput) {
    return;
  }

  const next = String(el.globalCategorySearchInput.value || "").slice(0, 120);
  if (next === state.categorySearchQuery) {
    return;
  }

  state.categorySearchQuery = next;
  renderGlobalCategoryFilters();
  persistState();
}

function handleResetAllFilters() {
  state.filters = { ...FILTER_DEFAULTS };
  state.onlyErrors = false;
  state.notLoadedOnly = false;
  state.checksFiltersOpen = false;
  state.autoplayProblemOnly = false;
  state.tagsProblemOnly = false;
  state.categorySearchQuery = "";
  if (el.globalCategorySearchInput) {
    el.globalCategorySearchInput.value = "";
  }
  state.rowsPage = 1;
  renderFilterInputs();
  render();
}

function handlePresetActionsClick(event) {
  const sellersBtn = event.target.closest("[data-action='open-sellers-settings']");
  if (sellersBtn) {
    event.preventDefault();
    openSellersModal();
    return;
  }

  const chartBtn = event.target.closest("[data-action='open-problems-chart']");
  if (chartBtn) {
    event.preventDefault();
    openProblemsChart();
    return;
  }

  const limitsBtn = event.target.closest("[data-action='open-limit-settings']");
  if (limitsBtn) {
    event.preventDefault();
    const kind = String(limitsBtn.dataset.limitKind || "autoplay").trim();
    openLimitsModal(kind === "tags" ? "tags" : "autoplay");
    return;
  }

  const dashboardCabinetBtn = event.target.closest("[data-action='toggle-dashboard-cabinet']");
  if (dashboardCabinetBtn) {
    event.preventDefault();
    const cabinet = String(dashboardCabinetBtn.dataset.dashboardCabinet || "all").trim();
    setDashboardCabinetFilter(cabinet, { toggle: true });
    return;
  }

  const categoryGroupBtn = event.target.closest("[data-action='toggle-category-group']");
  if (categoryGroupBtn) {
    event.preventDefault();
    const category = String(categoryGroupBtn.dataset.categoryGroup || "all");
    setCategoryGroupFilter(toggleCategoryGroupFilter(state.filters.categoryGroup, category, state.rows));
    return;
  }

  const toggleBtn = event.target.closest("[data-action='toggle-preset']");
  if (toggleBtn) {
    event.preventDefault();
    const presetId = String(toggleBtn.dataset.presetId || "").trim();
    if (presetId) {
      togglePresetFilter(presetId);
    }
    return;
  }

  const resetBtn = event.target.closest("[data-action='reset-all-filters']");
  if (resetBtn) {
    event.preventDefault();
    handleResetAllFilters();
  }
}

function handleAddBulk() {
  const nmIds = parseBulkInput(el.bulkInput.value);

  if (nmIds.length === 0) {
    window.alert("Не удалось распознать артикулы. Добавьте по одному значению в строке.");
    return;
  }

  upsertRowsFromNmIds(nmIds);
  el.bulkInput.value = "";
  render();
}

async function handleLoadAll() {
  if (state.rows.length === 0 || state.isBulkLoading) {
    return;
  }

  await loadFilteredRowsByMode({
    loadingText: "Обновляю карточки",
  });
}

async function loadFilteredRowsByMode({ loadingText = "Обновляю карточки" }) {
  const filteredRows = applyFilters(state.rows);
  if (filteredRows.length === 0) {
    window.alert("После фильтрации нет строк для обновления.");
    return;
  }

  const isFilteredSubset = filteredRows.length !== state.rows.length;
  const effectiveLoadingText = isFilteredSubset ? `${loadingText} (по фильтру)` : loadingText;
  await loadRowsByIds(
    filteredRows.map((row) => row.id),
    {
      loadingText: effectiveLoadingText,
      mode: "full",
      actionKey: "all",
      source: "manual",
    },
  );
}

function getProblemRowIds() {
  return state.rows.filter((row) => Boolean(row.error)).map((row) => row.id);
}

function handleBulkCancel() {
  if (!state.isBulkLoading) {
    return;
  }
  if (typeof requestBulkLoadingCancel === "function") {
    requestBulkLoadingCancel();
  }
}

async function handleLoadProblematic() {
  if (state.isBulkLoading) {
    return;
  }

  const problemRowIds = getProblemRowIds();
  if (problemRowIds.length === 0) {
    window.alert("Проблемных карточек с ошибками загрузки сейчас нет.");
    return;
  }

  if (el.loadProblemBtn) {
    el.loadProblemBtn.textContent = "Обновляю проблемные...";
  }

  const total = problemRowIds.length;
  let completed = 0;
  let canceled = false;

  try {
    setBulkLoading(true, `Обновляю проблемные (0/${total})...`, "problem", {
      reset: true,
      total,
      completed: 0,
      cancellable: true,
    });

    for (let index = 0; index < total; index += 1) {
      if (typeof isBulkLoadingCancelRequested === "function" && isBulkLoadingCancelRequested()) {
        canceled = true;
        break;
      }
      const rowId = problemRowIds[index];
      if (el.loadProblemBtn) {
        el.loadProblemBtn.textContent = `Проблемные: ${index + 1}/${total}`;
      }
      await loadRow(rowId, {
        forceHostProbe: true,
        source: "manual",
        actionKey: "problem",
        recordProblemSnapshot: false,
      });
      const freshRow = getRowById(rowId);
      if (
        freshRow?.error &&
        isRetriableRowError(freshRow.error) &&
        !(typeof isBulkLoadingCancelRequested === "function" && isBulkLoadingCancelRequested())
      ) {
        await sleep(720);
        await loadRow(rowId, {
          forceHostProbe: true,
          source: "manual",
          actionKey: "problem-retry",
          recordProblemSnapshot: false,
        });
      }

      completed += 1;
      const cancelRequested =
        typeof isBulkLoadingCancelRequested === "function" && isBulkLoadingCancelRequested();
      setBulkLoading(true, `Обновляю проблемные (${completed}/${total})...`, "problem", {
        total,
        completed,
        cancellable: true,
        cancelRequested,
      });

      if (cancelRequested) {
        canceled = true;
        break;
      }

      if (index < total - 1) {
        await sleep(160);
      }
    }

    if (typeof isBulkLoadingCancelRequested === "function" && isBulkLoadingCancelRequested()) {
      canceled = true;
    }

    state.lastSyncAt = new Date().toISOString();
    if (typeof recordProblemSnapshot === "function") {
      recordProblemSnapshot({
        source: "manual",
        actionKey: "problem",
        mode: "full",
      });
    }
  } finally {
    setBulkLoading(
      false,
      canceled ? `Обновление остановлено (${completed}/${total})` : "Обновление завершено",
      "problem",
      {
        total,
        completed,
        canceled,
      },
    );
    renderSummary();
    syncButtonState();
  }
}

function openSellersModal() {
  if (!el.sellersModal) {
    return;
  }
  el.sellersModal.hidden = false;
  renderSellersModalContent();
}

function closeSellersModal() {
  if (!el.sellersModal) {
    return;
  }
  el.sellersModal.hidden = true;
}

function renderSellersModalContent() {
  if (!el.sellersContent) {
    return;
  }

  const settings = getSellerSettings();
  const reservedSupplierIds = new Set(
    (Array.isArray(DEFAULT_SELLER_SETTINGS) ? DEFAULT_SELLER_SETTINGS : [])
      .map((item) => normalizeSupplierId(item?.supplierId))
      .filter(Boolean),
  );
  const rowsHtml =
    settings.length > 0
      ? settings
          .map(
            (item) => {
              const supplierId = normalizeSupplierId(item?.supplierId || "");
              const isReserved = supplierId ? reservedSupplierIds.has(supplierId) : false;
              const removeControl = isReserved
                ? '<span class="seller-settings-reserved-label">Зарезервирован</span>'
                : `<button
          class="btn btn-mini btn-danger seller-settings-remove-btn"
          type="button"
          data-action="remove-seller-setting"
          data-supplier-id="${escapeAttr(item.supplierId)}"
        >Удалить</button>`;

              return `<article class="seller-settings-row">
      <div class="seller-settings-row-main">
        <p class="seller-settings-cabinet">${escapeHtml(item.cabinet)}</p>
        <p class="seller-settings-id mono">${escapeHtml(item.supplierId)}</p>
      </div>
      <div class="seller-settings-row-actions">
        <a class="seller-settings-link" href="${escapeAttr(item.url)}" target="_blank" rel="noopener noreferrer">Открыть</a>
        ${removeControl}
      </div>
    </article>`;
            },
          )
          .join("")
      : '<div class="recommendation-empty">Список кабинетов пуст.</div>';

  el.sellersContent.innerHTML = `
    <div class="seller-settings-list">${rowsHtml}</div>
    <form class="seller-settings-form" data-action="add-seller-form">
      <label class="field">
        <span>Название кабинета</span>
        <input name="cabinetName" type="text" required placeholder="Например: Паша 3" maxlength="64" />
      </label>
      <label class="field">
        <span>Ссылка на продавца или ID</span>
        <input
          name="sellerRef"
          type="text"
          required
          placeholder="https://www.wildberries.ru/seller/123456"
          inputmode="url"
        />
      </label>
      <div class="seller-settings-form-actions">
        <button class="btn btn-primary" type="submit">Добавить кабинет</button>
        <button class="btn btn-mini" type="button" data-action="reset-seller-settings">Сбросить к дефолту</button>
      </div>
    </form>
  `;
}

function handleSellerSettingsSubmit(event) {
  const form = event.target?.closest?.("form[data-action='add-seller-form']");
  if (!form) {
    return;
  }

  event.preventDefault();
  const cabinetInput = form.elements.namedItem("cabinetName");
  const sellerRefInput = form.elements.namedItem("sellerRef");
  const cabinetName = String(cabinetInput?.value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
  const sellerRef = String(sellerRefInput?.value || "").trim();
  const supplierId = extractSellerIdFromInput(sellerRef);

  if (!cabinetName) {
    window.alert("Введите название кабинета.");
    return;
  }
  if (!supplierId) {
    window.alert("Не удалось определить ID продавца из ссылки.");
    return;
  }

  const settings = getSellerSettings().slice();
  const nextItem = {
    supplierId,
    cabinet: cabinetName,
    url: buildSellerUrl(supplierId),
  };

  const existingIndex = settings.findIndex((item) => String(item.supplierId) === supplierId);
  if (existingIndex >= 0) {
    settings[existingIndex] = nextItem;
  } else {
    settings.push(nextItem);
  }
  state.sellerSettings = normalizeSellerSettings(settings);

  for (const row of state.rows) {
    if (normalizeSupplierId(row?.supplierId) === supplierId) {
      row.cabinet = cabinetName;
    }
  }

  form.reset();
  render();
  renderSellersModalContent();
}

function handleSellerSettingsClick(event) {
  const removeBtn = event.target?.closest?.("[data-action='remove-seller-setting']");
  if (removeBtn) {
    const supplierId = normalizeSupplierId(removeBtn.dataset.supplierId || "");
    if (!supplierId) {
      return;
    }
    const reservedSupplierIds = new Set(
      (Array.isArray(DEFAULT_SELLER_SETTINGS) ? DEFAULT_SELLER_SETTINGS : [])
        .map((item) => normalizeSupplierId(item?.supplierId))
        .filter(Boolean),
    );
    if (reservedSupplierIds.has(supplierId)) {
      window.alert("Этот кабинет зарезервирован и не может быть удален.");
      return;
    }
    const currentSettings = getSellerSettings();
    const nextSettings = currentSettings.filter((item) => String(item.supplierId) !== supplierId);
    state.sellerSettings = normalizeSellerSettings(nextSettings);
    for (const row of state.rows) {
      if (normalizeSupplierId(row?.supplierId) === supplierId) {
        row.cabinet = "";
      }
    }
    render();
    renderSellersModalContent();
    return;
  }

  const resetBtn = event.target?.closest?.("[data-action='reset-seller-settings']");
  if (resetBtn) {
    state.sellerSettings = createDefaultSellerSettings();
    for (const row of state.rows) {
      const cabinet = getCabinetBySupplierId(row?.supplierId);
      if (cabinet) {
        row.cabinet = cabinet;
      }
    }
    render();
    renderSellersModalContent();
  }
}
