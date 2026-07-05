const API_URL = import.meta.env.VITE_API_URL

export interface ConversationSummary {
  id: number
  title: string
  mode: string | null
  created_at: string
  message_count: number
}

export interface ConversationMessage {
  id: number
  role: "user" | "assistant"
  content: string
  created_at: string
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ? String(body.detail) : `request failed (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export async function listConversations(
  skillId: string,
  mode?: string
): Promise<ConversationSummary[]> {
  const query = mode ? `?mode=${encodeURIComponent(mode)}` : ""
  const res = await fetch(`${API_URL}/api/skills/${skillId}/conversations${query}`)
  return unwrap(res)
}

export async function createConversation(
  skillId: string,
  mode?: string
): Promise<ConversationSummary> {
  const query = mode ? `?mode=${encodeURIComponent(mode)}` : ""
  const res = await fetch(`${API_URL}/api/skills/${skillId}/conversations${query}`, {
    method: "POST",
  })
  return unwrap(res)
}

export async function getConversationMessages(
  skillId: string,
  conversationId: number
): Promise<ConversationMessage[]> {
  const res = await fetch(
    `${API_URL}/api/skills/${skillId}/conversations/${conversationId}/messages`
  )
  return unwrap(res)
}

export async function deleteConversation(skillId: string, conversationId: number): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/skills/${skillId}/conversations/${conversationId}`,
    { method: "DELETE" }
  )
  return unwrap(res)
}
