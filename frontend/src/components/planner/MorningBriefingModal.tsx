import { useEffect, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { type BriefingByMode, getMorningBriefing } from "@/components/planner/api"

interface MorningBriefingModalProps {
  open: boolean
  onClose: () => void
}

const MODE_LABELS: Record<keyof BriefingByMode, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
}

export function MorningBriefingModal({ open, onClose }: MorningBriefingModalProps) {
  const [data, setData] = useState<BriefingByMode | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getMorningBriefing()
      .then(setData)
      .catch(() => setData({ daily: [], weekly: [], monthly: [] }))
      .finally(() => setLoading(false))
  }, [open])

  const hasAny = !!data && data.daily.length + data.weekly.length + data.monthly.length > 0

  return (
    <Modal open={open} onClose={onClose} title="Morning Briefing">
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && data && !hasAny && (
        <p className="text-sm text-muted-foreground">
          Nothing pending from before today — clean slate! 🎉
        </p>
      )}
      {!loading && data && hasAny && (
        <div className="space-y-4">
          {(Object.keys(MODE_LABELS) as (keyof BriefingByMode)[]).map((mode) => {
            const items = data[mode]
            if (items.length === 0) return null
            return (
              <div key={mode}>
                <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {MODE_LABELS[mode]} ({items.length})
                </h3>
                <ul className="space-y-1.5">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-canvas px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-foreground">{item.title}</span>
                      <button
                        type="button"
                        disabled
                        title="Coming soon"
                        className="shrink-0 cursor-not-allowed rounded-full border border-border-subtle px-2.5 py-1 text-xs text-slate-400"
                      >
                        Add to today
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
