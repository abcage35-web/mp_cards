import { useMemo, useRef } from "react";
import { format, parseISO } from "date-fns";

import { PARTICIPANTS, WEEKDAY_LABELS } from "@/app/planner/constants";
import type {
  CalendarDayGroupEntry,
  ParticipantMonthlyStat,
  ParticipantMonthlyTaskStat,
  PlannerDerivedCollections,
} from "@/app/planner/page-types";
import type { ParticipantId, PlannerTask, TaskGroupId } from "@/app/planner/types";

const EMPTY_TASK_LIST: PlannerTask[] = [];

function areTaskListsEqual(left: PlannerTask[], right: PlannerTask[]) {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function areDayGroupEntriesEqual(left: CalendarDayGroupEntry[], right: CalendarDayGroupEntry[]) {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index].groupId !== right[index].groupId || left[index].tasks !== right[index].tasks) {
      return false;
    }
  }

  return true;
}

function isDateWithinSelectedMonth(dateValue: string | null | undefined, currentMonth: Date) {
  if (!dateValue) {
    return false;
  }

  const date = parseISO(dateValue);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getFullYear() === currentMonth.getFullYear() &&
    date.getMonth() === currentMonth.getMonth()
  );
}

interface UsePlannerViewDataArgs {
  currentMonth: Date;
  monthDays: Date[];
  monthWeeks: Date[][];
  hideWeekends: boolean;
  sortedTasks: PlannerTask[];
  filteredTasks: PlannerTask[];
  orderedTaskGroupIds: TaskGroupId[];
  visibleOrderedTaskGroupIds: TaskGroupId[];
  statsParticipants: Array<(typeof PARTICIPANTS)[number]>;
  participantWorkHoursById: Record<ParticipantId, number>;
  workHoursPerDay: number;
  statsDialogParticipantId: ParticipantId | null;
}

