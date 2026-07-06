import { useCallback, useEffect, useState } from "react"
import { Brain, CalendarCheck, Plus, RotateCw, Trash2 } from "lucide-react"
import {
  type RevisionItem,
  listRevisionItems,
  createRevisionItem,
  markRevisionRevised,
  deleteRevisionItem,
} from "@/components/learning/api"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface RevisionPlannerProps {
  /** Bump this (e.g. increment a counter) to force a refetch — after a chat
   * turn may have added/revised a topic. */
  refreshToken?: number
}

export function RevisionPlanner({ refreshToken }: RevisionPlannerProps) {
  const [items, setItems] = useState<RevisionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [topic, setTopic] = useState("")
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    const result = await listRevisionItems()
    setItems(result)
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
    if (!topic.trim()) return
    setSaving(true)
    try {
      await createRevisionItem({ topic: topic.trim() })
      setTopic("")
      setAdding(false)
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkRevised(id: number) {
    await markRevisionRevised(id)
    await refresh()
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this revision topic?")) return
    await deleteRevisionItem(id)
    await refresh()
  }

  const today = new Date().toISOString().slice(0, 10)
  const due = items.filter((i) => i.next_review_at <= today)
  const upcoming = items.filter((i) => i.next_review_at > today)

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Brain className="size-4 text-primary" />
          Revision Planner
        </h2>
        <Button
          size="sm"
          onClick={() => setAdding((v) => !v)}
          className="bg-gradient-to-r from-primary to-accent"
        >
          <Plus className="size-3.5" /> Add Topic
        </Button>
      </div>

      {adding && (
        <form
          onSubmit={handleAdd}
          className="flex gap-2 rounded-xl border border-border-subtle bg-canvas p-3"
        >
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic to revise"
            autoFocus
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={saving || !topic.trim()}>
            {saving ? "Adding…" : "Add"}
          </Button>
        </form>
      )}

      {loading ? (
        <div className="space-y-1.5">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="Nothing to revise yet"
          description="Add a topic above, or tell Buddy in chat."
        />
      ) : (
        <>
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium tracking-wide text-primary uppercase">
              <CalendarCheck className="size-3.5" />
              Due today ({due.length})
            </h3>
            {due.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing due today. 🎉</p>
            ) : (
              <ul className="space-y-1.5">
                {due.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-50 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.topic}
                      </p>
                      {item.notes && (
                        <p className="truncate text-xs text-muted-foreground">{item.notes}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleMarkRevised(item.id)}
                      className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-white transition-colors duration-150 hover:bg-primary-hover"
                    >
                      <RotateCw className="size-3" />
                      Mark revised
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      aria-label="Delete revision topic"
                      className="shrink-0 rounded-full p-1 text-slate-400 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {upcoming.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Upcoming ({upcoming.length})
              </h3>
              <ul className="space-y-1.5">
                {upcoming.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{item.topic}</p>
                      <p className="text-xs text-slate-500">
                        Due{" "}
                        {new Date(item.next_review_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      aria-label="Delete revision topic"
                      className="shrink-0 rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
