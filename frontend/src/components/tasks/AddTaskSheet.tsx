import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
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
import { RecurrencePicker } from "@/components/tasks/RecurrencePicker"
import { sectionGap } from "@/lib/styles"
import { cn } from "@/lib/utils"
import type { NewTaskInput, TaskPriority } from "@/components/tasks/api"

const FORM_ID = "add-task-form"

interface AddTaskSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (input: NewTaskInput) => Promise<void>
}

export function AddTaskSheet({ open, onOpenChange, onCreate }: AddTaskSheetProps) {
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("normal")
  const [dueDateTime, setDueDateTime] = useState("")
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function reset() {
    setTitle("")
    setPriority("normal")
    setDueDateTime("")
    setRecurrenceRule(null)
  }

  async function handleCreate() {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onCreate({
        title: title.trim(),
        priority,
        due_at: dueDateTime ? new Date(dueDateTime).toISOString() : null,
        recurrence_rule: recurrenceRule,
      })
      reset()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    handleCreate()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <SheetContent className="rounded-l-2xl">
        <SheetHeader>
          <SheetTitle>New task</SheetTitle>
          <SheetDescription>Capture what needs to get done.</SheetDescription>
        </SheetHeader>

        <form
          id={FORM_ID}
          onSubmit={handleSubmit}
          className={cn(sectionGap, "flex-1 overflow-y-auto px-4")}
        >
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to get done?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-priority">Priority</Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as TaskPriority)}
            >
              <SelectTrigger id="task-priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-due">Due date &amp; time</Label>
            <Input
              id="task-due"
              type="datetime-local"
              value={dueDateTime}
              onChange={(e) => setDueDateTime(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Repeat</Label>
            <RecurrencePicker onChange={setRecurrenceRule} />
          </div>
        </form>

        <SheetFooter>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
              disabled={saving || !title.trim()}
            >
              {saving ? "Adding…" : "Add task"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
