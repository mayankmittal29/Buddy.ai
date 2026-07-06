import { useEffect, useRef, useState } from "react"
import { Check, ExternalLink, FileText, Pencil, Trash2, Upload, X } from "lucide-react"
import {
  type KnowledgeDocument,
  deleteDocument,
  listDocuments,
  renameDocument,
  uploadDocument,
} from "@/components/knowledge/api"
import { EmptyState } from "@/components/ui/empty-state"
import { RowSkeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cardBase, pillBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

type UploadMode = "pdf" | "link"

export function DocumentsTab() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<UploadMode>("pdf")
  const [title, setTitle] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")

  async function refresh() {
    setDocuments(await listDocuments())
  }

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [])

  function resetForm() {
    setTitle("")
    setSourceUrl("")
    setText("")
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (mode === "pdf" && !file) return
    if (mode === "link" && !text.trim()) return

    setSaving(true)
    setError(null)
    try {
      await uploadDocument({
        title: title.trim(),
        file: mode === "pdf" ? file ?? undefined : undefined,
        sourceUrl: mode === "link" ? sourceUrl.trim() || undefined : undefined,
        text: mode === "link" ? text.trim() : undefined,
      })
      resetForm()
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this document? This removes it from semantic search too.")) return
    await deleteDocument(id)
    await refresh()
  }

  function startRename(doc: KnowledgeDocument) {
    setRenamingId(doc.id)
    setRenameValue(doc.title)
  }

  async function handleRenameSave(id: number) {
    const value = renameValue.trim()
    if (!value) return
    const updated = await renameDocument(id, value)
    setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)))
    setRenamingId(null)
  }

  return (
    <div className={cn(cardBase, "flex h-full flex-col gap-3")}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileText className="size-4 text-primary" />
        Documents
      </h2>

      <div className="flex gap-1.5">
        {(["pdf", "link"] as UploadMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              pillBase,
              mode === m
                ? "bg-primary text-white"
                : "border border-border-subtle text-slate-500 hover:border-primary/40"
            )}
          >
            {m === "pdf" ? "Upload PDF" : "Add Link + Notes"}
          </button>
        ))}
      </div>

      <form onSubmit={handleAdd} className="space-y-2 rounded-xl border border-border-subtle bg-canvas p-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" />
        {mode === "pdf" ? (
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-muted-foreground file:mr-2 file:rounded-full file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
          />
        ) : (
          <>
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Source link (optional)"
              type="url"
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste notes/text about this document/paper — this is what gets searched…"
              rows={4}
              className="w-full resize-none rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring"
            />
          </>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button
          type="submit"
          size="sm"
          disabled={saving || !title.trim() || (mode === "pdf" ? !file : !text.trim())}
          className="w-full bg-gradient-to-r from-primary to-accent"
        >
          <Upload className="size-3.5" /> {saving ? "Ingesting…" : "Add to Knowledge Base"}
        </Button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-1.5">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" description="Upload a PDF or add a link above." />
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li key={doc.id} className={cn(cardBase, "flex flex-col gap-1 p-3 shadow-none")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {renamingId === doc.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          autoFocus
                          className="h-7 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameSave(doc.id)
                            if (e.key === "Escape") setRenamingId(null)
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameSave(doc.id)}
                          aria-label="Save name"
                          className="shrink-0 rounded-full p-1 text-success hover:bg-success/10"
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingId(null)}
                          aria-label="Cancel"
                          className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-border-subtle"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : doc.file_path || doc.source_url ? (
                      <a
                        href={doc.file_path ?? doc.source_url ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary hover:underline"
                      >
                        <span className="truncate">{doc.title}</span>
                        <ExternalLink className="size-3 shrink-0 text-slate-400" />
                      </a>
                    ) : (
                      <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"} indexed
                    </p>
                  </div>
                  {renamingId !== doc.id && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => startRename(doc)}
                        aria-label="Rename document"
                        className="rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-primary-50 hover:text-primary"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        aria-label="Delete document"
                        className="rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
