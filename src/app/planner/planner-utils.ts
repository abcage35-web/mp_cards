import {
  addDays,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  endOfMonth,
  endOfYear,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfYear,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";

import {
  DEFAULT_PARTICIPANT_WORK_SCHEDULES,
  DEFAULT_TASK_GROUP_ORDER,
  DEFAULT_TASK_RECURRENCE,
  DEFAULT_WORK_HOURS_PER_DAY,
  PARTICIPANTS,
  TASK_GROUPS,
  WEEKDAY_LABELS,
} from "./constants";
import type {
  ContainerSpec,
  ParticipantId,
  ParticipantWorkSchedule,
  PlannerState,
  PlannerSettings,
  PlannerTask,
  PlannerTaskInput,
  TaskMutationScope,
  TaskGroupId,
  TaskProgressStatus,
  TaskRecurrence,
  TaskRecurrenceWeekdayTiming,
  TaskFormValues,
} from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function uniqueParticipantIds(ids?: ParticipantId[] | null) {
  const values = Array.isArray(ids) ? ids : [];
  return values.filter(
    (id, index) =>
      PARTICIPANTS.some((participant) => participant.id === id) &&
      values.indexOf(id) === index,
  );
}

export function normalizeTaskGroupId(groupId?: string | null): TaskGroupId {
  if (groupId === "meeting") {
    return "planned-meeting";
  }

  return (TASK_GROUPS.find((group) => group.id === groupId)?.id || "undefined") as TaskGroupId;
}

export function normalizeTaskGroupOrder(groupOrder?: TaskGroupId[] | null) {
  const rawOrder = Array.isArray(groupOrder) ? groupOrder : [];
  const normalized = rawOrder
    .map((groupId) => normalizeTaskGroupId(groupId))
    .filter((groupId, index, values) => values.indexOf(groupId) === index);

  return [
    ...normalized,
    ...DEFAULT_TASK_GROUP_ORDER.filter((groupId) => !normalized.includes(groupId)),
  ];
}

export function normalizeTaskStartTime(startTime?: string | null) {
  if (!startTime) {
    return null;
  }

  const value = String(startTime).trim();
  return /^([01]\d|2[0-3]):(00|30)$/.test(value) ? value : null;
}

export function timeToMinutes(startTime?: string | null) {
  const normalized = normalizeTaskStartTime(startTime);
  if (!normalized) {
    return null;
  }

  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 30, Math.round(totalMinutes / 30) * 30));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatTaskStartTime(startTime?: string | null) {
  const normalized = normalizeTaskStartTime(startTime);
  if (!normalized) {
    return "";
  }

  return normalized;
}

export function getOrderedTaskGroups(groupOrder?: TaskGroupId[] | null) {
  const normalizedOrder = normalizeTaskGroupOrder(groupOrder);
  return normalizedOrder
    .map((groupId) => TASK_GROUPS.find((group) => group.id === groupId))
    .filter((group): group is (typeof TASK_GROUPS)[number] => Boolean(group));
}

export function shouldSyncTaskTimeAcrossFamily(_groupId: TaskGroupId) {
  return true;
}

function makeTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeSeriesId() {
  return `series-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeRecurrenceGroupId() {
  return `repeat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getTaskSeriesId(task: Pick<PlannerTask, "id"> & Partial<Pick<PlannerTask, "seriesId">>) {
  return task.seriesId || task.id;
}

function getTaskFallbackAssignees(task: Pick<PlannerTask, "assignee"> & Partial<Pick<PlannerTask, "seriesAssignees">>) {
  const seriesAssignees = uniqueParticipantIds(task.seriesAssignees);
  if (seriesAssignees.length > 0) {
    return seriesAssignees;
  }

  return task.assignee ? [task.assignee] : [];
}

function shouldScheduleTask(input: PlannerTaskInput) {
  return input.status === "calendar" && input.assignees.length > 0 && Boolean(input.date);
}

function uniqueWeekdays(weekdays?: number[] | null) {
  const values = Array.isArray(weekdays) ? weekdays : [];
  return values.filter(
    (day, index) => Number.isInteger(day) && day >= 0 && day <= 6 && values.indexOf(day) === index,
  );
}

function normalizeRecurrenceWeekdayTimings(
  weekdayTimings?: Partial<Record<number, Partial<TaskRecurrenceWeekdayTiming> | null>> | null,
  weekdays?: number[] | null,
) {
  const selectedWeekdays = uniqueWeekdays(weekdays);
  const sourceTimings =
    weekdayTimings && typeof weekdayTimings === "object" ? weekdayTimings : {};

  return selectedWeekdays.reduce<Partial<Record<number, TaskRecurrenceWeekdayTiming>>>(
    (accumulator, weekdayIndex) => {
      const rawTiming = sourceTimings[weekdayIndex];
      if (!rawTiming || typeof rawTiming !== "object") {
        return accumulator;
      }

      const hoursValue = Number(rawTiming.hours);
      accumulator[weekdayIndex] = {
        startTime: normalizeTaskStartTime(rawTiming.startTime) || null,
        hours: Number.isFinite(hoursValue)
          ? Math.max(0, Math.min(24, Math.round(hoursValue * 10) / 10))
          : 0,
      };

      return accumulator;
    },
    {},
  );
}

function isLegacyDefaultWorkSchedule(schedule?: ParticipantWorkSchedule | null) {
  return schedule?.startTime === "09:00" && schedule?.endTime === "17:00";
}

function shouldUpgradeLegacyDefaultWorkSettings(
  workSchedules: Record<ParticipantId, ParticipantWorkSchedule>,
  workHoursPerDay?: number | null,
) {
  const allLegacy = PARTICIPANTS.every((participant) =>
    isLegacyDefaultWorkSchedule(workSchedules[participant.id]),
  );

  if (!allLegacy) {
    return false;
  }

  return workHoursPerDay === undefined || workHoursPerDay === null || workHoursPerDay === 8 || workHoursPerDay === 9;
}

function normalizeRecurrenceExclusions(exclusions?: string[] | null) {
  const values = Array.isArray(exclusions) ? exclusions : [];

  return values.filter(
    (value, index, array) =>
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}::[a-z-]+$/.test(value) &&
      array.indexOf(value) === index,
  );
}

export function makeRecurrenceExclusionKey(
  dateKey?: string | null,
  assignee?: ParticipantId | null,
) {
  return dateKey && assignee ? `${dateKey}::${assignee}` : null;
}

