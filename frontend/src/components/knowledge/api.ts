const API_URL = import.meta.env.VITE_API_URL

export interface Note {
  id: number
  title: string
  content: string
  created_at: string
}

export interface Bookmark {
  id: number
  url: string
  title: string
  note: string | null
  created_at: string
}

export interface KnowledgeDocument {
  id: number
  title: string
  file_path: string | null
  source_url: string | null
  uploaded_at: string
  chunk_count: number
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ? String(body.detail) : `request failed (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

function get<T>(path: string): Promise<T> {
  return fetch(`${API_URL}/api/knowledge${path}`).then(unwrap<T>)
}

function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  return fetch(`${API_URL}/api/knowledge${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(unwrap<T>)
}

// Notes
export const listNotes = () => get<Note[]>("/notes")
export const createNote = (input: { title: string; content: string }) =>
  send<Note>("/notes", "POST", input)
export const updateNote = (id: number, input: { title: string; content: string }) =>
  send<Note>(`/notes/${id}`, "PUT", input)
export const deleteNote = (id: number) => send<void>(`/notes/${id}`, "DELETE")

// Bookmarks
export const listBookmarks = () => get<Bookmark[]>("/bookmarks")
export const createBookmark = (input: { url: string; title: string; note?: string | null }) =>
  send<Bookmark>("/bookmarks", "POST", input)
export const updateBookmark = (
  id: number,
  input: { url: string; title: string; note?: string | null }
) => send<Bookmark>(`/bookmarks/${id}`, "PUT", input)
export const deleteBookmark = (id: number) => send<void>(`/bookmarks/${id}`, "DELETE")

// Documents
export const listDocuments = () => get<KnowledgeDocument[]>("/documents")
export const deleteDocument = (id: number) => send<void>(`/documents/${id}`, "DELETE")
/** Renames the title only — does not re-run extraction/chunking/embedding. */
export const renameDocument = (id: number, title: string) =>
  send<KnowledgeDocument>(`/documents/${id}`, "PATCH", { title })

export async function uploadDocument(input: {
  title: string
  sourceUrl?: string
  text?: string
  file?: File
}): Promise<KnowledgeDocument> {
  const form = new FormData()
  form.set("title", input.title)
  if (input.sourceUrl) form.set("source_url", input.sourceUrl)
  if (input.text) form.set("text", input.text)
  if (input.file) form.set("file", input.file)
  const res = await fetch(`${API_URL}/api/knowledge/documents/upload`, {
    method: "POST",
    body: form,
  })
  return unwrap(res)
}
