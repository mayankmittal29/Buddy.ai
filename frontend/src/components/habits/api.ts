const API_URL = import.meta.env.VITE_API_URL

export interface HabitLog {
  log_date: string
  done: boolean
}

export interface Habit {
  id: number
  title: string
  description: string | null
  created_at: string
  last_done: string | null
  times_done: number
  current_streak: number
  longest_streak: number
  logs: HabitLog[]
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ? String(body.detail) : `request failed (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export async function listHabits(days = 90): Promise<Habit[]> {
  const res = await fetch(`${API_URL}/api/habits?days=${days}`)
  return unwrap(res)
}

export async function createHabit(input: {
  title: string
  description?: string | null
}): Promise<Habit> {
  const res = await fetch(`${API_URL}/api/habits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return unwrap(res)
}

export async function toggleHabitToday(id: number): Promise<Habit> {
  const res = await fetch(`${API_URL}/api/habits/${id}/toggle`, { method: "POST" })
  return unwrap(res)
}

export async function deleteHabit(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/habits/${id}`, { method: "DELETE" })
  return unwrap(res)
}