function hasRecurrenceExclusion(
  recurrence: TaskRecurrence,
  dateKey?: string | null,
  assignee?: ParticipantId | null,
) {
  const key = makeRecurrenceExclusionKey(dateKey, assignee);
  return key ? recurrence.exclusions.includes(key) : false;
}

function appendRecurrenceExclusion(
  recurrence: TaskRecurrence,
  dateKey?: string | null,
  assignee?: ParticipantId | null,
) {
  const key = makeRecurrenceExclusionKey(dateKey, assignee);
  if (!key || recurrence.exclusions.includes(key)) {
    return recurrence;
  }

  return {
    ...recurrence,
    exclusions: [...recurrence.exclusions, key],
  };
}

function getWeekdayIndexFromDate(dateKey?: string | null) {
  if (!dateKey) {
    return null;
  }

  const date = parseISO(dateKey);
  return Number.isNaN(date.getTime()) ? null : (date.getDay() + 6) % 7;
}

export function normalizeTaskRecurrence(
  recurrence?: Partial<TaskRecurrence> | null,
  anchorDate?: string | null,
): TaskRecurrence {
  const frequency = recurrence?.frequency || DEFAULT_TASK_RECURRENCE.frequency;
  const interval = Math.max(1, Math.min(52, Math.round(Number(recurrence?.interval) || 1)));
  const fromDate = recurrence?.fromDate || anchorDate || "";
  const anchorWeekday = getWeekdayIndexFromDate(fromDate || anchorDate);
  const weekdays = uniqueWeekdays(recurrence?.weekdays);
  const normalizedWeekdays =
    frequency === "weekly"
      ? weekdays.length > 0
        ? weekdays
        : anchorWeekday !== null
          ? [anchorWeekday]
          : []
      : weekdays;

  return {
    frequency,
    interval,
    weekdays: normalizedWeekdays,
    weekdayTimings:
      frequency === "weekly"
        ? normalizeRecurrenceWeekdayTimings(recurrence?.weekdayTimings, normalizedWeekdays)
        : {},
    fromDate,
    untilMode: recurrence?.untilMode === "until" ? "until" : "forever",
    untilDate: recurrence?.untilDate || "",
    exclusions: normalizeRecurrenceExclusions(recurrence?.exclusions),
  };
}

export function getRecurrenceWeekdayTiming(
  recurrence: TaskRecurrence,
  weekdayIndex?: number | null,
) {
  if (recurrence.frequency !== "weekly" || weekdayIndex === null || weekdayIndex === undefined) {
    return null;
  }

  return recurrence.weekdayTimings[weekdayIndex] || null;
}

function resolveRecurringOccurrenceTiming(
  recurrence: TaskRecurrence,
  occurrenceDate: string,
  fallbackStartTime: string | null,
  fallbackHours: number,
) {
  const weekdayTiming = getRecurrenceWeekdayTiming(
    recurrence,
    getWeekdayIndexFromDate(occurrenceDate),
  );

  return {
    startTime: weekdayTiming ? weekdayTiming.startTime : fallbackStartTime,
    hours: weekdayTiming ? weekdayTiming.hours : fallbackHours,
  };
}

export function getTaskRecurrence(
  task: Partial<Pick<PlannerTask, "recurrence" | "date">>,
) {
  return normalizeTaskRecurrence(task.recurrence, task.date || null);
}

function isRecurringTask(recurrence: TaskRecurrence) {
  return recurrence.frequency !== "none";
}

function getTaskRecurrenceGroupId(task: Partial<Pick<PlannerTask, "recurrenceGroupId">>) {
  return task.recurrenceGroupId || null;
}

function describeWeeklyRecurrence(weekdays: number[]) {
  return uniqueWeekdays(weekdays)
    .sort((left, right) => left - right)
    .map((weekday) => WEEKDAY_LABELS[weekday])
    .join(", ");
}

export function getRecurrenceSummary(
  recurrence: TaskRecurrence,
  dateKey?: string | null,
) {
  if (!dateKey || recurrence.frequency === "none") {
    return "Без повторения";
  }

  if (recurrence.frequency === "daily") {
    return recurrence.interval === 1
      ? "Каждый день"
      : `Каждые ${recurrence.interval} дня`;
  }

  if (recurrence.frequency === "weekly") {
    const weekdays = describeWeeklyRecurrence(recurrence.weekdays);
    const weekLabel = recurrence.interval === 1 ? "неделю" : `${recurrence.interval}-ю неделю`;
    return weekdays
      ? `Повторять в ${weekdays} каждую ${weekLabel}`
      : `Повторять по неделям`;
  }

  return recurrence.interval === 1
    ? "Каждый месяц"
    : `Каждые ${recurrence.interval} месяца`;
}

export function normalizeWorkHoursPerDay(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_WORK_HOURS_PER_DAY;
  }

  return Math.max(1, Math.min(24, Math.round(value * 10) / 10));
}

export function normalizeParticipantWorkSchedules(
  workSchedules?: Partial<Record<ParticipantId, Partial<ParticipantWorkSchedule> | null>> | null,
) {
  const normalizedSchedules = PARTICIPANTS.reduce<Record<ParticipantId, ParticipantWorkSchedule>>((accumulator, participant) => {
    const fallback = DEFAULT_PARTICIPANT_WORK_SCHEDULES[participant.id];
    const rawSchedule = workSchedules?.[participant.id];
    const normalizedStart = normalizeTaskStartTime(rawSchedule?.startTime) || fallback.startTime;
    const normalizedEnd = normalizeTaskStartTime(rawSchedule?.endTime) || fallback.endTime;
    const startMinutes = timeToMinutes(normalizedStart);
    const endMinutes = timeToMinutes(normalizedEnd);

    accumulator[participant.id] =
      startMinutes !== null && endMinutes !== null && endMinutes > startMinutes
        ? {
            startTime: normalizedStart,
            endTime: normalizedEnd,
          }
        : fallback;

    return accumulator;
  }, {} as Record<ParticipantId, ParticipantWorkSchedule>);

  return normalizedSchedules;
}

export function getParticipantWorkHoursPerDay(schedule?: ParticipantWorkSchedule | null) {
  const startMinutes = timeToMinutes(schedule?.startTime);
  const endMinutes = timeToMinutes(schedule?.endTime);

  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return DEFAULT_WORK_HOURS_PER_DAY;
  }

  return Math.round(((endMinutes - startMinutes) / 60) * 10) / 10;
}

export function getTaskProgressStatus(
  task: Pick<PlannerTask, "progressStatus"> & Partial<Pick<PlannerTask, "id">>,
) {
  return task.progressStatus || ("in-progress" satisfies TaskProgressStatus);
}

