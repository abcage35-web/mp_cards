import { GripVertical, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDrag, useDrop } from "react-dnd";

import { Button } from "@/app/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { cn } from "@/app/components/ui/utils";
import type { TaskGroupId } from "@/app/planner/types";

interface GroupOrderItem {
  id: TaskGroupId;
  label: string;
  badgeClass: string;
}

interface GroupOrderPopoverProps {
  groups: GroupOrderItem[];
  onCommitOrder: (nextOrder: TaskGroupId[]) => void;
  onReset: () => void;
}

interface DragGroupOrderItem {
  index: number;
  type: typeof GROUP_ORDER_DND_TYPE;
}

const GROUP_ORDER_DND_TYPE = "planner-group-order";

interface GroupOrderRowProps {
  group: GroupOrderItem;
  index: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

function GroupOrderRow({ group, index, onReorder }: GroupOrderRowProps) {
  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: GROUP_ORDER_DND_TYPE,
      item: { index, type: GROUP_ORDER_DND_TYPE },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [index],
  );

  const [, dropRef] = useDrop<DragGroupOrderItem>(
    () => ({
      accept: GROUP_ORDER_DND_TYPE,
      hover: (item) => {
        if (item.index === index) {
          return;
        }

        onReorder(item.index, index);
        item.index = index;
      },
    }),
    [index, onReorder],
  );

  return (
    <div
      ref={(node) => {
        dragRef(dropRef(node));
      }}
      className={cn(
        "flex cursor-grab items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition-opacity",
        isDragging && "opacity-60",
      )}
    >
      <GripVertical className="size-4 shrink-0 text-slate-400" />
      <span
        className={cn(
          "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium",
          group.badgeClass,
        )}
      >
        {group.label}
      </span>
    </div>
  );
}

export function GroupOrderPopover({
  groups,
  onCommitOrder,
  onReset,
}: GroupOrderPopoverProps) {
  const [open, setOpen] = useState(false);
  const [localGroups, setLocalGroups] = useState(groups);
  const orderedLabels = useMemo(() => groups.map((group) => group.label).join(" • "), [groups]);

  useEffect(() => {
    setLocalGroups(groups);
  }, [groups]);

  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    setLocalGroups((current) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length ||
        fromIndex === toIndex
      ) {
        return current;
      }

      const nextGroups = [...current];
      const [movedGroup] = nextGroups.splice(fromIndex, 1);
      nextGroups.splice(toIndex, 0, movedGroup);
      return nextGroups;
    });
  }, []);

  const commitLocalOrder = useCallback(() => {
    const currentOrder = groups.map((group) => group.id);
    const nextOrder = localGroups.map((group) => group.id);

    if (currentOrder.join("|") !== nextOrder.join("|")) {
      onCommitOrder(nextOrder);
    }
  }, [groups, localGroups, onCommitOrder]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          commitLocalOrder();
        } else {
          setLocalGroups(groups);
        }

        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 rounded-2xl border-slate-200 bg-white px-4 text-slate-700 shadow-none"
          title={orderedLabels}
        >
          Порядок групп
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 rounded-2xl border-white/80 bg-white/95 p-3 shadow-[0_22px_60px_-35px_rgba(15,23,42,0.35)]"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Порядок групп
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Перетаскивайте строки, чтобы менять порядок в банке и календаре.
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-xl text-slate-500"
            onClick={() => {
              onReset();
              setLocalGroups(groups);
            }}
            title="Сбросить порядок"
            aria-label="Сбросить порядок"
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>

        <div className="space-y-1.5">
          {localGroups.map((group, index) => (
            <GroupOrderRow
              key={group.id}
              group={group}
              index={index}
              onReorder={handleReorder}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
