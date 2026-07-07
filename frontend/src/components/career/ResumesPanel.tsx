import { useCallback, useEffect, useRef, useState } from "react"
import { showSuccess, showError } from "@/lib/toast"
import {
  Check,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  FileText,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import {
  type Resume,
  listResumes,
  uploadResume,
  updateResume,
  deleteResume,
  resumeDownloadUrl,
} from "@/components/career/api"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

/** Same gradient styling as the "Upload" button above, for the resume row
 * actions (Preview/Download) so all three match. */
const ACTION_BUTTON_CLASS = "shrink-0 bg-gradient-to-r from-primary to-accent"

interface ResumesPanelProps {
  /** Bump this (e.g. increment a counter) to force a refetch — after a chat
   * turn may have referenced resumes. */
  refreshToken?: number
  /** Fired whenever the resume list changes — a hook for other panels
   * (e.g. skill-gap analysis's resume picker) to refresh. */
  onChange?: () => void
}

export function ResumesPanel({ refreshToken, onChange }: ResumesPanelProps) {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)
  const [versionLabel, setVersionLabel] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const result = await listResumes()
    setResumes(result)
  }, [])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  useEffect(() => {
    if (refreshToken === undefined) return
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!versionLabel.trim()) {
      setError("Give this version a label first (e.g. \"v2 - backend focus\").")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    setError(null)
    setUploading(true)
    try {
      await uploadResume(versionLabel.trim(), file)
      setVersionLabel("")
      await refresh()
      onChange?.()
      showSuccess("Resume uploaded.", { duration: 5000 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed."
      setError(message)
      showError(message, { duration: 5000 })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleSetActive(id: number) {
    try {
      await updateResume(id, { is_active: true })
      await refresh()
      onChange?.()
      showSuccess("Active resume changed.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't change the active resume.", {
        duration: 5000,
      })
      throw err
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this resume version?")) return
    try {
      await deleteResume(id)
      await refresh()
      onChange?.()
      showSuccess("Resume deleted.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't delete the resume.", {
        duration: 5000,
      })
      throw err
    }
  }

  function startEdit(resume: Resume) {
    setEditingId(resume.id)
    setEditValue(resume.version_label)
  }

  async function handleSaveEdit(id: number) {
    const trimmed = editValue.trim()
    if (!trimmed) return
    try {
      await updateResume(id, { version_label: trimmed })
      setEditingId(null)
      await refresh()
      onChange?.()
      showSuccess("Resume label updated.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't update the resume label.", {
        duration: 5000,
      })
      throw err
    }
  }

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileText className="size-4 text-primary" />
        Resumes
      </h2>

      <div className="flex gap-2 rounded-xl border border-border-subtle bg-canvas p-3">
        <Input
          value={versionLabel}
          onChange={(e) => setVersionLabel(e.target.value)}
          placeholder='Version label (e.g. "v2 - backend focus")'
          className="flex-1"
        />
        <Button
          type="button"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 bg-gradient-to-r from-primary to-accent"
        >
          <Upload className="size-3.5" />
          {uploading ? "Uploading…" : "Upload"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {loading ? (
        <div className="space-y-1.5">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : resumes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No resumes yet"
          description="Upload a PDF or DOCX version above to get started."
        />
      ) : (
        <ul className="space-y-1.5">
          {resumes.map((resume) => (
            <li
              key={resume.id}
              className={cn(
                cardBase,
                "flex items-center gap-3 p-3 shadow-none",
                resume.is_active ? "border-primary bg-primary-50" : ""
              )}
            >
              <button
                type="button"
                onClick={() => handleSetActive(resume.id)}
                disabled={resume.is_active}
                aria-label={resume.is_active ? "Active version" : "Mark as active"}
                className="shrink-0 text-muted-foreground transition-colors duration-150 hover:text-primary disabled:cursor-default"
              >
                {resume.is_active ? (
                  <CheckCircle2 className="size-5 text-primary" />
                ) : (
                  <Circle className="size-5" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                {editingId === resume.id ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(resume.id)
                        if (e.key === "Escape") setEditingId(null)
                      }}
                      autoFocus
                      className="h-7 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(resume.id)}
                      aria-label="Save version label"
                      className="shrink-0 rounded-full p-1 text-success transition-colors duration-150 hover:bg-success/10"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel edit"
                      className="shrink-0 rounded-full p-1 text-slate-400 transition-colors duration-150 hover:bg-border-subtle"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="truncate text-sm font-medium text-foreground">
                    {resume.version_label}
                    {resume.is_active && (
                      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-white">
                        Active
                      </span>
                    )}
                  </p>
                )}
                <p className="truncate text-xs text-slate-500">
                  {resume.filename} ·{" "}
                  {new Date(resume.uploaded_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              {editingId !== resume.id && (
                <button
                  type="button"
                  onClick={() => startEdit(resume)}
                  aria-label="Edit version label"
                  className="shrink-0 rounded-full p-1 text-slate-400 transition-colors duration-150 hover:bg-primary-50 hover:text-primary"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
              {resume.filename.toLowerCase().endsWith(".pdf") && (
                <Button
                  size="sm"
                  className={ACTION_BUTTON_CLASS}
                  render={
                    <a href={resume.file_path} target="_blank" rel="noreferrer">
                      <Eye className="size-3" />
                      Preview
                    </a>
                  }
                />
              )}
              <Button
                size="sm"
                className={ACTION_BUTTON_CLASS}
                render={
                  <a href={resumeDownloadUrl(resume.id)}>
                    <Download className="size-3" />
                    Download
                  </a>
                }
              />
              <button
                type="button"
                onClick={() => handleDelete(resume.id)}
                aria-label="Delete resume version"
                className="shrink-0 rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
