import { useCallback, useEffect, useState } from "react"
import {
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskUpdateInput,
  listTasks,
  createTask,
  updateTask,
  deleteTask,
} from "@/components/tasks/api"
import { TaskRow } from "@/components/tasks/TaskRow"
import { NewTaskForm } from "@/components/tasks/NewTaskForm"

const STATUS_GROUPS: { status: TaskStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "done", label: "Done" },
]

export function TaskPanel() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all")
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listTasks({ status: statusFilter, priority: priorityFilter })
      setTasks(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks.")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, priorityFilter])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleCreate(input: Parameters<typeof createTask>[0]) {
    await createTask(input)
    await refresh()
  }

  async function handleComplete(id: number) {
    await updateTask(id, { status: "done" })
    await refresh()
  }

  async function handleUpdate(id: number, input: TaskUpdateInput) {
    await updateTask(id, input)
    await refresh()
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this task?")) return
    await deleteTask(id)
    await refresh()
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <h2 className="text-sm font-semibold text-muted-foreground">Tasks</h2>

      <div className="flex items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "all")}
          className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="done">Done</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | "all")}
          className="h-8 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm"
          aria-label="Filter by priority"
        >
          <option value="all">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="normal">Normal</option>
          <option value="light">Light</option>
        </select>
      </div>

      <NewTaskForm onCreate={handleCreate} />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && tasks.length === 0 && (
        <p className="text-sm text-muted-foreground">Loading tasks…</p>
      )}
      {!loading && tasks.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">No tasks yet.</p>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto">
        {STATUS_GROUPS.map(({ status, label }) => {
          const group = tasks.filter((t) => t.status === status)
          if (group.length === 0) return null
          return (
            <div key={status}>
              <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label} ({group.length})
              </h3>
              <ul className="space-y-1.5">
                {group.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
