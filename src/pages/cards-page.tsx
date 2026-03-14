import { useLoaderData } from "react-router-dom";

import { LegacyPageHost } from "@/components/legacy/legacy-page-host";
import { type CardsPageData } from "@/services/cards-service";

export function CardsPage() {
  const data = useLoaderData() as CardsPageData;

  return (
    <LegacyPageHost
      shellUrl={data.shellUrl}
      pageTitle={data.pageTitle}
      summary={data.summary}
      includeInlineScripts={false}
    />
  );
}