function getRecurringDates(
  anchorDateKey: string,
  recurrence: TaskRecurrence,
  currentMonth: Date,
) {
  const startDateKey = recurrence.fromDate || anchorDateKey;
  if (!startDateKey) {
    return [];
  }

  const anchorDate = parseISO(startDateKey);
  if (Number.isNaN(anchorDate.getTime())) {
    return [];
  }

  const monthStart = startOfYear(currentMonth);
  const monthEnd = endOfYear(currentMonth);
  const untilDate =
    recurrence.untilMode === "until" && recurrence.untilDate
      ? parseISO(recurrence.untilDate)
      : null;

  const dates: string[] = [];
  let cursor = monthStart;

  while (cursor <= monthEnd) {
    if (cursor >= anchorDate && (!untilDate || cursor <= untilDate)) {
      const weekdayIndex = (cursor.getDay() + 6) % 7;
      const dailyDiff = differenceInCalendarDays(cursor, anchorDate);
      const weeklyDiff = differenceInCalendarWeeks(cursor, anchorDate, {
        weekStartsOn: 1,
      });
      const monthlyDiff = differenceInCalendarMonths(cursor, anchorDate);

      const shouldInclude =
        recurrence.frequency === "daily"
          ? dailyDiff % recurrence.interval === 0
          : recurrence.frequency === "weekly"
            ? recurrence.weekdays.includes(weekdayIndex) &&
              weeklyDiff >= 0 &&
              weeklyDiff % recurrence.interval === 0
            : recurrence.frequency === "monthly"
              ? cursor.getDate() === anchorDate.getDate() &&
                monthlyDiff >= 0 &&
                monthlyDiff % recurrence.interval === 0
              : isSameDay(cursor, anchorDate);

      if (shouldInclude) {
        dates.push(format(cursor, "yyyy-MM-dd"));
      }
    }

    cursor = addDays(cursor, 1);
  }

  return dates;
}

function moveRecurrenceToDate(
  recurrence: TaskRecurrence,
  targetDateKey?: string,
) {
  if (!targetDateKey) {
    return recurrence;
  }

  if (recurrence.frequency !== "weekly") {
    return {
      ...recurrence,
      fromDate: targetDateKey,
    };
  }

  const weekdayIndex = getWeekdayIndexFromDate(targetDateKey);
  if (weekdayIndex === null) {
    return {
      ...recurrence,
      fromDate: targetDateKey,
    };
  }

  if (recurrence.weekdays.length > 1 && recurrence.weekdays.includes(weekdayIndex)) {
    return {
      ...recurrence,
      fromDate: targetDateKey,
    };
  }

  return {
    ...recurrence,
    fromDate: targetDateKey,
    weekdays: [weekdayIndex],
    weekdayTimings: normalizeRecurrenceWeekdayTimings(recurrence.weekdayTimings, [weekdayIndex]),
  };
}

export function createEmptyPlannerState(): PlannerState {
  const nowIso = new Date().toISOString();

  return {
    version: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
    settings: {
      workHoursPerDay: DEFAULT_WORK_HOURS_PER_DAY,
      groupOrder: DEFAULT_TASK_GROUP_ORDER,
      calendarDisplayMode: "day",
      hideWeekends: false,
      interleaveWeeksByParticipant: false,
      participantWorkSchedules: normalizeParticipantWorkSchedules(),
    },
    tasks: [],
  };
}

export function getPlannerSettings(state: PlannerState | null): PlannerSettings {
  const workHoursPerDay = normalizeWorkHoursPerDay(
    state?.settings?.workHoursPerDay ?? DEFAULT_WORK_HOURS_PER_DAY,
  );
  const participantWorkSchedules = normalizeParticipantWorkSchedules(state?.settings?.participantWorkSchedules);
  const shouldUpgradeLegacyDefaults = shouldUpgradeLegacyDefaultWorkSettings(
    participantWorkSchedules,
    state?.settings?.workHoursPerDay ?? null,
  );

  return {
    workHoursPerDay: shouldUpgradeLegacyDefaults ? DEFAULT_WORK_HOURS_PER_DAY : workHoursPerDay,
    groupOrder: normalizeTaskGroupOrder(state?.settings?.groupOrder),
    calendarDisplayMode: state?.settings?.calendarDisplayMode === "time" ? "time" : "day",
    hideWeekends: state?.settings?.hideWeekends === true,
    interleaveWeeksByParticipant: state?.settings?.interleaveWeeksByParticipant === true,
    participantWorkSchedules: shouldUpgradeLegacyDefaults
      ? { ...DEFAULT_PARTICIPANT_WORK_SCHEDULES }
      : participantWorkSchedules,
  };
}

export function getCurrentMonthLabel(currentMonth: Date) {
  return format(currentMonth, "LLLL yyyy", { locale: ru });
}

export function buildMonthGrid(currentMonth: Date) {
  const firstDay = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
  const lastDay = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
  const days: Date[] = [];

  let cursor = firstDay;
  while (cursor <= lastDay) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return days;
}

export function getDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function getDisplayDay(dateKey: string | null) {
  if (!dateKey) {
    return "";
  }

  return format(parseISO(dateKey), "dd.MM");
}

export function getContainerId(spec: ContainerSpec) {
  if (spec.kind === "calendar" && spec.assignee && spec.date) {
    return `calendar:${spec.assignee}:${spec.date}:${spec.group}`;
  }

  return `bank:${spec.group}`;
}

export function getTaskContainerSpec(task: PlannerTask): ContainerSpec {
  if (task.status === "calendar" && task.assignee && task.date) {
    return {
      kind: "calendar",
      assignee: task.assignee,
      date: task.date,
      group: task.group,
    };
  }

  return {
    kind: "bank",
    group: task.group,
  };
}

export function getTaskContainerId(task: PlannerTask) {
  return getContainerId(getTaskContainerSpec(task));
}

export function getTaskSeriesTasks(tasks: PlannerTask[], taskId: string) {
  const sourceTask = tasks.find((task) => task.id === taskId);
  if (!sourceTask) {
    return [];
  }

  const seriesId = getTaskSeriesId(sourceTask);
  return sortPlannerTasks(tasks).filter((task) => getTaskSeriesId(task) === seriesId);
}

