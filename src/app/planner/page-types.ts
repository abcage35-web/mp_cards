import type { ParticipantId, PlannerTask, TaskGroupId } from "./types";

export interface CalendarDayGroupEntry {
  groupId: TaskGroupId;
  tasks: PlannerTask[];
}

export interface ParticipantMonthlyTaskStat {
  title: string;
  hours: number;
  occurrences: number;
}

export interface ParticipantMonthlyStat {
  participantId: ParticipantId;
  capacityHours: number;
  plannedHours: number;
  remainingHours: number;
  overloadHours: number;
  usagePercent: number;
  taskCount: number;
  tasks: ParticipantMonthlyTaskStat[];
}

export interface PlannerDerivedCollections {
  bankTasksByGroup: Map<TaskGroupId, PlannerTask[]>;
  calendarDayTasksByKey: Map<string, PlannerTask[]>;
  calendarDayEntriesByKey: Map<string, CalendarDayGroupEntry[]>;
  dayHoursByKey: Map<string, number>;
  participantStatsById: Map<
    ParticipantId,
    {
      taskCount: number;
      hours: number;
    }
  >;
}
