const TASK_GROUPS = new Set(["planned", "new", "project", "planned-meeting", "new-meeting", "off-hours", "undefined"]);
const DEFAULT_GROUP_ORDER = ["planned", "new", "project", "planned-meeting", "new-meeting", "off-hours", "undefined"];
const PARTICIPANTS = new Set(["sasha-nekrasov", "sasha-manokhin", "anton-bober"]);
const PARTICIPANT_IDS = ["sasha-nekrasov", "sasha-manokhin", "anton-bober"];
const TASK_PROGRESS_STATUSES = new Set(["cancelled", "in-progress", "done"]);
const TASK_RECURRENCE_FREQUENCIES = new Set(["none", "daily", "weekly", "monthly"]);
const DEFAULT_WORK_HOURS_PER_DAY = 9;
const DEFAULT_PARTICIPANT_WORK_SCHEDULES = {
  "sasha-nekrasov": {
    startTime: "09:00",
    endTime: "18:00",
  },
  "sasha-manokhin": {
    startTime: "09:00",
    endTime: "18:00",
  },
  "anton-bober": {
    startTime: "09:00",
    endTime: "18:00",
  },
};

const PLANNER_STATE_KEY = "planner-state-v1";
const MEMORY_LOG_LIMIT = 1000;
let plannerTablesEnsured = false;
let plannerTablesEnsurePromise = null;
let memoryPlannerState = null;
let memoryPlannerLog = [];
const LEGACY_DEFAULT_PARTICIPANT_WORK_SCHEDULES = {
  "sasha-nekrasov": {
    startTime: "09:00",
    endTime: "17:00",
  },
  "sasha-manokhin": {
    startTime: "09:00",
    endTime: "17:00",
  },
  "anton-bober": {
    startTime: "09:00",
    endTime: "17:00",
  },
};

const DEFAULT_TASKS = [
  {
    id: "seed-analytics-report",
    title: "Подготовить отчет",
    description: "Собрать метрики за текущий месяц и подготовить короткое резюме.",
    link: "",
    hours: 2,
    group: "planned",
    progressStatus: "in-progress",
    assignee: null,
    date: null,
    status: "bank",
    order: 0,
    createdAt: "2026-04-01T08:00:00.000Z",
    updatedAt: "2026-04-01T08:00:00.000Z",
  },
  {
    id: "seed-new-brief",
    title: "Новый бриф",
    description: "Уточнить вводные по новой задаче и проверить материалы от клиента.",
    link: "",
    hours: 1.5,
    group: "new",
    progressStatus: "in-progress",
    assignee: null,
    date: null,
    status: "bank",
    order: 0,
    createdAt: "2026-04-01T08:05:00.000Z",
    updatedAt: "2026-04-01T08:05:00.000Z",
  },
  {
    id: "seed-project-sync",
    title: "Проектный созвон",
    description: "Сверить статусы по проекту и зафиксировать следующие шаги.",
    link: "",
    hours: 1,
    group: "planned-meeting",
    progressStatus: "in-progress",
    assignee: "sasha-nekrasov",
    date: null,
    status: "bank",
    order: 0,
    createdAt: "2026-04-01T08:10:00.000Z",
    updatedAt: "2026-04-01T08:10:00.000Z",
  },
];

function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function toSafeString(valueRaw, maxLength = 2000) {
  return String(valueRaw ?? "").trim().slice(0, maxLength);
}

function toIsoOrNow(valueRaw, fallbackIso = new Date().toISOString()) {
  const value = toSafeString(valueRaw, 100);
  if (!value) {
    return fallbackIso;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackIso;
  }

  return parsed.toISOString();
}

function toHours(valueRaw) {
  const value = Number(valueRaw);
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(24, Math.round(value * 10) / 10));
}

