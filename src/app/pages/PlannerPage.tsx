import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { format, parseISO } from "date-fns";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/utils";
import { PlannerBankSidebar } from "@/app/planner/PlannerBankSidebar";
import { PlannerCalendarCard } from "@/app/planner/PlannerCalendarCard";
import { PlannerDeleteConfirmDialog } from "@/app/planner/PlannerDeleteConfirmDialog";
import { PlannerFiltersBar } from "@/app/planner/PlannerFiltersBar";
import { PlannerHeroSection } from "@/app/planner/PlannerHeroSection";
import { PlannerMonthlyStatsDialog } from "@/app/planner/PlannerMonthlyStatsDialog";
import { PlannerMonthlyStatsSection } from "@/app/planner/PlannerMonthlyStatsSection";
import { PlannerTaskDialog } from "@/app/planner/PlannerTaskDialog";
import { PlannerTimeScopeAlert } from "@/app/planner/PlannerTimeScopeAlert";
import { usePlannerViewData } from "@/app/planner/usePlannerViewData";
import {
  DEFAULT_TASK_GROUP_ORDER,
  DEFAULT_TASK_RECURRENCE,
  DEFAULT_WORK_HOURS_PER_DAY,
  DEFAULT_TASK_FORM_VALUES,
  PARTICIPANTS,
  TASK_GROUPS,
  TASK_PROGRESS_STATUSES,
} from "@/app/planner/constants";
import { fetchPlannerState, persistPlannerState } from "@/app/planner/planner-service";
import {
  buildMonthGrid,
  buildTaskInput,
  clonePlannerTask,
  createEmptyPlannerState,
  createTaskFormValues,
  deletePlannerTask,
  detachTaskInstance,
  getBankTaskCount,
  getCurrentMonthLabel,
  getMonthInputRange,
  getParticipantNames,
  getParticipantWorkHoursPerDay,
  getOrderedTaskGroups,
  getPlannerSettings,
  getRecurrenceSummary,
  getScheduledTaskCount,
  getTaskLinkedTasks,
  getTaskPrimaryTask,
  getTaskSeriesAssignees,
  isDateWithinCurrentMonth,
  moveTaskToContainer,
  moveTaskToTimelineSlot,
  moveTaskToUntimedZone,
  normalizeTaskGroupOrder,
  normalizeTaskStartTime,
  normalizeWorkHoursPerDay,
  resizeTaskTimelineDuration,
  shouldPromptTaskScope,
  sortPlannerTasks,
  updateTaskSeriesProgressStatus,
  upsertPlannerTask,
} from "@/app/planner/planner-utils";
import type {
  ContainerSpec,
  ParticipantId,
  PlannerSaveSummary,
  PlannerState,
  PlannerStorageInfo,
  PlannerTask,
  TaskProgressStatus,
  TaskGroupId,
  TaskFormValues,
  TaskMutationScope,
} from "@/app/planner/types";

type SaveStatus = "loading" | "dirty" | "saving" | "saved" | "error";

interface TaskDialogState {
  open: boolean;
  mode: "create" | "edit";
  taskId?: string;
}

interface PlannerPageProps {
  standalone?: boolean;
}

interface PendingTimeScopeActionBase {
  taskId: string;
  taskTitle: string;
}

type PendingTimeScopeAction =
  | (PendingTimeScopeActionBase & {
      kind: "move";
      participantId: ParticipantId;
      dateKey: string;
      startTime: string;
    })
  | (PendingTimeScopeActionBase & {
      kind: "clear";
      participantId: ParticipantId;
      dateKey: string;
    })
  | (PendingTimeScopeActionBase & {
      kind: "resize";
      nextHours: number;
    })
  | (PendingTimeScopeActionBase & {
      kind: "save";
      input: ReturnType<typeof buildTaskInput>;
      saveMessage: string;
    });

const COLLAPSED_BANK_GROUPS_STORAGE_KEY = "planner:collapsed-bank-groups";
const ALL_TASK_GROUP_IDS = TASK_GROUPS.map((group) => group.id) as TaskGroupId[];
const ALL_TASK_PROGRESS_STATUSES = TASK_PROGRESS_STATUSES.map((status) => status.id) as TaskProgressStatus[];
const PLANNER_YEAR = 2026;
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index),
  label: getCurrentMonthLabel(new Date(PLANNER_YEAR, index, 1)),
}));

