import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { cn } from "@/app/components/ui/utils";
import { formatHours } from "@/app/planner/planner-utils";
import { getMonthlyTaskOccurrenceLabel } from "@/app/planner/planner-view-utils";
import type { ParticipantMonthlyStat } from "@/app/planner/page-types";
import type { ParticipantId } from "@/app/planner/types";
import { PARTICIPANTS } from "@/app/planner/constants";

interface PlannerMonthlyStatsDialogProps {
  open: boolean;
  participantStat: ParticipantMonthlyStat | null;
  monthLabel: string;
  monthWorkingDayCount: number;
  onClose: () => void;
}

export function PlannerMonthlyStatsDialog({
  open,
  participantStat,
  monthLabel,
  monthWorkingDayCount,
  onClose,
}: PlannerMonthlyStatsDialogProps) {
  const activeParticipant = participantStat
    ? PARTICIPANTS.find((participant) => participant.id === participantStat.participantId) || null
    : null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden border-white/80 bg-white/95 p-0 shadow-[0_40px_100px_-45px_rgba(15,23,42,0.65)] sm:max-w-4xl">
        {participantStat && activeParticipant ? (
          <>
            <DialogHeader className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(240,253,250,0.96),_rgba(239,246,255,0.96)_42%,_rgba(255,255,255,0.98)_100%)] px-6 py-5">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-1 h-10 w-1.5 rounded-full bg-gradient-to-b",
                    activeParticipant.accentClass,
                  )}
                />
                <div className="space-y-2">
                  <DialogTitle className="text-2xl font-semibold text-slate-950">
                    {activeParticipant.name}
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-6 text-slate-600">
                    Полный список задач за {monthLabel}. Здесь собраны все задачи месяца с суммой
                    часов и количеством повторений.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Осталось / всего
                  </p>
                  <div className="mt-2 flex items-end gap-2">
                    <span
                      className={cn(
                        "text-2xl font-semibold tracking-tight",
                        participantStat.overloadHours > 0 ? "text-rose-600" : "text-slate-950",
                      )}
                    >
                      {formatHours(participantStat.remainingHours)}
                    </span>
                    <span className="pb-0.5 text-sm text-slate-400">
                      / {formatHours(participantStat.capacityHours)}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Занято в месяце
                  </p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-2xl font-semibold tracking-tight text-slate-950">
                      {formatHours(participantStat.plannedHours)}
                    </span>
                    <span className="pb-0.5 text-sm text-slate-400">{monthWorkingDayCount} раб. дней</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Позиции / задачи
                  </p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-2xl font-semibold tracking-tight text-slate-950">
                      {participantStat.tasks.length}
                    </span>
                    <span className="pb-0.5 text-sm text-slate-400">/ {participantStat.taskCount}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Полный список задач месяца
                  </p>
                  <Badge variant="outline" className="border-slate-200 bg-white/90 text-slate-700">
                    {participantStat.tasks.length} позиций
                  </Badge>
                </div>

                {participantStat.tasks.length > 0 ? (
                  <div className="space-y-2">
                    {participantStat.tasks.map((taskStat) => (
                      <div
                        key={`stats-dialog-${participantStat.participantId}-${taskStat.title}`}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-white/90 bg-white/90 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium text-slate-900">
                            {taskStat.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {getMonthlyTaskOccurrenceLabel(taskStat.occurrences)}
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
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-sm text-slate-500">
                    В этом месяце для {activeParticipant.name} пока нет задач в календаре.
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="border-t border-slate-200/80 bg-white/90 px-6 py-4">
              <Button type="button" variant="outline" className="rounded-2xl" onClick={onClose}>
                Закрыть
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
