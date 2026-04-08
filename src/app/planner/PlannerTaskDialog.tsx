import type { Dispatch, SetStateAction } from "react";
import { Copy, Save, Trash2 } from "lucide-react";

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
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { cn } from "@/app/components/ui/utils";
import {
  PARTICIPANTS,
  RECURRENCE_FREQUENCIES,
  TASK_GROUPS,
  WEEKDAY_LABELS,
} from "@/app/planner/constants";
import { getDisplayDay, getParticipantName } from "@/app/planner/planner-utils";
import type { PlannerTask, TaskFormValues } from "@/app/planner/types";

interface PlannerTaskDialogProps {
  open: boolean;
  mode: "create" | "edit";
  monthLabel: string;
  formValues: TaskFormValues;
  formError: string | null;
  monthRange: { min: string; max: string };
  recurrenceStartDate: string;
  recurrenceSummary: string;
  automaticCalendarPlacement: boolean;
  selectedAssigneeNames: string[];
  selectedTask: PlannerTask | null;
  selectedTaskSeriesCount: number;
  setFormValues: Dispatch<SetStateAction<TaskFormValues>>;
  onOpenChange: (open: boolean) => void;
  onToggleAssignee: (participantId: (typeof PARTICIPANTS)[number]["id"]) => void;
  onSetTaskDateValue: (date: string) => void;
  onToggleRecurrenceWeekday: (weekdayIndex: number) => void;
  onUpdateRecurrenceWeekdayTiming: (
    weekdayIndex: number,
    field: "startTime" | "hours",
    rawValue: string,
  ) => void;
  onCloneTask: () => void;
  onDeleteTask: () => void;
  onSaveTask: () => void;
}

