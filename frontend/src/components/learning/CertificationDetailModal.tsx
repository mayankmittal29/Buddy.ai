import { useEffect } from "react"
import { Award, Calendar, ExternalLink, FileText, Hash, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Certification, CertificationStatus } from "@/components/learning/api"

const STATUS_BADGE: Record<CertificationStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
}

interface CertificationDetailModalProps {
  certification: Certification | null
  onClose: () => void
}

export function CertificationDetailModal({
  certification,
  onClose,
}: CertificationDetailModalProps) {
  useEffect(() => {
    if (!certification) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [certification, onClose])

  if (!certification) return null

  const dateLabel = certification.date_received
    ? new Date(certification.date_received).toLocaleDateString(undefined, {
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
              {certification.title}
            </h2>
            {certification.issuer && (
              <p className="text-sm text-muted-foreground">{certification.issuer}</p>
            )}
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
            <Award className="size-4 text-muted-foreground" />
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                STATUS_BADGE[certification.status]
              )}
            >
              {certification.status === "completed" ? "Completed" : "Pending"}
            </span>
          </div>

          {dateLabel && (
            <div className="flex items-center gap-2 text-foreground">
              <Calendar className="size-4 shrink-0 text-muted-foreground" />
              Issued {dateLabel}
            </div>
          )}

          {certification.credential_id && (
            <div className="flex items-center gap-2 text-foreground">
              <Hash className="size-4 shrink-0 text-muted-foreground" />
              Credential ID: {certification.credential_id}
            </div>
          )}

          {certification.credential_url && (
            <div className="flex items-center gap-2">
              <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
              <a
                href={certification.credential_url}
                target="_blank"
                rel="noreferrer"
                className="truncate text-primary hover:underline"
              >
                {certification.credential_url}
              </a>
            </div>
          )}

          {certification.file_url && (
            <div className="flex items-center gap-2 text-foreground">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              Certificate file attached ({certification.file_type === "pdf" ? "PDF" : "image"})
            </div>
          )}

          {certification.tags && certification.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-border-subtle pt-3">
              {certification.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
