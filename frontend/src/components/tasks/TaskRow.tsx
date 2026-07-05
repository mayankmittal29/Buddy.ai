import { useState } from "react"
import { Check, Pencil, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { cardBase, cardHover, pillBase } from "@/lib/styles"
import { formatDueLabel, toDatetimeLocalValue } from "@/lib/datetime"
import type { Task, TaskPriority, TaskUpdateInput } from "@/components/tasks/api"

const PRIORITY_ACCENT: Record<TaskPriority, { border: string; badge: string }> = {
  urgent: { border: "border-l-rose-500", badge: "bg-rose-50 text-rose-700" },
  normal: { border: "border-l-amber-500", badge: "bg-amber-50 text-amber-700" },
  light: { border: "border-l-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
}

interface TaskRowProps {
  task: Task
  onComplete: (id: number) => void
  onUpdate: (id: number, input: TaskUpdateInput) => Promise<void>
  onDelete: (id: number) => void
  onOpenDetail: (task: Task) => void
}

export function TaskRow({ task, onComplete, onUpdate, onDelete, onOpenDetail }: TaskRowProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [dueDateTime, setDueDateTime] = useState(
    task.due_at ? toDatetimeLocalValue(task.due_at) : ""
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate(task.id, {
        title: title.trim() || task.title,
        priority,
        due_at: dueDateTime ? new Date(dueDateTime).toISOString() : null,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setTitle(task.title)
    setPriority(task.priority)
    setDueDateTime(task.due_at ? toDatetimeLocalValue(task.due_at) : "")
    setEditing(false)
  }

  if (editing) {
    return (
      <li className={cn(cardBase, "flex flex-col gap-2")}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex items-center gap-2">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="urgent">Urgent</option>
            <option value="normal">Normal</option>
            <option value="light">Light</option>
          </select>
          <Input
            type="datetime-local"
            value={dueDateTime}
            onChange={(e) => setDueDateTime(e.target.value)}
            className="flex-1"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>
            <X /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !title.trim()}>
            <Check /> Save
          </Button>
        </div>
      </li>
    )
  }

  const dueLabel = task.due_at ? formatDueLabel(task.due_at) : null
  const accent = PRIORITY_ACCENT[task.priority]
  const isDone = task.status === "done"

  return (
    <li
      className={cn(
        cardBase,
        cardHover,
        "group flex items-center gap-3 border-l-4",
        accent.border
      )}
    >
      <button
        type="button"
        onClick={() => !isDone && onComplete(task.id)}
        disabled={isDone}
        aria-label={isDone ? "Completed" : "Mark as complete"}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150",
          isDone
            ? "border-success bg-success"
            : "border-border-subtle hover:border-success"
        )}
      >
        {isDone && <Check className="size-3 text-white" />}
      </button>

      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpenDetail(task)}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-sm",
              isDone && "text-muted-foreground line-through"
            )}
          >
            {task.title}
          </span>
          <span className={cn(pillBase, accent.badge, "capitalize")}>
            {task.priority}
          </span>
        </div>
        {dueLabel && <span className="text-xs text-slate-500">Due {dueLabel}</span>}
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Edit task"
          onClick={() => setEditing(true)}
        >
          <Pencil />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Delete task"
          onClick={() => onDelete(task.id)}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  )
}