export function PlannerTaskDialog({
  open,
  mode,
  monthLabel,
  formValues,
  formError,
  monthRange,
  recurrenceStartDate,
  recurrenceSummary,
  automaticCalendarPlacement,
  selectedAssigneeNames,
  selectedTask,
  selectedTaskSeriesCount,
  setFormValues,
  onOpenChange,
  onToggleAssignee,
  onSetTaskDateValue,
  onToggleRecurrenceWeekday,
  onUpdateRecurrenceWeekdayTiming,
  onCloneTask,
  onDeleteTask,
  onSaveTask,
}: PlannerTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-1.25rem)] gap-0 overflow-hidden border-white/80 bg-white/95 p-0 shadow-[0_40px_100px_-45px_rgba(15,23,42,0.65)] sm:max-w-6xl sm:grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader className="border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(240,253,250,0.96),_rgba(239,246,255,0.96)_42%,_rgba(255,255,255,0.98)_100%)] px-4 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-[1.7rem] font-semibold leading-none text-slate-950">
                {mode === "create" ? "Новая задача" : "Настройки задачи"}
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                Настройте карточку и быстро проверьте итог справа. Если выбрать исполнителей и
                дату, задача сразу разместится на всех выбранных календарях.
              </DialogDescription>
            </div>

            <div className="flex flex-wrap gap-2 lg:max-w-[360px] lg:justify-end">
              <Badge variant="outline" className="border-white bg-white/90 text-slate-700">
                Текущий месяц: {monthLabel}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "border-white bg-white/90 text-slate-700",
                  automaticCalendarPlacement && "border-emerald-200 bg-emerald-50 text-emerald-700",
                )}
              >
                {automaticCalendarPlacement ? "Готово к размещению в календаре" : "Сохранение в банк"}
              </Badge>
              {selectedTaskSeriesCount > 1 ? (
                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                  Связано: {selectedTaskSeriesCount} копии
                </Badge>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain">
          <div className="grid gap-5 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_320px] md:px-6 md:py-5">
            <div className="space-y-5">
              {formError ? (
                <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {formError}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="task-title" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Название задачи
                </Label>
                <Input
                  id="task-title"
                  className="h-11 rounded-2xl border-slate-200 bg-white text-sm shadow-sm"
                  value={formValues.title}
                  onChange={(event) => setFormValues((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Например, Подготовить отчет по проекту"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-description" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Описание
                </Label>
                <Textarea
                  id="task-description"
                  className="min-h-[132px] rounded-[22px] border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                  value={formValues.description}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Детали задачи, ссылки на материалы, ожидания по результату."
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="task-hours" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Время, часы
                  </Label>
                  <Input
                    id="task-hours"
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    className="h-11 rounded-2xl border-slate-200 bg-white text-sm shadow-none"
                    value={formValues.hours}
                    onChange={(event) => setFormValues((current) => ({ ...current, hours: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-start-time" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Время начала
                  </Label>
                  <Input
                    id="task-start-time"
                    type="time"
                    step="1800"
                    className="h-11 rounded-2xl border-slate-200 bg-white text-sm shadow-none"
                    value={formValues.startTime}
                    onChange={(event) =>
                      setFormValues((current) => ({ ...current, startTime: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-date" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Дата
                  </Label>
                  <Input
                    id="task-date"
                    type="date"
                    min={monthRange.min}
                    max={monthRange.max}
                    className="h-11 rounded-2xl border-slate-200 bg-white text-sm shadow-none"
                    value={formValues.date}
                    onChange={(event) => onSetTaskDateValue(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-link" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Ссылка
                  </Label>
                  <Input
                    id="task-link"
                    className="h-11 rounded-2xl border-slate-200 bg-white text-sm shadow-none"
                    value={formValues.link}
                    onChange={(event) => setFormValues((current) => ({ ...current, link: event.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Группа
                </Label>
                <div className="flex flex-wrap gap-2">
                  {TASK_GROUPS.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setFormValues((current) => ({ ...current, group: group.id }))}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                        formValues.group === group.id
                          ? "border-amber-300 bg-amber-100 text-amber-900 shadow-[0_10px_18px_-16px_rgba(217,119,6,0.7)]"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900",
                      )}
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Исполнители
                  </Label>
                  <span className="text-xs text-slate-400">
                    {formValues.assignees.length > 0 ? `${formValues.assignees.length} выбрано` : "Не выбраны"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PARTICIPANTS.map((participant) => {
                    const selected = formValues.assignees.includes(participant.id);

                    return (
                      <button
                        key={participant.id}
                        type="button"
                        onClick={() => onToggleAssignee(participant.id)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                          selected
                            ? "border-slate-900 bg-slate-900 text-white shadow-[0_12px_28px_-18px_rgba(15,23,42,0.85)]"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900",
                        )}
                      >
                        {participant.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  Можно выбрать сразу несколько человек. Если указана дата, задача создастся на календаре каждого выбранного исполнителя.
                </p>
              </div>

              <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Повторение
                  </Label>
                  <span className="text-xs text-slate-400">{recurrenceSummary}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_112px]">
                  <div className="space-y-2">
                    <Label htmlFor="task-recurrence-frequency" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Тип повторения
                    </Label>
                    <select
                      id="task-recurrence-frequency"
                      value={formValues.recurrence.frequency}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          recurrence: {
                            ...current.recurrence,
                            frequency: event.target.value as typeof current.recurrence.frequency,
                          },
                        }))
                      }
                      className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                    >
                      {RECURRENCE_FREQUENCIES.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="task-recurrence-interval" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Каждый
                    </Label>
                    <Input
                      id="task-recurrence-interval"
                      type="number"
                      min="1"
                      max="52"
                      step="1"
                      className="h-11 rounded-2xl border-slate-200 bg-white text-sm shadow-none"
                      value={String(formValues.recurrence.interval)}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          recurrence: {
                            ...current.recurrence,
                            interval: Math.max(1, Number(event.target.value) || 1),
                          },
                        }))
                      }
                      disabled={formValues.recurrence.frequency === "none"}
                    />
                  </div>
                </div>

                {formValues.recurrence.frequency === "weekly" ? (
                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Дни недели
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_LABELS.map((weekday, weekdayIndex) => {
                        const selected = formValues.recurrence.weekdays.includes(weekdayIndex);

                        return (
                          <button
                            key={`repeat-weekday-${weekday}`}
                            type="button"
                            onClick={() => onToggleRecurrenceWeekday(weekdayIndex)}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                              selected
                                ? "border-amber-300 bg-amber-100 text-amber-900 shadow-[0_10px_18px_-16px_rgba(217,119,6,0.7)]"
                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900",
                            )}
                          >
                            {weekday}
                          </button>
                        );
                      })}
                    </div>

                    {formValues.recurrence.weekdays.length > 0 ? (
                      <div className="mt-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                        <div className="space-y-3">
                          {formValues.recurrence.weekdays
                            .slice()
                            .sort((left, right) => left - right)
                            .map((weekdayIndex) => {
                              const weekdayTiming = formValues.recurrence.weekdayTimings[weekdayIndex];
                              const weekdayHoursValue =
                                weekdayTiming?.hours !== undefined ? String(weekdayTiming.hours) : formValues.hours;
                              const weekdayStartTimeValue = weekdayTiming ? weekdayTiming.startTime || "" : formValues.startTime;

                              return (
                                <div
                                  key={`repeat-weekday-timing-${weekdayIndex}`}
                                  className="grid gap-3 rounded-[20px] border border-white/90 bg-white/90 p-3 sm:grid-cols-[84px_minmax(0,1fr)_140px]"
                                >
                                  <div className="flex items-center text-sm font-semibold text-slate-700">
                                    {WEEKDAY_LABELS[weekdayIndex]}
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label htmlFor={`repeat-weekday-time-${weekdayIndex}`} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                      Время начала
                                    </Label>
                                    <Input
                                      id={`repeat-weekday-time-${weekdayIndex}`}
                                      type="time"
                                      step="1800"
                                      value={weekdayStartTimeValue}
                                      onChange={(event) => onUpdateRecurrenceWeekdayTiming(weekdayIndex, "startTime", event.target.value)}
                                      className="h-10 rounded-2xl border-slate-200 bg-white text-sm shadow-none"
                                    />
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label htmlFor={`repeat-weekday-hours-${weekdayIndex}`} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                      Часы
                                    </Label>
                                    <Input
                                      id={`repeat-weekday-hours-${weekdayIndex}`}
                                      type="number"
                                      min="0"
                                      max="24"
                                      step="0.5"
                                      value={weekdayHoursValue}
                                      onChange={(event) => onUpdateRecurrenceWeekdayTiming(weekdayIndex, "hours", event.target.value)}
                                      className="h-10 rounded-2xl border-slate-200 bg-white text-sm shadow-none"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-500">
                          Для каждого выбранного дня недели можно задать свой старт и свою длительность.
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="task-recurrence-from-date" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    От даты
                  </Label>
                  <Input
                    id="task-recurrence-from-date"
                    type="date"
                    min={monthRange.min}
                    max={monthRange.max}
                    value={recurrenceStartDate}
                    onChange={(event) => onSetTaskDateValue(event.target.value)}
                    disabled={formValues.recurrence.frequency === "none"}
                    className="h-11 rounded-2xl border-slate-200 bg-white text-sm shadow-none"
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    Старт повторения. Синхронизируется с основной датой задачи.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFormValues((current) => ({
                        ...current,
                        recurrence: {
                          ...current.recurrence,
                          untilMode: "forever",
                        },
                      }))
                    }
                    className={cn(
                      "rounded-[20px] border px-4 py-3 text-left transition-all",
                      formValues.recurrence.untilMode === "forever"
                        ? "border-slate-900 bg-slate-900 text-white shadow-[0_12px_24px_-18px_rgba(15,23,42,0.8)]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    )}
                    disabled={formValues.recurrence.frequency === "none"}
                  >
                    <div className="text-sm font-semibold">Всегда</div>
                    <div className="mt-1 text-xs opacity-80">Без даты окончания</div>
                  </button>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFormValues((current) => ({
                          ...current,
                          recurrence: {
                            ...current.recurrence,
                            untilMode: "until",
                          },
                        }))
                      }
                      className={cn(
                        "w-full rounded-[20px] border px-4 py-3 text-left transition-all",
                        formValues.recurrence.untilMode === "until"
                          ? "border-primary bg-primary/10 text-slate-900 shadow-[0_12px_24px_-18px_rgba(13,148,136,0.5)]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      )}
                      disabled={formValues.recurrence.frequency === "none"}
                    >
                      <div className="text-sm font-semibold">До даты</div>
                      <div className="mt-1 text-xs opacity-80">Ограничить повторение</div>
                    </button>
                    <Input
                      type="date"
                      min={recurrenceStartDate || monthRange.min}
                      max={monthRange.max}
                      value={formValues.recurrence.untilDate}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          recurrence: {
                            ...current.recurrence,
                            untilDate: event.target.value,
                          },
                        }))
                      }
                      disabled={
                        formValues.recurrence.frequency === "none" ||
                        formValues.recurrence.untilMode !== "until"
                      }
                      className="h-11 rounded-2xl border-slate-200 bg-white text-sm shadow-none"
                    />
                  </div>
                </div>

                <p className="text-xs leading-5 text-slate-500">
                  Повторение работает для задач с датой в календаре. Время суток не учитывается, повторяются только даты.
                </p>
              </div>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
              <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Размещение
                </p>
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={() => setFormValues((current) => ({ ...current, status: "bank" }))}
                    className={cn(
                      "rounded-[20px] border px-4 py-3 text-left transition-all",
                      formValues.status === "bank"
                        ? "border-slate-900 bg-slate-900 text-white shadow-[0_14px_32px_-20px_rgba(15,23,42,0.9)]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    )}
                  >
                    <div className="text-sm font-semibold">Банк задач</div>
                    <div className="mt-1 text-xs opacity-80">Карточка остается слева до планирования.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormValues((current) => ({ ...current, status: "calendar" }))}
                    className={cn(
                      "rounded-[20px] border px-4 py-3 text-left transition-all",
                      formValues.status === "calendar"
                        ? "border-emerald-500 bg-emerald-500 text-white shadow-[0_14px_32px_-20px_rgba(16,185,129,0.9)]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    )}
                  >
                    <div className="text-sm font-semibold">В календари</div>
                    <div className="mt-1 text-xs opacity-80">Требуются исполнители и дата внутри текущего месяца.</div>
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  В банке можно заранее заполнить дату, повторение и исполнителей. Перенос в календари происходит только когда вы явно выбираете размещение или перетаскиваете задачу в нужный день.
                </p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Что произойдет
                </p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <p>
                    {automaticCalendarPlacement
                      ? `После сохранения задача появится в ${formValues.assignees.length} календарях на дату ${getDisplayDay(formValues.date)}.`
                      : formValues.date
                        ? `После сохранения задача останется в банке с датой ${getDisplayDay(formValues.date)} и будет готова к переносу.`
                        : "После сохранения задача останется в банке задач и будет готова к переносу."}
                  </p>
                  <p>
                    {selectedAssigneeNames.length > 0
                      ? `Исполнители: ${selectedAssigneeNames.join(", ")}`
                      : "Исполнители пока не выбраны."}
                  </p>
                  <p>Повторение: {recurrenceSummary}</p>
                  {selectedTask ? (
                    <p>
                      Сейчас:{" "}
                      {selectedTask.status === "calendar"
                        ? `${getParticipantName(selectedTask.assignee)} • ${selectedTask.date ? getDisplayDay(selectedTask.date) : "без даты"}`
                        : "банк задач"}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Контроль заполнения
                </p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  <p>Название обязательно всегда. Остальные поля можно заполнить позже.</p>
                  <p>Для размещения в календарях нужны исполнители и дата текущего месяца. В банке дату можно хранить как преднастройку.</p>
                  <p>Связанные задачи синхронизируются между всеми выбранными исполнителями.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200/80 px-4 py-4 sm:justify-between md:px-6">
          <div className="flex items-center gap-2">
            {mode === "edit" ? (
              <>
                <Button variant="outline" className="rounded-2xl" onClick={onCloneTask}>
                  <Copy className="size-4" />
                  Клонировать
                </Button>
                <Button variant="destructive" className="rounded-2xl" onClick={onDeleteTask}>
                  <Trash2 className="size-4" />
                  Удалить
                </Button>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button className="rounded-2xl" onClick={onSaveTask}>
              <Save className="size-4" />
              Сохранить
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
