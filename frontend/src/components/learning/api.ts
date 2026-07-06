const API_URL = import.meta.env.VITE_API_URL

export type CourseStatus = "planned" | "in_progress" | "done"
export type CertificationStatus = "pending" | "completed"

export interface Course {
  id: number
  title: string
  provider: string | null
  status: CourseStatus
  deadline: string | null
  roadmap_position: number | null
  roadmap_rationale: string | null
  last_updated_at: string
  created_at: string
}

export interface Certification {
  id: number
  title: string
  issuer: string | null
  date_received: string | null
  status: CertificationStatus
  credential_id: string | null
  credential_url: string | null
  tags: string[] | null
  file_url: string | null
  file_type: "image" | "pdf" | null
  last_updated_at: string
  created_at: string
}

export interface RevisionItem {
  id: number
  topic: string
  notes: string | null
  next_review_at: string
  interval_days: number
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

// --- Courses ---

export async function listCourses(status?: CourseStatus): Promise<Course[]> {
  const query = status ? `?status=${status}` : ""
  const res = await fetch(`${API_URL}/api/learning/courses${query}`)
  return unwrap(res)
}

export async function createCourse(input: {
  title: string
  provider?: string | null
  deadline?: string | null
}): Promise<Course> {
  const res = await fetch(`${API_URL}/api/learning/courses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return unwrap(res)
}

export async function updateCourse(
  id: number,
  input: Partial<Pick<Course, "title" | "provider" | "deadline" | "status">>
): Promise<Course> {
  const res = await fetch(`${API_URL}/api/learning/courses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return unwrap(res)
}

export async function deleteCourse(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/learning/courses/${id}`, { method: "DELETE" })
  return unwrap(res)
}

// --- Certifications ---

export async function listCertifications(status?: CertificationStatus): Promise<Certification[]> {
  const query = status ? `?status=${status}` : ""
  const res = await fetch(`${API_URL}/api/learning/certifications${query}`)
  return unwrap(res)
}

export async function createCertification(input: {
  title: string
  issuer?: string | null
  date_received?: string | null
  credential_id?: string | null
  credential_url?: string | null
  tags?: string[] | null
}): Promise<Certification> {
  const res = await fetch(`${API_URL}/api/learning/certifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return unwrap(res)
}

export async function updateCertification(
  id: number,
  input: Partial<
    Pick<
      Certification,
      | "title"
      | "issuer"
      | "date_received"
      | "status"
      | "credential_id"
      | "credential_url"
      | "tags"
    >
  >
): Promise<Certification> {
  const res = await fetch(`${API_URL}/api/learning/certifications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return unwrap(res)
}

export async function deleteCertification(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/learning/certifications/${id}`, { method: "DELETE" })
  return unwrap(res)
}

export async function uploadCertificationFile(id: number, file: File): Promise<Certification> {
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_URL}/api/learning/certifications/${id}/file`, {
    method: "POST",
    body: formData,
  })
  return unwrap(res)
}

// --- Revision items ---

export async function listRevisionItems(due?: "today"): Promise<RevisionItem[]> {
  const query = due ? `?due=${due}` : ""
  const res = await fetch(`${API_URL}/api/learning/revision-items${query}`)
  return unwrap(res)
}

export async function createRevisionItem(input: {
  topic: string
  notes?: string | null
  interval_days?: number
}): Promise<RevisionItem> {
  const res = await fetch(`${API_URL}/api/learning/revision-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return unwrap(res)
}

export async function markRevisionRevised(id: number): Promise<RevisionItem> {
  const res = await fetch(`${API_URL}/api/learning/revision-items/${id}/mark-revised`, {
    method: "POST",
  })
  return unwrap(res)
}

export async function deleteRevisionItem(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/learning/revision-items/${id}`, { method: "DELETE" })
  return unwrap(res)
}
