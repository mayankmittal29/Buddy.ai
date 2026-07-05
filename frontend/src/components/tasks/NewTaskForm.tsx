import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RecurrencePicker } from "@/components/tasks/RecurrencePicker"
import type { NewTaskInput, TaskPriority } from "@/components/tasks/api"

interface NewTaskFormProps {
  onCreate: (input: NewTaskInput) => Promise<void>
}

export function NewTaskForm({ onCreate }: NewTaskFormProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("normal")
  const [dueDate, setDueDate] = useState("")
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function reset() {
    setTitle("")
    setPriority("normal")
    setDueDate("")
    setRecurrenceRule(null)
    setOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await onCreate({
        title: title.trim(),
        priority,
        due_at: dueDate ? new Date(dueDate).toISOString() : null,
        recurrence_rule: recurrenceRule,
      })
      reset()
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus /> New Task
      </Button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-border p-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">New task</span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Cancel"
          onClick={reset}
        >
          <X />
        </Button>
      </div>
      <Input
        autoFocus
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
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
      <RecurrencePicker onChange={setRecurrenceRule} />
      <Button type="submit" disabled={saving || !title.trim()}>
        Add task
      </Button>
    </form>
  )
}
