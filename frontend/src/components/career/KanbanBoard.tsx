import { useCallback, useEffect, useState } from "react"
import { Briefcase, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react"
import {
  type JobApplication,
  type JobApplicationStatus,
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from "@/components/career/api"
import { JobApplicationDetailModal } from "@/components/career/JobApplicationDetailModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

const COLUMNS: { status: JobApplicationStatus; label: string; accent: string }[] = [
  { status: "applied", label: "Applied", accent: "border-t-blue-500" },
  { status: "interview", label: "Interview", accent: "border-t-amber-500" },
  { status: "offer", label: "Offer", accent: "border-t-emerald-500" },
  { status: "rejected", label: "Rejected", accent: "border-t-rose-500" },
  { status: "withdrawn", label: "Withdrawn", accent: "border-t-slate-400" },
]

interface KanbanBoardProps {
  /** Bump this (e.g. increment a counter) to force a refetch — after a chat
   * turn may have added/updated an application. */
  refreshToken?: number
}

interface FormState {
  id?: number
  company: string
  role: string
  date_applied: string
  ctc: string
  source_link: string
  referral_taken_by: string
  hr_contact: string
  notes: string
  status: JobApplicationStatus
}

const EMPTY_FORM: FormState = {
  company: "",
  role: "",
  date_applied: "",
  ctc: "",
  source_link: "",
  referral_taken_by: "",
  hr_contact: "",
  notes: "",
  status: "applied",
}

export function KanbanBoard({ refreshToken }: KanbanBoardProps) {
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<JobApplicationStatus | null>(null)
  const [detailApp, setDetailApp] = useState<JobApplication | null>(null)

  const refresh = useCallback(async () => {
    const result = await listApplications()
    setApplications(result)
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

  function openAddForm() {
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEditForm(app: JobApplication) {
    setForm({
      id: app.id,
      company: app.company,
      role: app.role,
      date_applied: app.date_applied ?? "",
      ctc: app.ctc ?? "",
      source_link: app.source_link ?? "",
      referral_taken_by: app.referral_taken_by ?? "",
      hr_contact: app.hr_contact ?? "",
      notes: app.notes ?? "",
      status: app.status,
    })
    setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company.trim() || !form.role.trim()) return
    setSaving(true)
    try {
      const payload = {
        company: form.company.trim(),
        role: form.role.trim(),
        date_applied: form.date_applied || null,
        ctc: form.ctc.trim() || null,
        source_link: form.source_link.trim() || null,
        referral_taken_by: form.referral_taken_by.trim() || null,
        hr_contact: form.hr_contact.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      }
      if (form.id) {
        await updateApplication(form.id, payload)
      } else {
        await createApplication(payload)
      }
      setFormOpen(false)
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this application?")) return
    await deleteApplication(id)
    if (detailApp?.id === id) setDetailApp(null)
    await refresh()
  }

  async function handleStatusChange(id: number, status: JobApplicationStatus) {
    await updateApplication(id, { status })
    await refresh()
  }

  function handleDrop(status: JobApplicationStatus) {
    if (draggingId != null) {
      handleStatusChange(draggingId, status)
    }
    setDraggingId(null)
    setDragOverStatus(null)
  }

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Briefcase className="size-4 text-primary" />
          Job Applications
        </h2>
        <Button
          size="sm"
          onClick={openAddForm}
          className="bg-gradient-to-r from-primary to-accent"
        >
          <Plus className="size-3.5" /> Add Application
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map(({ status, label, accent }) => {
            const cards = applications.filter((a) => a.status === status)
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverStatus(status)
                }}
                onDragLeave={() => setDragOverStatus((s) => (s === status ? null : s))}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDrop(status)
                }}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border-t-4 bg-canvas p-2.5 transition-colors duration-150",
                  accent,
                  dragOverStatus === status && "bg-primary-50"
                )}
              >
                <h3 className="flex items-center justify-between px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {label}
                  <span className="text-[10px] font-normal text-slate-400">{cards.length}</span>
                </h3>
                <div className="flex min-h-16 flex-col gap-2">
                  {cards.map((app) => (
                    <div
                      key={app.id}
                      draggable
                      onDragStart={() => setDraggingId(app.id)}
                      onDragEnd={() => setDraggingId(null)}
                      onClick={() => setDetailApp(app)}
                      className={cn(
                        "cursor-grab rounded-lg border border-border-subtle bg-surface p-2.5 shadow-card active:cursor-grabbing",
                        draggingId === app.id && "opacity-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {app.company}
                          </p>
                          <p className="truncate text-xs text-slate-500">{app.role}</p>
                        </div>
                        <div className="flex shrink-0 gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditForm(app)
                            }}
                            aria-label="Edit application"
                            className="rounded-full p-1 text-slate-400 transition-colors duration-150 hover:bg-primary-50 hover:text-primary"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(app.id)
                            }}
                            aria-label="Delete application"
                            className="rounded-full p-1 text-slate-400 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-500">
                        {app.date_applied && (
                          <p>
                            Applied{" "}
                            {new Date(app.date_applied).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        )}
                        {app.ctc && <p>CTC: {app.ctc}</p>}
                        {app.referral_taken_by && <p>Referral: {app.referral_taken_by}</p>}
                        {app.hr_contact && <p>HR: {app.hr_contact}</p>}
                        {app.source_link && (
                          <a
                            href={app.source_link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-0.5 text-primary hover:underline"
                          >
                            <ExternalLink className="size-2.5" /> Posting
                          </a>
                        )}
                      </div>

                      <select
                        value={app.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          handleStatusChange(app.id, e.target.value as JobApplicationStatus)
                        }
                        className="mt-2 h-6 w-full rounded-md border border-border-subtle bg-transparent px-1 text-[11px]"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.status} value={c.status}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
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
                {form.id ? "Edit Application" : "New Application"}
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
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date_applied">Date applied</Label>
                <Input
                  id="date_applied"
                  type="date"
                  value={form.date_applied}
                  onChange={(e) => setForm((f) => ({ ...f, date_applied: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctc">CTC</Label>
                <Input
                  id="ctc"
                  value={form.ctc}
                  onChange={(e) => setForm((f) => ({ ...f, ctc: e.target.value }))}
                  placeholder="e.g. 18 LPA"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source_link">Source link</Label>
              <Input
                id="source_link"
                value={form.source_link}
                onChange={(e) => setForm((f) => ({ ...f, source_link: e.target.value }))}
                placeholder="Job posting URL"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="referral">Referral by</Label>
                <Input
                  id="referral"
                  value={form.referral_taken_by}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, referral_taken_by: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hr_contact">HR contact</Label>
                <Input
                  id="hr_contact"
                  value={form.hr_contact}
                  onChange={(e) => setForm((f) => ({ ...f, hr_contact: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, status: value as JobApplicationStatus }))
                }
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue>
                    {(value: JobApplicationStatus | null) =>
                      COLUMNS.find((c) => c.status === value)?.label ?? "Select a status"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((c) => (
                    <SelectItem key={c.status} value={c.status}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving || !form.company.trim() || !form.role.trim()}
              >
                {saving ? "Saving…" : form.id ? "Save" : "Add"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <JobApplicationDetailModal application={detailApp} onClose={() => setDetailApp(null)} />
    </div>
  )
}
