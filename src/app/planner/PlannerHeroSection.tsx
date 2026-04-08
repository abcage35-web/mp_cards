import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Save,
} from "lucide-react";

import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

interface PlannerHeroSectionProps {
  monthLabel: string;
  bankTaskCount: number;
  scheduledTaskCount: number;
  selectedMonthIndex: number;
  monthOptions: Array<{ value: string; label: string }>;
  loadError: string | null;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectMonth: (value: string) => void;
}

export function PlannerHeroSection({
  monthLabel,
  bankTaskCount,
  scheduledTaskCount,
  selectedMonthIndex,
  monthOptions,
  loadError,
  onPreviousMonth,
  onNextMonth,
  onSelectMonth,
}: PlannerHeroSectionProps) {
  return (
    <>
      <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.94),_rgba(236,253,245,0.85)_35%,_rgba(239,246,255,0.88)_70%,_rgba(248,250,252,0.94)_100%)] p-4 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.45)] sm:p-6">
        <div className="absolute -left-16 top-0 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative grid gap-5 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-end">
          <div className="max-w-4xl space-y-4">
            <Badge
              variant="outline"
              className="border-white/80 bg-white/80 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-600"
            >
              Standalone Planner
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-5xl">
                Планировщик задач на текущий месяц
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
                Отдельная самостоятельная страница с банком задач, календарями и
                постоянным сохранением в локальные JSON и NDJSON файлы.
              </p>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-start">
            <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-white/80 bg-white/70 p-3 shadow-none">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 rounded-2xl text-slate-500 hover:bg-white/80"
                onClick={onPreviousMonth}
                disabled={selectedMonthIndex === 0}
                aria-label="Предыдущий месяц"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <div className="min-w-[220px] flex-1">
                <Select value={String(selectedMonthIndex)} onValueChange={onSelectMonth}>
                  <SelectTrigger className="h-11 rounded-2xl border-white/80 bg-white/90 text-left shadow-none">
                    <SelectValue placeholder="Выбрать месяц 2026" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-white/80 bg-white/95">
                    {monthOptions.map((monthOption) => (
                      <SelectItem
                        key={`planner-month-${monthOption.value}`}
                        value={monthOption.value}
                        className="rounded-xl capitalize"
                      >
                        {monthOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 rounded-2xl text-slate-500 hover:bg-white/80"
                onClick={onNextMonth}
                disabled={selectedMonthIndex === 11}
                aria-label="Следующий месяц"
              >
                <ChevronRight className="size-4" />
              </Button>

              <Badge variant="outline" className="border-white/80 bg-white/85 text-slate-700">
                2026
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
              <Card className="border-white/80 bg-white/70 shadow-none">
                <CardContent className="px-5 py-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <CalendarRange className="size-4" />
                    <span className="text-xs uppercase tracking-[0.16em]">Месяц</span>
                  </div>
                  <div className="mt-2 text-xl font-semibold capitalize text-slate-900">
                    {monthLabel}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/80 bg-white/70 shadow-none">
                <CardContent className="px-5 py-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Clock3 className="size-4" />
                    <span className="text-xs uppercase tracking-[0.16em]">В банке</span>
                  </div>
                  <div className="mt-2 text-xl font-semibold text-slate-900">
                    {bankTaskCount}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/80 bg-white/70 shadow-none">
                <CardContent className="px-5 py-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Save className="size-4" />
                    <span className="text-xs uppercase tracking-[0.16em]">Запланировано</span>
                  </div>
                  <div className="mt-2 text-xl font-semibold text-slate-900">
                    {scheduledTaskCount}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {loadError ? (
        <Card className="border-amber-200 bg-amber-50/90">
          <CardContent className="px-5 py-4 text-sm text-amber-900">
            Хранилище пока не ответило: {loadError}. Для постоянного сохранения
            планировщик нужно запускать через `vite`, чтобы локальный API был
            доступен.
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
