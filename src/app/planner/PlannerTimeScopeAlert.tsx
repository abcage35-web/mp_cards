import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { Button } from "@/app/components/ui/button";

interface PlannerTimeScopeAlertProps {
  open: boolean;
  taskTitle?: string;
  onClose: () => void;
  onApplySeries: () => void;
  onApplyInstance: () => void;
}

export function PlannerTimeScopeAlert({
  open,
  taskTitle,
  onClose,
  onApplySeries,
  onApplyInstance,
}: PlannerTimeScopeAlertProps) {
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <AlertDialogContent className="border-white/80 bg-white/95 shadow-[0_40px_100px_-45px_rgba(15,23,42,0.65)]">
        <AlertDialogHeader>
          <AlertDialogTitle>Как применить изменение времени?</AlertDialogTitle>
          <AlertDialogDescription className="leading-6 text-slate-600">
            {taskTitle
              ? `Задача «${taskTitle}» связана с повторением или несколькими исполнителями. Выберите, менять все расписание или только конкретный день.`
              : "Выберите область применения изменения."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:flex-col sm:items-stretch">
          <Button className="rounded-2xl" onClick={onApplySeries}>
            Применить на все расписание
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={onApplyInstance}>
            Только на конкретный день
          </Button>
          <Button variant="ghost" className="rounded-2xl" onClick={onClose}>
            Отмена
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