function toGroup(valueRaw) {
  const value = toSafeString(valueRaw, 40).toLowerCase();
  if (value === "meeting") {
    return "planned-meeting";
  }
  return TASK_GROUPS.has(value) ? value : "undefined";
}

function toGroupOrder(valueRaw) {
  if (!Array.isArray(valueRaw)) {
    return DEFAULT_GROUP_ORDER.slice();
  }

  const normalized = valueRaw
    .map((value) => toGroup(value))
    .filter((value, index, values) => value && values.indexOf(value) === index);

  return [
    ...normalized,
    ...DEFAULT_GROUP_ORDER.filter((groupId) => !normalized.includes(groupId)),
  ];
}

function toParticipant(valueRaw) {
  const value = toSafeString(valueRaw, 80).toLowerCase();
  return PARTICIPANTS.has(value) ? value : null;
}

function toParticipantList(valueRaw) {
  if (!Array.isArray(valueRaw)) {
    return [];
  }

  return valueRaw
    .map((value) => toParticipant(value))
    .filter((value, index, values) => value && values.indexOf(value) === index);
}

function toDate(valueRaw) {
  const value = toSafeString(valueRaw, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function toStartTime(valueRaw) {
  const value = toSafeString(valueRaw, 10);
  return /^([01]\d|2[0-3]):(00|30)$/.test(value) ? value : null;
}

function toStatus(valueRaw) {
  return toSafeString(valueRaw, 20).toLowerCase() === "calendar" ? "calendar" : "bank";
}

function toProgressStatus(valueRaw) {
  const value = toSafeString(valueRaw, 40).toLowerCase();
  return TASK_PROGRESS_STATUSES.has(value) ? value : "in-progress";
}

function toWorkHours(valueRaw) {
  const value = Number(valueRaw);
  if (!Number.isFinite(value)) {
    return DEFAULT_WORK_HOURS_PER_DAY;
  }

  return Math.max(1, Math.min(24, Math.round(value * 10) / 10));
}

function toCalendarDisplayMode(valueRaw) {
  return toSafeString(valueRaw, 20).toLowerCase() === "time" ? "time" : "day";
}

function toBoolean(valueRaw) {
  return valueRaw === true;
}

function sanitizeParticipantWorkSchedules(valueRaw) {
  const raw = valueRaw && typeof valueRaw === "object" ? valueRaw : {};

  return PARTICIPANT_IDS.reduce((accumulator, participantId) => {
    const fallback = DEFAULT_PARTICIPANT_WORK_SCHEDULES[participantId];
    const scheduleRaw = raw[participantId] && typeof raw[participantId] === "object" ? raw[participantId] : {};
    const startTime = toStartTime(scheduleRaw.startTime) || fallback.startTime;
    const endTime = toStartTime(scheduleRaw.endTime) || fallback.endTime;

    if (startTime >= endTime) {
      accumulator[participantId] = fallback;
      return accumulator;
    }

    accumulator[participantId] = {
      startTime,
      endTime,
    };
    return accumulator;
  }, {});
}

function isLegacyDefaultParticipantSchedule(schedule, participantId) {
  const legacy = LEGACY_DEFAULT_PARTICIPANT_WORK_SCHEDULES[participantId];
  return schedule?.startTime === legacy.startTime && schedule?.endTime === legacy.endTime;
}

function shouldUpgradeLegacyDefaultWorkSettings(workSchedules, workHoursPerDay) {
  const allLegacy = PARTICIPANT_IDS.every((participantId) =>
    isLegacyDefaultParticipantSchedule(workSchedules[participantId], participantId),
  );

  if (!allLegacy) {
    return false;
  }

  return workHoursPerDay === undefined || workHoursPerDay === null || workHoursPerDay === 8 || workHoursPerDay === 9;
}

function toRecurrenceFrequency(valueRaw) {
  const value = toSafeString(valueRaw, 40).toLowerCase();
  return TASK_RECURRENCE_FREQUENCIES.has(value) ? value : "none";
}

function toWeekdays(valueRaw) {
  if (!Array.isArray(valueRaw)) {
    return [];
  }

  return valueRaw
    .map((value) => Number(value))
    .filter((value, index, values) => Number.isInteger(value) && value >= 0 && value <= 6 && values.indexOf(value) === index);
}

function toWeekdayTimings(valueRaw, weekdays) {
  const raw = valueRaw && typeof valueRaw === "object" ? valueRaw : {};
  const selectedWeekdays = Array.isArray(weekdays) ? weekdays : [];

  return selectedWeekdays.reduce((accumulator, weekday) => {
    const timingRaw =
      raw[weekday] && typeof raw[weekday] === "object"
        ? raw[weekday]
        : raw[String(weekday)] && typeof raw[String(weekday)] === "object"
          ? raw[String(weekday)]
          : null;

    if (!timingRaw) {
      return accumulator;
    }

    accumulator[weekday] = {
      startTime: toStartTime(timingRaw.startTime),
      hours: toHours(timingRaw.hours),
    };

    return accumulator;
  }, {});
}

function toRecurrenceExclusions(valueRaw) {
  if (!Array.isArray(valueRaw)) {
    return [];
  }

  return valueRaw
    .map((value) => toSafeString(value, 120))
    .filter(
      (value, index, values) =>
        /^\d{4}-\d{2}-\d{2}::[a-z-]+$/.test(value) &&
        values.indexOf(value) === index,
    );
}

function sanitizeRecurrence(recurrenceRaw, dateValue) {
  const raw = recurrenceRaw && typeof recurrenceRaw === "object" ? recurrenceRaw : {};
  const frequency = toRecurrenceFrequency(raw.frequency);
  const interval = Math.max(1, Math.min(52, Math.round(Number(raw.interval) || 1)));
  const fromDate = toDate(raw.fromDate) || dateValue || "";
  const weekdays = toWeekdays(raw.weekdays);
  const weekdayFromDate = fromDate ? (new Date(fromDate).getDay() + 6) % 7 : null;
  const normalizedWeekdays =
    frequency === "weekly"
      ? weekdays.length > 0
        ? weekdays
        : weekdayFromDate !== null
          ? [weekdayFromDate]
          : []
      : weekdays;

  return {
    frequency,
    interval,
    weekdays: normalizedWeekdays,
    weekdayTimings: frequency === "weekly" ? toWeekdayTimings(raw.weekdayTimings, normalizedWeekdays) : {},
    fromDate,
    untilMode: toSafeString(raw.untilMode, 20).toLowerCase() === "until" ? "until" : "forever",
    untilDate: toDate(raw.untilDate) || "",
    exclusions: toRecurrenceExclusions(raw.exclusions),
  };
}

function sanitizeTask(taskRaw, index) {
  const raw = taskRaw && typeof taskRaw === "object" ? taskRaw : {};
  const createdAt = toIsoOrNow(raw.createdAt);
  const status = toStatus(raw.status);
  const assignee = toParticipant(raw.assignee);
  const date = toDate(raw.date);
  const seriesId = toSafeString(raw.seriesId, 120) || toSafeString(raw.id, 120) || `series-${Date.now()}-${index}`;
  const seriesAssignees = toParticipantList(raw.seriesAssignees);
  const recurrence = sanitizeRecurrence(raw.recurrence, date);

  return {
    id: toSafeString(raw.id, 120) || `task-${Date.now()}-${index}`,
    seriesId,
    seriesAssignees: seriesAssignees.length > 0 ? seriesAssignees : assignee ? [assignee] : [],
    recurrenceGroupId: toSafeString(raw.recurrenceGroupId, 120) || null,
    recurrence,
    title: toSafeString(raw.title, 180),
    description: toSafeString(raw.description, 4000),
    link: toSafeString(raw.link, 1000),
    hours: toHours(raw.hours),
    startTime: toStartTime(raw.startTime),
    group: toGroup(raw.group),
    progressStatus: toProgressStatus(raw.progressStatus),
    assignee,
    date,
    status: status === "calendar" && assignee && date ? "calendar" : "bank",
    order: Number.isFinite(Number(raw.order)) ? Math.max(0, Math.round(Number(raw.order))) : index,
    createdAt,
    updatedAt: toIsoOrNow(raw.updatedAt, createdAt),
  };
}

function sortTasks(tasksRaw) {
  const tasks = Array.isArray(tasksRaw) ? tasksRaw.slice() : [];
  return tasks.sort((left, right) => {
    const orderDiff = (left.order || 0) - (right.order || 0);
    if (orderDiff !== 0) {
      return orderDiff;
    }

    return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
  });
}

function getSeriesId(task) {
  return toSafeString(task?.seriesId, 120) || toSafeString(task?.id, 120);
}

function getSeriesAssignees(task) {
  const seriesAssignees = toParticipantList(task?.seriesAssignees);
  if (seriesAssignees.length > 0) {
    return seriesAssignees;
  }

  return task?.assignee ? [task.assignee] : [];
}

function collapseBankSeriesTasks(tasksRaw) {
  const tasks = Array.isArray(tasksRaw) ? tasksRaw : [];
  const calendarTasks = [];
  const bankSeriesMap = new Map();

  for (const task of tasks) {
    if (task?.status === "bank") {
      const familyId = toSafeString(task?.recurrenceGroupId, 120) || getSeriesId(task);
      const list = bankSeriesMap.get(familyId) || [];
      list.push(task);
      bankSeriesMap.set(familyId, list);
      continue;
    }

    calendarTasks.push(task);
  }

  const collapsedBankTasks = [];

  for (const seriesTasks of bankSeriesMap.values()) {
    const orderedSeriesTasks = sortTasks(seriesTasks);
    const representativeTask = orderedSeriesTasks[0];
    const assignees = orderedSeriesTasks.flatMap((task) => getSeriesAssignees(task));
    const uniqueAssignees = assignees.filter(
      (value, index, values) => value && values.indexOf(value) === index,
    );

    collapsedBankTasks.push({
      ...representativeTask,
      seriesId: getSeriesId(representativeTask),
      seriesAssignees: uniqueAssignees,
      assignee: uniqueAssignees.length === 1 ? uniqueAssignees[0] : null,
      date: representativeTask.date || null,
      status: "bank",
    });
  }

  return [...calendarTasks, ...collapsedBankTasks];
}

function containerKey(task) {
  if (task.status === "calendar" && task.assignee && task.date) {
    return `calendar:${task.assignee}:${task.date}:${task.group}`;
  }

  return `bank:${task.group}`;
}

function normalizeOrders(tasksRaw) {
  const tasks = sortTasks(tasksRaw);
  const grouped = new Map();

  for (const task of tasks) {
    const key = containerKey(task);
    const list = grouped.get(key) || [];
    list.push(task);
    grouped.set(key, list);
  }

  const normalized = [];
  for (const list of grouped.values()) {
    list.forEach((task, index) => {
      normalized.push({
        ...task,
        order: index,
      });
    });
  }

  return normalized;
}

function sanitizeState(payloadRaw) {
  const payload = payloadRaw && typeof payloadRaw === "object" ? payloadRaw : {};
  const tasksSource = Array.isArray(payload.tasks) ? payload.tasks : [];
  const sanitizedTasks = tasksSource.map((task, index) => sanitizeTask(task, index));
  const tasks = normalizeOrders(collapseBankSeriesTasks(sanitizedTasks));
  const updatedAt = toIsoOrNow(payload.updatedAt);
  const createdAt = toIsoOrNow(payload.createdAt, updatedAt);
  const workHoursPerDay = toWorkHours(payload.settings?.workHoursPerDay);
  const participantWorkSchedules = sanitizeParticipantWorkSchedules(payload.settings?.participantWorkSchedules);
  const shouldUpgradeLegacyDefaults = shouldUpgradeLegacyDefaultWorkSettings(
    participantWorkSchedules,
    payload.settings?.workHoursPerDay,
  );

  return {
    version: 1,
    createdAt,
    updatedAt,
    settings: {
      workHoursPerDay: shouldUpgradeLegacyDefaults ? DEFAULT_WORK_HOURS_PER_DAY : workHoursPerDay,
      groupOrder: toGroupOrder(payload.settings?.groupOrder),
      calendarDisplayMode: toCalendarDisplayMode(payload.settings?.calendarDisplayMode),
      hideWeekends: toBoolean(payload.settings?.hideWeekends),
      interleaveWeeksByParticipant: toBoolean(payload.settings?.interleaveWeeksByParticipant),
      participantWorkSchedules: shouldUpgradeLegacyDefaults
        ? DEFAULT_PARTICIPANT_WORK_SCHEDULES
        : participantWorkSchedules,
    },
    tasks,
  };
}

function buildDefaultState() {
  return sanitizeState({
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: DEFAULT_TASKS,
  });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getStorageInfo(env) {
  if (env?.DB) {
    return {
      stateFile: "D1 planner_state",
      logFile: "D1 planner_state_log",
    };
  }

  return {
    stateFile: "runtime memory planner_state",
    logFile: "runtime memory planner_state_log",
  };
}

function createLogId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const random = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${random}`;
}

async function ensurePlannerTables(db) {
  if (!db || plannerTablesEnsured) {
    return;
  }

  if (!plannerTablesEnsurePromise) {
    plannerTablesEnsurePromise = (async () => {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS planner_state (
             state_key TEXT PRIMARY KEY,
             payload_json TEXT NOT NULL,
             created_at TEXT NOT NULL,
             updated_at TEXT NOT NULL
           )`,
        )
        .run();

      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS planner_state_log (
             state_key TEXT NOT NULL,
             log_id TEXT NOT NULL,
             entry_json TEXT NOT NULL,
             created_at TEXT NOT NULL,
             PRIMARY KEY(state_key, log_id)
           )`,
        )
        .run();

      await db
        .prepare(
          `CREATE INDEX IF NOT EXISTS idx_planner_state_log_created_at
             ON planner_state_log(state_key, created_at)`,
        )
        .run();

      plannerTablesEnsured = true;
    })().catch((error) => {
      plannerTablesEnsurePromise = null;
      throw error;
    });
  }

  await plannerTablesEnsurePromise;
}

async function appendLogEntryToD1(db, entryRaw) {
  await ensurePlannerTables(db);
  const entry = entryRaw && typeof entryRaw === "object" ? entryRaw : {};
  const createdAt = toIsoOrNow(entry.at);

  await db
    .prepare(
      `INSERT INTO planner_state_log (state_key, log_id, entry_json, created_at)
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(PLANNER_STATE_KEY, createLogId(), JSON.stringify(entry), createdAt)
    .run();
}

async function writeStateToD1(db, payload) {
  await ensurePlannerTables(db);
  const updatedAt = toIsoOrNow(payload?.updatedAt);
  const createdAt = toIsoOrNow(payload?.createdAt, updatedAt);

  await db
    .prepare(
      `INSERT INTO planner_state (state_key, payload_json, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(state_key) DO UPDATE SET
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at`,
    )
    .bind(PLANNER_STATE_KEY, JSON.stringify(payload), createdAt, updatedAt)
    .run();
}

function appendLogEntryToMemory(entryRaw) {
  const entry = entryRaw && typeof entryRaw === "object" ? entryRaw : {};
  memoryPlannerLog = [...memoryPlannerLog, cloneJson(entry)].slice(-MEMORY_LOG_LIMIT);
}

function summarizeState(payload) {
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const scheduled = tasks.filter((task) => task.status === "calendar").length;

  return {
    tasksTotal: tasks.length,
    scheduledTotal: scheduled,
    bankTotal: Math.max(0, tasks.length - scheduled),
  };
}

function buildTaskLogSnapshot(payload, changedTaskId) {
  const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
  const taskId = toSafeString(changedTaskId, 120);

  if (!taskId) {
    return null;
  }

  const changedTask = tasks.find((task) => task?.id === taskId);
  if (!changedTask) {
    return null;
  }

  const familyId = toSafeString(changedTask?.recurrenceGroupId, 120) || getSeriesId(changedTask);
  const familyTasks = tasks.filter((task) => {
    const taskFamilyId = toSafeString(task?.recurrenceGroupId, 120) || getSeriesId(task);
    return taskFamilyId === familyId;
  });

  return {
    id: changedTask.id,
    title: changedTask.title,
    status: changedTask.status,
    group: changedTask.group,
    assignee: changedTask.assignee,
    seriesAssignees: getSeriesAssignees(changedTask),
    date: changedTask.date,
    startTime: changedTask.startTime,
    recurrence: changedTask.recurrence,
    familySize: familyTasks.length,
  };
}

async function initializeDefaultState(db = null) {
  const defaultState = buildDefaultState();
  const initEntry = {
    at: defaultState.updatedAt,
    action: "init",
    summary: "Initial planner state created",
    ...summarizeState(defaultState),
  };

  if (db) {
    await writeStateToD1(db, defaultState);
    await appendLogEntryToD1(db, initEntry);
  } else {
    memoryPlannerState = cloneJson(defaultState);
    appendLogEntryToMemory(initEntry);
  }

  return defaultState;
}

async function loadPlannerState(env) {
  const db = env?.DB;
  if (!db) {
    if (!memoryPlannerState) {
      return initializeDefaultState();
    }

    return sanitizeState(cloneJson(memoryPlannerState));
  }

  await ensurePlannerTables(db);
  const row = await db
    .prepare(
      `SELECT payload_json
       FROM planner_state
       WHERE state_key = ?1
       LIMIT 1`,
    )
    .bind(PLANNER_STATE_KEY)
    .first();

  if (!row?.payload_json) {
    return initializeDefaultState(db);
  }

  return sanitizeState(JSON.parse(String(row.payload_json)));
}

async function savePlannerState(env, payload, logEntry) {
  const db = env?.DB;
  if (!db) {
    memoryPlannerState = cloneJson(payload);
    appendLogEntryToMemory(logEntry);
    return;
  }

  await writeStateToD1(db, payload);
  await appendLogEntryToD1(db, logEntry);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestGet(context) {
  try {
    const payload = await loadPlannerState(context?.env);

    return json({
      ok: true,
      payload,
      storage: getStorageInfo(context?.env),
      stats: summarizeState(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load planner state";
    return json({ ok: false, error: message }, { status: 500 });
  }
}

export async function onRequestPut(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = sanitizeState(body?.payload);
  const summary = toSafeString(body?.summary?.message, 240) || "Planner state saved";
  const action = toSafeString(body?.summary?.action, 80) || "save";
  const changedTaskId = toSafeString(body?.summary?.taskId, 120) || null;
  const nowIso = new Date().toISOString();

  payload.updatedAt = nowIso;

  try {
    const logEntry = {
      at: nowIso,
      action,
      taskId: changedTaskId,
      summary,
      taskSnapshot: buildTaskLogSnapshot(payload, changedTaskId),
      ...summarizeState(payload),
    };

    await savePlannerState(context?.env, payload, logEntry);

    return json({
      ok: true,
      payload,
      storage: getStorageInfo(context?.env),
      stats: summarizeState(payload),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save planner state";
    return json({ ok: false, error: message }, { status: 500 });
  }
}
