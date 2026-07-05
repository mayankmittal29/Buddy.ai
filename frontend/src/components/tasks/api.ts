const API_URL = import.meta.env.VITE_API_URL

export type TaskPriority = "urgent" | "normal" | "light"
export type TaskStatus = "pending" | "done"

export interface Task {
  id: number
  title: string
  notes: string | null
  priority: TaskPriority
  due_at: string | null
  recurrence_rule: string | null
  status: TaskStatus
  reminder_sent: boolean
  created_at: string
}

export interface NewTaskInput {
  title: string
  priority: TaskPriority
  due_at: string | null
  recurrence_rule?: string | null
}

export interface TaskUpdateInput {
  title?: string
  notes?: string | null
  priority?: TaskPriority
  due_at?: string | null
  recurrence_rule?: string | null
  status?: TaskStatus
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ? String(body.detail) : `request failed (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export async function listTasks(filters: {
  status?: TaskStatus | "all"
  priority?: TaskPriority | "all"
}): Promise<Task[]> {
  const params = new URLSearchParams()
  if (filters.status && filters.status !== "all") params.set("status", filters.status)
  if (filters.priority && filters.priority !== "all") params.set("priority", filters.priority)
  const query = params.toString()
  const res = await fetch(`${API_URL}/api/tasks${query ? `?${query}` : ""}`)
  return unwrap<Task[]>(res)
}

export async function createTask(input: NewTaskInput): Promise<Task> {
  const res = await fetch(`${API_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return unwrap<Task>(res)
}

export async function updateTask(id: number, input: TaskUpdateInput): Promise<Task> {
  const res = await fetch(`${API_URL}/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return unwrap<Task>(res)
}

export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/tasks/${id}`, { method: "DELETE" })
  return unwrap<void>(res)
}
