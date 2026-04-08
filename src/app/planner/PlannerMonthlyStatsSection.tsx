import { Badge } from "@/app/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { PARTICIPANTS } from "@/app/planner/constants";
import { formatHours } from "@/app/planner/planner-utils";
import { getMonthlyLoadTone } from "@/app/planner/planner-view-utils";
import type { ParticipantId } from "@/app/planner/types";
import type { ParticipantMonthlyStat } from "@/app/planner/page-types";

interface PlannerMonthlyStatsSectionProps {
  participantMonthlyStats: ParticipantMonthlyStat[];
  monthLabel: string;
  monthWorkingDayCount: number;
  onOpenParticipantStats: (participantId: ParticipantId) => void;
}

export function PlannerMonthlyStatsSection({
  participantMonthlyStats,
  monthLabel,
  monthWorkingDayCount,
  onOpenParticipantStats,
}: PlannerMonthlyStatsSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {participantMonthlyStats.map((stat) => {
        const participant = PARTICIPANTS.find((participantItem) => participantItem.id === stat.participantId);
        const usagePercent = Math.max(0, Math.min(100, stat.usagePercent));
        const loadTone = getMonthlyLoadTone(usagePercent, stat.overloadHours);
        const topTasks = stat.tasks.slice(0, 6);
        const remainingTaskCount = Math.max(stat.tasks.length - topTasks.length, 0);

        if (!participant) {
          return null;
        }

        return (
          <Card
            key={`month-stats-${participant.id}`}
            className={[
              "border-white/80 bg-white/88 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.5)]",
              participant.glowClass,
            ].join(" ")}
          >
            <CardHeader className="space-y-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      "mt-1 h-10 w-1.5 rounded-full bg-gradient-to-b",
                      participant.accentClass,
                    ].join(" ")}
                  />
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-950">
                      {participant.name}
                    </CardTitle>
                    <CardDescription className="mt-1 text-sm text-slate-500">
                      {monthLabel}
                    </CardDescription>
                  </div>
                </div>

                <Badge variant="outline" className={["bg-white/90", loadTone.badgeClass].join(" ")}>
                  {stat.taskCount} задач
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Осталось / всего
                  </p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className={["text-2xl font-semibold tracking-tight", loadTone.accentTextClass].join(" ")}>
                      {formatHours(stat.remainingHours)}
                    </span>
                    <span className="pb-0.5 text-sm text-slate-400">/ {formatHours(stat.capacityHours)}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Занято в месяце
                  </p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-2xl font-semibold tracking-tight text-slate-950">
                      {formatHours(stat.plannedHours)}
                    </span>
                    <span className="pb-0.5 text-sm text-slate-400">{monthWorkingDayCount} раб. дней</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <span>Загрузка месяца</span>
                  <span>{usagePercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={["h-full rounded-full transition-all", loadTone.barClass].join(" ")}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{loadTone.summaryLabel}</span>
                  {stat.overloadHours > 0 ? (
                    <span className="font-medium text-rose-600">+{formatHours(stat.overloadHours)}</span>
                  ) : null}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/75 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Задачи месяца
                  </p>
                  <span className="text-xs text-slate-400">{stat.tasks.length} позиций</span>
                </div>

                {topTasks.length > 0 ? (
                  <div className="space-y-2">
                    {topTasks.map((taskStat) => (
                      <div
                        key={`${participant.id}-${taskStat.title}`}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-white/90 bg-white/85 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{taskStat.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {taskStat.occurrences} {taskStat.occurrences === 1 ? "раз" : "раза"}
                          </p>
                        </div>

                        <Badge
                          variant="outline"
                          className="shrink-0 border-slate-200 bg-slate-50 text-slate-700"
                        >
                          {formatHours(taskStat.hours)}
                        </Badge>
                      </div>
                    ))}

                    {remainingTaskCount > 0 ? (
                      <p className="px-1 text-xs text-slate-500">
                        Ещё {remainingTaskCount} задач в этом месяце.
                      </p>
                    ) : null}

                    <div className="flex justify-end pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded-xl border-slate-200 bg-white/90 px-3 text-xs text-slate-700 shadow-none"
                        onClick={() => onOpenParticipantStats(participant.id)}
                      >
                        {remainingTaskCount > 0 ? "Показать все" : "Весь список"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-sm text-slate-500">
                    В этом месяце у {participant.name} пока нет задач в календаре.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
