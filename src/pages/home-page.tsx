import { ArrowRight, Database, FileCode2, Route, ShieldCheck } from "lucide-react";
import { Link, useLoaderData } from "react-router-dom";
import { Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip } from "recharts";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { type ProjectDescriptor, overviewFunnelData } from "@/services/project-service";

interface HomePageData {
  projects: ProjectDescriptor[];
}

const capabilityNotes = [
  {
    icon: Route,
    title: "React Router Data Mode",
    description: "Страницы получают typed loaders и роутятся через единый shell без ручных HTML-переходов.",
  },
  {
    icon: FileCode2,
    title: "Figma-compatible foundation",
    description: "React 18, TSX, Tailwind v4 и slate/teal токены подогнаны под make-файл и дальнейшие правки.",
  },
  {
    icon: Database,
    title: "Service layer",
    description: "Данные и конфигурации маршрутов вынесены в сервисы, чтобы заменять legacy-части без сноса приложения.",
  },
  {
    icon: ShieldCheck,
    title: "Без потери runtime",
    description: "Текущие скрипты карточек и AB‑тестов поднимаются через bridge, а не переписываются вслепую.",
  },
];

export function HomePage() {
  const { projects } = useLoaderData() as HomePageData;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative overflow-hidden rounded-[36px] border border-white/60 bg-white/78 p-7 shadow-[0_28px_90px_-42px_rgba(15,23,42,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/76">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.1),transparent_38%)]" />
          <div className="relative space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700 dark:text-teal-300">
                Новый прикладной стек
              </p>
              <h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-slate-50 sm:text-5xl">
                Vite 6, React 18, TypeScript и Tailwind v4 как общий слой для всего Media Plan.
              </h2>
              <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Этот shell держит роутинг, тему, типы и дизайн-токены. Карточки и AB‑тесты уже заведены в него через
                совместимые legacy-host адаптеры, чтобы можно было переносить фигмовый код без ручного расклеивания
                страниц.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="primary" size="lg">
                <Link to="/cards/" reloadDocument>
                  Открыть карточки
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg">
                <Link to="/ab-tests/" reloadDocument>
                  Открыть AB‑тесты
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {capabilityNotes.map((note) => {
                const Icon = note.icon;
                return (
                  <article
                    key={note.title}
                    className="rounded-[26px] border border-slate-200/70 bg-slate-50/80 p-4 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/4"
                  >
                    <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-teal-500/12 text-teal-700 dark:text-teal-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-100">
                      {note.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{note.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-[36px] border border-white/60 bg-white/74 p-6 shadow-[0_28px_90px_-42px_rgba(15,23,42,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/76">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700 dark:text-teal-300">
                Recharts bridge
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-slate-50">
                Funnel совместимости
              </h3>
            </div>
            <div className="rounded-full border border-slate-200/70 bg-slate-50/80 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              Tailwind + Tokens
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    borderRadius: 20,
                    border: "1px solid rgba(148, 163, 184, 0.22)",
                    backgroundColor: "rgba(15, 23, 42, 0.92)",
                    color: "#f8fafc",
                    boxShadow: "0 24px 60px -36px rgba(15, 23, 42, 0.86)",
                  }}
                />
                <Funnel data={overviewFunnelData} dataKey="value" isAnimationActive={false}>
                  <LabelList dataKey="name" position="right" fill="#94a3b8" stroke="none" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Слой shell уже на новом стеке. Следующий безопасный шаг: вытаскивать отдельные зоны legacy-дашбордов в
            TSX-компоненты, не ломая текущие runtime-сценарии.
          </p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {projects.map((project) => (
          <article
            key={project.slug}
            className="group relative overflow-hidden rounded-[32px] border border-white/60 bg-white/78 p-6 shadow-[0_28px_80px_-46px_rgba(15,23,42,0.58)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/74"
          >
            <div className={cn("pointer-events-none absolute inset-0 bg-linear-to-br opacity-90", project.accent)} />
            <div className="relative space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700 dark:text-teal-300">
                  {project.eyebrow}
                </p>
                <h3 className="text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-slate-50">
                  {project.title}
                </h3>
                <p className="max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300">{project.description}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {project.stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[24px] border border-slate-200/70 bg-white/72 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {project.stackNotes.map((note) => (
                  <span
                    key={note}
                    className="rounded-full border border-teal-500/20 bg-teal-500/8 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-200"
                  >
                    {note}
                  </span>
                ))}
              </div>

              <Button asChild variant="secondary">
                <Link to={project.href} reloadDocument>
                  Открыть маршрут
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
