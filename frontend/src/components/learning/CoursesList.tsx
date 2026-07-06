import { useCallback, useEffect, useState } from "react"
import { BookOpen, Check, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react"
import {
  type Course,
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
} from "@/components/learning/api"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface CoursesListProps {
  /** Bump this (e.g. increment a counter) to force a refetch — after a chat
   * turn may have added/completed a course. */
  refreshToken?: number
  /** Fired whenever a course is added/toggled/deleted here — a hook for a
   * parent to refresh anything derived (e.g. the roadmap view). */
  onChange?: () => void
}

function CourseRow({
  course,
  onToggleDone,
  onDelete,
}: {
  course: Course
  onToggleDone: (course: Course) => void
  onDelete: (id: number) => void
}) {
  const isDone = course.status === "done"
  return (
    <li className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-3">
      <button
        type="button"
        onClick={() => onToggleDone(course)}
        aria-label={isDone ? "Mark as not done" : "Mark as done"}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150",
          isDone ? "border-success bg-success" : "border-border-subtle hover:border-success"
        )}
      >
        {isDone && <Check className="size-3 text-white" />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm text-foreground",
            isDone && "text-muted-foreground line-through"
          )}
        >
          {course.title}
        </p>
        <p className="text-xs text-slate-500">
          {course.provider || "—"}
          {course.deadline
            ? ` · Due ${new Date(course.deadline).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}`
            : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDelete(course.id)}
        aria-label="Delete course"
        className="shrink-0 rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  )
}

export function CoursesList({ refreshToken, onChange }: CoursesListProps) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState("")
  const [provider, setProvider] = useState("")
  const [deadline, setDeadline] = useState("")
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    const result = await listCourses()
    setCourses(result)
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await createCourse({
        title: title.trim(),
        provider: provider.trim() || null,
        deadline: deadline || null,
      })
      setTitle("")
      setProvider("")
      setDeadline("")
      setAdding(false)
      await refresh()
      onChange?.()
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleDone(course: Course) {
    await updateCourse(course.id, { status: course.status === "done" ? "planned" : "done" })
    await refresh()
    onChange?.()
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this course?")) return
    await deleteCourse(id)
    await refresh()
    onChange?.()
  }

  const active = courses.filter((c) => c.status !== "done")
  const completed = courses.filter((c) => c.status === "done")

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BookOpen className="size-4 text-primary" />
          Courses
        </h2>
        <Button
          size="sm"
          onClick={() => setAdding((v) => !v)}
          className="bg-gradient-to-r from-primary to-accent"
        >
          <Plus className="size-3.5" /> Add Course
        </Button>
      </div>

      {adding && (
        <form
          onSubmit={handleAdd}
          className="space-y-2 rounded-xl border border-border-subtle bg-canvas p-3"
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Course title"
            autoFocus
          />
          <div className="flex gap-2">
            <Input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="Provider (optional)"
            />
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !title.trim()}>
              {saving ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-1.5">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Add one above, or tell Buddy in chat."
        />
      ) : (
        <>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">All caught up! No active courses.</p>
          ) : (
            <ul className="space-y-1.5">
              {active.map((course) => (
                <CourseRow
                  key={course.id}
                  course={course}
                  onToggleDone={handleToggleDone}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}

          {completed.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                {showCompleted ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                Completed ({completed.length})
              </button>
              {showCompleted && (
                <ul className="mt-1.5 space-y-1.5">
                  {completed.map((course) => (
                    <CourseRow
                      key={course.id}
                      course={course}
                      onToggleDone={handleToggleDone}
                      onDelete={handleDelete}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
