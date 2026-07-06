import { useEffect, useState } from "react"
import { Pencil, X } from "lucide-react"
import { type Note, updateNote } from "@/components/knowledge/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface NoteDetailModalProps {
  note: Note | null
  onClose: () => void
  onUpdated: (note: Note) => void
  /** Open straight into edit mode (e.g. the tile's own edit icon was clicked
   * rather than the tile itself). */
  startInEditMode?: boolean
  /** Bump this every time the modal is opened (even for the same note id)
   * so re-opening in a different mode (view vs edit) is always reflected —
   * keying off note.id alone wouldn't re-run the reset below when the same
   * note is reopened right after being closed. */
  openNonce?: number
}

export function NoteDetailModal({
  note,
  onClose,
  onUpdated,
  startInEditMode,
  openNonce,
}: NoteDetailModalProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!note) return
    setTitle(note.title)
    setContent(note.content)
    setEditing(Boolean(startInEditMode))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNonce])

  useEffect(() => {
    if (!note) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [note, onClose])

  if (!note) return null

  async function handleSave() {
    if (!note || !title.trim() || !content.trim()) return
    setSaving(true)
    try {
      const updated = await updateNote(note.id, { title: title.trim(), content: content.trim() })
      onUpdated(updated)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

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
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="text-lg font-semibold"
            />
          ) : (
            <h2 className="min-w-0 text-lg font-semibold break-words text-foreground">
              {note.title}
            </h2>
          )}
          <div className="flex shrink-0 items-center gap-1">
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="Edit note"
                className="flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors duration-150 hover:bg-primary-50 hover:text-primary"
              >
                <Pencil className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors duration-150 hover:bg-border-subtle hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full resize-none rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-sm outline-none focus-visible:border-ring"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving || !title.trim() || !content.trim()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground">{note.content}</p>
        )}

        <p className="mt-4 border-t border-border-subtle pt-3 text-xs text-muted-foreground">
          Created {new Date(note.created_at).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
    </div>
  )
}
