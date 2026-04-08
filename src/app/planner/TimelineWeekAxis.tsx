import {
  TIMELINE_ROW_HEIGHT,
  TIMELINE_SLOT_COUNT,
  TIMELINE_SLOT_MINUTES,
  TIMELINE_START_MINUTES,
} from "@/app/planner/constants";
import { minutesToTime } from "@/app/planner/planner-utils";

export function TimelineWeekAxis() {
  return (
    <div className="flex min-h-[520px] flex-col bg-slate-50/80 p-2">
      <div className="mb-2 flex h-8 items-center justify-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Время
      </div>

      <div
        className="relative rounded-[18px] border border-slate-200/90 bg-slate-50/85"
        style={{ height: TIMELINE_SLOT_COUNT * TIMELINE_ROW_HEIGHT }}
      >
        {Array.from({ length: TIMELINE_SLOT_COUNT }).map((_, slotIndex) => {
          const labelMinutes = TIMELINE_START_MINUTES + slotIndex * TIMELINE_SLOT_MINUTES;
          const isHourLabel = labelMinutes % 60 === 0;

          return (
            <div
              key={`timeline-axis-slot-${slotIndex}`}
              className="absolute inset-x-0 border-t border-slate-200/80"
              style={{ top: slotIndex * TIMELINE_ROW_HEIGHT }}
            >
              {isHourLabel ? (
                <span className="absolute left-2 top-0 -translate-y-1/2 bg-slate-50 px-1 text-[10px] font-medium text-slate-500">
                  {minutesToTime(labelMinutes)}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex-1 rounded-[18px] border border-dashed border-slate-200/70 bg-slate-50/55" />
    </div>
  );
}
