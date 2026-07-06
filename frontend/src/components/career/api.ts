const API_URL = import.meta.env.VITE_API_URL

export type JobApplicationStatus =
  | "just_found"
  | "applied"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn"

export const JOB_CATEGORIES = [
  "Full Stack",
  "AI",
  "ML",
  "DevOps",
  "IT",
  "Testing",
  "Product",
  "Researcher",
  "Backend",
  "Frontend UI/UX",
  "Other",
] as const

export type JobCategory = (typeof JOB_CATEGORIES)[number]

export interface Resume {
  id: number
  filename: string
  version_label: string
  file_path: string
  uploaded_at: string
  is_active: boolean
}

export interface JobApplication {
  id: number
  company: string
  role: string
  date_applied: string | null
  ctc: string | null
  source_link: string | null
  referral_taken_by: string | null
  status: JobApplicationStatus
  category: string | null
  hr_contact: string | null
  notes: string | null
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

// --- Resumes ---

export async function listResumes(): Promise<Resume[]> {
  const res = await fetch(`${API_URL}/api/career/resumes`)
  return unwrap(res)
}

export async function uploadResume(versionLabel: string, file: File): Promise<Resume> {
  const formData = new FormData()
  formData.append("version_label", versionLabel)
  formData.append("file", file)
  const res = await fetch(`${API_URL}/api/career/resumes`, {
    method: "POST",
    body: formData,
  })
  return unwrap(res)
}

export async function updateResume(
  id: number,
  input: Partial<Pick<Resume, "version_label" | "is_active">>
): Promise<Resume> {
  const res = await fetch(`${API_URL}/api/career/resumes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return unwrap(res)
}

export async function deleteResume(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/career/resumes/${id}`, { method: "DELETE" })
  return unwrap(res)
}

/** Forces a real download (proper filename + attachment disposition,
 * regardless of storage provider) — unlike linking straight to file_path. */
export function resumeDownloadUrl(id: number): string {
  return `${API_URL}/api/career/resumes/${id}/download`
}

// --- Job applications ---

export async function listApplications(status?: JobApplicationStatus): Promise<JobApplication[]> {
  const query = status ? `?status=${status}` : ""
  const res = await fetch(`${API_URL}/api/career/applications${query}`)
  return unwrap(res)
}

export async function createApplication(input: {
  company: string
  role: string
  date_applied?: string | null
  ctc?: string | null
  source_link?: string | null
  referral_taken_by?: string | null
  status?: JobApplicationStatus
  category?: string | null
  hr_contact?: string | null
  notes?: string | null
}): Promise<JobApplication> {
  const res = await fetch(`${API_URL}/api/career/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return unwrap(res)
}

export async function updateApplication(
  id: number,
  input: Partial<Omit<JobApplication, "id" | "created_at">>
): Promise<JobApplication> {
  const res = await fetch(`${API_URL}/api/career/applications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return unwrap(res)
}

export async function deleteApplication(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/career/applications/${id}`, { method: "DELETE" })
  return unwrap(res)
}

// --- JD text extraction ---

export async function extractJdText(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`${API_URL}/api/career/extract-jd-text`, {
    method: "POST",
    body: formData,
  })
  const data = await unwrap<{ text: string }>(res)
  return data.text
}