export function getTaskLinkedTasks(
  tasks: PlannerTask[],
  taskId: string,
) {
  const sourceTask = tasks.find((task) => task.id === taskId);
  if (!sourceTask) {
    return [];
  }

  const recurrenceGroupId = getTaskRecurrenceGroupId(sourceTask);
  if (!recurrenceGroupId) {
    return getTaskSeriesTasks(tasks, taskId);
  }

  return sortPlannerTasks(tasks).filter(
    (task) => getTaskRecurrenceGroupId(task) === recurrenceGroupId,
  );
}

function areParticipantListsEqual(left: ParticipantId[], right: ParticipantId[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((participantId, index) => participantId === right[index]);
}

function synchronizeSeriesAssignees(tasks: PlannerTask[]) {
  const seriesAssigneesBySeriesId = new Map<string, ParticipantId[]>();

  sortPlannerTasks(tasks).forEach((task) => {
    const seriesId = getTaskSeriesId(task);
    const currentAssignees = seriesAssigneesBySeriesId.get(seriesId) || [];
    const sourceAssignees =
      task.status === "calendar" && task.assignee
        ? [task.assignee]
        : getTaskFallbackAssignees(task);

    sourceAssignees.forEach((participantId) => {
      if (!currentAssignees.includes(participantId)) {
        currentAssignees.push(participantId);
      }
    });

    seriesAssigneesBySeriesId.set(seriesId, currentAssignees);
  });

  return tasks.map((task) => {
    const nextSeriesAssignees =
      seriesAssigneesBySeriesId.get(getTaskSeriesId(task)) || getTaskFallbackAssignees(task);

    if (areParticipantListsEqual(getTaskFallbackAssignees(task), nextSeriesAssignees)) {
      return task;
    }

    return {
      ...task,
      seriesAssignees: nextSeriesAssignees,
    };
  });
}

export function shouldPromptTaskScope(tasks: PlannerTask[], taskId: string) {
  const sourceTask = tasks.find((task) => task.id === taskId);
  if (!sourceTask || sourceTask.status !== "calendar" || !sourceTask.assignee || !sourceTask.date) {
    return false;
  }

  return getTaskLinkedTasks(tasks, taskId).length > 1;
}

export function detachTaskInstance(tasks: PlannerTask[], taskId: string) {
  const sourceTask = tasks.find((task) => task.id === taskId);
  if (
    !sourceTask ||
    sourceTask.status !== "calendar" ||
    !sourceTask.assignee ||
    !sourceTask.date
  ) {
    return tasks;
  }

  const linkedTasks = getTaskLinkedTasks(tasks, taskId);
  if (linkedTasks.length <= 1) {
    return tasks;
  }

  const linkedTaskIds = new Set(linkedTasks.map((task) => task.id));
  const sourceSeriesId = getTaskSeriesId(sourceTask);
  const detachedSeriesId = makeSeriesId();
  const nowIso = new Date().toISOString();

  return synchronizeSeriesAssignees(
    normalizeTaskOrders(
      tasks.map((task) => {
        if (task.id === taskId) {
          return {
            ...task,
            seriesId: detachedSeriesId,
            seriesAssignees: [sourceTask.assignee],
            recurrenceGroupId: null,
            recurrence: DEFAULT_TASK_RECURRENCE,
            updatedAt: nowIso,
          };
        }

        if (!linkedTaskIds.has(task.id)) {
          return task;
        }

        const nextRecurrence = appendRecurrenceExclusion(
          getTaskRecurrence(task),
          sourceTask.date,
          sourceTask.assignee,
        );
        const nextSeriesAssignees =
          getTaskSeriesId(task) === sourceSeriesId
            ? getTaskFallbackAssignees(task).filter((participantId) => participantId !== sourceTask.assignee)
            : getTaskFallbackAssignees(task);

        return {
          ...task,
          recurrence: nextRecurrence,
          seriesAssignees: nextSeriesAssignees,
          updatedAt: nowIso,
        };
      }),
    ),
  );
}

export function getTaskSeriesAssignees(task: PlannerTask) {
  return getTaskFallbackAssignees(task);
}

export function getTaskPrimaryTask(tasks: PlannerTask[], taskId: string) {
  const linkedTasks = getTaskLinkedTasks(tasks, taskId);
  if (linkedTasks.length === 0) {
    return null;
  }

  const bankTask = linkedTasks.find((task) => task.status === "bank");
  if (bankTask) {
    return bankTask;
  }

  return [...linkedTasks].sort((left, right) => {
    const leftDate = left.date || "9999-99-99";
    const rightDate = right.date || "9999-99-99";

    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }

    return left.createdAt.localeCompare(right.createdAt);
  })[0];
}

