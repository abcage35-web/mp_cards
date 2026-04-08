import { createRoot } from "react-dom/client";

import { PlannerPage } from "./app/pages/PlannerPage";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <div
    className="min-h-screen bg-[#eef3f8] text-slate-950"
    style={{ fontFamily: "Inter, sans-serif" }}
  >
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-sky-300/15 blur-3xl" />
      <div className="absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-emerald-300/15 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-[320px] w-[520px] rounded-full bg-fuchsia-300/10 blur-3xl" />
    </div>
    <div className="relative w-full px-4 py-5 md:px-6 xl:px-8">
      <PlannerPage standalone />
    </div>
  </div>,
);
