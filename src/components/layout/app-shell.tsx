import { Blocks, ChartNoAxesCombined, LayoutDashboard, LoaderCircle } from "lucide-react";
import { Link, Outlet, useLocation, useMatches, useNavigation } from "react-router-dom";

import { cn } from "@/lib/cn";

import { ThemeToggle } from "./theme-toggle";

const navigationItems = [
  {
    href: "/",
    label: "Обзор",
    icon: LayoutDashboard,
    reloadDocument: false,
  },
  {
    href: "/cards/",
    label: "Карточки",
    icon: Blocks,
    reloadDocument: true,
  },
  {
    href: "/ab-tests/",
    label: "AB‑тесты",
    icon: ChartNoAxesCombined,
    reloadDocument: true,
  },
] as const;

export function AppShell() {
  const matches = useMatches();
  const location = useLocation();
  const navigation = useNavigation();
  const isLegacyRoute = matches.some((match) => {
    const handle = match.handle as { legacy?: boolean } | undefined;
    return Boolean(handle?.legacy);
  });

  if (isLegacyRoute) {
    return <Outlet />;
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-[-180px] h-[360px] bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.22),transparent_58%)]" />
        <div className="absolute right-[-120px] top-28 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl dark:bg-teal-300/8" />
        <div className="absolute left-[-100px] top-56 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl dark:bg-cyan-200/6" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-white/72 backdrop-blur-xl dark:bg-slate-950/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-br from-slate-950 via-slate-800 to-teal-700 text-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.75)]">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal-700 dark:text-teal-300">
                Media Plan
              </p>
              <h1 className="text-lg font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-50">
                React shell для внутренних дашбордов
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-2 rounded-full border border-white/60 bg-white/65 p-1.5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70 md:flex">
              {navigationItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? location.pathname === "/"
                    : location.pathname === item.href || location.pathname === item.href.slice(0, -1);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    reloadDocument={item.reloadDocument}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                      isActive
                        ? "bg-teal-500 text-white shadow-[0_18px_40px_-28px_rgba(13,148,136,0.95)]"
                        : "text-slate-600 hover:bg-slate-950/5 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/6 dark:hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {navigation.state !== "idle" ? (
        <div className="fixed inset-x-0 top-[81px] z-40 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-white/92 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_16px_34px_-24px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-teal-300/20 dark:bg-slate-950/80 dark:text-slate-100">
            <LoaderCircle className="h-4 w-4 animate-spin text-teal-600 dark:text-teal-300" />
            <span>Перехожу по маршруту…</span>
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
