import { format, isSameMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { useRef } from "react";
import { useDragLayer, useDrop } from "react-dnd";

import { cn } from "@/app/components/ui/utils";
import { TASK_GROUPS } from "@/app/planner/constants";
import { TASK_ITEM_TYPE, type DragTaskItem } from "@/app/planner/dnd";
import {
  formatHours,
  getContainerId,
  getDailyHours,
  getDateKey,
  getTasksForContainer,
  isDateToday,
} from "@/app/planner/planner-utils";
import { TaskGroupSection } from "@/app/planner/TaskGroupSection";
import type { ContainerSpec, PlannerTask } from "@/app/planner/types";

function CalendarEmptyGroupChip({
  dateKey,
  groupId,
  participantId,
  onMoveTask,
}: {
  dateKey: string;
  groupId: PlannerTask["group"];
  participantId: NonNullable<PlannerTask["assignee"]>;
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

  const [{ isOver, canDrop }, drop] = useDrop<DragTaskItem>(
    () => ({
      accept: TASK_ITEM_TYPE,
      drop: (item, monitor) => {
        if (monitor.didDrop()) {
          return undefined;
        }

        onMoveTask(item.taskId, containerSpec, 0);
        item.containerId = containerId;
        item.index = 0;
        return { handled: true };
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    }),
    [containerId, containerSpec, onMoveTask],
  );

  drop(ref);

  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-auto flex min-h-8 items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold shadow-[0_10px_24px_-18px_rgba(15,23,42,0.28)] backdrop-blur-sm transition-all",
        groupMeta.badgeClass,
        isOver && canDrop && "scale-[1.02] border-primary bg-primary/15 text-primary shadow-[0_0_0_1px_rgba(13,148,136,0.35)]",
      )}
    >
      {groupMeta.shortLabel}
    </div>
  );
}

interface CalendarDayCellProps {
  date: Date;
  currentMonth: Date;
  tasks: PlannerTask[];
  participantId: NonNullable<PlannerTask["assignee"]>;
  onMoveTask: (taskId: string, containerSpec: ContainerSpec, targetIndex: number) => void;
  onOpenTask: (task: PlannerTask) => void;
}

export function CalendarDayCell({
  date,
  currentMonth,
  tasks,
  participantId,
  onMoveTask,
  onOpenTask,
}: CalendarDayCellProps) {
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const dateKey = getDateKey(date);
  const isAnyDragging = useDragLayer((monitor) => monitor.isDragging());
  const dayRef = useRef<HTMLDivElement | null>(null);
  const [{ isOverDay }, dayDrop] = useDrop<DragTaskItem>(
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
      <div
        aria-hidden="true"
        className="min-h-[168px] rounded-[24px] border border-transparent bg-transparent"
      />
    );
  }

  const dayHours = getDailyHours(tasks, participantId, dateKey);
  const groupsWithTasks = TASK_GROUPS.map((group) => ({
    group,
    tasks: getTasksForContainer(tasks, {
      kind: "calendar",
      assignee: participantId,
      date: dateKey,
      group: group.id,
    }),
  }));
  const emptyGroups = groupsWithTasks.filter(({ tasks: groupedTasks }) => groupedTasks.length === 0);

  return (
    <div
      ref={dayRef}
      className={cn(
        "relative min-h-[168px] overflow-hidden rounded-[24px] border bg-white/80 p-3 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)] backdrop-blur-sm transition-colors",
        isDateToday(date) ? "border-primary/60 bg-primary/6" : "border-white/70",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold",
            isDateToday(date) ? "bg-primary text-white shadow-lg" : "bg-slate-100 text-slate-700",
          )}
        >
          {format(date, "d")}
        </span>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
            {format(date, "EEE", { locale: ru })}
          </div>
          <div className="text-[10px] font-medium text-slate-500">
            {dayHours > 0 ? formatHours(dayHours) : "свободно"}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        {groupsWithTasks.map(({ group, tasks: groupedTasks }) => (
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
            variant="calendar"
            onMoveTask={onMoveTask}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
      {isAnyDragging && isOverDay && emptyGroups.length > 0 ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 top-11 z-20 rounded-[20px] border border-white/70 bg-white/45 p-2 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.24)] backdrop-blur-[4px]">
          <div
            className={cn(
              "grid content-start gap-1.5",
              emptyGroups.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {emptyGroups.map(({ group }) => (
              <CalendarEmptyGroupChip
                key={`empty-${participantId}-${dateKey}-${group.id}`}
                dateKey={dateKey}
                groupId={group.id}
                participantId={participantId}
                onMoveTask={onMoveTask}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