export function PlannerPage({ standalone = false }: PlannerPageProps) {
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => {
    const now = new Date();
    return now.getFullYear() === PLANNER_YEAR ? now.getMonth() : 0;
  });
  const currentMonth = useMemo(
    () => new Date(PLANNER_YEAR, selectedMonthIndex, 1),
    [selectedMonthIndex],
  );
  const monthLabel = useMemo(() => getCurrentMonthLabel(currentMonth), [currentMonth]);
  const monthDays = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);
  const monthWeeks = useMemo(() => {
    const weeks: Date[][] = [];

    for (let index = 0; index < monthDays.length; index += 7) {
      weeks.push(monthDays.slice(index, index + 7));
    }

    return weeks;
  }, [monthDays]);
  const monthRange = useMemo(() => getMonthInputRange(currentMonth), [currentMonth]);

  const [plannerState, setPlannerState] = useState<PlannerState | null>(null);
  const [storageInfo, setStorageInfo] = useState<PlannerStorageInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [saveLabel, setSaveLabel] = useState("Загружаем состояние...");
  const [dialogState, setDialogState] = useState<TaskDialogState>({ open: false, mode: "create" });
  const [formValues, setFormValues] = useState<TaskFormValues>(DEFAULT_TASK_FORM_VALUES);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingTimeScopeAction, setPendingTimeScopeAction] = useState<PendingTimeScopeAction | null>(null);
  const [visibleParticipantIds, setVisibleParticipantIds] = useState<ParticipantId[]>(
    PARTICIPANTS.map((participant) => participant.id),
  );
  const [visibleTaskGroupIds, setVisibleTaskGroupIds] = useState<TaskGroupId[]>(ALL_TASK_GROUP_IDS);
  const [visibleTaskProgressStatuses, setVisibleTaskProgressStatuses] = useState<TaskProgressStatus[]>(
    ALL_TASK_PROGRESS_STATUSES,
  );
  const [isCalendarCompactMode, setIsCalendarCompactMode] = useState(false);
  const [isBankVisible, setIsBankVisible] = useState(true);
  const [statsDialogParticipantId, setStatsDialogParticipantId] = useState<ParticipantId | null>(null);
  const [collapsedBankGroupIds, setCollapsedBankGroupIds] = useState<TaskGroupId[]>([]);
  const [workHoursDraft, setWorkHoursDraft] = useState(String(DEFAULT_WORK_HOURS_PER_DAY));
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());

  const plannerStateRef = useRef<PlannerState | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const saveVersionRef = useRef(0);
  const saveStatusRef = useRef<SaveStatus>("loading");
  const suppressTaskOpenUntilRef = useRef(0);
  const dragMutationDepthRef = useRef(0);
  const deferredSaveRef = useRef<{
    state: PlannerState;
    summary: PlannerSaveSummary;
  } | null>(null);
  const pendingSummaryRef = useRef<PlannerSaveSummary>({
    action: "init",
    message: "Planner state initialized",
  });
  const {
    visibleWeekdayEntries,
    visibleMonthWeeks,
    visibleMonthDays,
    monthWorkingDayCount,
    participantMonthlyStats,
    activeParticipantMonthlyStat,
    derivedTaskCollections,
  } = usePlannerViewData({
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
  });

  const queueSave = useCallback((nextState: PlannerState, summary: PlannerSaveSummary) => {
    pendingSummaryRef.current = summary;
    setSaveStatus("dirty");
    setSaveLabel("Есть несохраненные изменения");
    saveVersionRef.current += 1;
    const currentVersion = saveVersionRef.current;

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      saveTimeoutRef.current = null;
      setSaveStatus("saving");
      setSaveLabel("Сохраняем изменения в файл...");

      try {
        const response = await persistPlannerState(nextState, summary);
        setStorageInfo(response.storage);

        if (currentVersion === saveVersionRef.current) {
          setSaveStatus("saved");
          setSaveLabel(`Сохранено ${format(parseISO(response.payload.updatedAt), "HH:mm:ss")}`);
        }
      } catch (error) {
        setSaveStatus("error");
        setSaveLabel(error instanceof Error ? error.message : "Ошибка сохранения");
      }
    }, 450);
  }, []);

  const beginDeferredDragPersistence = useCallback(() => {
    dragMutationDepthRef.current += 1;

    if (dragMutationDepthRef.current !== 1) {
      return;
    }

    if (
      !deferredSaveRef.current &&
      plannerStateRef.current &&
      (saveStatusRef.current === "dirty" || saveTimeoutRef.current !== null)
    ) {
      deferredSaveRef.current = {
        state: plannerStateRef.current,
        summary: pendingSummaryRef.current,
      };
    }

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  const endDeferredDragPersistence = useCallback(() => {
    if (dragMutationDepthRef.current > 0) {
      dragMutationDepthRef.current -= 1;
    }

    if (dragMutationDepthRef.current > 0) {
      return;
    }

    const deferredSave = deferredSaveRef.current;
    deferredSaveRef.current = null;

    if (!deferredSave) {
      return;
    }

    queueSave(deferredSave.state, deferredSave.summary);
  }, [queueSave]);

  const handleDragActivityChange = useCallback(
    (active: boolean) => {
      if (active) {
        beginDeferredDragPersistence();
        return;
      }

      endDeferredDragPersistence();
    },
    [beginDeferredDragPersistence, endDeferredDragPersistence],
  );

  const applyPlannerMutation = useCallback(
    (updater: (state: PlannerState) => PlannerState, summary: PlannerSaveSummary) => {
      const currentState = plannerStateRef.current;
      if (!currentState) {
        return;
      }

      const nextDraft = updater(currentState);
      if (nextDraft === currentState) {
        return;
      }

      const nextState: PlannerState = {
        ...nextDraft,
        updatedAt: new Date().toISOString(),
        settings: getPlannerSettings(nextDraft),
      };

      plannerStateRef.current = nextState;
      startTransition(() => {
        setPlannerState(nextState);
      });

      if (dragMutationDepthRef.current > 0) {
        pendingSummaryRef.current = summary;
        deferredSaveRef.current = {
          state: nextState,
          summary,
        };
        setSaveStatus("dirty");
        setSaveLabel("Изменения будут сохранены после завершения перетаскивания");
      } else {
        queueSave(nextState, summary);
      }
    },
    [queueSave],
  );

  const applyTaskMutation = useCallback(
    (updater: (tasks: PlannerTask[]) => PlannerTask[], summary: PlannerSaveSummary) => {
      applyPlannerMutation(
        (state) => {
          const nextTasks = updater(state.tasks);
          if (nextTasks === state.tasks) {
            return state;
          }

          return {
            ...state,
            tasks: nextTasks,
          };
        },
        summary,
      );
    },
    [applyPlannerMutation],
  );

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setSaveStatus("loading");
      setSaveLabel("Загружаем состояние...");

      try {
        const response = await fetchPlannerState();
        if (ignore) {
          return;
        }

        plannerStateRef.current = response.payload;
        setPlannerState(response.payload);
        setStorageInfo(response.storage);
        setLoadError(null);
        setSaveStatus("saved");
        setSaveLabel(`Состояние загружено ${format(parseISO(response.payload.updatedAt), "HH:mm:ss")}`);
      } catch (error) {
        if (ignore) {
          return;
        }

        const fallbackState = createEmptyPlannerState();
        plannerStateRef.current = fallbackState;
        setPlannerState(fallbackState);
        setLoadError(error instanceof Error ? error.message : "Не удалось загрузить состояние");
        setSaveStatus("error");
        setSaveLabel("API сохранения пока недоступен");
      }
    };

    void load();

    return () => {
      ignore = true;
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(COLLAPSED_BANK_GROUPS_STORAGE_KEY);
      if (!rawValue) {
        return;
      }

      const parsedValue = JSON.parse(rawValue);
      if (!Array.isArray(parsedValue)) {
        return;
      }

      const nextCollapsedGroupIds = parsedValue.filter((groupId): groupId is TaskGroupId =>
        TASK_GROUPS.some((group) => group.id === groupId),
      );

      setCollapsedBankGroupIds(nextCollapsedGroupIds);
    } catch {
      window.localStorage.removeItem(COLLAPSED_BANK_GROUPS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      COLLAPSED_BANK_GROUPS_STORAGE_KEY,
      JSON.stringify(collapsedBankGroupIds),
    );
  }, [collapsedBankGroupIds]);

  useEffect(() => {
    setWorkHoursDraft(String(workHoursPerDay));
  }, [workHoursPerDay]);

  useEffect(() => {
    saveStatusRef.current = saveStatus;
  }, [saveStatus]);

  useEffect(() => {
    const syncCurrentTime = () => {
      setCurrentTimeMs(Date.now());
    };

    syncCurrentTime();
    const intervalId = window.setInterval(syncCurrentTime, 30_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!plannerStateRef.current || saveStatus !== "dirty") {
        return;
      }

      void persistPlannerState(plannerStateRef.current, pendingSummaryRef.current, {
        keepalive: true,
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  const openCreateDialog = useCallback((groupId?: TaskGroupId) => {
    setFormValues({
      ...DEFAULT_TASK_FORM_VALUES,
      recurrence: {
        ...DEFAULT_TASK_FORM_VALUES.recurrence,
        weekdayTimings: {},
      },
      group: groupId || DEFAULT_TASK_FORM_VALUES.group,
    });
    setFormError(null);
    setDeleteConfirmOpen(false);
    setPendingTimeScopeAction(null);
    setDialogState({ open: true, mode: "create" });
  }, []);

  const suppressImmediateTaskReopen = useCallback((durationMs = 250) => {
    suppressTaskOpenUntilRef.current = Date.now() + durationMs;
  }, []);

  const closeTaskDialog = useCallback((durationMs = 250) => {
    suppressImmediateTaskReopen(durationMs);
    setFormError(null);
    setDeleteConfirmOpen(false);
    setPendingTimeScopeAction(null);
    setDialogState({ open: false, mode: "create" });
  }, [suppressImmediateTaskReopen]);

  const openEditDialog = useCallback((task: PlannerTask) => {
    if (Date.now() < suppressTaskOpenUntilRef.current) {
      return;
    }

    const primaryTask = getTaskPrimaryTask(sortedTasks, task.id) || task;
    setFormValues(createTaskFormValues(primaryTask));
    setFormError(null);
    setDeleteConfirmOpen(false);
    setPendingTimeScopeAction(null);
    setDialogState({ open: true, mode: "edit", taskId: task.id });
  }, [sortedTasks]);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      closeTaskDialog();
      return;
    }

    setDialogState((current) => ({ ...current, open }));
  }, [closeTaskDialog]);

  const toggleVisibleParticipant = useCallback((participantId: ParticipantId) => {
    setVisibleParticipantIds((current) => {
      if (current.includes(participantId)) {
        return current.filter((id) => id !== participantId);
      }

      return PARTICIPANTS.filter((participant) =>
        [...current, participantId].includes(participant.id),
      ).map((participant) => participant.id);
    });
  }, []);

  const goToPreviousMonth = useCallback(() => {
    setSelectedMonthIndex((current) => Math.max(0, current - 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setSelectedMonthIndex((current) => Math.min(11, current + 1));
  }, []);

  const toggleVisibleTaskGroup = useCallback((groupId: TaskGroupId, checked: boolean) => {
    setVisibleTaskGroupIds((current) => {
      if (checked) {
        return normalizeTaskGroupOrder([...current, groupId]);
      }

      return current.filter((id) => id !== groupId);
    });
  }, []);

  const toggleVisibleTaskProgressStatus = useCallback(
    (progressStatus: TaskProgressStatus, checked: boolean) => {
      setVisibleTaskProgressStatuses((current) => {
        if (checked) {
          return TASK_PROGRESS_STATUSES.filter((status) =>
            [...current, progressStatus].includes(status.id),
          ).map((status) => status.id);
        }

        return current.filter((id) => id !== progressStatus);
      });
    },
    [],
  );

  const moveTaskGroupOrder = useCallback(
    (draggedGroupId: TaskGroupId, targetGroupId: TaskGroupId) => {
      if (draggedGroupId === targetGroupId) {
        return;
      }

      applyPlannerMutation(
        (state) => {
          const currentOrder = normalizeTaskGroupOrder(getPlannerSettings(state).groupOrder);
          const fromIndex = currentOrder.indexOf(draggedGroupId);
          const toIndex = currentOrder.indexOf(targetGroupId);

          if (fromIndex === -1 || toIndex === -1) {
            return state;
          }

          const nextOrder = [...currentOrder];
          const [movedGroupId] = nextOrder.splice(fromIndex, 1);
          nextOrder.splice(toIndex, 0, movedGroupId);

          return {
            ...state,
            settings: {
              ...getPlannerSettings(state),
              groupOrder: nextOrder,
            },
          };
        },
        {
          action: "settings",
          message: "Обновлен порядок групп задач",
        },
      );
    },
    [applyPlannerMutation],
  );

  const commitTaskGroupOrder = useCallback(
    (nextOrderInput: TaskGroupId[]) => {
      const nextOrder = normalizeTaskGroupOrder(nextOrderInput);

      applyPlannerMutation(
        (state) => {
          const currentOrder = normalizeTaskGroupOrder(getPlannerSettings(state).groupOrder);

          if (currentOrder.join("|") === nextOrder.join("|")) {
            return state;
          }

          return {
            ...state,
            settings: {
              ...getPlannerSettings(state),
              groupOrder: nextOrder,
            },
          };
        },
        {
          action: "settings",
          message: "Обновлен порядок групп задач",
        },
      );
    },
    [applyPlannerMutation],
  );

  const resetTaskGroupOrder = useCallback(() => {
    applyPlannerMutation(
      (state) => ({
        ...state,
        settings: {
          ...getPlannerSettings(state),
          groupOrder: DEFAULT_TASK_GROUP_ORDER,
        },
      }),
      {
        action: "settings",
        message: "Порядок групп сброшен",
      },
    );
  }, [applyPlannerMutation]);

  const toggleAssignee = useCallback((participantId: ParticipantId) => {
    setFormValues((current) => ({
      ...current,
      assignees: current.assignees.includes(participantId)
        ? current.assignees.filter((id) => id !== participantId)
        : [...current.assignees, participantId],
    }));
  }, []);

  const toggleRecurrenceWeekday = useCallback((weekdayIndex: number) => {
    setFormValues((current) => {
      const isSelected = current.recurrence.weekdays.includes(weekdayIndex);
      const nextWeekdays = isSelected
        ? current.recurrence.weekdays.filter((day) => day !== weekdayIndex)
        : [...current.recurrence.weekdays, weekdayIndex].sort((left, right) => left - right);
      const nextWeekdayTimings = { ...current.recurrence.weekdayTimings };

      if (isSelected) {
        delete nextWeekdayTimings[weekdayIndex];
      } else if (!nextWeekdayTimings[weekdayIndex]) {
        const fallbackHours = Number(current.hours);
        nextWeekdayTimings[weekdayIndex] = {
          startTime: normalizeTaskStartTime(current.startTime),
          hours: Number.isFinite(fallbackHours)
            ? Math.max(0, Math.round(fallbackHours * 10) / 10)
            : 0,
        };
      }

      return {
        ...current,
        recurrence: {
          ...current.recurrence,
          weekdays: nextWeekdays,
          weekdayTimings: nextWeekdayTimings,
        },
      };
    });
  }, []);

  const updateRecurrenceWeekdayTiming = useCallback(
    (weekdayIndex: number, field: "startTime" | "hours", rawValue: string) => {
      setFormValues((current) => {
        const fallbackHours = Number(current.hours);
        const currentTiming = current.recurrence.weekdayTimings[weekdayIndex];
        const nextTiming = {
          startTime:
            field === "startTime"
              ? normalizeTaskStartTime(rawValue)
              : currentTiming?.startTime ?? normalizeTaskStartTime(current.startTime),
          hours:
            field === "hours"
              ? Number.isFinite(Number(rawValue))
                ? Math.max(0, Math.round(Number(rawValue) * 10) / 10)
                : 0
              : currentTiming?.hours ??
                (Number.isFinite(fallbackHours)
                  ? Math.max(0, Math.round(fallbackHours * 10) / 10)
                  : 0),
        };

        return {
          ...current,
          recurrence: {
            ...current.recurrence,
            weekdayTimings: {
              ...current.recurrence.weekdayTimings,
              [weekdayIndex]: nextTiming,
            },
          },
        };
      });
    },
    [],
  );

  const setTaskDateValue = useCallback((date: string) => {
    setFormValues((current) => ({
      ...current,
      date,
      recurrence: {
        ...current.recurrence,
        fromDate: date,
      },
    }));
  }, []);

  const toggleCollapsedBankGroup = useCallback((groupId: TaskGroupId) => {
    setCollapsedBankGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  }, []);

  const buildInstanceScopedInput = useCallback(
    (input: ReturnType<typeof buildTaskInput>, task: PlannerTask) => ({
      ...input,
      status: task.status,
      assignees: task.assignee ? [task.assignee] : input.assignees.slice(0, 1),
      date: task.date,
      recurrence: {
        ...DEFAULT_TASK_RECURRENCE,
        weekdayTimings: {},
        fromDate: task.date || "",
      },
    }),
    [],
  );

  const commitPendingTimeScopeAction = useCallback(
    (scope: TaskMutationScope) => {
      if (!pendingTimeScopeAction) {
        return;
      }

      const action = pendingTimeScopeAction;

      if (action.kind === "move") {
        applyTaskMutation(
          (tasks) =>
            moveTaskToTimelineSlot(
              tasks,
              action.taskId,
              action.participantId,
              action.dateKey,
              action.startTime,
              currentMonth,
              scope,
            ),
          {
            action: scope === "instance" ? "timeline-move-instance" : "timeline-move",
            message:
              scope === "instance"
                ? "Время обновлено только у выбранного дня задачи"
                : "Обновлено время задачи в календаре",
            taskId: action.taskId,
          },
        );
        setPendingTimeScopeAction(null);
        return;
      }

      if (action.kind === "clear") {
        applyTaskMutation(
          (tasks) =>
            moveTaskToUntimedZone(
              tasks,
              action.taskId,
              action.participantId,
              action.dateKey,
              currentMonth,
              scope,
            ),
          {
            action: scope === "instance" ? "timeline-clear-time-instance" : "timeline-clear-time",
            message:
              scope === "instance"
                ? "Время очищено только у выбранного дня задачи"
                : "У задачи очищено время внутри дня",
            taskId: action.taskId,
          },
        );
        setPendingTimeScopeAction(null);
        return;
      }

      if (action.kind === "resize") {
        applyTaskMutation(
          (tasks) => resizeTaskTimelineDuration(tasks, action.taskId, action.nextHours, scope),
          {
            action: scope === "instance" ? "timeline-resize-instance" : "timeline-resize",
            message:
              scope === "instance"
                ? "Длительность обновлена только у выбранного дня задачи"
                : "Обновлена длительность задачи",
            taskId: action.taskId,
          },
        );
        setPendingTimeScopeAction(null);
        return;
      }

      if (action.kind === "save") {
        applyTaskMutation(
          (tasks) => {
            if (scope === "series") {
              return upsertPlannerTask(tasks, action.input, currentMonth, action.taskId);
            }

            const detachedTasks = detachTaskInstance(tasks, action.taskId);
            const detachedTask = detachedTasks.find((task) => task.id === action.taskId);
            if (!detachedTask) {
              return detachedTasks;
            }

            return upsertPlannerTask(
              detachedTasks,
              buildInstanceScopedInput(action.input, detachedTask),
              currentMonth,
              action.taskId,
            );
          },
          {
            action: scope === "instance" ? "update-instance" : "update",
            message:
              scope === "instance"
                ? "Экземпляр задачи отделен от серии и обновлен отдельно"
                : action.saveMessage,
            taskId: action.taskId,
          },
        );
        setPendingTimeScopeAction(null);
        setDialogState({ open: false, mode: "create" });
      }
    },
    [applyTaskMutation, buildInstanceScopedInput, currentMonth, pendingTimeScopeAction],
  );

  const handleTaskMove = useCallback(
    (taskId: string, containerSpec: ContainerSpec, targetIndex: number) => {
      applyTaskMutation(
        (tasks) => moveTaskToContainer(tasks, taskId, containerSpec, targetIndex, currentMonth),
        {
          action: "move",
          message: "Обновлено положение задачи",
          taskId,
        },
      );
    },
    [applyTaskMutation, currentMonth],
  );

  const handleTaskProgressStatusToggle = useCallback(
    (taskId: string, nextProgressStatus: TaskProgressStatus) => {
      applyTaskMutation(
        (tasks) => updateTaskSeriesProgressStatus(tasks, taskId, nextProgressStatus),
        {
          action: "progress",
          message: "Обновлен статус задачи",
          taskId,
        },
      );
    },
    [applyTaskMutation],
  );

  const handleTaskMoveToTimeSlot = useCallback(
    (taskId: string, participantId: ParticipantId, dateKey: string, startTime: string) => {
      const sourceTask = sortedTasks.find((task) => task.id === taskId);
      if (sourceTask && shouldPromptTaskScope(sortedTasks, taskId)) {
        setPendingTimeScopeAction({
          kind: "move",
          taskId,
          taskTitle: sourceTask.title,
          participantId,
          dateKey,
          startTime,
        });
        return;
      }

      applyTaskMutation(
        (tasks) => moveTaskToTimelineSlot(tasks, taskId, participantId, dateKey, startTime, currentMonth),
        {
          action: "timeline-move",
          message: "Обновлено время задачи в календаре",
          taskId,
        },
      );
    },
    [applyTaskMutation, currentMonth, sortedTasks],
  );

  const handleTaskMoveToUntimedZone = useCallback(
    (taskId: string, participantId: ParticipantId, dateKey: string) => {
      const sourceTask = sortedTasks.find((task) => task.id === taskId);
      if (sourceTask && shouldPromptTaskScope(sortedTasks, taskId)) {
        setPendingTimeScopeAction({
          kind: "clear",
          taskId,
          taskTitle: sourceTask.title,
          participantId,
          dateKey,
        });
        return;
      }

      applyTaskMutation(
        (tasks) => moveTaskToUntimedZone(tasks, taskId, participantId, dateKey, currentMonth),
        {
          action: "timeline-clear-time",
          message: "У задачи очищено время внутри дня",
          taskId,
        },
      );
    },
    [applyTaskMutation, currentMonth, sortedTasks],
  );

  const handleTaskResizeDuration = useCallback(
    (taskId: string, nextHours: number) => {
      const sourceTask = sortedTasks.find((task) => task.id === taskId);
      if (sourceTask && shouldPromptTaskScope(sortedTasks, taskId)) {
        setPendingTimeScopeAction({
          kind: "resize",
          taskId,
          taskTitle: sourceTask.title,
          nextHours,
        });
        return;
      }

      applyTaskMutation(
        (tasks) => resizeTaskTimelineDuration(tasks, taskId, nextHours),
        {
          action: "timeline-resize",
          message: "Обновлена длительность задачи",
          taskId,
        },
      );
    },
    [applyTaskMutation, sortedTasks],
  );

  const commitWorkHoursPerDay = useCallback(
    (rawValue: string) => {
      const normalized = normalizeWorkHoursPerDay(Number(rawValue));
      setWorkHoursDraft(String(normalized));

      if (normalized === workHoursPerDay) {
        return;
      }

      applyPlannerMutation(
        (state) => ({
          ...state,
          settings: {
            ...getPlannerSettings(state),
            workHoursPerDay: normalized,
          },
        }),
        {
          action: "settings",
          message: "Обновлена настройка рабочего времени в день",
        },
      );
    },
    [applyPlannerMutation, workHoursPerDay],
  );

  const updateParticipantWorkSchedule = useCallback(
    (participantId: ParticipantId, field: "startTime" | "endTime", value: string) => {
      applyPlannerMutation(
        (state) => {
          const currentSettings = getPlannerSettings(state);

          return {
            ...state,
            settings: {
              ...currentSettings,
              participantWorkSchedules: {
                ...currentSettings.participantWorkSchedules,
                [participantId]: {
                  ...currentSettings.participantWorkSchedules[participantId],
                  [field]: value,
                },
              },
            },
          };
        },
        {
          action: "settings",
          message: "Обновлен индивидуальный график работы",
        },
      );
    },
    [applyPlannerMutation],
  );

  const setCalendarDisplayMode = useCallback(
    (mode: "day" | "time") => {
      if (mode === calendarDisplayMode) {
        return;
      }

      applyPlannerMutation(
        (state) => ({
          ...state,
          settings: {
            ...getPlannerSettings(state),
            calendarDisplayMode: mode,
          },
        }),
        {
          action: "settings",
          message:
            mode === "time"
              ? "Включен режим календаря по времени"
              : "Включен режим календаря по дням",
        },
      );
    },
    [applyPlannerMutation, calendarDisplayMode],
  );

  const toggleHideWeekends = useCallback(() => {
    applyPlannerMutation(
      (state) => ({
        ...state,
        settings: {
          ...getPlannerSettings(state),
          hideWeekends: !getPlannerSettings(state).hideWeekends,
        },
      }),
      {
        action: "settings",
        message: !hideWeekends
          ? "Выходные скрыты из визуала календаря"
          : "Выходные снова показаны в календаре",
      },
    );
  }, [applyPlannerMutation, hideWeekends]);

  const toggleInterleaveWeeksByParticipant = useCallback(() => {
    applyPlannerMutation(
      (state) => ({
        ...state,
        settings: {
          ...getPlannerSettings(state),
          interleaveWeeksByParticipant: !getPlannerSettings(state).interleaveWeeksByParticipant,
        },
      }),
      {
        action: "settings",
        message: !interleaveWeeksByParticipant
          ? "Включено чередование недель по исполнителям"
          : "Возвращен режим месяца по исполнителям",
      },
    );
  }, [applyPlannerMutation, interleaveWeeksByParticipant]);

  const handleDeleteTask = useCallback(() => {
    if (!dialogState.taskId) {
      return;
    }

    setDeleteConfirmOpen(true);
  }, [dialogState.taskId]);

  const confirmDeleteTask = useCallback((scope: TaskMutationScope = "series") => {
    if (!dialogState.taskId) {
      return;
    }

    const deletingTaskId = dialogState.taskId;

    applyTaskMutation(
      (tasks) => deletePlannerTask(tasks, deletingTaskId, scope),
      {
        action: scope === "instance" ? "delete-instance" : "delete",
        message:
          scope === "instance"
            ? "Удалена связанная серия задачи у всех исполнителей"
            : "Задача удалена",
        taskId: deletingTaskId,
      },
    );
    setDeleteConfirmOpen(false);
    closeTaskDialog();
  }, [applyTaskMutation, closeTaskDialog, dialogState.taskId, selectedTaskSeries.length]);

  const handleCloneTask = useCallback(() => {
    if (!selectedTask) {
      return;
    }

    const input = buildTaskInput(formValues);
    const inputStartDate = input.recurrence.fromDate || input.date;

    if (!input.title) {
      setFormError("Укажите название задачи.");
      return;
    }

    if (formValues.status === "calendar" && input.assignees.length === 0) {
      setFormError("Выберите хотя бы одного исполнителя.");
      return;
    }

    if (formValues.status === "calendar" && !input.date) {
      setFormError("Выберите дату для задачи в календаре.");
      return;
    }

    if (input.date && !isDateWithinCurrentMonth(input.date, currentMonth)) {
      setFormError("Дата задачи должна попадать в текущий месяц календаря.");
      return;
    }

    if (
      input.recurrence.frequency !== "none" &&
      input.recurrence.untilMode === "until" &&
      !input.recurrence.untilDate
    ) {
      setFormError("Укажите дату окончания повторения.");
      return;
    }

    if (
      input.recurrence.frequency !== "none" &&
      inputStartDate &&
      input.recurrence.untilMode === "until" &&
      input.recurrence.untilDate &&
      input.recurrence.untilDate < inputStartDate
    ) {
      setFormError("Дата окончания повторения не может быть раньше даты старта.");
      return;
    }

    setFormError(null);

    applyTaskMutation(
      (tasks) => clonePlannerTask(tasks, selectedTask.id, input, currentMonth),
      {
        action: "clone",
        message:
          input.status === "calendar" && input.assignees.length > 1 && input.date
            ? `Клон задачи создан на ${input.assignees.length} календарях.`
            : "Задача клонирована",
        taskId: selectedTask.id,
      },
    );
    closeTaskDialog();
  }, [applyTaskMutation, closeTaskDialog, currentMonth, formValues, selectedTask]);

  const handleTaskSave = useCallback(() => {
    const input = buildTaskInput(formValues);
    const inputStartDate = input.recurrence.fromDate || input.date;

    if (!input.title) {
      setFormError("Укажите название задачи.");
      return;
    }

    if (formValues.status === "calendar" && input.assignees.length === 0) {
      setFormError("Выберите хотя бы одного исполнителя.");
      return;
    }

    if (formValues.status === "calendar" && !input.date) {
      setFormError("Выберите дату для задачи в календаре.");
      return;
    }

    if (input.date && !isDateWithinCurrentMonth(input.date, currentMonth)) {
      setFormError("Дата задачи должна попадать в текущий месяц календаря.");
      return;
    }

    if (
      input.recurrence.frequency !== "none" &&
      input.recurrence.untilMode === "until" &&
      !input.recurrence.untilDate
    ) {
      setFormError("Укажите дату окончания повторения.");
      return;
    }

    if (
      input.recurrence.frequency !== "none" &&
      inputStartDate &&
      input.recurrence.untilMode === "until" &&
      input.recurrence.untilDate &&
      input.recurrence.untilDate < inputStartDate
    ) {
      setFormError("Дата окончания повторения не может быть раньше даты старта.");
      return;
    }

    setFormError(null);

    const editingTaskId = dialogState.taskId;
    const saveMessage =
      input.status === "calendar" && input.assignees.length > 1 && input.date
        ? `Задача размещена на ${input.assignees.length} календарях.`
        : dialogState.mode === "create"
          ? "Новая задача создана"
          : "Задача обновлена";
    const shouldPromptScopedSave =
      dialogState.mode === "edit" &&
      Boolean(editingTaskId) &&
      activeDialogTask?.status === "calendar" &&
      shouldPromptTaskScope(sortedTasks, editingTaskId || "") &&
      (activeDialogTask.hours !== input.hours ||
        (activeDialogTask.startTime || "") !== (input.startTime || ""));

    if (shouldPromptScopedSave && editingTaskId) {
      setPendingTimeScopeAction({
        kind: "save",
        taskId: editingTaskId,
        taskTitle: activeDialogTask?.title || input.title,
        input,
        saveMessage,
      });
      return;
    }

    applyTaskMutation(
      (tasks) => upsertPlannerTask(tasks, input, currentMonth, editingTaskId),
      {
        action: dialogState.mode === "create" ? "create" : "update",
        message: saveMessage,
        taskId: editingTaskId,
      },
    );
    closeTaskDialog();
  }, [activeDialogTask, applyTaskMutation, closeTaskDialog, currentMonth, dialogState.mode, dialogState.taskId, formValues, sortedTasks]);

  const renderParticipantCalendarCard = (
    participant: (typeof PARTICIPANTS)[number],
    weekDays?: Date[],
    weekIndex?: number,
  ) => (
    <PlannerCalendarCard
      participant={participant}
      currentMonth={currentMonth}
      monthLabel={monthLabel}
      weekDays={weekDays}
      weekIndex={weekIndex}
      visibleMonthWeeks={visibleMonthWeeks}
      visibleMonthDays={visibleMonthDays}
      visibleWeekdayEntries={visibleWeekdayEntries}
      calendarDisplayMode={calendarDisplayMode}
      hideWeekends={hideWeekends}
      isCalendarCompactMode={isCalendarCompactMode}
      participantWorkHoursPerDay={participantWorkHoursById[participant.id] || workHoursPerDay}
      workHoursPerDay={workHoursPerDay}
      participantWorkSchedule={participantWorkSchedules[participant.id]}
      currentTimeMs={currentTimeMs}
      derivedTaskCollections={derivedTaskCollections}
      onMoveTask={handleTaskMove}
      onMoveTaskToTimeSlot={handleTaskMoveToTimeSlot}
      onMoveTaskToUntimed={handleTaskMoveToUntimedZone}
      onDragActivityChange={handleDragActivityChange}
      onResizeTaskDuration={handleTaskResizeDuration}
      onToggleTaskProgressStatus={handleTaskProgressStatusToggle}
      onOpenTask={openEditDialog}
    />
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <section className={cn("space-y-6", standalone && "w-full")}>
        <PlannerHeroSection
          monthLabel={monthLabel}
          bankTaskCount={bankTaskCount}
          scheduledTaskCount={scheduledTaskCount}
          selectedMonthIndex={selectedMonthIndex}
          monthOptions={MONTH_OPTIONS}
          loadError={loadError}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
          onSelectMonth={(value) => setSelectedMonthIndex(Number(value))}
        />

        <div
          className={cn(
            "grid gap-6",
            isBankVisible
              ? "xl:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)]"
              : "grid-cols-1",
          )}
        >
          {isBankVisible ? (
            <PlannerBankSidebar
              orderedTaskGroups={orderedTaskGroups}
              visibleTaskGroupIds={visibleTaskGroupIds}
              collapsedBankGroupIds={collapsedBankGroupIds}
              derivedTaskCollections={derivedTaskCollections}
              saveLabel={saveLabel}
              saveStatus={saveStatus}
              storageInfo={storageInfo}
              onCreateTask={openCreateDialog}
              onHideBank={() => setIsBankVisible(false)}
              onToggleCollapsed={toggleCollapsedBankGroup}
              onMoveTask={handleTaskMove}
              onDragActivityChange={handleDragActivityChange}
              onToggleTaskProgressStatus={handleTaskProgressStatusToggle}
              onOpenTask={openEditDialog}
            />
          ) : null}
          <div className="space-y-6">
            <PlannerMonthlyStatsSection
              participantMonthlyStats={participantMonthlyStats}
              monthLabel={monthLabel}
              monthWorkingDayCount={monthWorkingDayCount}
              onOpenParticipantStats={setStatsDialogParticipantId}
            />

            <PlannerFiltersBar
              visibleParticipantIds={visibleParticipantIds}
              isBankVisible={isBankVisible}
              calendarDisplayMode={calendarDisplayMode}
              isCalendarCompactMode={isCalendarCompactMode}
              hideWeekends={hideWeekends}
              interleaveWeeksByParticipant={interleaveWeeksByParticipant}
              taskStatusFilterLabel={taskStatusFilterLabel}
              taskGroupFilterLabel={taskGroupFilterLabel}
              orderedTaskGroups={orderedTaskGroups}
              visibleTaskProgressStatuses={visibleTaskProgressStatuses}
              visibleTaskGroupIds={visibleTaskGroupIds}
              participantWorkSchedules={participantWorkSchedules}
              workHoursDraft={workHoursDraft}
              onToggleVisibleParticipant={toggleVisibleParticipant}
              onShowBank={() => setIsBankVisible(true)}
              onSetCalendarDisplayMode={setCalendarDisplayMode}
              onToggleCalendarCompactMode={() => setIsCalendarCompactMode((current) => !current)}
              onToggleVisibleTaskProgressStatus={toggleVisibleTaskProgressStatus}
              onToggleVisibleTaskGroup={toggleVisibleTaskGroup}
              onCommitTaskGroupOrder={commitTaskGroupOrder}
              onResetTaskGroupOrder={resetTaskGroupOrder}
              onUpdateParticipantWorkSchedule={updateParticipantWorkSchedule}
              onToggleHideWeekends={toggleHideWeekends}
              onToggleInterleaveWeeksByParticipant={toggleInterleaveWeeksByParticipant}
              onSetWorkHoursDraft={setWorkHoursDraft}
              onCommitWorkHoursPerDay={commitWorkHoursPerDay}
            />
            {visibleParticipants.length === 0 ? (
              <Card className="border-dashed border-slate-300 bg-white/75">
                <CardContent className="px-6 py-8 text-center text-sm text-slate-500">
                  Выберите хотя бы один календарь в фильтре выше.
                </CardContent>
              </Card>
            ) : null}

            {interleaveWeeksByParticipant
              ? visibleMonthWeeks.flatMap((week, weekIndex) =>
                  visibleParticipants.map((participant) =>
                    renderParticipantCalendarCard(participant, week, weekIndex),
                  ),
                )
              : visibleParticipants.map((participant) => renderParticipantCalendarCard(participant))}
          </div>
        </div>

        <PlannerMonthlyStatsDialog
          open={Boolean(activeParticipantMonthlyStat)}
          participantStat={activeParticipantMonthlyStat}
          monthLabel={monthLabel}
          monthWorkingDayCount={monthWorkingDayCount}
          onClose={() => setStatsDialogParticipantId(null)}
        />

        <PlannerTaskDialog
          open={dialogState.open}
          mode={dialogState.mode}
          monthLabel={monthLabel}
          formValues={formValues}
          formError={formError}
          monthRange={monthRange}
          recurrenceStartDate={recurrenceStartDate}
          recurrenceSummary={recurrenceSummary}
          automaticCalendarPlacement={automaticCalendarPlacement}
          selectedAssigneeNames={selectedAssigneeNames}
          selectedTask={selectedTask}
          selectedTaskSeriesCount={selectedTaskSeries.length}
          setFormValues={setFormValues}
          onOpenChange={handleDialogOpenChange}
          onToggleAssignee={toggleAssignee}
          onSetTaskDateValue={setTaskDateValue}
          onToggleRecurrenceWeekday={toggleRecurrenceWeekday}
          onUpdateRecurrenceWeekdayTiming={updateRecurrenceWeekdayTiming}
          onCloneTask={handleCloneTask}
          onDeleteTask={handleDeleteTask}
          onSaveTask={handleTaskSave}
        />
        <PlannerTimeScopeAlert
          open={Boolean(pendingTimeScopeAction)}
          taskTitle={pendingTimeScopeAction?.taskTitle}
          onClose={() => setPendingTimeScopeAction(null)}
          onApplySeries={() => commitPendingTimeScopeAction("series")}
          onApplyInstance={() => commitPendingTimeScopeAction("instance")}
        />

        <PlannerDeleteConfirmDialog
          open={deleteConfirmOpen}
          linkedSeriesCount={selectedTaskSeries.length}
          assigneeNames={selectedTaskSeriesAssigneeNames}
          canDetachInstance={canDetachActiveDialogTask}
          onOpenChange={setDeleteConfirmOpen}
          onDeleteInstance={() => confirmDeleteTask("instance")}
          onDeleteSeries={() => confirmDeleteTask("series")}
        />
      </section>
    </DndProvider>
  );
}
