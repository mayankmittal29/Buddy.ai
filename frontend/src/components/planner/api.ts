const API_URL = import.meta.env.VITE_API_URL

export type PlannerMode = "daily" | "weekly" | "monthly"
export type PlannerStatus = "pending" | "done"

export interface PlannerItem {
  id: number
  mode: PlannerMode
  title: string
  details: string | null
  hours_needed: number | null
  deadline: string | null
  status: PlannerStatus
  created_at: string
}

export interface DailySchedule {
  free_blocks: { start: string; end: string }[]
  schedule: { start: string; end: string; activity: string }[]
  unscheduled: string[]
}

export interface BriefingByMode {
  daily: PlannerItem[]
  weekly: PlannerItem[]
  monthly: PlannerItem[]
}

export interface EveningReview {
  completed: PlannerItem[]
  pending: PlannerItem[]
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ? String(body.detail) : `request failed (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export async function listPlannerItems(
  mode: PlannerMode,
  status?: PlannerStatus
): Promise<PlannerItem[]> {
  const params = new URLSearchParams({ mode })
  if (status) params.set("status", status)
  const res = await fetch(`${API_URL}/api/planner?${params.toString()}`)
  return unwrap(res)
}

export async function updatePlannerItem(
  id: number,
  input: Partial<Pick<PlannerItem, "title" | "hours_needed" | "deadline" | "status">>
): Promise<PlannerItem> {
  const res = await fetch(`${API_URL}/api/planner/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return unwrap(res)
}

export async function deletePlannerItem(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/planner/${id}`, { method: "DELETE" })
  return unwrap(res)
}

export async function getDailySchedule(): Promise<DailySchedule> {
  const res = await fetch(`${API_URL}/api/planner/daily-schedule`)
  return unwrap(res)
}

export function exportUrl(mode: PlannerMode): string {
  return `${API_URL}/api/planner/export?mode=${mode}`
}

export async function getMorningBriefing(): Promise<BriefingByMode> {
  const res = await fetch(`${API_URL}/api/planner/morning-briefing`)
  return unwrap(res)
}

export async function getEveningReview(): Promise<EveningReview> {
  const res = await fetch(`${API_URL}/api/planner/evening-review`)
  return unwrap(res)
}
