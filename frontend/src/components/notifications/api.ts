const API_URL = import.meta.env.VITE_API_URL

export interface Notification {
  id: number
  type: string
  title: string
  body: string
  source_skill: string | null
  source_id: number | null
  read: boolean
  created_at: string
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ? String(body.detail) : `request failed (${res.status})`)
  }
  return res.json()
}

export async function listNotifications(days?: number): Promise<Notification[]> {
  const query = days ? `?days=${days}` : ""
  const res = await fetch(`${API_URL}/api/notifications${query}`)
  return unwrap(res)
}

export async function getUnreadNotificationCount(): Promise<number> {
  const res = await fetch(`${API_URL}/api/notifications/unread-count`)
  const data = await unwrap<{ count: number }>(res)
  return data.count
}

export async function markNotificationRead(id: number, read = true): Promise<Notification> {
  const res = await fetch(`${API_URL}/api/notifications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ read }),
  })
  return unwrap(res)
}
