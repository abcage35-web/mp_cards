export interface AbPageData {
  shellUrl: string;
  pageTitle: string;
  summary: string;
}

export async function getAbPageData(): Promise<AbPageData> {
  return {
    shellUrl: "/ab-tests/legacy-shell.html",
    pageTitle: "Media Plan — AB-тесты",
    summary: "AB‑дашборд поднимается через typed route loader и сохраняет текущий XWAY runtime и React overlay.",
  };
}
