import { useCallback, useEffect, useMemo, useState } from "react"
import { showSuccess, showError } from "@/lib/toast"
import { Briefcase, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import {
  JOB_CATEGORIES,
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
import { fuzzyMatch } from "@/lib/fuzzy"
import { cardBase, pillBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

const COLUMNS: { status: JobApplicationStatus; label: string; accent: string }[] = [
  { status: "just_found", label: "Just Found", accent: "border-l-purple-500" },
  { status: "applied", label: "Applied", accent: "border-l-blue-500" },
  { status: "interview", label: "Interview", accent: "border-l-amber-500" },
  { status: "offer", label: "Offer", accent: "border-l-emerald-500" },
  { status: "rejected", label: "Rejected", accent: "border-l-rose-500" },
  { status: "withdrawn", label: "Withdrawn", accent: "border-l-slate-400" },
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
  category: string
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
  category: "",
  source_link: "",
  referral_taken_by: "",
  hr_contact: "",
  notes: "",
  status: "just_found",
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

export function KanbanBoard({ refreshToken }: KanbanBoardProps) {
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [ctcError, setCtcError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<JobApplicationStatus | null>(null)
  const [detailApp, setDetailApp] = useState<JobApplication | null>(null)

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [ctcMin, setCtcMin] = useState("")
  const [ctcMax, setCtcMax] = useState("")

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

  const filteredApplications = useMemo(() => {
    let result = applications

    if (categoryFilter !== "all") {
      result = result.filter((a) => a.category === categoryFilter)
    }

    const min = ctcMin.trim() ? Number(ctcMin) : null
    const max = ctcMax.trim() ? Number(ctcMax) : null
    if (min != null || max != null) {
      result = result.filter((a) => {
        if (!a.ctc) return false
        const parsed = parseInt(a.ctc, 10)
        if (Number.isNaN(parsed)) return false
        if (min != null && parsed < min) return false
        if (max != null && parsed > max) return false
        return true
      })
    }

    const query = search.trim()
    if (query) {
      result = result.filter((a) => fuzzyMatch(query, a.company) || fuzzyMatch(query, a.role))
    }

    return result
  }, [applications, categoryFilter, ctcMin, ctcMax, search])

  function openAddForm() {
    setForm(EMPTY_FORM)
    setCtcError(null)
    setFormOpen(true)
  }

  function openEditForm(app: JobApplication) {
    setForm({
      id: app.id,
      company: app.company,
      role: app.role,
      date_applied: app.date_applied ?? "",
      ctc: app.ctc ?? "",
      category: app.category ?? "",
      source_link: app.source_link ?? "",
      referral_taken_by: app.referral_taken_by ?? "",
      hr_contact: app.hr_contact ?? "",
      notes: app.notes ?? "",
      status: app.status,
    })
    setCtcError(null)
    setFormOpen(true)
  }

  function handleCtcChange(value: string) {
    setForm((f) => ({ ...f, ctc: value }))
    setCtcError(value.trim() && !/^\d+$/.test(value.trim()) ? "Enter numbers only (e.g. 18)" : null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company.trim() || !form.role.trim()) return
    if (form.ctc.trim() && !/^\d+$/.test(form.ctc.trim())) {
      setCtcError("Enter numbers only (e.g. 18)")
      return
    }
    setSaving(true)
    try {
      const payload = {
        company: form.company.trim(),
        role: form.role.trim(),
        date_applied: form.date_applied || null,
        ctc: form.ctc.trim() || null,
        category: form.category || null,
        source_link: form.source_link.trim() || null,
        referral_taken_by: form.referral_taken_by.trim() || null,
        hr_contact: form.hr_contact.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      }
      const isEdit = Boolean(form.id)
      if (form.id) {
        await updateApplication(form.id, payload)
      } else {
        await createApplication(payload)
      }
      setFormOpen(false)
      await refresh()
      showSuccess(isEdit ? "Application updated." : "Application added.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't save the application.", {
        duration: 5000,
      })
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this application?")) return
    try {
      await deleteApplication(id)
      if (detailApp?.id === id) setDetailApp(null)
      await refresh()
      showSuccess("Application deleted.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't delete the application.", {
        duration: 5000,
      })
      throw err
    }
  }

  async function handleStatusChange(id: number, status: JobApplicationStatus) {
    try {
      await updateApplication(id, { status })
      await refresh()
      showSuccess("Application status updated.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't update the application status.", {
        duration: 5000,
      })
      throw err
    }
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

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company or role…"
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
        <FilterPill active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>
          All categories
        </FilterPill>
        {JOB_CATEGORIES.map((c) => (
          <FilterPill key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>
            {c}
          </FilterPill>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">CTC (LPA) range:</span>
        <Input
          type="number"
          min={0}
          value={ctcMin}
          onChange={(e) => setCtcMin(e.target.value)}
          placeholder="Min"
          className="h-7 w-20 px-2 text-xs"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="number"
          min={0}
          value={ctcMax}
          onChange={(e) => setCtcMax(e.target.value)}
          placeholder="Max"
          className="h-7 w-20 px-2 text-xs"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {COLUMNS.map(({ status, label, accent }) => {
            const cards = filteredApplications.filter((a) => a.status === status)
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
                  "flex items-stretch gap-3 rounded-xl border-l-4 bg-canvas p-2.5 transition-colors duration-150",
                  accent,
                  dragOverStatus === status && "bg-primary-50"
                )}
              >
                <div className="flex w-24 shrink-0 flex-col justify-center px-1">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {label}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {cards.length} {cards.length === 1 ? "app" : "apps"}
                  </p>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5">
                  {cards.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No applications</p>
                  ) : (
                    cards.map((app) => (
                      <div
                        key={app.id}
                        draggable
                        onDragStart={() => setDraggingId(app.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onClick={() => setDetailApp(app)}
                        className={cn(
                          "flex w-40 shrink-0 cursor-grab flex-col gap-0.5 rounded-lg border border-border-subtle bg-surface p-2 shadow-card active:cursor-grabbing",
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
                      </div>
                    ))
                  )}
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
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select
                value={form.category || undefined}
                onValueChange={(value) => setForm((f) => ({ ...f, category: value ?? "" }))}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue>
                    {(value: string | null) => value || "Select a category"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {JOB_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Label htmlFor="ctc">CTC (LPA)</Label>
                <Input
                  id="ctc"
                  value={form.ctc}
                  onChange={(e) => handleCtcChange(e.target.value)}
                  placeholder="e.g. 18"
                  inputMode="numeric"
                />
                {ctcError && <p className="text-xs text-danger">{ctcError}</p>}
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
                disabled={saving || !form.company.trim() || !form.role.trim() || Boolean(ctcError)}
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
