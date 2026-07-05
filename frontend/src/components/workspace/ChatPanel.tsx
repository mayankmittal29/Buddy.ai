import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const API_URL = import.meta.env.VITE_API_URL

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

interface ChatPanelProps {
  skillId: string
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

export function ChatPanel({ skillId }: ChatPanelProps) {
  const storageKey = conversationStorageKey(skillId)

  const [conversationId, setConversationId] = useState<number | null>(() => {
    const stored = localStorage.getItem(storageKey)
    return stored ? Number(stored) : null
  })
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Switching skills means switching conversations too.
  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    setConversationId(stored ? Number(stored) : null)
    setMessages([])
  }, [storageKey])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput("")
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    }
    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "" },
    ])
    setIsStreaming(true)

    const updateAssistant = (content: string) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
      )

    try {
      const res = await fetch(`${API_URL}/api/skills/${skillId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, message: text }),
      })

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
              localStorage.setItem(storageKey, String(event.conversation_id))
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
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Say hello to get started.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              {m.content ? (
                m.content
              ) : m.role === "assistant" && isStreaming ? (
                <TypingIndicator />
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Buddy…"
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
