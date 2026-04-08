import { format, isSameMonth } from "date-fns";
import { memo, useMemo, useRef } from "react";
import { useDrop } from "react-dnd";

import { cn } from "@/app/components/ui/utils";
import { TASK_GROUPS, WEEKDAY_LABELS } from "@/app/planner/constants";
import { TASK_ITEM_TYPE, type DragTaskItem } from "@/app/planner/dnd";
import {
  formatHours,
  getContainerId,
  getDateKey,
  isDateToday,
} from "@/app/planner/planner-utils";
import { TaskGroupSection } from "@/app/planner/TaskGroupSection";
import type { ContainerSpec, PlannerTask, TaskGroupId, TaskProgressStatus } from "@/app/planner/types";

function CalendarGroupChip({
  dateKey,
  groupId,
  participantId,
  targetIndex,
  onMoveTask,
}: {
  dateKey: string;
  groupId: PlannerTask["group"];
  participantId: NonNullable<PlannerTask["assignee"]>;
  targetIndex: number;
  onMoveTask: (taskId: string, containerSpec: ContainerSpec, targetIndex: number) => void;
}) {
  const groupMeta = TASK_GROUPS.find((group) => group.id === groupId) || TASK_GROUPS[TASK_GROUPS.length - 1];
  const ref = useRef<HTMLDivElement | null>(null);
  const containerSpec: ContainerSpec = {
    kind: "calendar",
    assignee: participantId,
    date: dateKey,
    group: groupId,
  };
  const containerId = getContainerId(containerSpec);

  const [{ isOver, canDrop }, drop] = useDrop<DragTaskItem, { handled: true } | undefined, { isOver: boolean; canDrop: boolean }>(
    () => ({
      accept: TASK_ITEM_TYPE,
      drop: (item, monitor) => {
        if (monitor.didDrop()) {
          return undefined;
        }

        onMoveTask(item.taskId, containerSpec, targetIndex);
        item.containerId = containerId;
        item.index = targetIndex;
        return { handled: true };
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    }),
    [containerId, containerSpec, onMoveTask, targetIndex],
  );

  drop(ref);

  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-auto flex min-h-8 items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold shadow-[0_10px_24px_-18px_rgba(15,23,42,0.28)] backdrop-blur-sm transition-all",
        groupMeta.badgeClass,
        isOver &&
          canDrop &&
          "scale-[1.02] border-primary bg-primary/15 text-primary shadow-[0_0_0_1px_rgba(13,148,136,0.35)]",
      )}
    >
      {groupMeta.shortLabel}
    </div>
  );
}

interface CalendarDayCellProps {
  date: Date;
  currentMonth: Date;
  groupEntries: {
    groupId: TaskGroupId;
    tasks: PlannerTask[];
  }[];
  dayHours: number;
  participantId: NonNullable<PlannerTask["assignee"]>;
  minimal?: boolean;
  workHoursPerDay: number;
  onMoveTask: (taskId: string, containerSpec: ContainerSpec, targetIndex: number) => void;
  onDragActivityChange?: (active: boolean) => void;
  onToggleTaskProgressStatus: (taskId: string, nextProgressStatus: TaskProgressStatus) => void;
  onOpenTask: (task: PlannerTask) => void;
}

function CalendarDayCellComponent({
  date,
  currentMonth,
  groupEntries,
  dayHours,
  participantId,
  minimal = false,
  workHoursPerDay,
  onMoveTask,
  onDragActivityChange,
  onToggleTaskProgressStatus,
  onOpenTask,
}: CalendarDayCellProps) {
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const dateKey = getDateKey(date);
  const weekdayIndex = (date.getDay() + 6) % 7;
  const weekdayLabel = WEEKDAY_LABELS[weekdayIndex];
  const isWeekend = weekdayIndex >= 5;
  const dayRef = useRef<HTMLDivElement | null>(null);
  const [{ isOverDay }, dayDrop] = useDrop<DragTaskItem, void, { isOverDay: boolean }>(
    () => ({
      accept: TASK_ITEM_TYPE,
      hover: () => undefined,
      collect: (monitor) => ({
        isOverDay: monitor.isOver({ shallow: false }),
      }),
    }),
    [],
  );

  dayDrop(dayRef);

  if (!isCurrentMonth) {
    return (
      <div className={cn("min-h-[168px] p-2.5", isWeekend ? "bg-rose-50/35" : "bg-slate-50/80")}>
        <div className="flex items-center justify-between gap-2 opacity-70">
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
      </div>
    );
  }

  const isOverbooked = dayHours > workHoursPerDay;
  const groupsWithTasks = useMemo(
    () =>
      groupEntries.map(({ groupId, tasks: groupedTasks }) => ({
        group: TASK_GROUPS.find((group) => group.id === groupId) || TASK_GROUPS[TASK_GROUPS.length - 1],
        tasks: groupedTasks,
      })),
    [groupEntries],
  );
  const visibleGroupsWithTasks = useMemo(
    () => groupsWithTasks.filter(({ tasks: groupedTasks }) => groupedTasks.length > 0),
    [groupsWithTasks],
  );
  const showTray = isOverDay;

  return (
    <div
      ref={dayRef}
      className={cn("relative flex flex-col", showTray && "z-30")}
    >
      <div
        className={cn(
          "min-h-[168px] p-2.5 transition-colors",
          isWeekend ? "bg-rose-50/45" : "bg-white",
        )}
      >
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
        <div className="space-y-1.5">
          {visibleGroupsWithTasks.map(({ group, tasks: groupedTasks }) => (
            <TaskGroupSection
              key={`${participantId}-${dateKey}-${group.id}`}
              title={group.shortLabel}
              groupId={group.id}
              tasks={groupedTasks}
              containerSpec={{
                kind: "calendar",
                assignee: participantId,
                date: dateKey,
                group: group.id,
              }}
              compact
              minimal={minimal}
              variant="calendar"
              onMoveTask={onMoveTask}
              onDragActivityChange={onDragActivityChange}
              onToggleTaskProgressStatus={onToggleTaskProgressStatus}
              onOpenTask={onOpenTask}
              />
            ))}
        </div>
      </div>
      {showTray ? (
        <div className="mt-2 rounded-[24px] border border-white/80 bg-white/80 p-3 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.38)] backdrop-blur-sm">
          <div className="pointer-events-none inline-flex w-full flex-wrap items-center justify-center gap-1.5">
            {groupsWithTasks.map(({ group, tasks: groupedTasks }) => (
              <CalendarGroupChip
                key={`overlay-${participantId}-${dateKey}-${group.id}`}
                dateKey={dateKey}
                groupId={group.id}
                participantId={participantId}
                targetIndex={groupedTasks.length}
                onMoveTask={onMoveTask}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const CalendarDayCell = memo(
  CalendarDayCellComponent,
  (prevProps, nextProps) =>
    prevProps.date === nextProps.date &&
    prevProps.currentMonth === nextProps.currentMonth &&
    prevProps.groupEntries === nextProps.groupEntries &&
    prevProps.dayHours === nextProps.dayHours &&
    prevProps.participantId === nextProps.participantId &&
    prevProps.minimal === nextProps.minimal &&
    prevProps.workHoursPerDay === nextProps.workHoursPerDay &&
    prevProps.onMoveTask === nextProps.onMoveTask &&
    prevProps.onDragActivityChange === nextProps.onDragActivityChange &&
    prevProps.onToggleTaskProgressStatus === nextProps.onToggleTaskProgressStatus &&
    prevProps.onOpenTask === nextProps.onOpenTask,
);
