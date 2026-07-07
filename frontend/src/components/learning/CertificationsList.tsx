import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { showSuccess, showError } from "@/lib/toast"
import {
  Award,
  Check,
  Download,
  Eye,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import {
  type Certification,
  type CertificationStatus,
  listCertifications,
  createCertification,
  updateCertification,
  deleteCertification,
  uploadCertificationFile,
} from "@/components/learning/api"
import { CertificationDetailModal } from "@/components/learning/CertificationDetailModal"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fuzzyMatch, fuzzyScore } from "@/lib/fuzzy"
import { cardBase, pillBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface CertificationsListProps {
  refreshToken?: number
  onChange?: () => void
}

/** Same gradient styling used across the app for primary row actions. */
const ACTION_BUTTON_CLASS = "shrink-0 bg-gradient-to-r from-primary to-accent"

const TAG_OPTIONS = [
  "Frontend",
  "Backend",
  "AI/ML",
  "GenAI",
  "DevOps",
  "Cloud",
  "Data",
  "Mobile",
  "Security",
  "Other",
]

const STATUS_FILTERS: { value: CertificationStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
]

const STATUS_ORDER: Record<CertificationStatus, number> = { pending: 0, completed: 1 }

const STATUS_BADGE: Record<CertificationStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
}

interface FormState {
  id?: number
  title: string
  issuer: string
  date_received: string
  credential_id: string
  credential_url: string
  tags: string[]
}

const EMPTY_FORM: FormState = {
  title: "",
  issuer: "",
  date_received: "",
  credential_id: "",
  credential_url: "",
  tags: [],
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        pillBase,
        active
          ? "bg-primary text-white"
          : "border border-border-subtle text-slate-500 hover:border-primary/40"
      )}
    >
      {children}
    </button>
  )
}

