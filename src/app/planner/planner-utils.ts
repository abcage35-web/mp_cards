import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ru } from "date-fns/locale";

import { PARTICIPANTS } from "./constants";
import type {
  ContainerSpec,
  ParticipantId,
  PlannerState,
  PlannerTask,
  PlannerTaskInput,
  TaskFormValues,
} from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function uniqueParticipantIds(ids: ParticipantId[]) {
  return ids.filter((id, index) => PARTICIPANTS.some((participant) => participant.id === id) && ids.indexOf(id) === index);
}

function makeTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function shouldScheduleTask(input: PlannerTaskInput) {
  return input.assignees.length > 0 && Boolean(input.date);
}

export function createEmptyPlannerState(): PlannerState {
  const nowIso = new Date().toISOString();

  return {
    version: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
    tasks: [],
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
  };
}

export function moveTaskToContainer(
  tasks: PlannerTask[],
  taskId: string,
  targetSpec: ContainerSpec,
  targetIndex: number,
) {
  const sourceTask = tasks.find((task) => task.id === taskId);
  if (!sourceTask) {
    return tasks;
  }

  const nowIso = new Date().toISOString();
  const sourceContainerId = getTaskContainerId(sourceTask);
  const movedTask = patchTaskWithContainer(
    {
      ...sourceTask,
      updatedAt: nowIso,
    },
    targetSpec,
  );
  const targetContainerId = getTaskContainerId(movedTask);

  const withoutMovedTask = tasks.filter((task) => task.id !== taskId).map((task) => ({ ...task }));
  const targetList = getTasksForContainer(withoutMovedTask, getTaskContainerSpec(movedTask));
  const insertIndex = clamp(targetIndex, 0, targetList.length);
  const nextTargetList = [...targetList];
  nextTargetList.splice(insertIndex, 0, movedTask);

  const orderMap = new Map<string, number>();
  nextTargetList.forEach((task, index) => {
    orderMap.set(task.id, index);
  });

  if (sourceContainerId !== targetContainerId) {
    const sourceList = getTasksForContainer(withoutMovedTask, getTaskContainerSpec(sourceTask));
    sourceList.forEach((task, index) => {
      orderMap.set(task.id, index);
    });
  }

  const nextTasks = withoutMovedTask.map((task) =>
    orderMap.has(task.id)
      ? {
          ...task,
          order: orderMap.get(task.id) ?? task.order,
        }
      : task,
  );

  nextTasks.push({
    ...movedTask,
    order: orderMap.get(movedTask.id) ?? movedTask.order,
  });

  return normalizeTaskOrders(nextTasks);
}

export function deletePlannerTask(tasks: PlannerTask[], taskId: string) {
  return normalizeTaskOrders(tasks.filter((task) => task.id !== taskId));
}

export function buildTaskInput(values: TaskFormValues): PlannerTaskInput {
  const hoursValue = Number(values.hours);
  const assignees = uniqueParticipantIds(values.assignees);
  const date = values.date || null;
  const status = assignees.length > 0 && date ? "calendar" : values.status;

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    link: values.link.trim(),
    hours: Number.isFinite(hoursValue) ? Math.max(0, Math.round(hoursValue * 10) / 10) : 0,
    group: values.group,
    assignees,
    date,
    status,
  };
}

export function upsertPlannerTask(
  tasks: PlannerTask[],
  input: PlannerTaskInput,
  editingTaskId?: string,
) {
  const nowIso = new Date().toISOString();
  const previousTask = editingTaskId ? tasks.find((task) => task.id === editingTaskId) : null;
  if (editingTaskId && !previousTask) {
    return tasks;
  }

  const withoutPreviousTask = editingTaskId
    ? tasks.filter((task) => task.id !== editingTaskId).map((task) => ({ ...task }))
    : tasks.map((task) => ({ ...task }));

  const scheduleToCalendars = shouldScheduleTask(input);
  const assignees = scheduleToCalendars
    ? input.assignees
    : input.assignees.length > 0
      ? [input.assignees[0]]
      : [null];

  const createdTasks = assignees.map((assignee, index) => {
    const createdAt = previousTask && index === 0 ? previousTask.createdAt : nowIso;
    const nextTask: PlannerTask = {
      id: previousTask && index === 0 ? previousTask.id : makeTaskId(),
      title: input.title,
      description: input.description,
      link: input.link,
      hours: input.hours,
      group: input.group,
      assignee,
      date: input.date,
      status: scheduleToCalendars && assignee && input.date ? "calendar" : "bank",
      order: 0,
      createdAt,
      updatedAt: nowIso,
    };

    const targetTasks = getTasksForContainer(withoutPreviousTask, getTaskContainerSpec(nextTask));
    const sameContainer =
      previousTask && getTaskContainerId(previousTask) === getTaskContainerId(nextTask) && index === 0;

    return {
      ...nextTask,
      order: sameContainer ? previousTask.order : targetTasks.length + index,
    };
  });

  return normalizeTaskOrders([...withoutPreviousTask, ...createdTasks]);
}

export function isDateToday(date: Date) {
  return isSameDay(date, new Date());
}

export function getMonthInputRange(currentMonth: Date) {
  return {
    min: format(startOfMonth(currentMonth), "yyyy-MM-dd"),
    max: format(endOfMonth(currentMonth), "yyyy-MM-dd"),
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
  return format(date, "yyyy-MM") === format(currentMonth, "yyyy-MM");
}

export function createTaskFormValues(task?: PlannerTask): TaskFormValues {
  if (!task) {
    return {
      title: "",
      description: "",
      link: "",
      hours: "1",
      group: "undefined",
      assignees: [],
      date: "",
      status: "bank",
    };
  }

  return {
    title: task.title,
    description: task.description,
    link: task.link,
    hours: String(task.hours || 0),
    group: task.group,
    assignees: task.assignee ? [task.assignee] : [],
    date: task.date || "",
    status: task.status,
  };
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
