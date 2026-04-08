import { ChevronLeft, Plus } from "lucide-react";

import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { TASK_GROUPS } from "@/app/planner/constants";
import { TaskGroupSection } from "@/app/planner/TaskGroupSection";
import type { PlannerStorageInfo } from "@/app/planner/types";
import type { PlannerDerivedCollections } from "@/app/planner/page-types";
import type {
  PlannerTask,
  TaskGroupId,
  TaskProgressStatus,
  ContainerSpec,
} from "@/app/planner/types";

const EMPTY_TASK_LIST: PlannerTask[] = [];

interface PlannerBankSidebarProps {
  orderedTaskGroups: Array<(typeof TASK_GROUPS)[number]>;
  visibleTaskGroupIds: TaskGroupId[];
  collapsedBankGroupIds: TaskGroupId[];
  derivedTaskCollections: PlannerDerivedCollections;
  saveLabel: string;
  saveStatus: "loading" | "dirty" | "saving" | "saved" | "error";
  storageInfo: PlannerStorageInfo | null;
  onCreateTask: (groupId?: TaskGroupId) => void;
  onHideBank: () => void;
  onToggleCollapsed: (groupId: TaskGroupId) => void;
  onMoveTask: (taskId: string, containerSpec: ContainerSpec, targetIndex: number) => void;
  onDragActivityChange: (active: boolean) => void;
  onToggleTaskProgressStatus: (taskId: string, nextProgressStatus: TaskProgressStatus) => void;
  onOpenTask: (task: PlannerTask) => void;
}

export function PlannerBankSidebar({
  orderedTaskGroups,
  visibleTaskGroupIds,
  collapsedBankGroupIds,
  derivedTaskCollections,
  saveLabel,
  saveStatus,
  storageInfo,
  onCreateTask,
  onHideBank,
  onToggleCollapsed,
  onMoveTask,
  onDragActivityChange,
  onToggleTaskProgressStatus,
  onOpenTask,
}: PlannerBankSidebarProps) {
  return (
    <aside className="2xl:sticky 2xl:top-6 2xl:self-start">
      <Card className="flex max-h-none flex-col overflow-hidden border-white/80 bg-white/82 shadow-[0_22px_60px_-45px_rgba(15,23,42,0.6)] backdrop-blur-xl xl:max-h-[calc(100vh-1.5rem)]">
        <CardHeader className="border-b border-white/70 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-2xl font-semibold text-slate-950">Банк задач</CardTitle>
              <CardDescription className="mt-2 text-sm leading-6 text-slate-600">
                Панель закреплена слева. Отсюда задачи можно перетаскивать в календарь и
                возвращать обратно.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button className="rounded-2xl" onClick={() => onCreateTask()}>
                <Plus className="size-4" />
                Новая
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 rounded-2xl border-slate-200 bg-white/90 text-slate-600 shadow-none hover:bg-white"
                onClick={onHideBank}
                aria-label="Скрыть банк задач"
                title="Скрыть банк задач"
              >
                <ChevronLeft className="size-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-slate-200 bg-white/85 text-slate-700">
              {saveLabel}
            </Badge>
            <Badge
              variant="outline"
              className={[
                "border-transparent",
                saveStatus === "saved" ? "bg-emerald-100 text-emerald-800" : "",
                saveStatus === "saving" ? "bg-sky-100 text-sky-800" : "",
                saveStatus === "dirty" ? "bg-amber-100 text-amber-800" : "",
                saveStatus === "error" ? "bg-rose-100 text-rose-800" : "",
                saveStatus === "loading" ? "bg-slate-100 text-slate-700" : "",
              ].join(" ")}
            >
              {saveStatus}
            </Badge>
          </div>

          {storageInfo ? (
            <div className="mt-4 space-y-1 text-xs text-slate-500">
              <div>Состояние: {storageInfo.stateFile}</div>
              <div>Лог изменений: {storageInfo.logFile}</div>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="min-h-0 overflow-y-visible px-4 py-4 xl:overflow-y-auto">
          <div className="space-y-3 pr-1">
            {orderedTaskGroups
              .filter((group) => visibleTaskGroupIds.includes(group.id))
              .map((group) => (
                <TaskGroupSection
                  key={group.id}
                  title={group.label}
                  groupId={group.id}
                  tasks={derivedTaskCollections.bankTasksByGroup.get(group.id) || EMPTY_TASK_LIST}
                  containerSpec={{
                    kind: "bank",
                    group: group.id,
                  }}
                  collapsible
                  collapsed={collapsedBankGroupIds.includes(group.id)}
                  onToggleCollapsed={onToggleCollapsed}
                  onCreateTask={onCreateTask}
                  onMoveTask={onMoveTask}
                  onDragActivityChange={onDragActivityChange}
                  onToggleTaskProgressStatus={onToggleTaskProgressStatus}
                  onOpenTask={onOpenTask}
                />
              ))}
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
