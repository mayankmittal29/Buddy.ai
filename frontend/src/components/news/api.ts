const API_URL = import.meta.env.VITE_API_URL

export type NewsCategory = "ai" | "tech" | "github" | "research" | "startup" | "jobs"

export interface NewsItem {
  id: number
  category: NewsCategory
  title: string
  url: string
  source: string
  summary: string
  published_at: string
  fetched_at: string
  read: boolean
  starred: boolean
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ? String(body.detail) : `request failed (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export async function listNews(params?: {
  category?: NewsCategory | null
  starred?: boolean | null
  days?: number | null
}): Promise<NewsItem[]> {
  const search = new URLSearchParams()
  if (params?.category) search.set("category", params.category)
  if (params?.starred) search.set("starred", "true")
  if (params?.days) search.set("days", String(params.days))
  const qs = search.toString()
  const res = await fetch(`${API_URL}/api/news${qs ? `?${qs}` : ""}`)
  return unwrap(res)
}

export async function updateNewsItem(
  id: number,
  input: { read?: boolean; starred?: boolean }
): Promise<NewsItem | null> {
  const res = await fetch(`${API_URL}/api/news/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return unwrap(res)
}

export async function generateDigest(): Promise<{ added: number; by_category: Record<string, number> }> {
  const res = await fetch(`${API_URL}/api/news/generate-digest`, { method: "POST" })
  return unwrap(res)
}
