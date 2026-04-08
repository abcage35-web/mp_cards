import { format } from "date-fns";

import { Badge } from "@/app/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/utils";
import { CalendarDayCell } from "@/app/planner/CalendarDayCell";
import { CalendarTimeDayCell } from "@/app/planner/CalendarTimeDayCell";
import { PARTICIPANTS } from "@/app/planner/constants";
import { TimelineWeekAxis } from "@/app/planner/TimelineWeekAxis";
import { getWeekRangeLabel } from "@/app/planner/planner-view-utils";
import type { PlannerDerivedCollections } from "@/app/planner/page-types";
import type {
  ContainerSpec,
  ParticipantId,
  ParticipantWorkSchedule,
  PlannerTask,
  TaskGroupId,
  TaskProgressStatus,
} from "@/app/planner/types";

const EMPTY_TASK_LIST: PlannerTask[] = [];
const EMPTY_DAY_GROUP_ENTRIES: PlannerDerivedCollections["calendarDayEntriesByKey"] extends Map<
  string,
  infer TValue
>
  ? TValue
  : never = [];

interface PlannerCalendarCardProps {
  participant: (typeof PARTICIPANTS)[number];
  currentMonth: Date;
  monthLabel: string;
  weekDays?: Date[];
  weekIndex?: number;
  visibleMonthWeeks: Date[][];
  visibleMonthDays: Date[];
  visibleWeekdayEntries: { label: string; index: number }[];
  calendarDisplayMode: "day" | "time";
  hideWeekends: boolean;
  isCalendarCompactMode: boolean;
  participantWorkHoursPerDay: number;
  workHoursPerDay: number;
  participantWorkSchedule: ParticipantWorkSchedule;
  currentTimeMs: number;
  derivedTaskCollections: PlannerDerivedCollections;
  onMoveTask: (taskId: string, containerSpec: ContainerSpec, targetIndex: number) => void;
  onMoveTaskToTimeSlot: (
    taskId: string,
    participantId: ParticipantId,
    dateKey: string,
    startTime: string,
  ) => void;
  onMoveTaskToUntimed: (taskId: string, participantId: ParticipantId, dateKey: string) => void;
  onDragActivityChange: (active: boolean) => void;
  onResizeTaskDuration: (taskId: string, nextHours: number) => void;
  onToggleTaskProgressStatus: (taskId: string, nextProgressStatus: TaskProgressStatus) => void;
  onOpenTask: (task: PlannerTask) => void;
}