function CertRow({
  cert,
  onToggleDone,
  onDelete,
  onEdit,
  onFileUploaded,
  onOpenDetail,
}: {
  cert: Certification
  onToggleDone: (cert: Certification) => void
  onDelete: (id: number) => void
  onEdit: (cert: Certification) => void
  onFileUploaded: (id: number, file: File) => Promise<void>
  onOpenDetail: (cert: Certification) => void
}) {
  const isDone = cert.status === "completed"
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await onFileUploaded(cert.id, file)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <li
      onClick={() => onOpenDetail(cert)}
      className="flex cursor-pointer flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-3 transition-colors duration-150 hover:border-primary/40"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleDone(cert)
          }}
          aria-label={isDone ? "Mark as pending" : "Mark as completed"}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150",
            isDone ? "border-success bg-success" : "border-border-subtle hover:border-success"
          )}
        >
          {isDone && <Check className="size-3 text-white" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{cert.title}</p>
          <p className="text-xs text-slate-500">{cert.issuer || "—"}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
            STATUS_BADGE[cert.status]
          )}
        >
          {cert.status}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(cert)
          }}
          aria-label="Edit certification"
          className="shrink-0 rounded-full p-1 text-slate-400 transition-colors duration-150 hover:bg-primary-50 hover:text-primary"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(cert.id)
          }}
          aria-label="Delete certification"
          className="shrink-0 rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {cert.tags && cert.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-8">
          {cert.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div
        className="flex flex-wrap items-center gap-1.5 pl-8"
        onClick={(e) => e.stopPropagation()}
      >
        {cert.file_url ? (
          <>
            <Button
              size="sm"
              className={ACTION_BUTTON_CLASS}
              render={
                <a href={cert.file_url} target="_blank" rel="noreferrer">
                  <Eye className="size-3" />
                  Preview
                </a>
              }
            />
            <Button
              size="sm"
              className={ACTION_BUTTON_CLASS}
              render={
                <a href={cert.file_url} download>
                  <Download className="size-3" />
                  Download
                </a>
              }
            />
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={ACTION_BUTTON_CLASS}
          >
            <Upload className="size-3" />
            {uploading ? "Uploading…" : "Attach certificate"}
          </Button>
        )}
        {cert.credential_url && (
          <Button
            size="sm"
            className={ACTION_BUTTON_CLASS}
            render={
              <a href={cert.credential_url} target="_blank" rel="noreferrer">
                <ShieldCheck className="size-3" />
                Verify
              </a>
            }
          />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </li>
  )
}

export function CertificationsList({ refreshToken, onChange }: CertificationsListProps) {
  const [certs, setCerts] = useState<Certification[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<CertificationStatus | "all">("all")
  const [tagFilter, setTagFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [detailCert, setDetailCert] = useState<Certification | null>(null)

  const refresh = useCallback(async () => {
    const result = await listCertifications()
    setCerts(result)
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

  const tagsInUse = useMemo(() => {
    const set = new Set<string>()
    for (const c of certs) {
      for (const t of c.tags ?? []) set.add(t)
    }
    return TAG_OPTIONS.filter((t) => set.has(t))
  }, [certs])

  const visibleCerts = useMemo(() => {
    let result = certs
    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter)
    if (tagFilter !== "all") result = result.filter((c) => (c.tags ?? []).includes(tagFilter))

    const query = search.trim()
    if (query) {
      return result
        .filter((c) => fuzzyMatch(query, c.title))
        .sort((a, b) => fuzzyScore(query, b.title) - fuzzyScore(query, a.title))
    }

    if (statusFilter === "all") {
      return [...result].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    }
    return result
  }, [certs, statusFilter, tagFilter, search])

  function openAddForm() {
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEditForm(cert: Certification) {
    setForm({
      id: cert.id,
      title: cert.title,
      issuer: cert.issuer ?? "",
      date_received: cert.date_received ?? "",
      credential_id: cert.credential_id ?? "",
      credential_url: cert.credential_url ?? "",
      tags: cert.tags ?? [],
    })
    setFormOpen(true)
  }

  function toggleTag(tag: string) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        issuer: form.issuer.trim() || null,
        date_received: form.date_received || null,
        credential_id: form.credential_id.trim() || null,
        credential_url: form.credential_url.trim() || null,
        tags: form.tags,
      }
      const isEdit = Boolean(form.id)
      if (form.id) {
        await updateCertification(form.id, payload)
      } else {
        await createCertification(payload)
      }
      setFormOpen(false)
      await refresh()
      onChange?.()
      showSuccess(isEdit ? "Certification updated." : "Certification added.", {
        duration: 5000,
      })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't save the certification.", {
        duration: 5000,
      })
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleDone(cert: Certification) {
    try {
      if (cert.status === "completed") {
        await updateCertification(cert.id, { status: "pending" })
      } else {
        await updateCertification(cert.id, {
          status: "completed",
          date_received: cert.date_received ?? new Date().toISOString().slice(0, 10),
        })
      }
      await refresh()
      onChange?.()
      showSuccess("Certification updated.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't update the certification.", {
        duration: 5000,
      })
      throw err
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this certification?")) return
    try {
      await deleteCertification(id)
      if (detailCert?.id === id) setDetailCert(null)
      await refresh()
      onChange?.()
      showSuccess("Certification deleted.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't delete the certification.", {
        duration: 5000,
      })
      throw err
    }
  }

  async function handleFileUploaded(id: number, file: File) {
    try {
      await uploadCertificationFile(id, file)
      await refresh()
      showSuccess("Certificate file uploaded.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't upload the certificate file.", {
        duration: 5000,
      })
      throw err
    }
  }

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Award className="size-4 text-primary" />
          Certifications
        </h2>
        <Button size="sm" onClick={openAddForm} className="bg-gradient-to-r from-primary to-accent">
          <Plus className="size-3.5" /> Add Certification
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search certifications…"
          className="h-9 w-full rounded-full border border-border-subtle bg-canvas pr-8 pl-9 text-sm outline-none transition-colors duration-150 focus:border-primary/40"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map(({ value, label }) => (
          <FilterPill key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)}>
            {label}
          </FilterPill>
        ))}
      </div>

      {tagsInUse.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterPill active={tagFilter === "all"} onClick={() => setTagFilter("all")}>
            All tags
          </FilterPill>
          {tagsInUse.map((tag) => (
            <FilterPill key={tag} active={tagFilter === tag} onClick={() => setTagFilter(tag)}>
              {tag}
            </FilterPill>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-1.5">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : certs.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certifications yet"
          description="Add one above, or tell Buddy in chat."
        />
      ) : visibleCerts.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching certifications"
          description="Try a different search or filter."
        />
      ) : (
        <ul className="space-y-1.5">
          {visibleCerts.map((cert) => (
            <CertRow
              key={cert.id}
              cert={cert}
              onToggleDone={handleToggleDone}
              onDelete={handleDelete}
              onEdit={openEditForm}
              onFileUploaded={handleFileUploaded}
              onOpenDetail={setDetailCert}
            />
          ))}
        </ul>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-6 backdrop-blur-sm"
          onClick={() => setFormOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl bg-surface p-6 shadow-card-hover"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {form.id ? "Edit Certification" : "New Certification"}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-slate-400 transition-colors duration-150 hover:bg-border-subtle hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cert-title">Title</Label>
              <Input
                id="cert-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-issuer">Issuer</Label>
              <Input
                id="cert-issuer"
                value={form.issuer}
                onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))}
                placeholder="e.g. Microsoft and LinkedIn"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cert-date">Date of issue</Label>
                <Input
                  id="cert-date"
                  type="date"
                  value={form.date_received}
                  onChange={(e) => setForm((f) => ({ ...f, date_received: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cert-credential-id">Credential ID (optional)</Label>
                <Input
                  id="cert-credential-id"
                  value={form.credential_id}
                  onChange={(e) => setForm((f) => ({ ...f, credential_id: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cert-credential-url">Credential URL (optional)</Label>
              <Input
                id="cert-credential-url"
                value={form.credential_url}
                onChange={(e) => setForm((f) => ({ ...f, credential_url: e.target.value }))}
                placeholder="Link to verify this credential"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {TAG_OPTIONS.map((tag) => {
                  const selected = form.tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                        selected
                          ? "bg-primary text-white"
                          : "bg-canvas text-muted-foreground hover:bg-primary-50 hover:text-primary"
                      )}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving || !form.title.trim()}>
                {saving ? "Saving…" : form.id ? "Save" : "Add"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <CertificationDetailModal certification={detailCert} onClose={() => setDetailCert(null)} />
    </div>
  )
}
