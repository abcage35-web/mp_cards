import { format, isSameMonth } from "date-fns";
import { memo, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import { Ban, CheckCheck, CircleDot, GripVertical } from "lucide-react";

import { Badge } from "@/app/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { cn } from "@/app/components/ui/utils";
import {
  TASK_GROUPS,
  TASK_PROGRESS_STATUSES,
  TIMELINE_END_MINUTES,
  TIMELINE_ROW_HEIGHT,
  TIMELINE_SLOT_COUNT,
  TIMELINE_SLOT_MINUTES,
  TIMELINE_START_MINUTES,
  WEEKDAY_LABELS,
} from "@/app/planner/constants";
import { TASK_ITEM_TYPE, type DragTaskItem } from "@/app/planner/dnd";
import {
  formatHours,
  getDateKey,
  getTaskContainerId,
  getTaskProgressStatus,
  isDateToday,
  minutesToTime,
  timeToMinutes,
} from "@/app/planner/planner-utils";
import type {
  ParticipantId,
  ParticipantWorkSchedule,
  PlannerTask,
  TaskProgressStatus,
} from "@/app/planner/types";

function getGroupMeta(groupId: PlannerTask["group"]) {
  return TASK_GROUPS.find((group) => group.id === groupId) || TASK_GROUPS[TASK_GROUPS.length - 1];
}

function getTaskProgressMeta(progressStatus: TaskProgressStatus) {
  const baseMeta =
    TASK_PROGRESS_STATUSES.find((status) => status.id === progressStatus) ||
    TASK_PROGRESS_STATUSES[0];

  if (progressStatus === "done") {
    return {
      ...baseMeta,
      icon: CheckCheck,
    };
  }

  if (progressStatus === "cancelled") {
    return {
      ...baseMeta,
      icon: Ban,
    };
  }

  return {
    ...baseMeta,
    icon: CircleDot,
  };
}

function getTaskSlotCount(task: PlannerTask) {
  const minutes = Math.max(30, Math.round((task.hours || 0.5) * 60 / TIMELINE_SLOT_MINUTES) * TIMELINE_SLOT_MINUTES);
  return Math.max(1, Math.round(minutes / TIMELINE_SLOT_MINUTES));
}

function getTaskTimelineMeta(task: PlannerTask) {
  const startMinutes = timeToMinutes(task.startTime);
  if (
    startMinutes === null ||
    startMinutes < TIMELINE_START_MINUTES ||
    startMinutes >= TIMELINE_END_MINUTES
  ) {
    return null;
  }

  const startSlot = Math.max(
    0,
    Math.floor((startMinutes - TIMELINE_START_MINUTES) / TIMELINE_SLOT_MINUTES),
  );
  const slotCount = Math.max(1, Math.min(getTaskSlotCount(task), TIMELINE_SLOT_COUNT - startSlot));

  return {
    startMinutes,
    startSlot,
    slotCount,
    top: startSlot * TIMELINE_ROW_HEIGHT,
    height: slotCount * TIMELINE_ROW_HEIGHT,
  };
}

function getDurationHeight(hours: number) {
  return Math.max(
    TIMELINE_ROW_HEIGHT,
    Math.round((Math.max(hours, 0.5) * 60) / TIMELINE_SLOT_MINUTES) * TIMELINE_ROW_HEIGHT,
  );
}

function getTaskTimeRangeLabel(startTime: string | null, hours: number) {
  const startMinutes = timeToMinutes(startTime);
  if (startMinutes === null) {
    return null;
  }

  const durationMinutes = Math.max(
    30,
    Math.round((Math.max(hours, 0.5) * 60) / TIMELINE_SLOT_MINUTES) * TIMELINE_SLOT_MINUTES,
  );
  const endMinutes = Math.min(TIMELINE_END_MINUTES, startMinutes + durationMinutes);

  return `${minutesToTime(startMinutes)}-${minutesToTime(endMinutes)}`;
}

function getTimelineSlotIndex(clientY: number, rectTop: number) {
  return Math.max(
    0,
    Math.min(
      TIMELINE_SLOT_COUNT - 1,
      Math.floor((clientY - rectTop) / TIMELINE_ROW_HEIGHT),
    ),
  );
}

interface TimedTaskLayoutEntry {
  task: PlannerTask;
  top: number;
  height: number;
  startSlot: number;
  endSlot: number;
  lane: number;
  laneCount: number;
}

function buildTimedTaskLayouts(tasks: PlannerTask[]) {
  const entries = tasks
    .map((task) => {
      const meta = getTaskTimelineMeta(task);
      if (!meta) {
        return null;
      }

      return {
        task,
        top: meta.top,
        height: meta.height,
        startSlot: meta.startSlot,
        endSlot: meta.startSlot + meta.slotCount,
      };
    })
    .filter((entry): entry is Omit<TimedTaskLayoutEntry, "lane" | "laneCount"> => Boolean(entry))
    .sort((left, right) => {
      if (left.startSlot !== right.startSlot) {
        return left.startSlot - right.startSlot;
      }

      if (left.endSlot !== right.endSlot) {
        return left.endSlot - right.endSlot;
      }

      return left.task.order - right.task.order;
    });

  const clusterLaneCounts = new Map<number, number>();
  const active: Array<{ endSlot: number; lane: number }> = [];
  const layouts: Array<TimedTaskLayoutEntry & { clusterId: number }> = [];
  let currentClusterId = -1;
  let currentClusterEnd = -1;

  entries.forEach((entry) => {
    for (let index = active.length - 1; index >= 0; index -= 1) {
      if (active[index].endSlot <= entry.startSlot) {
        active.splice(index, 1);
      }
    }

    if (currentClusterId === -1 || entry.startSlot >= currentClusterEnd) {
      currentClusterId += 1;
      currentClusterEnd = entry.endSlot;
    } else {
      currentClusterEnd = Math.max(currentClusterEnd, entry.endSlot);
    }

    const usedLanes = new Set(active.map((item) => item.lane));
    let lane = 0;
    while (usedLanes.has(lane)) {
      lane += 1;
    }

    active.push({ endSlot: entry.endSlot, lane });
    const activeLaneCount = active.reduce((max, item) => Math.max(max, item.lane + 1), lane + 1);
    clusterLaneCounts.set(
      currentClusterId,
      Math.max(clusterLaneCounts.get(currentClusterId) || 0, activeLaneCount),
    );

    layouts.push({
      ...entry,
      lane,
      laneCount: 1,
      clusterId: currentClusterId,
    });
  });

  return layouts.map(({ clusterId, ...entry }) => ({
    ...entry,
    laneCount: Math.max(1, clusterLaneCounts.get(clusterId) || 1),
  }));
}

function TimelineTaskCard({
  task,
  floating = false,
  top = 0,
  height,
  left = "0%",
  width = "100%",
  onDragActivityChange,
  onToggleTaskProgressStatus,
  onOpenTask,
  onResizeTaskDuration,
}: {
  task: PlannerTask;
  floating?: boolean;
  top?: number;
  height?: number;
  left?: string;
  width?: string;
  onDragActivityChange?: (active: boolean) => void;
  onToggleTaskProgressStatus: (taskId: string, nextProgressStatus: TaskProgressStatus) => void;
  onOpenTask: (task: PlannerTask) => void;
  onResizeTaskDuration?: (taskId: string, nextHours: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const suppressClickRef = useRef(false);
  const [previewHours, setPreviewHours] = useState<number | null>(null);
  const groupMeta = getGroupMeta(task.group);
  const progressMeta = getTaskProgressMeta(getTaskProgressStatus(task));
  const ProgressIcon = progressMeta.icon;
  const taskHours = Math.max(task.hours || 0.5, 0.5);
  const effectiveHours = previewHours ?? taskHours;
  const baseHeight = height ?? getDurationHeight(taskHours);
  const effectiveHeight = previewHours !== null ? getDurationHeight(previewHours) : baseHeight;
  const isResizePreviewActive = previewHours !== null;
  const showSubline = effectiveHeight >= TIMELINE_ROW_HEIGHT * 2;
  const timeRangeLabel = getTaskTimeRangeLabel(task.startTime, effectiveHours);

  const [{ isDragging }, drag, preview] = useDrag(
    () => ({
      type: TASK_ITEM_TYPE,
      item: () => {
        onDragActivityChange?.(true);
        return {
          taskId: task.id,
          containerId: getTaskContainerId(task),
          index: task.order,
        } satisfies DragTaskItem;
      },
      end: () => {
        onDragActivityChange?.(false);
      },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [onDragActivityChange, task.id, task.order, task.status, task.group, task.assignee, task.date],
  );

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  useEffect(() => {
    drag(handleRef);
  }, [drag]);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onResizeTaskDuration) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;

    const startY = event.clientY;
    const initialSlots = getTaskSlotCount(task);

    const updatePreview = (clientY: number) => {
      const deltaSlots = Math.round((clientY - startY) / TIMELINE_ROW_HEIGHT);
      const nextSlots = Math.max(1, initialSlots + deltaSlots);
      setPreviewHours(nextSlots * 0.5);
      return nextSlots;
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updatePreview(moveEvent.clientY);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      const nextSlots = updatePreview(upEvent.clientY);
      const nextHours = nextSlots * 0.5;

      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      setPreviewHours(null);
      onResizeTaskDuration(task.id, nextHours);

      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  };

  const cardBody = (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (suppressClickRef.current) {
          return;
        }
        onOpenTask(task);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenTask(task);
        }
      }}
      className={cn(
        "group relative overflow-hidden border bg-white/95 text-left shadow-sm transition-all",
        groupMeta.borderClass,
        floating ? "h-full rounded-xl px-2 py-1" : "rounded-2xl px-3 py-2",
        isResizePreviewActive &&
          "ring-2 ring-primary/35 shadow-[0_18px_35px_-22px_rgba(13,148,136,0.65)]",
        isDragging && "opacity-35",
      )}
      style={floating ? { height: effectiveHeight } : undefined}
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90", groupMeta.surfaceClass)} />

      <div className="relative h-full">
        <div className="flex items-start justify-between gap-2">
          <div className="relative min-w-0 flex-1">
            <div
              ref={handleRef}
              onClick={(event) => event.stopPropagation()}
              className="absolute left-0 top-0 inline-flex size-4 cursor-grab items-center justify-center text-slate-400 active:cursor-grabbing"
              title="Перетащить задачу"
              aria-label={`Перетащить задачу ${task.title}`}
            >
              <GripVertical className="size-3.5" />
            </div>

            <p className={cn("truncate pl-4 font-semibold text-slate-900", floating ? "text-[11px] leading-4" : "text-sm")}>
              {task.title}
            </p>

            {showSubline ? (
              <div className="mt-0.5 flex min-w-0 items-center gap-1 pl-4 text-[9px] text-slate-500">
                {timeRangeLabel ? <span className="shrink-0 font-medium text-slate-600">{timeRangeLabel}</span> : null}
                {task.startTime ? <span className="shrink-0">•</span> : null}
                <span className="truncate">{groupMeta.shortLabel}</span>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full border transition-colors",
                    progressMeta.chipClass,
                    floating ? "size-5" : "size-6",
                  )}
                  title={progressMeta.label}
                  aria-label={progressMeta.label}
                >
                  <ProgressIcon className={floating ? "size-3" : "size-3.5"} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 rounded-2xl border-white/80 bg-white/95 p-1.5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)]"
                onClick={(event) => event.stopPropagation()}
              >
                {TASK_PROGRESS_STATUSES.map((status) => {
                  const statusMeta = getTaskProgressMeta(status.id);
                  const StatusIcon = statusMeta.icon;
                  const isActive = status.id === progressMeta.id;

                  return (
                    <DropdownMenuItem
                      key={status.id}
                      onSelect={(event) => {
                        event.preventDefault();
                        onToggleTaskProgressStatus(task.id, status.id);
                      }}
                      className={cn(
                        "rounded-xl px-2.5 py-2 text-xs font-medium text-slate-700",
                        isActive && "bg-slate-100 text-slate-950",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex size-5 items-center justify-center rounded-full border",
                          statusMeta.chipClass,
                        )}
                      >
                        <StatusIcon className="size-3" />
                      </span>
                      <span>{status.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <Badge
              variant="outline"
              className="shrink-0 border-white/80 bg-white/70 px-1.5 text-[10px] text-slate-700"
            >
              {formatHours(effectiveHours)}
            </Badge>
          </div>
        </div>
      </div>

      {isResizePreviewActive ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-primary/15 via-primary/8 to-transparent" />
      ) : null}

      {floating && onResizeTaskDuration ? (
        <div
          onPointerDown={startResize}
          className="absolute inset-x-2 bottom-0 h-2 cursor-ns-resize rounded-full"
          title="Изменить длительность"
          aria-label="Изменить длительность"
        >
          <div className="absolute inset-x-4 bottom-1 h-0.5 rounded-full bg-slate-300/80" />
        </div>
      ) : null}
    </div>
  );

  if (!floating) {
    return cardBody;
  }

  return (
    <div
      className="absolute z-10"
      style={{ top, height: effectiveHeight, left, width }}
    >
      {cardBody}
    </div>
  );
}

interface CalendarTimeDayCellProps {
  date: Date;
  currentMonth: Date;
  dayTasks: PlannerTask[];
  dayHours: number;
  participantId: ParticipantId;
  workHoursPerDay: number;
  participantWorkSchedule: ParticipantWorkSchedule;
  currentTimeMs: number;
  onMoveTaskToTimeSlot: (
    taskId: string,
    participantId: ParticipantId,
    dateKey: string,
    startTime: string,
  ) => void;
  onMoveTaskToUntimed: (
    taskId: string,
    participantId: ParticipantId,
    dateKey: string,
  ) => void;
  onDragActivityChange?: (active: boolean) => void;
  onResizeTaskDuration: (taskId: string, nextHours: number) => void;
  onToggleTaskProgressStatus: (taskId: string, nextProgressStatus: TaskProgressStatus) => void;
  onOpenTask: (task: PlannerTask) => void;
  showTimelineLabels?: boolean;
}

function CalendarTimeDayCellComponent({
  date,
  currentMonth,
  dayTasks,
  dayHours,
  participantId,
  workHoursPerDay,
  participantWorkSchedule,
  currentTimeMs,
  onMoveTaskToTimeSlot,
  onMoveTaskToUntimed,
  onDragActivityChange,
  onResizeTaskDuration,
  onToggleTaskProgressStatus,
  onOpenTask,
  showTimelineLabels = true,
}: CalendarTimeDayCellProps) {
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const dateKey = getDateKey(date);
  const weekdayIndex = (date.getDay() + 6) % 7;
  const weekdayLabel = WEEKDAY_LABELS[weekdayIndex];
  const isWeekend = weekdayIndex >= 5;
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const untimedRef = useRef<HTMLDivElement | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const hoveredSlotRef = useRef<number | null>(null);
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null);
  const workStartMinutes = timeToMinutes(participantWorkSchedule.startTime) ?? TIMELINE_START_MINUTES;
  const workEndMinutes = timeToMinutes(participantWorkSchedule.endTime) ?? TIMELINE_END_MINUTES;
  const inactiveTopHeight = Math.max(
    0,
    ((Math.min(workStartMinutes, TIMELINE_END_MINUTES) - TIMELINE_START_MINUTES) / TIMELINE_SLOT_MINUTES) *
      TIMELINE_ROW_HEIGHT,
  );
  const inactiveBottomTop = Math.max(
    0,
    ((Math.min(workEndMinutes, TIMELINE_END_MINUTES) - TIMELINE_START_MINUTES) / TIMELINE_SLOT_MINUTES) *
      TIMELINE_ROW_HEIGHT,
  );
  const inactiveBottomHeight = Math.max(
    0,
    ((TIMELINE_END_MINUTES - Math.max(workEndMinutes, TIMELINE_START_MINUTES)) / TIMELINE_SLOT_MINUTES) *
      TIMELINE_ROW_HEIGHT,
  );
  const currentTimeLineTop = useMemo(() => {
    if (!isDateToday(date)) {
      return null;
    }

    const now = new Date(currentTimeMs);
    if (!isDateToday(now)) {
      return null;
    }

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes < TIMELINE_START_MINUTES || nowMinutes > TIMELINE_END_MINUTES) {
      return null;
    }

    return ((nowMinutes - TIMELINE_START_MINUTES) / TIMELINE_SLOT_MINUTES) * TIMELINE_ROW_HEIGHT;
  }, [currentTimeMs, date]);
  const currentTimeLabel = useMemo(() => {
    if (currentTimeLineTop === null) {
      return null;
    }

    return minutesToTime(new Date(currentTimeMs).getHours() * 60 + new Date(currentTimeMs).getMinutes());
  }, [currentTimeLineTop, currentTimeMs]);

  const timedTaskLayouts = useMemo(
    () =>
      buildTimedTaskLayouts(dayTasks).sort((left, right) => {
        if (left.startSlot !== right.startSlot) {
          return left.startSlot - right.startSlot;
        }
        return left.task.order - right.task.order;
      }),
    [dayTasks],
  );

  const timedTasks = useMemo(() => timedTaskLayouts.map((entry) => entry.task), [timedTaskLayouts]);

  const untimedTasks = useMemo(
    () => dayTasks.filter((task) => !getTaskTimelineMeta(task)),
    [dayTasks],
  );

  const scheduleHoveredSlot = (nextSlot: number | null) => {
    if (hoveredSlotRef.current === nextSlot) {
      return;
    }

    hoveredSlotRef.current = nextSlot;

    if (hoverFrameRef.current !== null) {
      cancelAnimationFrame(hoverFrameRef.current);
    }

    hoverFrameRef.current = requestAnimationFrame(() => {
      setHoveredSlotIndex(nextSlot);
      hoverFrameRef.current = null;
    });
  };

  const [{ isOverTimeline }, timelineDrop] = useDrop<
    DragTaskItem,
    { handled: true } | undefined,
    { isOverTimeline: boolean }
  >(
    () => ({
      accept: TASK_ITEM_TYPE,
      hover: (_item, monitor) => {
        if (!timelineRef.current) {
          return;
        }

        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) {
          return;
        }

        const rect = timelineRef.current.getBoundingClientRect();
        scheduleHoveredSlot(getTimelineSlotIndex(clientOffset.y, rect.top));
      },
      drop: (item, monitor) => {
        if (monitor.didDrop() || !timelineRef.current) {
          return undefined;
        }

        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) {
          return undefined;
        }

        const rect = timelineRef.current.getBoundingClientRect();
        const slotIndex = getTimelineSlotIndex(clientOffset.y, rect.top);

        onMoveTaskToTimeSlot(
          item.taskId,
          participantId,
          dateKey,
          minutesToTime(TIMELINE_START_MINUTES + slotIndex * TIMELINE_SLOT_MINUTES),
        );

        return { handled: true };
      },
      collect: (monitor) => ({
        isOverTimeline: monitor.isOver({ shallow: true }),
      }),
    }),
    [dateKey, onMoveTaskToTimeSlot, participantId],
  );

  const [{ isOverUntimed }, untimedDrop] = useDrop<
    DragTaskItem,
    { handled: true } | undefined,
    { isOverUntimed: boolean }
  >(
    () => ({
      accept: TASK_ITEM_TYPE,
      drop: (item, monitor) => {
        if (monitor.didDrop()) {
          return undefined;
        }

        onMoveTaskToUntimed(item.taskId, participantId, dateKey);
        return { handled: true };
      },
      collect: (monitor) => ({
        isOverUntimed: monitor.isOver({ shallow: true }),
      }),
    }),
    [dateKey, onMoveTaskToUntimed, participantId],
  );

  timelineDrop(timelineRef);
  untimedDrop(untimedRef);

  useEffect(() => {
    if (!isOverTimeline) {
      scheduleHoveredSlot(null);
    }
  }, [isOverTimeline]);

  useEffect(
    () => () => {
      if (hoverFrameRef.current !== null) {
        cancelAnimationFrame(hoverFrameRef.current);
      }
    },
    [],
  );

  if (!isCurrentMonth) {
    return (
      <div className={cn("flex min-h-[520px] flex-col p-2", isWeekend ? "bg-rose-50/35" : "bg-slate-50/80")}>
        <div className="mb-2 flex items-center justify-between gap-2 opacity-70">
          <span
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold",
              isWeekend ? "bg-rose-100/90 text-rose-300" : "bg-slate-200/90 text-slate-400",
            )}
          >
            {format(date, "d")}
          </span>
          <div className="text-right">
            <div className={cn("text-[10px] tracking-[0.18em]", isWeekend ? "text-rose-300" : "text-slate-300")}>
              {weekdayLabel}
            </div>
            <div className="text-[10px] font-medium text-slate-300">вне месяца</div>
          </div>
        </div>

        <div
          className={cn(
            "flex-1 rounded-[18px] border border-dashed p-3",
            isWeekend ? "border-rose-100/80 bg-white/55" : "border-slate-200/80 bg-white/60",
          )}
        />
      </div>
    );
  }

  const isOverbooked = dayHours > workHoursPerDay;

  return (
    <div className={cn("flex min-h-[520px] flex-col p-2", isWeekend ? "bg-rose-50/45" : "bg-white")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold",
            isDateToday(date)
              ? "bg-rose-500 text-white shadow-lg"
              : isWeekend
                ? "bg-rose-100 text-rose-500"
                : "bg-slate-100 text-slate-700",
          )}
        >
          {format(date, "d")}
        </span>
        <div className="text-right">
          <div className={cn("text-[10px] tracking-[0.18em]", isWeekend ? "text-rose-400" : "text-slate-400")}>
            {weekdayLabel}
          </div>
          <div
            className={cn(
              "text-[10px] font-medium",
              isOverbooked ? "text-rose-600" : isWeekend ? "text-rose-500" : "text-slate-500",
            )}
          >
            {formatHours(dayHours)} / {formatHours(workHoursPerDay)}
          </div>
        </div>
      </div>

      <div
        ref={timelineRef}
        className={cn(
          "relative rounded-[18px] border",
          isWeekend ? "border-rose-200/70 bg-rose-50/55" : "border-slate-200/90 bg-slate-50/80",
          isOverTimeline && "border-primary bg-primary/5",
        )}
        style={{ height: TIMELINE_SLOT_COUNT * TIMELINE_ROW_HEIGHT }}
      >
        {inactiveTopHeight > 0 ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 border-b border-rose-200/70 bg-rose-100/55"
            style={{ height: inactiveTopHeight }}
          />
        ) : null}

        {inactiveBottomHeight > 0 ? (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-rose-200/70 bg-rose-100/55"
            style={{ top: inactiveBottomTop, height: inactiveBottomHeight }}
          />
        ) : null}

        {Array.from({ length: TIMELINE_SLOT_COUNT }).map((_, slotIndex) => {
          const labelMinutes = TIMELINE_START_MINUTES + slotIndex * TIMELINE_SLOT_MINUTES;
          const isHourLabel = labelMinutes % 60 === 0;

          return (
            <div
              key={`${dateKey}-slot-${slotIndex}`}
              className="absolute inset-x-0 border-t border-slate-200/80"
              style={{ top: slotIndex * TIMELINE_ROW_HEIGHT }}
            >
              {showTimelineLabels && isHourLabel ? (
                <span className="absolute right-1 top-0 -translate-y-1/2 bg-slate-50 px-1 text-[8px] text-slate-400">
                  {minutesToTime(labelMinutes)}
                </span>
              ) : null}
            </div>
          );
        })}

        {hoveredSlotIndex !== null ? (
          <div
            className="pointer-events-none absolute inset-x-0 rounded-md border border-primary/25 bg-primary/10"
            style={{
              top: hoveredSlotIndex * TIMELINE_ROW_HEIGHT,
              height: TIMELINE_ROW_HEIGHT,
            }}
          />
        ) : null}

        {currentTimeLineTop !== null ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-20"
            style={{ top: currentTimeLineTop }}
          >
            <div className="absolute left-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-rose-500 shadow-[0_0_0_3px_rgba(255,255,255,0.85)]" />
            <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-rose-500/95" />
            {currentTimeLabel ? (
              <span className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white px-1.5 py-0.5 text-[8px] font-semibold text-rose-600 shadow-sm">
                {currentTimeLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        {timedTaskLayouts.map((layout) => {
          const leftPercent = (layout.lane / layout.laneCount) * 100;
          const widthPercent = 100 / layout.laneCount;
          const outerInset = 4;
          const isFirstLane = layout.lane === 0;
          const isLastLane = layout.lane === layout.laneCount - 1;
          const leftOffset = isFirstLane ? outerInset : 0;
          const widthOffset = (isFirstLane ? outerInset : 0) + (isLastLane ? outerInset : 0);

          return (
            <TimelineTaskCard
              key={layout.task.id}
              task={layout.task}
              floating
              top={layout.top}
              height={layout.height}
              left={`calc(${leftPercent}% + ${leftOffset}px)`}
              width={`calc(${widthPercent}% - ${widthOffset}px)`}
              onDragActivityChange={onDragActivityChange}
              onToggleTaskProgressStatus={onToggleTaskProgressStatus}
              onOpenTask={onOpenTask}
              onResizeTaskDuration={onResizeTaskDuration}
            />
          );
        })}
      </div>

      <div
        ref={untimedRef}
        className={cn(
          "mt-2 rounded-[18px] border border-dashed p-2",
          isWeekend ? "border-rose-200/70 bg-rose-50/65" : "border-slate-200/90 bg-slate-50/85",
          isOverUntimed && "border-primary bg-primary/5",
        )}
      >
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Без времени
        </div>
        <div className="space-y-2">
          {untimedTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white/80 px-3 py-2 text-[11px] text-slate-400">
              Перетащите задачу сюда, если время не задано
            </div>
          ) : (
            untimedTasks.map((task) => (
              <TimelineTaskCard
                key={task.id}
                task={task}
                onDragActivityChange={onDragActivityChange}
                onToggleTaskProgressStatus={onToggleTaskProgressStatus}
                onOpenTask={onOpenTask}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export const CalendarTimeDayCell = memo(
  CalendarTimeDayCellComponent,
  (prevProps, nextProps) =>
    prevProps.date === nextProps.date &&
    prevProps.currentMonth === nextProps.currentMonth &&
    prevProps.dayTasks === nextProps.dayTasks &&
    prevProps.dayHours === nextProps.dayHours &&
    prevProps.participantId === nextProps.participantId &&
    prevProps.workHoursPerDay === nextProps.workHoursPerDay &&
    prevProps.participantWorkSchedule.startTime === nextProps.participantWorkSchedule.startTime &&
    prevProps.participantWorkSchedule.endTime === nextProps.participantWorkSchedule.endTime &&
    prevProps.currentTimeMs === nextProps.currentTimeMs &&
    prevProps.showTimelineLabels === nextProps.showTimelineLabels &&
    prevProps.onMoveTaskToTimeSlot === nextProps.onMoveTaskToTimeSlot &&
    prevProps.onMoveTaskToUntimed === nextProps.onMoveTaskToUntimed &&
    prevProps.onDragActivityChange === nextProps.onDragActivityChange &&
    prevProps.onResizeTaskDuration === nextProps.onResizeTaskDuration &&
    prevProps.onToggleTaskProgressStatus === nextProps.onToggleTaskProgressStatus &&
    prevProps.onOpenTask === nextProps.onOpenTask,
);
