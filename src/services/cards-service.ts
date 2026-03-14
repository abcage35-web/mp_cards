export interface CardsPageData {
  shellUrl: string;
  pageTitle: string;
  summary: string;
}

export async function getCardsPageData(): Promise<CardsPageData> {
  return {
    shellUrl: "/cards/legacy-shell.html",
    pageTitle: "Media Plan — Карточки",
    summary: "Legacy-страница карточек загружается внутри React Router shell без потери текущей бизнес-логики.",
  };
}