export function usePlannerViewData({
  currentMonth,
  monthDays,
  monthWeeks,
  hideWeekends,
  sortedTasks,
  filteredTasks,
  orderedTaskGroupIds,
  visibleOrderedTaskGroupIds,
  statsParticipants,
  participantWorkHoursById,
  workHoursPerDay,
  statsDialogParticipantId,
}: UsePlannerViewDataArgs) {
  const bankTasksCacheRef = useRef(new Map<TaskGroupId, PlannerTask[]>());
  const calendarGroupTasksCacheRef = useRef(new Map<string, PlannerTask[]>());
  const calendarDayTasksCacheRef = useRef(new Map<string, PlannerTask[]>());
  const calendarDayEntriesCacheRef = useRef(new Map<string, CalendarDayGroupEntry[]>());

  const visibleWeekdayEntries = useMemo(
    () =>
      WEEKDAY_LABELS.map((label, index) => ({ label, index })).filter(
        ({ index }) => !hideWeekends || index < 5,
      ),
    [hideWeekends],
  );

  const visibleMonthWeeks = useMemo(
    () =>
      monthWeeks.map((week) =>
        week.filter((day) => !hideWeekends || ((day.getDay() + 6) % 7) < 5),
      ),
    [hideWeekends, monthWeeks],
  );

  const visibleMonthDays = useMemo(() => visibleMonthWeeks.flat(), [visibleMonthWeeks]);

  const monthWorkingDayCount = useMemo(
    () =>
      monthDays.reduce((total, day) => {
        const weekdayIndex = (day.getDay() + 6) % 7;
        if (
          weekdayIndex >= 5 ||
          !isDateWithinSelectedMonth(format(day, "yyyy-MM-dd"), currentMonth)
        ) {
          return total;
        }

        return total + 1;
      }, 0),
    [currentMonth, monthDays],
  );

  const participantMonthlyStats = useMemo(() => {
    const statsById = new Map<
      ParticipantId,
      {
        capacityHours: number;
        plannedHours: number;
        taskCount: number;
        tasksByTitle: Map<string, ParticipantMonthlyTaskStat>;
      }
    >(
      PARTICIPANTS.map((participant) => [
        participant.id,
        {
          capacityHours:
            Math.round(
              monthWorkingDayCount *
                (participantWorkHoursById[participant.id] || workHoursPerDay) *
                10,
            ) / 10,
          plannedHours: 0,
          taskCount: 0,
          tasksByTitle: new Map<string, ParticipantMonthlyTaskStat>(),
        },
      ]),
    );

    for (const task of sortedTasks) {
      if (
        task.status !== "calendar" ||
        !task.assignee ||
        !isDateWithinSelectedMonth(task.date, currentMonth)
      ) {
        continue;
      }

      const participantStats = statsById.get(task.assignee);
      if (!participantStats) {
        continue;
      }

      participantStats.plannedHours += task.hours;
      participantStats.taskCount += 1;

      const title = task.title.trim() || "Без названия";
      const existingTaskStat = participantStats.tasksByTitle.get(title);
      if (existingTaskStat) {
        existingTaskStat.hours += task.hours;
        existingTaskStat.occurrences += 1;
      } else {
        participantStats.tasksByTitle.set(title, {
          title,
          hours: task.hours,
          occurrences: 1,
        });
      }
    }

    return statsParticipants
      .map((participant) => {
        const rawStat = statsById.get(participant.id);
        const capacityHours = rawStat?.capacityHours || 0;
        const plannedHours = Math.round((rawStat?.plannedHours || 0) * 10) / 10;
        const remainingHours = Math.round((capacityHours - plannedHours) * 10) / 10;
        const overloadHours = Math.max(
          0,
          Math.round((plannedHours - capacityHours) * 10) / 10,
        );
        const usagePercent =
          capacityHours > 0 ? Math.round((plannedHours / capacityHours) * 100) : 0;
        const tasks = Array.from(rawStat?.tasksByTitle.values() || []).sort((left, right) => {
          if (right.hours !== left.hours) {
            return right.hours - left.hours;
          }

          if (right.occurrences !== left.occurrences) {
            return right.occurrences - left.occurrences;
          }

          return left.title.localeCompare(right.title, "ru");
        });

        return {
          participantId: participant.id,
          capacityHours,
          plannedHours,
          remainingHours,
          overloadHours,
          usagePercent,
          taskCount: rawStat?.taskCount || 0,
          tasks,
        } satisfies ParticipantMonthlyStat;
      })
      .sort((left, right) => {
        if ((right.overloadHours > 0) !== (left.overloadHours > 0)) {
          return right.overloadHours > 0 ? 1 : -1;
        }

        if (right.usagePercent !== left.usagePercent) {
          return right.usagePercent - left.usagePercent;
        }

        if (right.plannedHours !== left.plannedHours) {
          return right.plannedHours - left.plannedHours;
        }

        return left.participantId.localeCompare(right.participantId, "en");
      });
  }, [
    currentMonth,
    monthWorkingDayCount,
    participantWorkHoursById,
    sortedTasks,
    statsParticipants,
    workHoursPerDay,
  ]);

  const activeParticipantMonthlyStat = useMemo(
    () =>
      statsDialogParticipantId
        ? participantMonthlyStats.find((stat) => stat.participantId === statsDialogParticipantId) ||
          null
        : null,
    [participantMonthlyStats, statsDialogParticipantId],
  );

  const derivedTaskCollections = useMemo(() => {
    const rawBankTasksByGroup = new Map<TaskGroupId, PlannerTask[]>();
    const rawCalendarGroupTasksByKey = new Map<string, PlannerTask[]>();
    const rawCalendarDayTasksByKey = new Map<string, PlannerTask[]>();
    const dayHoursByKey = new Map<string, number>();
    const participantStatsById = new Map<
      ParticipantId,
      {
        taskCount: number;
        hours: number;
      }
    >(
      PARTICIPANTS.map((participant) => [
        participant.id,
        {
          taskCount: 0,
          hours: 0,
        },
      ]),
    );

    orderedTaskGroupIds.forEach((groupId) => {
      rawBankTasksByGroup.set(groupId, []);
    });

    for (const task of filteredTasks) {
      if (task.status === "bank") {
        const list = rawBankTasksByGroup.get(task.group) || [];
        list.push(task);
        rawBankTasksByGroup.set(task.group, list);
        continue;
      }

      if (!task.assignee || !task.date) {
        continue;
      }

      const dayKey = `${task.assignee}:${task.date}`;
      const groupKey = `${dayKey}:${task.group}`;

      const dayList = rawCalendarDayTasksByKey.get(dayKey) || [];
      dayList.push(task);
      rawCalendarDayTasksByKey.set(dayKey, dayList);

      const groupList = rawCalendarGroupTasksByKey.get(groupKey) || [];
      groupList.push(task);
      rawCalendarGroupTasksByKey.set(groupKey, groupList);

      dayHoursByKey.set(dayKey, (dayHoursByKey.get(dayKey) || 0) + task.hours);

      const participantStats = participantStatsById.get(task.assignee);
      if (participantStats) {
        participantStats.taskCount += 1;
        participantStats.hours += task.hours;
      }
    }

    const bankTasksByGroup = new Map<TaskGroupId, PlannerTask[]>();
    orderedTaskGroupIds.forEach((groupId) => {
      const nextList = rawBankTasksByGroup.get(groupId) || EMPTY_TASK_LIST;
      const previousList = bankTasksCacheRef.current.get(groupId);
      bankTasksByGroup.set(
        groupId,
        previousList && areTaskListsEqual(previousList, nextList)
          ? previousList
          : nextList.length > 0
            ? nextList
            : EMPTY_TASK_LIST,
      );
    });
    bankTasksCacheRef.current = bankTasksByGroup;

    const calendarGroupTasksByKey = new Map<string, PlannerTask[]>();
    rawCalendarGroupTasksByKey.forEach((nextList, groupKey) => {
      const previousList = calendarGroupTasksCacheRef.current.get(groupKey);
      calendarGroupTasksByKey.set(
        groupKey,
        previousList && areTaskListsEqual(previousList, nextList) ? previousList : nextList,
      );
    });
    calendarGroupTasksCacheRef.current = calendarGroupTasksByKey;

    const calendarDayTasksByKey = new Map<string, PlannerTask[]>();
    rawCalendarDayTasksByKey.forEach((nextList, dayKey) => {
      const previousList = calendarDayTasksCacheRef.current.get(dayKey);
      calendarDayTasksByKey.set(
        dayKey,
        previousList && areTaskListsEqual(previousList, nextList) ? previousList : nextList,
      );
    });
    calendarDayTasksCacheRef.current = calendarDayTasksByKey;

    const calendarDayEntriesByKey = new Map<string, CalendarDayGroupEntry[]>();
    PARTICIPANTS.forEach((participant) => {
      monthDays.forEach((day) => {
        const dayKey = `${participant.id}:${format(day, "yyyy-MM-dd")}`;
        const nextEntries = visibleOrderedTaskGroupIds.map((groupId) => ({
          groupId,
          tasks: calendarGroupTasksByKey.get(`${dayKey}:${groupId}`) || EMPTY_TASK_LIST,
        }));
        const previousEntries = calendarDayEntriesCacheRef.current.get(dayKey);

        calendarDayEntriesByKey.set(
          dayKey,
          previousEntries && areDayGroupEntriesEqual(previousEntries, nextEntries)
            ? previousEntries
            : nextEntries,
        );
      });
    });
    calendarDayEntriesCacheRef.current = calendarDayEntriesByKey;

    return {
      bankTasksByGroup,
      calendarDayTasksByKey,
      calendarDayEntriesByKey,
      dayHoursByKey,
      participantStatsById,
    } satisfies PlannerDerivedCollections;
  }, [filteredTasks, monthDays, orderedTaskGroupIds, visibleOrderedTaskGroupIds]);

  return {
    visibleWeekdayEntries,
    visibleMonthWeeks,
    visibleMonthDays,
    monthWorkingDayCount,
    participantMonthlyStats,
    activeParticipantMonthlyStat,
    derivedTaskCollections,
  };
}
