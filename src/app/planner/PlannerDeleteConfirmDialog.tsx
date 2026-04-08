import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";

interface PlannerDeleteConfirmDialogProps {
  open: boolean;
  linkedSeriesCount: number;
  assigneeNames: string[];
  canDetachInstance: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteInstance: () => void;
  onDeleteSeries: () => void;
}

export function PlannerDeleteConfirmDialog({
  open,
  linkedSeriesCount,
  assigneeNames,
  canDetachInstance,
  onOpenChange,
  onDeleteInstance,
  onDeleteSeries,
}: PlannerDeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-white/80 bg-white/95 shadow-[0_40px_100px_-45px_rgba(15,23,42,0.65)]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {linkedSeriesCount > 1 ? "Удалить связанную серию задач?" : "Удалить задачу?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="leading-6 text-slate-600">
            {linkedSeriesCount > 1
              ? `Будут удалены все связанные копии задачи у исполнителей: ${assigneeNames.join(", ")}. Это действие нельзя отменить.`
              : "Задача будет удалена без возможности восстановления."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-2xl">Отмена</AlertDialogCancel>
          {canDetachInstance ? (
            <AlertDialogAction
              className="rounded-2xl border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 focus-visible:ring-rose-500"
              onClick={onDeleteInstance}
            >
              Удалить только этот день
            </AlertDialogAction>
          ) : null}
          <AlertDialogAction
            className="rounded-2xl bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500"
            onClick={onDeleteSeries}
          >
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
