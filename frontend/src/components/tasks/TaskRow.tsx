import { useState } from "react"
import { Check, Pencil, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Task, TaskPriority, TaskUpdateInput } from "@/components/tasks/api"

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  urgent: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
  normal: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  light: "bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400",
}

function formatDueDate(due_at: string | null): string | null {
  if (!due_at) return null
  return new Date(due_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

interface TaskRowProps {
  task: Task
  onComplete: (id: number) => void
  onUpdate: (id: number, input: TaskUpdateInput) => Promise<void>
  onDelete: (id: number) => void
}

export function TaskRow({ task, onComplete, onUpdate, onDelete }: TaskRowProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [dueDate, setDueDate] = useState(task.due_at ? task.due_at.slice(0, 10) : "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate(task.id, {
        title: title.trim() || task.title,
        priority,
        due_at: dueDate ? new Date(dueDate).toISOString() : null,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setTitle(task.title)
    setPriority(task.priority)
    setDueDate(task.due_at ? task.due_at.slice(0, 10) : "")
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-lg border border-border p-2">
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
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
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

  const dueLabel = formatDueDate(task.due_at)

  return (
    <li className="flex items-center gap-2 rounded-lg border border-border p-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-sm",
              task.status === "done" && "text-muted-foreground line-through"
            )}
          >
            {task.title}
          </span>
          <Badge className={cn("border capitalize", PRIORITY_STYLES[task.priority])}>
            {task.priority}
          </Badge>
        </div>
        {dueLabel && (
          <span className="text-xs text-muted-foreground">Due {dueLabel}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {task.status === "pending" && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Complete task"
            onClick={() => onComplete(task.id)}
          >
            <Check />
          </Button>
        )}
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
