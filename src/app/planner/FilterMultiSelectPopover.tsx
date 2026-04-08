import { ChevronDown } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { cn } from "@/app/components/ui/utils";

interface FilterOption {
  id: string;
  label: string;
}

interface FilterMultiSelectPopoverProps {
  buttonLabel: string;
  summaryLabel: string;
  title: string;
  options: FilterOption[];
  selectedIds: string[];
  onToggle: (id: string, checked: boolean) => void;
}

export function FilterMultiSelectPopover({
  buttonLabel,
  summaryLabel,
  title,
  options,
  selectedIds,
  onToggle,
}: FilterMultiSelectPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 rounded-2xl border-slate-200 bg-white px-4 text-slate-700 shadow-none"
        >
          {buttonLabel}: {summaryLabel}
          <ChevronDown className="size-4 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 rounded-2xl border-white/80 bg-white/95 p-3 shadow-[0_22px_60px_-35px_rgba(15,23,42,0.35)]"
      >
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          {title}
        </div>
        <div className="space-y-1.5">
          {options.map((option) => {
            const checked = selectedIds.includes(option.id);

            return (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
                  checked ? "bg-slate-100/80" : "hover:bg-slate-50",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => onToggle(option.id, Boolean(value))}
                />
                <span className="text-sm text-slate-700">{option.label}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