export function sortPlannerTasks(tasks: PlannerTask[]) {
  return [...tasks].sort((left, right) => {
    const orderDiff = left.order - right.order;
    if (orderDiff !== 0) {
      return orderDiff;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

export function normalizeTaskOrders(tasks: PlannerTask[]) {
  const grouped = new Map<string, PlannerTask[]>();

  for (const task of sortPlannerTasks(tasks)) {
    const containerId = getTaskContainerId(task);
    const list = grouped.get(containerId) || [];
    list.push(task);
    grouped.set(containerId, list);
  }

  const normalized: PlannerTask[] = [];
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

export function getTasksForContainer(tasks: PlannerTask[], spec: ContainerSpec) {
  const containerId = getContainerId(spec);
  return sortPlannerTasks(tasks).filter((task) => getTaskContainerId(task) === containerId);
}

export function getParticipantName(participantId: ParticipantId | null) {
  return PARTICIPANTS.find((participant) => participant.id === participantId)?.name || "Не назначен";
}

export function getShortParticipantName(participantId: ParticipantId | null) {
  return PARTICIPANTS.find((participant) => participant.id === participantId)?.shortName || "Без исполнителя";
}

export function getParticipantNames(participantIds: ParticipantId[]) {
  return uniqueParticipantIds(participantIds).map((participantId) => getParticipantName(participantId));
}

export function getShortParticipantNames(participantIds: ParticipantId[]) {
  return uniqueParticipantIds(participantIds).map((participantId) =>
    getShortParticipantName(participantId),
  );
}

function getSeriesParticipantIds(tasks: PlannerTask[]) {
  return uniqueParticipantIds(tasks.flatMap((task) => getTaskFallbackAssignees(task)));
}

function buildCollapsedBankSeriesTask(
  seriesTasks: PlannerTask[],
  sourceTask: PlannerTask,
  targetGroup: PlannerTask["group"],
  updatedAt: string,
) {
  const assignees = getSeriesParticipantIds(seriesTasks);
  const representativeTask =
    seriesTasks.find((task) => task.id === sourceTask.id) || sortPlannerTasks(seriesTasks)[0];

  return {
    ...representativeTask,
    seriesId: getTaskSeriesId(representativeTask),
    seriesAssignees: assignees,
    progressStatus: getTaskProgressStatus(representativeTask),
    assignee: assignees.length === 1 ? assignees[0] : null,
    date: sourceTask.date || representativeTask.date || null,
    status: "bank" as const,
    group: targetGroup,
    updatedAt,
  };
}

function patchTaskWithContainer(task: PlannerTask, spec: ContainerSpec) {
  if (spec.kind === "calendar") {
    return {
      ...task,
      status: "calendar" as const,
      group: spec.group,
      assignee: spec.assignee || task.assignee,
      date: spec.date || task.date,
    };
  }

  return {
    ...task,
    status: "bank" as const,
    group: spec.group,
    date: null,
  };
}

function buildContainerMap(tasks: PlannerTask[]) {
  const grouped = new Map<string, PlannerTask[]>();

  for (const task of sortPlannerTasks(tasks)) {
    const containerId = getTaskContainerId(task);
    const list = grouped.get(containerId) || [];
    list.push(task);
    grouped.set(containerId, list);
  }

  return grouped;
}

function moveSingleTaskInsideContainer(
  tasks: PlannerTask[],
  taskId: string,
  targetSpec: ContainerSpec,
  targetIndex: number,
) {
  const targetContainerId = getContainerId(targetSpec);
  const currentList = getTasksForContainer(tasks, targetSpec);
  const sourceIndex = currentList.findIndex((task) => task.id === taskId);

  if (sourceIndex === -1) {
    return tasks;
  }

  const nextList = [...currentList];
  const [movedTask] = nextList.splice(sourceIndex, 1);
  const insertIndex = clamp(targetIndex, 0, nextList.length);
  nextList.splice(insertIndex, 0, movedTask);

  let hasChanges = false;
  const nextOrderById = new Map<string, number>();
  nextList.forEach((task, index) => {
    nextOrderById.set(task.id, index);
    if (task.order !== index) {
      hasChanges = true;
    }
  });

  if (!hasChanges) {
    return tasks;
  }

  return tasks.map((task) => {
    if (getTaskContainerId(task) !== targetContainerId) {
      return task;
    }

    const nextOrder = nextOrderById.get(task.id);
    if (nextOrder === undefined || nextOrder === task.order) {
      return task;
    }

    return {
      ...task,
      order: nextOrder,
    };
  });
}

export function moveTaskToContainer(
  tasks: PlannerTask[],
  taskId: string,
  targetSpec: ContainerSpec,
  targetIndex: number,
  currentMonth: Date,
) {
  const sourceTask = tasks.find((task) => task.id === taskId);
  if (!sourceTask) {
    return tasks;
  }

  const nowIso = new Date().toISOString();
  const linkedTasks = getTaskLinkedTasks(tasks, taskId);
  const seriesTasks = getTaskSeriesTasks(tasks, taskId);
  const movedSeriesId = getTaskSeriesId(sourceTask);
  const movedRecurrenceGroupId = getTaskRecurrenceGroupId(sourceTask);
  const tasksToMove = movedRecurrenceGroupId
    ? linkedTasks
    : seriesTasks.length > 0
      ? seriesTasks
      : [sourceTask];
  const sourceContainerId = getTaskContainerId(sourceTask);
  const targetContainerId = getContainerId(targetSpec);

  if (
    !movedRecurrenceGroupId &&
    tasksToMove.length === 1 &&
    sourceContainerId === targetContainerId
  ) {
    return moveSingleTaskInsideContainer(tasks, taskId, targetSpec, targetIndex);
  }

  const linkedTaskIds = new Set(tasksToMove.map((task) => task.id));
  const remainingTasks = tasks
    .filter((task) => !linkedTaskIds.has(task.id))
    .map((task) => ({ ...task }));
  const containerMap = buildContainerMap(remainingTasks);
  const movedTasksByContainer = new Map<string, PlannerTask[]>();
  const seriesAssignees = getSeriesParticipantIds(tasksToMove);
  const recurrence = moveRecurrenceToDate(
    getTaskRecurrence(sourceTask),
    targetSpec.date || sourceTask.date || null,
  );
  const familyRecurrenceGroupId =
    movedRecurrenceGroupId ||
    (isRecurringTask(recurrence) || seriesAssignees.length > 1 ? makeRecurrenceGroupId() : null);

  if (targetSpec.kind === "bank") {
    const movedTask = buildCollapsedBankSeriesTask(
      tasksToMove,
      sourceTask,
      targetSpec.group,
      nowIso,
    );
    movedTask.recurrenceGroupId = familyRecurrenceGroupId;
    movedTask.recurrence = recurrence;
    movedTask.seriesAssignees = seriesAssignees;
    const containerId = getTaskContainerId(movedTask);
    movedTasksByContainer.set(containerId, [movedTask]);
  } else {
    const calendarAssignees =
      seriesAssignees.length > 0
        ? seriesAssignees
        : targetSpec.assignee
          ? [targetSpec.assignee]
          : [];
    const occurrenceDates =
      isRecurringTask(recurrence) && targetSpec.date
        ? getRecurringDates(targetSpec.date, recurrence, currentMonth)
        : targetSpec.date
          ? [targetSpec.date]
          : [];
    const recurrenceGroupId =
      occurrenceDates.length > 1 || seriesAssignees.length > 1
        ? familyRecurrenceGroupId
        : movedRecurrenceGroupId;
    const previousSeriesIdByDate = new Map<string, string>();

    tasksToMove.forEach((task) => {
      if (task.status !== "calendar" || !task.date || previousSeriesIdByDate.has(task.date)) {
        return;
      }

      previousSeriesIdByDate.set(task.date, getTaskSeriesId(task));
    });

    occurrenceDates.forEach((occurrenceDate, occurrenceIndex) => {
      const occurrenceSeriesId =
        previousSeriesIdByDate.get(occurrenceDate) ||
        (occurrenceIndex === 0 ? movedSeriesId : makeSeriesId());

      calendarAssignees
        .filter((assignee) => !hasRecurrenceExclusion(recurrence, occurrenceDate, assignee))
        .forEach((assignee, index) => {
        const previousSibling =
          tasksToMove.find(
            (task) =>
              task.status === "calendar" &&
              task.assignee === assignee &&
              task.date === occurrenceDate,
          ) ||
          (occurrenceIndex === 0 && index === 0 ? sourceTask : null);
        const baseTask = previousSibling || sourceTask;
        const occurrenceTiming = resolveRecurringOccurrenceTiming(
          recurrence,
          occurrenceDate,
          baseTask.startTime,
          baseTask.hours,
        );
        const movedTask = patchTaskWithContainer(
          {
            ...baseTask,
            id:
              previousSibling?.id ||
              (occurrenceIndex === 0 && index === 0 ? sourceTask.id : makeTaskId()),
            updatedAt: nowIso,
            seriesId: occurrenceSeriesId,
            seriesAssignees:
              calendarAssignees.length > 0
                ? calendarAssignees
                : getTaskFallbackAssignees(baseTask),
            recurrenceGroupId,
            recurrence,
            progressStatus: getTaskProgressStatus(baseTask),
            startTime: occurrenceTiming.startTime,
            hours: occurrenceTiming.hours,
          },
          {
            kind: "calendar",
            group: targetSpec.group,
            assignee,
            date: occurrenceDate,
          },
        );
        const containerId = getTaskContainerId(movedTask);
        const list = movedTasksByContainer.get(containerId) || [];
        list.push(movedTask);
        movedTasksByContainer.set(containerId, list);
        });
    });
  }

  for (const [containerId, movedTasks] of movedTasksByContainer.entries()) {
    const currentList = [...(containerMap.get(containerId) || [])];
    const insertIndex = clamp(targetIndex, 0, currentList.length);
    currentList.splice(insertIndex, 0, ...sortPlannerTasks(movedTasks));
    currentList.forEach((task, index) => {
      task.order = index;
    });
    containerMap.set(containerId, currentList);
  }

  return synchronizeSeriesAssignees(normalizeTaskOrders(Array.from(containerMap.values()).flat()));
}

export function deletePlannerTask(
  tasks: PlannerTask[],
  taskId: string,
  scope: TaskMutationScope = "series",
) {
  const sourceTask = tasks.find((task) => task.id === taskId);
  if (!sourceTask) {
    return tasks;
  }

  if (scope === "instance") {
    const detachedTasks = detachTaskInstance(tasks, taskId);
    return synchronizeSeriesAssignees(
      normalizeTaskOrders(detachedTasks.filter((task) => task.id !== taskId)),
    );
  }

  const deletingRecurrenceGroupId = getTaskRecurrenceGroupId(sourceTask);
  const tasksToDelete = getTaskLinkedTasks(tasks, taskId);
  const deletingTaskIds = new Set(tasksToDelete.map((task) => task.id));

  return synchronizeSeriesAssignees(normalizeTaskOrders(
    tasks.filter((task) =>
      deletingRecurrenceGroupId
        ? getTaskRecurrenceGroupId(task) !== deletingRecurrenceGroupId
        : !deletingTaskIds.has(task.id),
    ),
  ));
}

export function updateTaskSeriesProgressStatus(
  tasks: PlannerTask[],
  taskId: string,
  progressStatus: TaskProgressStatus,
) {
  const sourceTask = tasks.find((task) => task.id === taskId);
  if (!sourceTask) {
    return tasks;
  }

  const nowIso = new Date().toISOString();

  return tasks.map((task) => {
    return task.id === taskId
      ? {
          ...task,
          seriesId: getTaskSeriesId(task),
          seriesAssignees: getTaskFallbackAssignees(task),
          recurrence: getTaskRecurrence(task),
          progressStatus,
          updatedAt: nowIso,
        }
      : task;
  });
}

export function cycleTaskProgressStatus(status: TaskProgressStatus) {
  if (status === "in-progress") {
    return "done" satisfies TaskProgressStatus;
  }

  if (status === "done") {
    return "cancelled" satisfies TaskProgressStatus;
  }

  return "in-progress" satisfies TaskProgressStatus;
}

export function clonePlannerTask(
  tasks: PlannerTask[],
  taskId: string,
  input: PlannerTaskInput,
  currentMonth: Date,
) {
  const sourceTask = tasks.find((task) => task.id === taskId);
  if (!sourceTask) {
    return tasks;
  }

  const nextTasks = upsertPlannerTask(tasks, input, currentMonth);
  const previousTaskIds = new Set(tasks.map((task) => task.id));
  const createdTasks = nextTasks.filter((task) => !previousTaskIds.has(task.id));

  if (createdTasks.length === 0) {
    return nextTasks;
  }

  const nowIso = new Date().toISOString();
  const createdRecurrenceGroupId = getTaskRecurrenceGroupId(createdTasks[0]);
  const createdSeriesId = getTaskSeriesId(createdTasks[0]);
  const sourceProgressStatus = getTaskProgressStatus(sourceTask);

  return nextTasks.map((task) => {
    const matchesCloneGroup = createdRecurrenceGroupId
      ? getTaskRecurrenceGroupId(task) === createdRecurrenceGroupId
      : getTaskSeriesId(task) === createdSeriesId;

    return matchesCloneGroup
      ? {
          ...task,
          progressStatus: sourceProgressStatus,
          updatedAt: nowIso,
        }
      : task;
  });
}

export function buildTaskInput(values: TaskFormValues): PlannerTaskInput {
  const hoursValue = Number(values.hours);
  const assignees = uniqueParticipantIds(values.assignees);
  const date = values.recurrence.fromDate || values.date || null;

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    link: values.link.trim(),
    hours: Number.isFinite(hoursValue) ? Math.max(0, Math.round(hoursValue * 10) / 10) : 0,
    startTime: normalizeTaskStartTime(values.startTime),
    group: values.group,
    assignees,
    date,
    status: values.status,
    recurrence: normalizeTaskRecurrence(values.recurrence, date),
  };
}

export function upsertPlannerTask(
  tasks: PlannerTask[],
  input: PlannerTaskInput,
  currentMonth: Date,
  editingTaskId?: string,
) {
  const nowIso = new Date().toISOString();
  const previousTask = editingTaskId ? tasks.find((task) => task.id === editingTaskId) : null;
  if (editingTaskId && !previousTask) {
    return tasks;
  }

  const recurrence = normalizeTaskRecurrence(input.recurrence, input.date);
  const previousPrimaryTask = previousTask ? getTaskPrimaryTask(tasks, previousTask.id) : null;
  const previousSeriesId = previousPrimaryTask ? getTaskSeriesId(previousPrimaryTask) : makeSeriesId();
  const previousRecurrenceGroupId = previousPrimaryTask ? getTaskRecurrenceGroupId(previousPrimaryTask) : null;
  const previousSeriesTasks = previousTask ? getTaskLinkedTasks(tasks, previousTask.id) : [];
  const withoutPreviousSeries = previousTask
    ? tasks
        .filter((task) =>
          previousRecurrenceGroupId
            ? getTaskRecurrenceGroupId(task) !== previousRecurrenceGroupId
            : getTaskSeriesId(task) !== previousSeriesId,
        )
        .map((task) => ({ ...task }))
    : tasks.map((task) => ({ ...task }));

  const scheduleToCalendars = shouldScheduleTask(input);
  const seriesAssignees = uniqueParticipantIds(input.assignees);
  const assignees = seriesAssignees;
  const syncTimeAcrossFamily = shouldSyncTaskTimeAcrossFamily(input.group);
  const recurrenceGroupId =
    previousRecurrenceGroupId ||
    (isRecurringTask(recurrence) || assignees.length > 1 ? makeRecurrenceGroupId() : null);

  if (!scheduleToCalendars) {
    const nextTask: PlannerTask = {
      id: previousPrimaryTask?.status === "bank" ? previousPrimaryTask.id : previousTask?.id || makeTaskId(),
      seriesId: previousPrimaryTask ? getTaskSeriesId(previousPrimaryTask) : makeSeriesId(),
      seriesAssignees,
      recurrenceGroupId,
      recurrence,
      progressStatus: previousPrimaryTask?.progressStatus || previousTask?.progressStatus || "in-progress",
      title: input.title,
      description: input.description,
      link: input.link,
      hours: input.hours,
      startTime: input.startTime,
      group: input.group,
      assignee: seriesAssignees.length === 1 ? seriesAssignees[0] : null,
      date: input.date,
      status: "bank",
      order: 0,
      createdAt: previousPrimaryTask?.createdAt || previousTask?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const targetTasks = getTasksForContainer(withoutPreviousSeries, getTaskContainerSpec(nextTask));
    const sameContainer =
      previousPrimaryTask &&
      getTaskContainerId(previousPrimaryTask) === getTaskContainerId(nextTask);

    return synchronizeSeriesAssignees(
      normalizeTaskOrders([
        ...withoutPreviousSeries,
        {
          ...nextTask,
          order: sameContainer && previousPrimaryTask ? previousPrimaryTask.order : targetTasks.length,
        },
      ]),
    );
  }

  const occurrenceDates =
    input.date
      ? isRecurringTask(recurrence)
        ? getRecurringDates(input.date, recurrence, currentMonth)
        : [input.date]
      : [];
  const previousSeriesIdByDate = new Map<string, string>();

  previousSeriesTasks.forEach((task) => {
    if (task.status !== "calendar" || !task.date || previousSeriesIdByDate.has(task.date)) {
      return;
    }
    previousSeriesIdByDate.set(task.date, getTaskSeriesId(task));
  });

  const createdTasks = occurrenceDates.flatMap((occurrenceDate) => {
    const occurrenceSeriesId =
      occurrenceDate && previousSeriesIdByDate.get(occurrenceDate)
        ? previousSeriesIdByDate.get(occurrenceDate)!
        : occurrenceDate
          ? occurrenceDates.length === 1 && previousPrimaryTask
            ? getTaskSeriesId(previousPrimaryTask)
            : makeSeriesId()
          : previousSeriesId;

    return assignees
      .filter((assignee) => !hasRecurrenceExclusion(recurrence, occurrenceDate, assignee))
      .map((assignee, index) => {
      const previousSibling =
        previousSeriesTasks.find(
          (task) =>
            task.status === "calendar" &&
            task.assignee === assignee &&
            (task.date || null) === occurrenceDate,
        ) || (occurrenceDates.length === 1 && index === 0 ? previousTask : null);
      const createdAt = previousSibling?.createdAt || nowIso;
      const occurrenceTiming = resolveRecurringOccurrenceTiming(
        recurrence,
        occurrenceDate,
        input.startTime,
        input.hours,
      );
      const shouldPreserveIndividualTime =
        !syncTimeAcrossFamily &&
        previousTask?.status === "calendar" &&
        previousSibling?.status === "calendar";
      const nextHours =
        shouldPreserveIndividualTime && previousSibling
          ? previousSibling.hours
          : occurrenceTiming.hours;
      const nextStartTime =
        shouldPreserveIndividualTime && previousSibling
          ? previousSibling.startTime
          : occurrenceTiming.startTime;
      const nextTask: PlannerTask = {
        id: previousSibling?.id || makeTaskId(),
        seriesId: occurrenceSeriesId,
        seriesAssignees,
        recurrenceGroupId,
        recurrence,
        progressStatus: previousSibling?.progressStatus || "in-progress",
        title: input.title,
        description: input.description,
        link: input.link,
        hours: nextHours,
        startTime: nextStartTime,
        group: input.group,
        assignee,
        date: occurrenceDate,
        status: scheduleToCalendars && assignee && occurrenceDate ? "calendar" : "bank",
        order: 0,
        createdAt,
        updatedAt: nowIso,
      };

      const targetTasks = getTasksForContainer(
        withoutPreviousSeries,
        getTaskContainerSpec(nextTask),
      );
      const sameContainer =
        previousSibling &&
        getTaskContainerId(previousSibling) === getTaskContainerId(nextTask);

      return {
        ...nextTask,
        assignee:
          nextTask.status === "bank" && seriesAssignees.length > 1 ? null : nextTask.assignee,
        order:
          sameContainer && previousSibling ? previousSibling.order : targetTasks.length + index,
      };
      });
  });

  return synchronizeSeriesAssignees(normalizeTaskOrders([...withoutPreviousSeries, ...createdTasks]));
}

export function isDateToday(date: Date) {
  return isSameDay(date, new Date());
}

export function getMonthInputRange(currentMonth: Date) {
  return {
    min: format(startOfYear(currentMonth), "yyyy-MM-dd"),
    max: format(endOfYear(currentMonth), "yyyy-MM-dd"),
  };
}

export function formatHours(hours: number) {
  const normalized = Math.round(hours * 10) / 10;
  return `${normalized}ч`;
}

export function isDateWithinCurrentMonth(dateValue: string, currentMonth: Date) {
  if (!dateValue) {
    return false;
  }

  const date = parseISO(dateValue);
  return format(date, "yyyy") === format(currentMonth, "yyyy");
}

export function createTaskFormValues(task?: PlannerTask): TaskFormValues {
  if (!task) {
    return {
      title: "",
      description: "",
      link: "",
      hours: "1",
      startTime: "",
      group: "undefined",
      assignees: [],
      date: "",
      status: "bank",
      recurrence: {
        ...DEFAULT_TASK_RECURRENCE,
        weekdayTimings: {},
      },
    };
  }

  return {
    title: task.title,
    description: task.description,
    link: task.link,
    hours: String(task.hours || 0),
    startTime: task.startTime || "",
    group: task.group,
    assignees: getTaskSeriesAssignees(task),
    date: task.date || task.recurrence?.fromDate || "",
    status: task.status,
    recurrence: getTaskRecurrence(task),
  };
}

function updateLinkedTaskFamily(
  tasks: PlannerTask[],
  taskId: string,
  updater: (task: PlannerTask, nowIso: string) => PlannerTask,
) {
  const sourceTask = tasks.find((task) => task.id === taskId);
  if (!sourceTask) {
    return tasks;
  }

  const linkedTasks = getTaskLinkedTasks(tasks, taskId);
  const linkedTaskIds = new Set(linkedTasks.map((task) => task.id));
  if (linkedTaskIds.size === 0) {
    return tasks;
  }

  const nowIso = new Date().toISOString();

  return tasks.map((task) => {
    if (!linkedTaskIds.has(task.id)) {
      return task;
    }

    return updater(
      {
        ...task,
        seriesId: getTaskSeriesId(task),
        seriesAssignees: getTaskFallbackAssignees(task),
        recurrence: getTaskRecurrence(task),
      },
      nowIso,
    );
  });
}

export function moveTaskToTimelineSlot(
  tasks: PlannerTask[],
  taskId: string,
  participantId: ParticipantId,
  dateKey: string,
  startTime: string,
  currentMonth: Date,
  scope: TaskMutationScope = "series",
) {
  const scopedTasks = scope === "instance" ? detachTaskInstance(tasks, taskId) : tasks;
  const sourceTask = scopedTasks.find((task) => task.id === taskId);
  if (!sourceTask) {
    return scopedTasks;
  }

  const targetSpec: ContainerSpec = {
    kind: "calendar",
    assignee: participantId,
    date: dateKey,
    group: sourceTask.group,
  };
  const sourceContainerId = getTaskContainerId(sourceTask);
  const targetContainerId = getContainerId(targetSpec);
  const movedTasks =
    sourceContainerId === targetContainerId
      ? scopedTasks
      : moveTaskToContainer(
          scopedTasks,
          taskId,
          targetSpec,
          getTasksForContainer(scopedTasks, targetSpec).length,
          currentMonth,
        );
  const normalizedStartTime = normalizeTaskStartTime(startTime) || startTime;
  const normalizedHours =
    sourceTask.hours > 0 ? Math.max(0.5, Math.round(sourceTask.hours * 2) / 2) : 1;

  if (sourceTask.status === "bank" || shouldSyncTaskTimeAcrossFamily(sourceTask.group)) {
    return updateLinkedTaskFamily(movedTasks, taskId, (task, nowIso) => ({
      ...task,
      startTime: normalizedStartTime,
      hours: task.hours > 0 ? Math.max(0.5, Math.round(task.hours * 2) / 2) : normalizedHours,
      updatedAt: nowIso,
    }));
  }

  const nowIso = new Date().toISOString();
  return movedTasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          startTime: normalizedStartTime,
          hours: normalizedHours,
          updatedAt: nowIso,
        }
      : task,
  );
}

export function moveTaskToUntimedZone(
  tasks: PlannerTask[],
  taskId: string,
  participantId: ParticipantId,
  dateKey: string,
  currentMonth: Date,
  scope: TaskMutationScope = "series",
) {
  const scopedTasks = scope === "instance" ? detachTaskInstance(tasks, taskId) : tasks;
  const sourceTask = scopedTasks.find((task) => task.id === taskId);
  if (!sourceTask) {
    return scopedTasks;
  }

  const targetSpec: ContainerSpec = {
    kind: "calendar",
    assignee: participantId,
    date: dateKey,
    group: sourceTask.group,
  };
  const sourceContainerId = getTaskContainerId(sourceTask);
  const targetContainerId = getContainerId(targetSpec);
  const movedTasks =
    sourceContainerId === targetContainerId
      ? scopedTasks
      : moveTaskToContainer(
          scopedTasks,
          taskId,
          targetSpec,
          getTasksForContainer(scopedTasks, targetSpec).length,
          currentMonth,
        );

  if (sourceTask.status === "bank" || shouldSyncTaskTimeAcrossFamily(sourceTask.group)) {
    return updateLinkedTaskFamily(movedTasks, taskId, (task, nowIso) => ({
      ...task,
      startTime: null,
      updatedAt: nowIso,
    }));
  }

  const nowIso = new Date().toISOString();
  return movedTasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          startTime: null,
          updatedAt: nowIso,
        }
      : task,
  );
}

export function resizeTaskTimelineDuration(
  tasks: PlannerTask[],
  taskId: string,
  nextHours: number,
  scope: TaskMutationScope = "series",
) {
  const scopedTasks = scope === "instance" ? detachTaskInstance(tasks, taskId) : tasks;
  const sourceTask = scopedTasks.find((task) => task.id === taskId);
  if (!sourceTask) {
    return scopedTasks;
  }

  const normalizedHours = Math.max(0.5, Math.min(12, Math.round(nextHours * 2) / 2));

  if (shouldSyncTaskTimeAcrossFamily(sourceTask.group)) {
    return updateLinkedTaskFamily(scopedTasks, taskId, (task, nowIso) => ({
      ...task,
      hours: normalizedHours,
      updatedAt: nowIso,
    }));
  }

  const nowIso = new Date().toISOString();
  return scopedTasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          hours: normalizedHours,
          updatedAt: nowIso,
        }
      : task,
  );
}

export function getTaskHoursForParticipant(tasks: PlannerTask[], participantId: ParticipantId) {
  return tasks
    .filter((task) => task.status === "calendar" && task.assignee === participantId)
    .reduce((total, task) => total + task.hours, 0);
}

export function getBankTaskCount(tasks: PlannerTask[]) {
  return tasks.filter((task) => task.status === "bank").length;
}

export function getScheduledTaskCount(tasks: PlannerTask[]) {
  return tasks.filter((task) => task.status === "calendar").length;
}

export function getDailyHours(tasks: PlannerTask[], participantId: ParticipantId, dateKey: string) {
  return tasks
    .filter(
      (task) =>
        task.status === "calendar" &&
        task.assignee === participantId &&
        task.date === dateKey,
    )
    .reduce((total, task) => total + task.hours, 0);
}
