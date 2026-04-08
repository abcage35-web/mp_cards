import { Link, useLocation } from "react-router";
import { BarChart3, ExternalLink, FileText, FlaskConical, Moon, Sun } from "lucide-react";

interface NavigationProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export function Navigation({ darkMode, onToggleDarkMode }: NavigationProps) {
  const location = useLocation();

  const navItems = [
    { path: "/ab-tests-xway", label: "AB Tests XWAY", icon: FlaskConical },
    { path: "/ab-tests", label: "AB Tests", icon: BarChart3 },
    { path: "/cards", label: "Карточки товаров", icon: FileText },
  ];

  const xwayUrl = "https://am.xway.ru/wb/ab-tests";

  return (
    <nav className="mb-4 rounded-2xl border border-slate-200/80 bg-white/90 p-2 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/90">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const pathname = location.pathname.replace(/\/+$/, "") || "/";
            const normalizedPath = item.path.replace(/\/+$/, "") || "/";
            const isDashboardAlias = normalizedPath === "/ab-tests" && pathname === "/";
            const isActive = pathname === normalizedPath || isDashboardAlias;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[14px] transition-all ${
                  isActive
                    ? "bg-gradient-to-b from-teal-600 to-teal-700 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
                style={{ fontWeight: 600 }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={xwayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-orange-300 bg-gradient-to-b from-orange-500 to-orange-600 px-4 text-[14px] text-white shadow-sm transition-all hover:from-orange-400 hover:to-orange-500 hover:shadow-md dark:border-orange-700 dark:from-orange-600 dark:to-orange-700 dark:hover:from-orange-500 dark:hover:to-orange-600"
            style={{ fontWeight: 700 }}
            title="Открыть XWAY"
          >
            <span>XWAY</span>
            <ExternalLink className="h-4 w-4" />
          </a>

          <button
            onClick={onToggleDarkMode}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-700"
            title={darkMode ? "Светлая тема" : "Тёмная тема"}
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </nav>
  );
}
