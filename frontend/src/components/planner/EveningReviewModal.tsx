import { useEffect, useState } from "react"
import { CheckCircle2, Circle } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { type EveningReview, getEveningReview } from "@/components/planner/api"

interface EveningReviewModalProps {
  open: boolean
  onClose: () => void
}

export function EveningReviewModal({ open, onClose }: EveningReviewModalProps) {
  const [data, setData] = useState<EveningReview | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getEveningReview()
      .then(setData)
      .catch(() => setData({ completed: [], pending: [] }))
      .finally(() => setLoading(false))
  }, [open])

  const isEmpty = !!data && data.completed.length === 0 && data.pending.length === 0

  return (
    <Modal open={open} onClose={onClose} title="Evening Review">
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && isEmpty && (
        <p className="text-sm text-muted-foreground">No items added today.</p>
      )}
      {!loading && data && !isEmpty && (
        <div className="space-y-4">
          {data.completed.length > 0 && (
            <div>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium tracking-wide text-success uppercase">
                <CheckCircle2 className="size-3.5" /> Completed ({data.completed.length})
              </h3>
              <ul className="space-y-1.5">
                {data.completed.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border-subtle bg-canvas px-3 py-2 text-sm text-muted-foreground line-through"
                  >
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.pending.length > 0 && (
            <div>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium tracking-wide text-amber-600 uppercase">
                <Circle className="size-3.5" /> Still pending ({data.pending.length})
              </h3>
              <ul className="space-y-1.5">
                {data.pending.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border-subtle bg-canvas px-3 py-2 text-sm text-foreground"
                  >
                    {item.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
