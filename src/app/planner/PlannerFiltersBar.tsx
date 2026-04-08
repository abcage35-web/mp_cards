import { ChevronRight, SlidersHorizontal } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/components/ui/utils";
import { FilterMultiSelectPopover } from "@/app/planner/FilterMultiSelectPopover";
import { GroupOrderPopover } from "@/app/planner/GroupOrderPopover";
import { PARTICIPANTS, TASK_GROUPS, TASK_PROGRESS_STATUSES } from "@/app/planner/constants";
import { WorkSchedulePopover } from "@/app/planner/WorkSchedulePopover";
import type {
  ParticipantId,
  ParticipantWorkSchedule,
  TaskGroupId,
  TaskProgressStatus,
} from "@/app/planner/types";

interface PlannerFiltersBarProps {
  visibleParticipantIds: ParticipantId[];
  isBankVisible: boolean;
  calendarDisplayMode: "day" | "time";
  isCalendarCompactMode: boolean;
  hideWeekends: boolean;
  interleaveWeeksByParticipant: boolean;
  taskStatusFilterLabel: string;
  taskGroupFilterLabel: string;
  orderedTaskGroups: Array<(typeof TASK_GROUPS)[number]>;
  visibleTaskProgressStatuses: TaskProgressStatus[];
  visibleTaskGroupIds: TaskGroupId[];
  participantWorkSchedules: Record<ParticipantId, ParticipantWorkSchedule>;
  workHoursDraft: string;
  onToggleVisibleParticipant: (participantId: ParticipantId) => void;
  onShowBank: () => void;
  onSetCalendarDisplayMode: (mode: "day" | "time") => void;
  onToggleCalendarCompactMode: () => void;
  onToggleVisibleTaskProgressStatus: (progressStatus: TaskProgressStatus, checked: boolean) => void;
  onToggleVisibleTaskGroup: (groupId: TaskGroupId, checked: boolean) => void;
  onCommitTaskGroupOrder: (nextOrder: TaskGroupId[]) => void;
  onResetTaskGroupOrder: () => void;
  onUpdateParticipantWorkSchedule: (
    participantId: ParticipantId,
    field: "startTime" | "endTime",
    value: string,
  ) => void;
  onToggleHideWeekends: () => void;
  onToggleInterleaveWeeksByParticipant: () => void;
  onSetWorkHoursDraft: (value: string) => void;
  onCommitWorkHoursPerDay: (value: string) => void;
}

