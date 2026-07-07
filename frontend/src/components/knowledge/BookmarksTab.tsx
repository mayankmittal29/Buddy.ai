import { useEffect, useState } from "react"
import { Bookmark as BookmarkIcon, Check, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react"
import { showSuccess, showError } from "@/lib/toast"
import {
  type Bookmark,
  createBookmark,
  deleteBookmark,
  listBookmarks,
  updateBookmark,
} from "@/components/knowledge/api"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

export function BookmarksTab() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editUrl, setEditUrl] = useState("")

  async function refresh() {
    setBookmarks(await listBookmarks())
  }

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || !title.trim()) return
    setSaving(true)
    try {
      await createBookmark({ url: url.trim(), title: title.trim(), note: note.trim() || null })
      setUrl("")
      setTitle("")
      setNote("")
      await refresh()
      showSuccess("Bookmark added.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't add the bookmark.", { duration: 5000 })
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteBookmark(id)
      await refresh()
      showSuccess("Bookmark deleted.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't delete the bookmark.", { duration: 5000 })
      throw err
    }
  }

  function startEdit(bookmark: Bookmark) {
    setEditingId(bookmark.id)
    setEditTitle(bookmark.title)
    setEditUrl(bookmark.url)
  }

  async function handleEditSave(bookmark: Bookmark) {
    if (!editTitle.trim() || !editUrl.trim()) return
    try {
      const updated = await updateBookmark(bookmark.id, {
        title: editTitle.trim(),
        url: editUrl.trim(),
        note: bookmark.note,
      })
      setBookmarks((prev) => prev.map((b) => (b.id === bookmark.id ? updated : b)))
      setEditingId(null)
      showSuccess("Bookmark updated.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Couldn't update the bookmark.", { duration: 5000 })
      throw err
    }
  }

  return (
    <div className={cn(cardBase, "flex h-full flex-col gap-3")}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <BookmarkIcon className="size-4 text-primary" />
        Bookmarks
      </h2>

      <form onSubmit={handleAdd} className="space-y-2 rounded-xl border border-border-subtle bg-canvas p-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          type="url"
        />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
        <Button
          type="submit"
          size="sm"
          disabled={saving || !url.trim() || !title.trim()}
          className="w-full bg-gradient-to-r from-primary to-accent"
        >
          <Plus className="size-3.5" /> Add Bookmark
        </Button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-1.5">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : bookmarks.length === 0 ? (
          <EmptyState icon={BookmarkIcon} title="No bookmarks yet" description="Add one above." />
        ) : (
          <ul className="space-y-2">
            {bookmarks.map((bookmark) => (
              <li key={bookmark.id} className={cn(cardBase, "flex flex-col gap-1 p-3 shadow-none")}>
                {editingId === bookmark.id ? (
                  <div className="space-y-1.5">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-7 text-sm"
                      autoFocus
                    />
                    <Input
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      className="h-7 text-sm"
                      type="url"
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        aria-label="Cancel"
                        className="rounded-full p-1 text-slate-400 hover:bg-border-subtle"
                      >
                        <X className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditSave(bookmark)}
                        aria-label="Save"
                        className="rounded-full p-1 text-success hover:bg-success/10"
                      >
                        <Check className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <a
                      href={bookmark.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 items-center gap-1 text-sm font-medium text-foreground hover:text-primary hover:underline"
                    >
                      <span className="truncate">{bookmark.title}</span>
                      <ExternalLink className="size-3 shrink-0 text-slate-400" />
                    </a>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => startEdit(bookmark)}
                        aria-label="Edit bookmark"
                        className="rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-primary-50 hover:text-primary"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(bookmark.id)}
                        aria-label="Delete bookmark"
                        className="rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}
                {editingId !== bookmark.id && bookmark.note && (
                  <p className="text-xs text-muted-foreground">{bookmark.note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
