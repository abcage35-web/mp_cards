import { createBrowserRouter } from "react-router";
import { DashboardPage } from "./pages/DashboardPage";
import { CardsPage } from "./pages/CardsPage";
import { Layout } from "./Layout";
import { XwayAbTestsPage } from "./pages/XwayAbTestsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      {
        index: true,
        Component: DashboardPage,
      },
      {
        path: "cards",
        Component: CardsPage,
      },
      {
        path: "ab-tests",
        Component: DashboardPage,
      },
      {
        path: "ab-tests-xway",
        Component: XwayAbTestsPage,
      },
    ],
  },
]);
