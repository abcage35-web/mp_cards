export type TaskGroupId =
  | "planned"
  | "new"
  | "project"
  | "planned-meeting"
  | "new-meeting"
  | "off-hours"
  | "undefined";

export type ParticipantId = "sasha-nekrasov" | "sasha-manokhin" | "anton-bober";

export type TaskStatus = "bank" | "calendar";
export type TaskProgressStatus = "cancelled" | "in-progress" | "done";
export type TaskMutationScope = "series" | "instance";
export type TaskRecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";
export type TaskRecurrenceUntilMode = "forever" | "until";

export interface ParticipantWorkSchedule {
  startTime: string;
  endTime: string;
}

export interface TaskRecurrenceWeekdayTiming {
  startTime: string | null;
  hours: number;
}

export interface TaskRecurrence {
  frequency: TaskRecurrenceFrequency;
  interval: number;
  weekdays: number[];
  weekdayTimings: Partial<Record<number, TaskRecurrenceWeekdayTiming>>;
  fromDate: string;
  untilMode: TaskRecurrenceUntilMode;
  untilDate: string;
  exclusions: string[];
}

export interface PlannerSettings {
  workHoursPerDay: number;
  groupOrder: TaskGroupId[];
  calendarDisplayMode: "day" | "time";
  hideWeekends: boolean;
  interleaveWeeksByParticipant: boolean;
  participantWorkSchedules: Record<ParticipantId, ParticipantWorkSchedule>;
}

export interface PlannerTask {
  id: string;
  seriesId: string;
  seriesAssignees: ParticipantId[];
  recurrenceGroupId: string | null;
  recurrence: TaskRecurrence;
  progressStatus: TaskProgressStatus;
  title: string;
  description: string;
  link: string;
  hours: number;
  startTime: string | null;
  group: TaskGroupId;
  assignee: ParticipantId | null;
  date: string | null;
  status: TaskStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerState {
  version: number;
  createdAt: string;
  updatedAt: string;
  settings: PlannerSettings;
  tasks: PlannerTask[];
}

export interface ContainerSpec {
  kind: TaskStatus;
  group: TaskGroupId;
  assignee?: ParticipantId;
  date?: string;
}

export interface PlannerTaskInput {
  title: string;
  description: string;
  link: string;
  hours: number;
  startTime: string | null;
  group: TaskGroupId;
  assignees: ParticipantId[];
  date: string | null;
  status: TaskStatus;
  recurrence: TaskRecurrence;
}

export interface TaskFormValues {
  title: string;
  description: string;
  link: string;
  hours: string;
  startTime: string;
  group: TaskGroupId;
  assignees: ParticipantId[];
  date: string;
  status: TaskStatus;
  recurrence: TaskRecurrence;
}

export interface PlannerSaveSummary {
  action: string;
  message: string;
  taskId?: string;
}

export interface PlannerStorageInfo {
  stateFile: string;
  logFile: string;
}

export interface PlannerStateResponse {
  ok: boolean;
  payload: PlannerState;
  storage: PlannerStorageInfo;
  stats: {
    tasksTotal: number;
    scheduledTotal: number;
    bankTotal: number;
  };
}
