export type ProjectSlug = "cards" | "ab-tests";

export interface ProjectDescriptor {
  slug: ProjectSlug;
  eyebrow: string;
  title: string;
  description: string;
  href: `/${string}`;
  accent: string;
  stats: Array<{
    label: string;
    value: string;
  }>;
  stackNotes: string[];
}

const PROJECTS: ProjectDescriptor[] = [
  {
    slug: "cards",
    eyebrow: "WB Catalog",
    title: "Дашборд карточек",
    description:
      "Большой операционный экран с фильтрами, таблицей качества, оверлеями, экспортом и кабинетами продавцов.",
    href: "/cards/",
    accent: "from-teal-500/20 via-cyan-500/10 to-slate-950/0",
    stats: [
      { label: "Слой", value: "Legacy host" },
      { label: "Маршрут", value: "/cards/" },
      { label: "Совместимость", value: "DOM + scripts" },
    ],
    stackNotes: ["React route", "Typed loader", "Legacy asset bridge"],
  },
  {
    slug: "ab-tests",
    eyebrow: "XWAY + Sheets",
    title: "AB-дэшборд обложек",
    description:
      "Figma-ориентированная оболочка для AB‑аналитики с XWAY, темой, фильтрами, funnel-блоком и карточками тестов.",
    href: "/ab-tests/",
    accent: "from-slate-900/10 via-teal-500/18 to-cyan-500/10",
    stats: [
      { label: "Слой", value: "React + legacy runtime" },
      { label: "Маршрут", value: "/ab-tests/" },
      { label: "Тема", value: "Light / Dark" },
    ],
    stackNotes: ["React Router data mode", "Figma token-ready theme", "Legacy runtime sync"],
  },
];

export const overviewFunnelData = [
  { name: "Shell", value: 100, fill: "#0f766e" },
  { name: "Routes", value: 82, fill: "#0d9488" },
  { name: "Type-safe loaders", value: 64, fill: "#14b8a6" },
  { name: "Legacy adapters", value: 47, fill: "#2dd4bf" },
];

export async function getProjectCatalog() {
  return PROJECTS;
}

export async function getProjectDescriptor(slug: ProjectSlug) {
  const project = PROJECTS.find((item) => item.slug === slug);

  if (!project) {
    throw new Response("Project not found", { status: 404 });
  }

  return project;
}
