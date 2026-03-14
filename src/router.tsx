import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "@/components/layout/app-shell";
import { getAbPageData } from "@/services/ab-service";
import { getCardsPageData } from "@/services/cards-service";
import { getProjectCatalog } from "@/services/project-service";

import { AbTestsPage } from "./pages/ab-tests-page";
import { CardsPage } from "./pages/cards-page";
import { HomePage } from "./pages/home-page";

function NotFoundPage() {
  return (
    <div className="rounded-[32px] border border-white/60 bg-white/80 p-8 shadow-[0_28px_80px_-46px_rgba(15,23,42,0.58)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/74">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700 dark:text-teal-300">404</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-slate-50">
        Маршрут не найден
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
        Проверь путь или вернись на обзор проекта, чтобы открыть доступные страницы.
      </p>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        loader: async () => ({
          projects: await getProjectCatalog(),
        }),
        element: <HomePage />,
      },
      {
        path: "cards",
        loader: getCardsPageData,
        handle: {
          legacy: true,
        },
        element: <CardsPage />,
      },
      {
        path: "ab-tests",
        loader: getAbPageData,
        handle: {
          legacy: true,
        },
        element: <AbTestsPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
