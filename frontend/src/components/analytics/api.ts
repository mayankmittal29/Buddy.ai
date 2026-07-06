const API_URL = import.meta.env.VITE_API_URL

export type DateRange = "week" | "month"

export interface ProductivityStats {
  days: number
  total: number
  done: number
  completion_rate: number
}

export interface GoalsStats {
  days: number
  planned: number
  completed: number
  adherence_rate: number
}

export interface FinanceStats {
  month: string
  spend: number
  budget: number
  pct_used: number | null
  by_category: Record<string, number>
}

export interface LearningStats {
  total: number
  done: number
  in_progress: number
  planned: number
  completion_rate: number
}

export interface HabitsStats {
  total_habits: number
  avg_current_streak: number
  longest_current_streak: number
  done_today: number
}

export interface CareerStats {
  total: number
  by_status: {
    just_found: number
    applied: number
    interview: number
    offer: number
    rejected: number
    withdrawn: number
  }
  offer_rate: number
}

export interface AnalyticsOverview {
  range_days: number
  productivity: ProductivityStats
  goals: GoalsStats
  finance: FinanceStats
  learning: LearningStats
  habits: HabitsStats
  career: CareerStats
}

export interface WeeklyReport {
  report: string
  overview: AnalyticsOverview
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ? String(body.detail) : `request failed (${res.status})`)
  }
  return res.json()
}

export async function getAnalyticsOverview(range: DateRange): Promise<AnalyticsOverview> {
  const res = await fetch(`${API_URL}/api/analytics/overview?range=${range}`)
  return unwrap(res)
}

export async function generateWeeklyReport(range: DateRange): Promise<WeeklyReport> {
  const res = await fetch(`${API_URL}/api/analytics/weekly-report?range=${range}`, {
    method: "POST",
  })
  return unwrap(res)
}
