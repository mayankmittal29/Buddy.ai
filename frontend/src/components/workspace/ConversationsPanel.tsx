import { useCallback, useEffect, useState } from "react"
import { MessageSquarePlus, MessagesSquare, Trash2 } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import {
  type ConversationSummary,
  listConversations,
  createConversation,
  deleteConversation,
} from "@/components/workspace/conversationsApi"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface ConversationsPanelProps {
  skillId: string
  activeConversationId: number | null
  onSelect: (id: number | null) => void
  /** Bump this (e.g. increment a counter) to force a list refetch — after a
   * new conversation is created or a title gets summarized. */
  refreshToken?: number
  /** Only meaningful for skills with sub-modes (e.g. planner's
   * daily/weekly/monthly) — scopes the list and new conversations to just
   * this mode, so each mode has its own independent conversation list. */
  mode?: string
}

export function ConversationsPanel({
  skillId,
  activeConversationId,
  onSelect,
  refreshToken,
  mode,
}: ConversationsPanelProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [startingNew, setStartingNew] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const result = await listConversations(skillId, mode)
      setConversations(result)
      return result
    } catch {
      // Leave the previous list in place; this is a best-effort refresh.
      return conversations
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId, mode])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh, refreshToken])

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await deleteConversation(skillId, id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (id === activeConversationId) onSelect(null)
    } catch {
      // Leave it in the list if deletion failed.
    } finally {
      setDeletingId(null)
    }
  }

  async function handleStartNew() {
    setStartingNew(true)
    try {
      // Don't let untouched "New chat" placeholders pile up — if the
      // conversation we're leaving never got a single message, drop it.
      const current = conversations.find((c) => c.id === activeConversationId)
      if (current && current.message_count === 0) {
        try {
          await deleteConversation(skillId, current.id)
        } catch {
          // best effort
        }
      }
      const created = await createConversation(skillId, mode)
      onSelect(created.id)
      await refresh()
    } catch {
      // Backend create failed — fall back to the old behaviour (a
      // transient, not-yet-persisted "new" state) so chat still works.
      onSelect(null)
    } finally {
      setStartingNew(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h2 className="mb-3 text-sm font-semibold text-foreground">All Conversations</h2>

      <button
        type="button"
        onClick={handleStartNew}
        disabled={startingNew}
        className="mb-4 flex shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-medium text-white shadow-card transition-all duration-200 hover:opacity-90 disabled:opacity-60"
      >
        <MessageSquarePlus className="size-4" />
        Start new conversation
      </button>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-border-subtle/60" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No conversations yet"
            description="Start chatting and it'll show up here."
          />
        ) : (
          conversations.map((c) => (
            <div key={c.id} className="group relative">
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  cardBase,
                  "w-full p-3 text-left shadow-none",
                  c.id === activeConversationId
                    ? "border-primary bg-primary-50"
                    : "hover:border-primary/30"
                )}
              >
                <p className="truncate pr-6 text-sm font-medium text-foreground">
                  {c.title || "New conversation"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.message_count} {c.message_count === 1 ? "message" : "messages"}
                </p>
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(c.id, e)}
                disabled={deletingId === c.id}
                aria-label="Delete conversation"
                className="absolute top-3 right-3 rounded-full p-1 text-slate-300 transition-colors duration-150 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