export function PlannerFiltersBar({
  visibleParticipantIds,
  isBankVisible,
  calendarDisplayMode,
  isCalendarCompactMode,
  hideWeekends,
  interleaveWeeksByParticipant,
  taskStatusFilterLabel,
  taskGroupFilterLabel,
  orderedTaskGroups,
  visibleTaskProgressStatuses,
  visibleTaskGroupIds,
  participantWorkSchedules,
  workHoursDraft,
  onToggleVisibleParticipant,
  onShowBank,
  onSetCalendarDisplayMode,
  onToggleCalendarCompactMode,
  onToggleVisibleTaskProgressStatus,
  onToggleVisibleTaskGroup,
  onCommitTaskGroupOrder,
  onResetTaskGroupOrder,
  onUpdateParticipantWorkSchedule,
  onToggleHideWeekends,
  onToggleInterleaveWeeksByParticipant,
  onSetWorkHoursDraft,
  onCommitWorkHoursPerDay,
}: PlannerFiltersBarProps) {
  return (
    <Card className="border-white/80 bg-white/82 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.55)]">
      <CardContent className="px-4 py-4 md:px-5 md:py-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-slate-700 shadow-sm">
              <SlidersHorizontal className="size-4 text-slate-500" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Фильтры
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {PARTICIPANTS.map((participant) => {
                const isVisible = visibleParticipantIds.includes(participant.id);

                return (
                  <button
                    key={`filter-row-${participant.id}`}
                    type="button"
                    onClick={() => onToggleVisibleParticipant(participant.id)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                      isVisible
                        ? "border-slate-900 bg-slate-900 text-white shadow-[0_10px_30px_-18px_rgba(15,23,42,0.8)]"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900",
                    )}
                  >
                    {participant.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isBankVisible ? (
              <Button
                type="button"
                variant="outline"
                onClick={onShowBank}
                className="h-11 shrink-0 rounded-2xl border-slate-200 bg-white px-4 text-slate-700 shadow-none"
              >
                <ChevronRight className="size-4 text-slate-400" />
                Банк задач
              </Button>
            ) : null}

            <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-none">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onSetCalendarDisplayMode("day")}
                className={cn(
                  "h-9 rounded-xl px-3",
                  calendarDisplayMode === "day"
                    ? "bg-slate-900 text-white hover:bg-slate-900"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                По дням
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onSetCalendarDisplayMode("time")}
                className={cn(
                  "h-9 rounded-xl px-3",
                  calendarDisplayMode === "time"
                    ? "bg-slate-900 text-white hover:bg-slate-900"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                По времени
              </Button>
            </div>

            {calendarDisplayMode === "day" ? (
              <Button
                type="button"
                variant="outline"
                onClick={onToggleCalendarCompactMode}
                className={cn(
                  "h-11 shrink-0 rounded-2xl px-4 shadow-none",
                  isCalendarCompactMode
                    ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-900"
                    : "border-slate-200 bg-white text-slate-700",
                )}
              >
                {isCalendarCompactMode ? "Полный календарь" : "Компактный календарь"}
              </Button>
            ) : null}

            <FilterMultiSelectPopover
              buttonLabel="Статусы"
              summaryLabel={taskStatusFilterLabel}
              title="Статусы задач"
              options={TASK_PROGRESS_STATUSES.map((status) => ({
                id: status.id,
                label: status.label,
              }))}
              selectedIds={visibleTaskProgressStatuses}
              onToggle={(id, checked) =>
                onToggleVisibleTaskProgressStatus(id as TaskProgressStatus, checked)
              }
            />

            <FilterMultiSelectPopover
              buttonLabel="Типы"
              summaryLabel={taskGroupFilterLabel}
              title="Типы задач"
              options={orderedTaskGroups.map((group) => ({
                id: group.id,
                label: group.label,
              }))}
              selectedIds={visibleTaskGroupIds}
              onToggle={(id, checked) => onToggleVisibleTaskGroup(id as TaskGroupId, checked)}
            />

            <GroupOrderPopover
              groups={orderedTaskGroups}
              onCommitOrder={onCommitTaskGroupOrder}
              onReset={onResetTaskGroupOrder}
            />

            <WorkSchedulePopover
              participants={PARTICIPANTS}
              schedules={participantWorkSchedules}
              onChange={onUpdateParticipantWorkSchedule}
            />

            <Button
              type="button"
              variant={hideWeekends ? "default" : "outline"}
              className={cn(
                "shrink-0 rounded-2xl",
                hideWeekends && "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]",
              )}
              onClick={onToggleHideWeekends}
            >
              {hideWeekends ? "Показать выходные" : "Убрать выходные"}
            </Button>

            <Button
              type="button"
              variant={interleaveWeeksByParticipant ? "default" : "outline"}
              className={cn(
                "shrink-0 rounded-2xl",
                interleaveWeeksByParticipant && "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]",
              )}
              onClick={onToggleInterleaveWeeksByParticipant}
            >
              {interleaveWeeksByParticipant ? "Месяц по исполнителям" : "Недели по исполнителям"}
            </Button>

            <div className="flex min-w-[220px] grow items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 sm:grow-0">
              <Label
                htmlFor="work-hours-per-day"
                className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
              >
                Рабочее время в день
              </Label>
              <div className="ml-auto flex items-center gap-2">
                <Input
                  id="work-hours-per-day"
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={workHoursDraft}
                  onChange={(event) => onSetWorkHoursDraft(event.target.value)}
                  onBlur={(event) => onCommitWorkHoursPerDay(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onCommitWorkHoursPerDay(workHoursDraft);
                    }
                  }}
                  className="h-9 w-24 rounded-xl border-slate-200 bg-white text-sm shadow-none"
                />
                <span className="text-sm text-slate-500">ч</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
