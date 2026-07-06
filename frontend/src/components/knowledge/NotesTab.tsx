import { useEffect, useState } from "react"
import { NotebookPen, Pencil, Plus, Trash2 } from "lucide-react"
import { type Note, createNote, deleteNote, listNotes } from "@/components/knowledge/api"
import { NoteDetailModal } from "@/components/knowledge/NoteDetailModal"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

export function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [detailNote, setDetailNote] = useState<Note | null>(null)
  const [detailEditMode, setDetailEditMode] = useState(false)
  const [detailNonce, setDetailNonce] = useState(0)

  async function refresh() {
    setNotes(await listNotes())
  }

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    try {
      await createNote({ title: title.trim(), content: content.trim() })
      setTitle("")
      setContent("")
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    await deleteNote(id)
    if (detailNote?.id === id) setDetailNote(null)
    await refresh()
  }

  function handleNoteUpdated(updated: Note) {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
    setDetailNote(updated)
  }

  return (
    <div className={cn(cardBase, "flex h-full flex-col gap-3")}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <NotebookPen className="size-4 text-primary" />
        Notes
      </h2>

      <form onSubmit={handleAdd} className="space-y-2 rounded-xl border border-border-subtle bg-canvas p-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your note…"
          rows={3}
          className="w-full resize-none rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring"
        />
        <Button
          type="submit"
          size="sm"
          disabled={saving || !title.trim() || !content.trim()}
          className="w-full bg-gradient-to-r from-primary to-accent"
        >
          <Plus className="size-3.5" /> Add Note
        </Button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-1.5">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : notes.length === 0 ? (
          <EmptyState icon={NotebookPen} title="No notes yet" description="Add one above." />
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li
                key={note.id}
                onClick={() => {
                  setDetailNote(note)
                  setDetailEditMode(false)
                  setDetailNonce((n) => n + 1)
                }}
                className={cn(cardBase, "flex cursor-pointer flex-col gap-1 p-3 shadow-none hover:border-primary/30")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-foreground">{note.title}</p>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDetailNote(note)
                        setDetailEditMode(true)
                        setDetailNonce((n) => n + 1)
                      }}
                      aria-label="Edit note"
                      className="rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-primary-50 hover:text-primary"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(note.id)
                      }}
                      aria-label="Delete note"
                      className="rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <p className="line-clamp-3 text-xs text-muted-foreground">{note.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NoteDetailModal
        note={detailNote}
        startInEditMode={detailEditMode}
        openNonce={detailNonce}
        onClose={() => setDetailNote(null)}
        onUpdated={handleNoteUpdated}
      />
    </div>
  )
}
