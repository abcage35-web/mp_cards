import { useEffect, useRef, useState } from "react";
import { useDrag, useDrop } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import {
  Ban,
  CalendarDays,
  CheckCheck,
  CircleDot,
  GripVertical,
  Link2,
  UserRound,
} from "lucide-react";

import { Badge } from "@/app/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { cn } from "@/app/components/ui/utils";
import { TASK_GROUPS, TASK_PROGRESS_STATUSES } from "@/app/planner/constants";
import { TASK_ITEM_TYPE, type DragTaskItem } from "@/app/planner/dnd";
import {
  getTaskProgressStatus,
  formatHours,
  getContainerId,
  getDisplayDay,
  getShortParticipantNames,
  getTaskSeriesAssignees,
} from "@/app/planner/planner-utils";
import type { ContainerSpec, PlannerTask, TaskProgressStatus } from "@/app/planner/types";

interface TaskCardProps {
  task: PlannerTask;
  index: number;
  containerSpec: ContainerSpec;
  compact?: boolean;
  variant?: "bank" | "calendar";
  onMoveTask: (taskId: string, containerSpec: ContainerSpec, targetIndex: number) => void;
  onToggleTaskProgressStatus: (taskId: string, nextProgressStatus: TaskProgressStatus) => void;
  onOpenTask: (task: PlannerTask) => void;
}

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

