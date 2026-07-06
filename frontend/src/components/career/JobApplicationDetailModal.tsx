import { useEffect } from "react"
import {
  Briefcase,
  Calendar,
  ExternalLink,
  Mail,
  StickyNote,
  Users,
  Wallet,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { JobApplication, JobApplicationStatus } from "@/components/career/api"

const STATUS_BADGE: Record<JobApplicationStatus, string> = {
  just_found: "bg-purple-50 text-purple-700",
  applied: "bg-blue-50 text-blue-700",
  interview: "bg-amber-50 text-amber-700",
  offer: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  withdrawn: "bg-slate-100 text-slate-600",
}

const STATUS_LABEL: Record<JobApplicationStatus, string> = {
  just_found: "Just Found",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
}

interface JobApplicationDetailModalProps {
  application: JobApplication | null
  onClose: () => void
}

export function JobApplicationDetailModal({
  application,
  onClose,
}: JobApplicationDetailModalProps) {
  useEffect(() => {
    if (!application) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [application, onClose])

  if (!application) return null

  const dateLabel = application.date_applied
    ? new Date(application.date_applied).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold break-words text-foreground">
              {application.company}
            </h2>
            <p className="text-sm text-muted-foreground">{application.role}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors duration-150 hover:bg-border-subtle hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-muted-foreground" />
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                STATUS_BADGE[application.status]
              )}
            >
              {STATUS_LABEL[application.status]}
            </span>
            {application.category && (
              <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary">
                {application.category}
              </span>
            )}
          </div>

          {dateLabel && (
            <div className="flex items-center gap-2 text-foreground">
              <Calendar className="size-4 shrink-0 text-muted-foreground" />
              Applied {dateLabel}
            </div>
          )}

          {application.ctc && (
            <div className="flex items-center gap-2 text-foreground">
              <Wallet className="size-4 shrink-0 text-muted-foreground" />
              CTC: {application.ctc}
            </div>
          )}

          {application.referral_taken_by && (
            <div className="flex items-center gap-2 text-foreground">
              <Users className="size-4 shrink-0 text-muted-foreground" />
              Referral: {application.referral_taken_by}
            </div>
          )}

          {application.hr_contact && (
            <div className="flex items-center gap-2 text-foreground">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              HR contact: {application.hr_contact}
            </div>
          )}

          {application.source_link && (
            <div className="flex items-center gap-2">
              <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
              <a
                href={application.source_link}
                target="_blank"
                rel="noreferrer"
                className="truncate text-primary hover:underline"
              >
                {application.source_link}
              </a>
            </div>
          )}

          {application.notes && (
            <div className="flex gap-2 border-t border-border-subtle pt-3">
              <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="whitespace-pre-wrap text-foreground">{application.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