export function PlannerCalendarCard({
  participant,
  currentMonth,
  monthLabel,
  weekDays,
  weekIndex,
  visibleMonthWeeks,
  visibleMonthDays,
  visibleWeekdayEntries,
  calendarDisplayMode,
  hideWeekends,
  isCalendarCompactMode,
  participantWorkHoursPerDay,
  workHoursPerDay,
  participantWorkSchedule,
  currentTimeMs,
  derivedTaskCollections,
  onMoveTask,
  onMoveTaskToTimeSlot,
  onMoveTaskToUntimed,
  onDragActivityChange,
  onResizeTaskDuration,
  onToggleTaskProgressStatus,
  onOpenTask,
}: PlannerCalendarCardProps) {
  const isWeeklySequenceCard = Array.isArray(weekDays) && weekDays.length > 0;
  const renderedWeeks = isWeeklySequenceCard ? [weekDays] : visibleMonthWeeks;
  const renderedDays = isWeeklySequenceCard ? weekDays : visibleMonthDays;
  const renderedDayKeys = renderedDays.map((day) => `${participant.id}:${format(day, "yyyy-MM-dd")}`);
  const displayTaskCount = isWeeklySequenceCard
    ? renderedDayKeys.reduce(
        (total, dayKey) => total + (derivedTaskCollections.calendarDayTasksByKey.get(dayKey)?.length || 0),
        0,
      )
    : derivedTaskCollections.participantStatsById.get(participant.id)?.taskCount || 0;
  const displayHours = isWeeklySequenceCard
    ? Math.round(
        renderedDayKeys.reduce(
          (total, dayKey) => total + (derivedTaskCollections.dayHoursByKey.get(dayKey) || 0),
          0,
        ) * 10,
      ) / 10
    : Math.round((derivedTaskCollections.participantStatsById.get(participant.id)?.hours || 0) * 10) / 10;
  const titleLabel = isWeeklySequenceCard ? `Неделя ${Number(weekIndex) + 1}` : participant.name;
  const subtitleLabel = isWeeklySequenceCard
    ? `${participant.name} · ${getWeekRangeLabel(weekDays)}`
    : monthLabel;
  const descriptionLabel = isWeeklySequenceCard
    ? "Карточка показывает только одну неделю текущего месяца для выбранного исполнителя."
    : `${monthLabel}. Отображается только текущий месяц. Задачи можно перетаскивать по дням, между группами и обратно в банк задач.`;
  const cardKey = isWeeklySequenceCard ? `${participant.id}-week-${weekIndex}` : participant.id;

  return (
    <Card
      key={cardKey}
      className={cn(
        "overflow-hidden border-white/80 bg-white/82 shadow-[0_30px_70px_-45px_rgba(15,23,42,0.6)]",
        participant.glowClass,
      )}
    >
      <CardHeader className="border-b border-white/70 pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "h-12 w-1.5 rounded-full bg-gradient-to-b md:h-14",
                participant.accentClass,
              )}
            />
            <div>
              <CardTitle className="text-2xl font-semibold uppercase tracking-[0.04em] text-slate-950 md:text-3xl">
                {titleLabel}
              </CardTitle>
              <CardDescription className="mt-2 max-w-2xl text-sm text-slate-600">
                <span className="block font-medium text-slate-700">{subtitleLabel}</span>
                <span className="mt-1 block">{descriptionLabel}</span>
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="border-white/80 bg-white/85 text-slate-700">
              {displayTaskCount} задач
            </Badge>
            <Badge variant="outline" className="border-white/80 bg-white/85 text-slate-700">
              {displayHours.toFixed(1)} ч
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3 py-3 md:px-4 md:py-4">
        <div className="overflow-x-auto">
          <div
            className={cn(
              "space-y-3",
              calendarDisplayMode === "time"
                ? hideWeekends
                  ? "min-w-[900px] lg:min-w-[1060px]"
                  : "min-w-[1180px] lg:min-w-[1400px]"
                : isCalendarCompactMode
                  ? hideWeekends
                    ? "min-w-[680px] lg:min-w-[720px]"
                    : "min-w-[860px] lg:min-w-[980px]"
                  : hideWeekends
                    ? "min-w-[760px] lg:min-w-[820px]"
                    : "min-w-[980px] lg:min-w-[1120px]",
            )}
          >
            {calendarDisplayMode === "time" ? (
              <div className="rounded-[24px] bg-slate-200/70">
                <div
                  className="grid gap-px rounded-t-[24px] bg-slate-200/70"
                  style={{
                    gridTemplateColumns: `76px repeat(${visibleWeekdayEntries.length}, minmax(0, 1fr))`,
                  }}
                >
                  <div className="bg-slate-50 px-3 py-2 text-center text-[11px] font-semibold tracking-[0.14em] text-slate-400">
                    Время
                  </div>
                  {visibleWeekdayEntries.map(({ label: weekday, index: weekdayIndex }) => (
                    <div
                      key={`${cardKey}-${weekday}`}
                      className={cn(
                        "px-3 py-2 text-center text-[11px] font-semibold tracking-[0.14em]",
                        weekdayIndex >= 5 ? "bg-rose-50/70 text-rose-500" : "bg-slate-50 text-slate-500",
                      )}
                    >
                      {weekday}
                    </div>
                  ))}
                </div>

                <div className="space-y-px rounded-b-[24px] bg-slate-200/70">
                  {renderedWeeks.map((week, weekRowIndex) => (
                    <div
                      key={`${cardKey}-week-row-${weekRowIndex}`}
                      className="grid gap-px bg-slate-200/70"
                      style={{
                        gridTemplateColumns: `76px repeat(${visibleWeekdayEntries.length}, minmax(0, 1fr))`,
                      }}
                    >
                      <TimelineWeekAxis />
                      {week.map((day) => (
                        <CalendarTimeDayCell
                          key={`${cardKey}-${day.toISOString()}`}
                          date={day}
                          currentMonth={currentMonth}
                          dayTasks={
                            derivedTaskCollections.calendarDayTasksByKey.get(
                              `${participant.id}:${format(day, "yyyy-MM-dd")}`,
                            ) || EMPTY_TASK_LIST
                          }
                          dayHours={
                            derivedTaskCollections.dayHoursByKey.get(
                              `${participant.id}:${format(day, "yyyy-MM-dd")}`,
                            ) || 0
                          }
                          participantId={participant.id}
                          workHoursPerDay={participantWorkHoursPerDay || workHoursPerDay}
                          participantWorkSchedule={participantWorkSchedule}
                          currentTimeMs={currentTimeMs}
                          onMoveTaskToTimeSlot={onMoveTaskToTimeSlot}
                          onMoveTaskToUntimed={onMoveTaskToUntimed}
                          onDragActivityChange={onDragActivityChange}
                          onResizeTaskDuration={onResizeTaskDuration}
                          onToggleTaskProgressStatus={onToggleTaskProgressStatus}
                          onOpenTask={onOpenTask}
                          showTimelineLabels={false}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div
                  className="grid gap-px rounded-t-[24px] bg-slate-200/70"
                  style={{
                    gridTemplateColumns: `repeat(${visibleWeekdayEntries.length}, minmax(0, 1fr))`,
                  }}
                >
                  {visibleWeekdayEntries.map(({ label: weekday, index: weekdayIndex }) => (
                    <div
                      key={`${cardKey}-${weekday}`}
                      className={cn(
                        "px-3 py-2 text-center text-[11px] font-semibold tracking-[0.14em]",
                        weekdayIndex >= 5 ? "bg-rose-50/70 text-rose-500" : "bg-slate-50 text-slate-500",
                      )}
                    >
                      {weekday}
                    </div>
                  ))}
                </div>
                <div
                  className="grid gap-px rounded-b-[24px] bg-slate-200/70"
                  style={{
                    gridTemplateColumns: `repeat(${visibleWeekdayEntries.length}, minmax(0, 1fr))`,
                  }}
                >
                  {renderedDays.map((day) => (
                    <CalendarDayCell
                      key={`${cardKey}-${day.toISOString()}`}
                      date={day}
                      currentMonth={currentMonth}
                      groupEntries={
                        derivedTaskCollections.calendarDayEntriesByKey.get(
                          `${participant.id}:${format(day, "yyyy-MM-dd")}`,
                        ) || EMPTY_DAY_GROUP_ENTRIES
                      }
                      dayHours={
                        derivedTaskCollections.dayHoursByKey.get(
                          `${participant.id}:${format(day, "yyyy-MM-dd")}`,
                        ) || 0
                      }
                      participantId={participant.id}
                      minimal={isCalendarCompactMode}
                      workHoursPerDay={participantWorkHoursPerDay || workHoursPerDay}
                      onMoveTask={onMoveTask}
                      onDragActivityChange={onDragActivityChange}
                      onToggleTaskProgressStatus={onToggleTaskProgressStatus}
                      onOpenTask={onOpenTask}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