export function TaskCard({
  task,
  index,
  containerSpec,
  compact = false,
  variant = "bank",
  onMoveTask,
  onToggleTaskProgressStatus,
  onOpenTask,
}: TaskCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const groupMeta = getGroupMeta(task.group);
  const progressMeta = getTaskProgressMeta(getTaskProgressStatus(task));
  const ProgressIcon = progressMeta.icon;
  const containerId = getContainerId(containerSpec);
  const taskAssignees = getTaskSeriesAssignees(task);
  const assigneeLabels = getShortParticipantNames(taskAssignees);
  const assigneeLine = assigneeLabels.join(" · ");
  const assigneeViewportRef = useRef<HTMLSpanElement | null>(null);
  const assigneeContentRef = useRef<HTMLSpanElement | null>(null);
  const [isAssigneeOverflowing, setIsAssigneeOverflowing] = useState(false);
  const shouldShowDate = Boolean(task.date) && variant !== "calendar";
  const marqueeDuration = Math.max(8, assigneeLine.length * 0.32);

  const [{ isDragging }, drag, preview] = useDrag(
    () => ({
      type: TASK_ITEM_TYPE,
      item: {
        taskId: task.id,
        containerId,
        index,
      } satisfies DragTaskItem,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [containerId, index, task.id],
  );

  const [, drop] = useDrop<DragTaskItem>(
    () => ({
      accept: TASK_ITEM_TYPE,
      hover: (item, monitor) => {
        if (!ref.current || item.taskId === task.id) {
          return;
        }

        if (item.containerId === containerId && item.index === index) {
          return;
        }

        const hoverRect = ref.current.getBoundingClientRect();
        const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2;
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) {
          return;
        }

        const hoverClientY = clientOffset.y - hoverRect.top;
        if (item.containerId === containerId) {
          if (item.index < index && hoverClientY < hoverMiddleY) {
            return;
          }

          if (item.index > index && hoverClientY > hoverMiddleY) {
            return;
          }
        }

        onMoveTask(item.taskId, containerSpec, index);
        item.containerId = containerId;
        item.index = index;
      },
      drop: () => ({ handled: true }),
    }),
    [containerId, containerSpec, index, onMoveTask, task.id],
  );

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  useEffect(() => {
    drag(handleRef);
    drop(ref);
  }, [drag, drop]);

  useEffect(() => {
    const viewport = assigneeViewportRef.current;
    const content = assigneeContentRef.current;

    if (!viewport || !content || !assigneeLine) {
      setIsAssigneeOverflowing(false);
      return;
    }

    const updateOverflow = () => {
      setIsAssigneeOverflowing(content.scrollWidth > viewport.clientWidth + 4);
    };

    updateOverflow();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateOverflow) : null;

    if (resizeObserver) {
      resizeObserver.observe(viewport);
      resizeObserver.observe(content);
    }

    window.addEventListener("resize", updateOverflow);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [assigneeLine]);

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={() => onOpenTask(task)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenTask(task);
        }
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden border bg-white/95 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg select-none",
        groupMeta.borderClass,
        compact ? "px-2.5 py-2" : "px-3.5 py-3",
        variant === "calendar" ? "rounded-xl" : "rounded-2xl",
        isDragging && "opacity-35",
      )}
    >
      <style>
        {`
          @keyframes planner-assignee-marquee {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(calc(-50% - 0.75rem));
            }
          }
        `}
      </style>
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90", groupMeta.surfaceClass)} />
      <div className="relative flex items-start gap-2">
        <div
          ref={handleRef}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "inline-flex shrink-0 items-center justify-center text-slate-400 cursor-grab active:cursor-grabbing",
            compact ? "size-3.5" : "size-4",
          )}
          aria-label={`Перетащить задачу ${task.title}`}
          title="Перетащить задачу"
        >
          <GripVertical className={compact ? "size-3.5" : "size-4"} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "font-semibold text-slate-900",
                compact ? "line-clamp-1 text-[11px] leading-4" : "line-clamp-2 text-sm",
              )}
            >
              {task.title}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
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
                      compact ? "size-5" : "size-6",
                    )}
                    title={`${progressMeta.label}. Нажмите, чтобы выбрать статус`}
                    aria-label={`${progressMeta.label}. Нажмите, чтобы выбрать статус`}
                  >
                    <ProgressIcon className={compact ? "size-3" : "size-3.5"} />
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
                className="shrink-0 border-white/80 bg-white/70 text-[10px] text-slate-700"
              >
                {formatHours(task.hours)}
              </Badge>
            </div>
          </div>
          {task.description && variant !== "calendar" ? (
            <p
              className={cn(
                "mt-1 text-slate-600",
                compact ? "line-clamp-2 text-[10px] leading-3.5" : "line-clamp-2 text-xs",
              )}
            >
              {task.description}
            </p>
          ) : null}
          <div className={cn("flex min-w-0 items-center gap-1.5 overflow-hidden", compact ? "mt-1.5" : "mt-2")}>
            {assigneeLine ? (
              <span
                className="inline-flex min-w-0 flex-1 items-center gap-1 rounded-full border border-white/80 bg-white/75 px-2 py-0.5 text-[10px] text-slate-700"
                title={assigneeLabels.join(", ")}
              >
                <UserRound className="size-3 shrink-0" />
                <span
                  ref={assigneeViewportRef}
                  className="relative block min-w-0 flex-1 overflow-hidden whitespace-nowrap"
                >
                  {isAssigneeOverflowing ? (
                    <span
                      className="flex w-max items-center gap-6 whitespace-nowrap"
                      style={{
                        animation: `planner-assignee-marquee ${marqueeDuration}s linear infinite`,
                      }}
                    >
                      <span ref={assigneeContentRef}>{assigneeLine}</span>
                      <span aria-hidden>{assigneeLine}</span>
                    </span>
                  ) : (
                    <span ref={assigneeContentRef} className="block truncate">
                      {assigneeLine}
                    </span>
                  )}
                </span>
              </span>
            ) : null}
            {shouldShowDate ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/75 px-2 py-0.5 text-[10px] text-slate-700">
                <CalendarDays className="size-3" />
                {getDisplayDay(task.date)}
              </span>
            ) : null}
            {task.link && variant !== "calendar" ? (
              <a
                href={task.link}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/75 px-2 py-0.5 text-[10px] text-slate-700 transition hover:bg-white"
              >
                <Link2 className="size-3" />
                Ссылка
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
