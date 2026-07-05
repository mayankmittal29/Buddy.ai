import { useEffect, useRef, useState } from "react"
import { Bot, Send, Sparkle, Sparkles } from "lucide-react"
import UserAvatar from "@/components/UserAvatar"
import { getConversationMessages } from "@/components/workspace/conversationsApi"
import { formatMessageTime } from "@/lib/datetime"
import { cn } from "@/lib/utils"

const API_URL = import.meta.env.VITE_API_URL

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  /** ISO timestamp — set from the local device clock the instant a message
   * is sent/received, or from the server's stored value when loading
   * history. Either way, no extra network round-trip is needed to show it. */
  createdAt: string
}

interface ChatPanelProps {
  skillId: string
  /** Omit for self-managed (localStorage-backed) conversation state, used by
   * skills with no conversation-list panel of their own. Pass a value (even
   * null) to put this panel under a parent's control instead — e.g. so a
   * conversations list can drive which conversation is loaded. */
  conversationId?: number | null
  onConversationIdChange?: (id: number | null) => void
  /** Fired once a turn finishes (success or error) — a good hook for a
   * parent to refresh a conversations list (new conversation appearing, or
   * its title having just been summarized). */
  onTurnComplete?: () => void
  /** Only meaningful for skills with sub-modes (e.g. planner's
   * daily/weekly/monthly) — sent with each message so the backend can tag
   * new conversations and adapt the model's behavior to the active mode. */
  mode?: string
}

function conversationStorageKey(skillId: string) {
  return `buddy:conversation:${skillId}`
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </div>
  )
}

function AssistantAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-card">
      <Bot className="size-4" />
    </div>
  )
}

/** Chat's default greeting — shown whenever a conversation has no messages yet. */
function BuddyGreeting() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent shadow-card-hover">
        <Bot className="size-8 text-white" />
        <Sparkles className="absolute -top-2 -right-2 size-5 text-accent" />
        <Sparkle className="absolute -bottom-1 -left-3 size-4 text-primary" />
      </div>
      <h2 className="font-script text-4xl font-bold text-primary">Hey there!</h2>
      <p className="text-base font-medium text-foreground">
        I'm <span className="font-semibold text-primary">Buddy</span> — your AI
        companion
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Ask a question, share a preference, or just say hi — I'm all ears! 👋
      </p>
    </div>
  )
}

