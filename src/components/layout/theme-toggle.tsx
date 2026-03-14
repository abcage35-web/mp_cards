import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LaptopMinimal, MoonStar, SunMedium } from "lucide-react";

import { cn } from "@/lib/cn";
import { type ThemePreference, useTheme } from "@/lib/theme";

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof SunMedium;
}> = [
  { value: "light", label: "Светлая", icon: SunMedium },
  { value: "dark", label: "Тёмная", icon: MoonStar },
  { value: "system", label: "Системная", icon: LaptopMinimal },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const TriggerIcon = resolvedTheme === "dark" ? MoonStar : SunMedium;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/80 text-slate-700 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.55)] backdrop-blur-md transition hover:border-teal-300/60 hover:text-teal-700 focus-visible:ring-2 focus-visible:ring-teal-400/40 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:border-teal-400/40 dark:hover:text-teal-200"
          aria-label="Сменить тему"
        >
          <TriggerIcon className="h-5 w-5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={12}
          align="end"
          className="z-50 min-w-48 rounded-3xl border border-slate-200/70 bg-white/92 p-2 text-slate-700 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.48)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/88 dark:text-slate-100"
        >
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = theme === option.value;

            return (
              <DropdownMenu.Item
                key={option.value}
                onSelect={() => setTheme(option.value)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium outline-none transition",
                  isActive
                    ? "bg-teal-500/12 text-teal-700 dark:bg-teal-400/12 dark:text-teal-200"
                    : "hover:bg-slate-950/5 dark:hover:bg-white/6",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{option.label}</span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
