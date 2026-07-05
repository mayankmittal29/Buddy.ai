import { useEffect } from "react"
import { Clock, Flag, Repeat, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Task, TaskPriority } from "@/components/tasks/api"

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  urgent: "bg-rose-50 text-rose-700",
  normal: "bg-amber-50 text-amber-700",
  light: "bg-emerald-50 text-emerald-700",
}

interface TaskDetailModalProps {
  task: Task | null
  onClose: () => void
}

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  useEffect(() => {
    if (!task) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [task, onClose])

  if (!task) return null

  const dueLabel = task.due_at
    ? new Date(task.due_at).toLocaleString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
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
          <h2 className="text-lg font-semibold break-words text-foreground">
            {task.title}
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
            <Flag className="size-4 text-muted-foreground" />
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                PRIORITY_BADGE[task.priority]
              )}
            >
              {task.priority}
            </span>
            <span className="text-muted-foreground capitalize">· {task.status}</span>
          </div>

          {dueLabel && (
            <div className="flex items-center gap-2 text-foreground">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              {dueLabel}
            </div>
          )}

          {task.recurrence_rule && (
            <div className="flex items-center gap-2 text-foreground">
              <Repeat className="size-4 shrink-0 text-muted-foreground" />
              Repeats: {task.recurrence_rule}
            </div>
          )}

          {task.notes && (
            <div className="border-t border-border-subtle pt-3 whitespace-pre-wrap text-foreground">
              {task.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