export function ChatPanel({
  skillId,
  conversationId: controlledConversationId,
  onConversationIdChange,
  onTurnComplete,
  mode,
}: ChatPanelProps) {
  const isControlled = controlledConversationId !== undefined
  const storageKey = conversationStorageKey(skillId)

  const [internalConversationId, setInternalConversationId] = useState<number | null>(
    () => {
      if (isControlled) return controlledConversationId ?? null
      const stored = localStorage.getItem(storageKey)
      return stored ? Number(stored) : null
    }
  )

  const conversationId = isControlled ? controlledConversationId! : internalConversationId

  // When ChatPanel itself assigns a conversation id (e.g. the backend
  // creating one mid-stream for what was a "new" conversation), the local
  // `messages` state is already the source of truth — the controlled-mode
  // load effect below must NOT re-fetch and clobber it. This ref records
  // "the next id change is one we caused ourselves, skip the reload".
  const selfInitiatedIdRef = useRef<{ pending: boolean; id: number | null }>({
    pending: false,
    id: null,
  })

  function setConversationId(id: number | null) {
    if (isControlled) {
      selfInitiatedIdRef.current = { pending: true, id }
      onConversationIdChange?.(id)
      return
    }
    setInternalConversationId(id)
    if (id === null) localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, String(id))
  }

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Uncontrolled mode: switching skills means switching conversations too.
  useEffect(() => {
    if (isControlled) return
    const stored = localStorage.getItem(storageKey)
    setInternalConversationId(stored ? Number(stored) : null)
    setMessages([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Controlled mode: whenever the parent points us at a different
  // conversation (or null, for "new"), load its history from the server —
  // unless this is the id ChatPanel itself just emitted mid-stream.
  useEffect(() => {
    if (!isControlled) return
    if (
      selfInitiatedIdRef.current.pending &&
      selfInitiatedIdRef.current.id === controlledConversationId
    ) {
      selfInitiatedIdRef.current = { pending: false, id: null }
      return
    }
    selfInitiatedIdRef.current = { pending: false, id: null }

    if (controlledConversationId == null) {
      setMessages([])
      return
    }
    let cancelled = false
    getConversationMessages(skillId, controlledConversationId)
      .then((rows) => {
        if (cancelled) return
        setMessages(
          rows.map((r) => ({
            id: String(r.id),
            role: r.role,
            content: r.content,
            createdAt: r.created_at,
          }))
        )
      })
      .catch(() => {
        if (!cancelled) setMessages([])
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, controlledConversationId, skillId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput("")
    const now = new Date().toISOString()
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: now,
    }
    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "", createdAt: now },
    ])
    setIsStreaming(true)

    const updateAssistant = (content: string) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
      )

    try {
      let activeConversationId = conversationId
      let res = await fetch(`${API_URL}/api/skills/${skillId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: activeConversationId,
          message: text,
          mode,
        }),
      })

      // A stale conversation_id (e.g. left over from a wiped dev database)
      // gets rejected by the backend — drop it and retry as a fresh
      // conversation instead of leaving the chat permanently broken.
      if (!res.ok && (res.status === 404 || res.status === 400) && activeConversationId !== null) {
        activeConversationId = null
        setConversationId(null)
        res = await fetch(`${API_URL}/api/skills/${skillId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: null, message: text, mode }),
        })
      }

      if (!res.ok || !res.body) {
        throw new Error(`request failed (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let assistantText = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let sepIndex: number
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIndex)
          buffer = buffer.slice(sepIndex + 2)

          const dataLine = rawEvent
            .split("\n")
            .find((line) => line.startsWith("data:"))
          if (!dataLine) continue

          const event = JSON.parse(dataLine.slice("data:".length).trim())

          switch (event.type) {
            case "conversation":
              setConversationId(event.conversation_id)
              break
            case "delta":
              assistantText += event.text
              updateAssistant(assistantText)
              break
            case "final":
              assistantText = event.text
              updateAssistant(assistantText)
              break
            case "error":
              updateAssistant(`Error: ${event.detail}`)
              break
          }
        }
      }
    } catch (err) {
      updateAssistant(
        err instanceof Error ? `Error: ${err.message}` : "Something went wrong."
      )
    } finally {
      setIsStreaming(false)
      onTurnComplete?.()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && <BuddyGreeting />}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex items-end gap-2",
              m.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {m.role === "assistant" && <AssistantAvatar />}
            <div
              className={cn(
                "flex max-w-[75%] flex-col gap-1",
                m.role === "user" ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap shadow-card",
                  m.role === "user"
                    ? "rounded-br-md bg-gradient-to-br from-primary to-accent text-white"
                    : "rounded-bl-md border border-border-subtle bg-surface text-foreground"
                )}
              >
                {m.content ? (
                  m.content
                ) : m.role === "assistant" && isStreaming ? (
                  <TypingIndicator />
                ) : null}
              </div>
              {m.content && (
                <span className="px-1 text-[11px] text-muted-foreground">
                  {formatMessageTime(m.createdAt)}
                </span>
              )}
            </div>
            {m.role === "user" && <UserAvatar className="size-8" />}
          </div>
        ))}
      </div>

      <div className="border-t border-border-subtle p-4">
        <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-canvas px-2 py-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Buddy…"
            rows={1}
            className="max-h-32 flex-1 resize-none bg-transparent px-3 py-1.5 text-sm outline-none"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            aria-label="Send message"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-all duration-200 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
