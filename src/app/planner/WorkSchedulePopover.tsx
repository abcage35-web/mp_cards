import { Clock3 } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { getParticipantWorkHoursPerDay } from "@/app/planner/planner-utils";
import type { ParticipantId, ParticipantWorkSchedule } from "@/app/planner/types";

interface WorkScheduleItem {
  id: ParticipantId;
  name: string;
  shortName: string;
}

interface WorkSchedulePopoverProps {
  participants: WorkScheduleItem[];
  schedules: Record<ParticipantId, ParticipantWorkSchedule>;
  onChange: (participantId: ParticipantId, field: "startTime" | "endTime", value: string) => void;
}

export function WorkSchedulePopover({
  participants,
  schedules,
  onChange,
}: WorkSchedulePopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 rounded-2xl border-slate-200 bg-white px-4 text-slate-700 shadow-none"
        >
          <Clock3 className="size-4 text-slate-400" />
          График работы
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[360px] rounded-2xl border-white/80 bg-white/95 p-4 shadow-[0_22px_60px_-35px_rgba(15,23,42,0.35)]"
      >
        <div className="mb-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Индивидуальное рабочее время
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            Красным в таймлайне будет подсвечено время вне рабочего окна сотрудника.
          </div>
        </div>

        <div className="space-y-3">
          {participants.map((participant) => {
            const schedule = schedules[participant.id];
            const hours = getParticipantWorkHoursPerDay(schedule);

            return (
              <div
                key={participant.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{participant.name}</div>
                    <div className="text-xs text-slate-500">
                      {schedule.startTime} - {schedule.endTime} · {hours}ч
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`work-start-${participant.id}`}
                      className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
                    >
                      От
                    </Label>
                    <Input
                      id={`work-start-${participant.id}`}
                      type="time"
                      step="1800"
                      value={schedule.startTime}
                      onChange={(event) => onChange(participant.id, "startTime", event.target.value)}
                      className="h-10 rounded-xl border-slate-200 bg-white text-sm shadow-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`work-end-${participant.id}`}
                      className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
                    >
                      До
                    </Label>
                    <Input
                      id={`work-end-${participant.id}`}
                      type="time"
                      step="1800"
                      value={schedule.endTime}
                      onChange={(event) => onChange(participant.id, "endTime", event.target.value)}
                      className="h-10 rounded-xl border-slate-200 bg-white text-sm shadow-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
