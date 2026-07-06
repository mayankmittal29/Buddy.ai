import { useRef, useState } from "react"
import { MessageCircle, Minus } from "lucide-react"
import { ChatPanel } from "@/components/workspace/ChatPanel"
import { ConversationsPanel } from "@/components/workspace/ConversationsPanel"

const DRAG_THRESHOLD_PX = 5
const BUTTON_SIZE = 56
const PANEL_WIDTH = 640
const PANEL_HEIGHT = 560
const SIDEBAR_WIDTH = 208

interface DragState {
  startX: number
  startY: number
  originRight: number
  originTop: number
  moved: boolean
}

interface FloatingChatWidgetProps {
  skillId: string
  /** Fired once a chat turn finishes — a hook for the page to refresh
   * whatever lists the turn may have changed via tools, without needing a
   * manual page refresh. */
  onTurnComplete?: () => void
  /** Set this (bumping `nonce` each time) to send a message programmatically
   * and auto-expand the widget if it's collapsed — e.g. a "Skill Gap
   * Analysis" helper form composing a message from a resume + JD. */
  externalTrigger?: { text: string; nonce: number }
}

function conversationStorageKey(skillId: string) {
  return `buddy:conversation:${skillId}`
}

/** A draggable chat launcher that partially expands in place — the rest of
 * the page stays visible and usable around it. Anchored by its right edge
 * (not left), so it starts top-right and always expands leftward from
 * wherever it's been dragged to, never running off the right side of the
 * screen. Shared across skills (Learning Hub, Career Hub, ...) — each
 * instance is scoped to its own skillId's conversations. */
export function FloatingChatWidget({
  skillId,
  onTurnComplete,
  externalTrigger,
}: FloatingChatWidgetProps) {
  // top clears the app's nav bar AND the page's own heading/subtitle so the
  // launcher doesn't overlap either.
  const [position, setPosition] = useState({ right: 24, top: 88 })
  const [expanded, setExpanded] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const storageKey = conversationStorageKey(skillId)
  const [conversationId, setConversationIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(storageKey)
    return stored ? Number(stored) : null
  })
  const dragState = useRef<DragState | null>(null)
  const lastTriggerNonceRef = useRef(0)

  // An external trigger should auto-expand the widget if it's collapsed,
  // so the user sees the analysis land in chat rather than wondering where
  // it went.
  if (
    externalTrigger &&
    externalTrigger.nonce !== 0 &&
    externalTrigger.nonce !== lastTriggerNonceRef.current &&
    !expanded
  ) {
    lastTriggerNonceRef.current = externalTrigger.nonce
    setExpanded(true)
  }

  function setConversationId(id: number | null) {
    setConversationIdState(id)
    if (id === null) localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, String(id))
  }

  function handleTurnComplete() {
    onTurnComplete?.()
    // New conversation showing up / title getting summarized — refresh soon
    // and again shortly after (summarization is a fire-and-forget background
    // task on the backend, finishes a couple seconds later).
    setRefreshToken((t) => t + 1)
    setTimeout(() => setRefreshToken((t) => t + 1), 3500)
  }

  function handlePointerDown(e: React.PointerEvent) {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originRight: position.right,
      originTop: position.top,
      moved: false,
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragState.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
      drag.moved = true
    }
    const width = expanded ? PANEL_WIDTH : BUTTON_SIZE
    const height = expanded ? PANEL_HEIGHT : BUTTON_SIZE
    const maxRight = window.innerWidth - width
    const maxTop = window.innerHeight - height
    setPosition({
      right: Math.min(Math.max(0, drag.originRight - dx), Math.max(0, maxRight)),
      top: Math.min(Math.max(0, drag.originTop + dy), Math.max(0, maxTop)),
    })
  }

  function handlePointerUp() {
    if (dragState.current && !dragState.current.moved) {
      setExpanded((v) => !v)
    }
    dragState.current = null
  }

  return (
    <div className="fixed z-50" style={{ right: position.right, top: position.top }}>
      {!expanded ? (
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          aria-label="Open chat"
          className="flex size-14 touch-none items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-card-hover transition-transform duration-150 active:scale-95"
        >
          <MessageCircle className="size-6" />
        </button>
      ) : (
        <div
          className="flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-card-hover"
          style={{ width: PANEL_WIDTH, height: PANEL_HEIGHT }}
        >
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="flex shrink-0 touch-none items-center justify-between border-b border-border-subtle bg-gradient-to-r from-primary-50 to-accent-50 px-4 py-2.5"
          >
            <span className="font-script text-lg font-bold text-primary">Buddy</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setExpanded(false)
              }}
              aria-label="Minimize chat"
              className="flex size-6 items-center justify-center rounded-full text-slate-500 transition-colors duration-150 hover:bg-white/60 hover:text-foreground"
            >
              <Minus className="size-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1">
            <div
              className="h-full shrink-0 overflow-hidden border-r border-border-subtle p-3"
              style={{ width: SIDEBAR_WIDTH }}
            >
              <ConversationsPanel
                skillId={skillId}
                activeConversationId={conversationId}
                onSelect={setConversationId}
                refreshToken={refreshToken}
              />
            </div>
            <div className="h-full min-w-0 flex-1">
              <ChatPanel
                skillId={skillId}
                conversationId={conversationId}
                onConversationIdChange={setConversationId}
                onTurnComplete={handleTurnComplete}
                externalTrigger={externalTrigger}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
