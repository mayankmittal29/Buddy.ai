import { useEffect } from "react"
import { AlertTriangle, Bell, Calendar, ListChecks, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Notification } from "@/components/notifications/api"

const TYPE_ICON: Record<string, typeof Bell> = {
  task_due: ListChecks,
  course_deadline: Calendar,
  learning_inactivity: AlertTriangle,
}

const TYPE_BADGE: Record<string, string> = {
  task_due: "bg-blue-50 text-blue-700",
  course_deadline: "bg-amber-50 text-amber-700",
  learning_inactivity: "bg-rose-50 text-rose-700",
}

const TYPE_LABEL: Record<string, string> = {
  task_due: "Task reminder",
  course_deadline: "Course deadline",
  learning_inactivity: "Inactivity nudge",
}

interface NotificationDetailModalProps {
  notification: Notification | null
  onClose: () => void
}

export function NotificationDetailModal({
  notification,
  onClose,
}: NotificationDetailModalProps) {
  useEffect(() => {
    if (!notification) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [notification, onClose])

  if (!notification) return null

  const Icon = TYPE_ICON[notification.type] ?? Bell
  const dateLabel = new Date(notification.created_at).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

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
          <h2 className="text-lg font-semibold break-words text-foreground">
            {notification.title}
          </h2>
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
            <Icon className="size-4 text-muted-foreground" />
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                TYPE_BADGE[notification.type] ?? "bg-slate-100 text-slate-600"
              )}
            >
              {TYPE_LABEL[notification.type] ?? notification.type}
            </span>
          </div>

          <div className="flex items-center gap-2 text-foreground">
            <Calendar className="size-4 shrink-0 text-muted-foreground" />
            {dateLabel}
          </div>

          <div className="border-t border-border-subtle pt-3 whitespace-pre-wrap text-foreground">
            {notification.body}
          </div>
        </div>
      </div>
    </div>
  )
}
