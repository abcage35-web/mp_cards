import { useLoaderData } from "react-router-dom";

import { LegacyPageHost } from "@/components/legacy/legacy-page-host";
import { type AbPageData } from "@/services/ab-service";

function prepareAbRuntime() {
  const resolvedTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
  window.__AB_USE_REACT__ = true;

  try {
    window.localStorage.setItem("ab-dashboard-theme", resolvedTheme);
  } catch {}
}

export function AbTestsPage() {
  const data = useLoaderData() as AbPageData;

  return (
    <LegacyPageHost
      shellUrl={data.shellUrl}
      pageTitle={data.pageTitle}
      summary={data.summary}
      includeInlineScripts={false}
      onBeforeBoot={prepareAbRuntime}
    />
  );
}
