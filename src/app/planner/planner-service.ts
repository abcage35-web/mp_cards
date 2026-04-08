import type {
  PlannerSaveSummary,
  PlannerState,
  PlannerStateResponse,
} from "./types";

async function parsePlannerResponse(response: Response): Promise<PlannerStateResponse> {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }

  const data = payload as Partial<PlannerStateResponse> & { error?: string };
  if (!response.ok || !data?.ok || !data.payload || !data.storage || !data.stats) {
    throw new Error(data?.error || "Не удалось выполнить запрос к хранилищу планировщика.");
  }

  return data as PlannerStateResponse;
}

export async function fetchPlannerState() {
  const response = await fetch("/api/planner-state", {
    method: "GET",
    cache: "no-store",
  });

  return parsePlannerResponse(response);
}

export async function persistPlannerState(
  payload: PlannerState,
  summary: PlannerSaveSummary,
  options?: { keepalive?: boolean },
) {
  const response = await fetch("/api/planner-state", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      payload,
      summary,
    }),
    keepalive: options?.keepalive === true,
  });

  return parsePlannerResponse(response);
}

