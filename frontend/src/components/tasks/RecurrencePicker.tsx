import { useState } from "react"
import { cn } from "@/lib/utils"

type RecurrenceType = "none" | "daily" | "weekly" | "every"

const WEEKDAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
]

function buildRule(
  type: RecurrenceType,
  weekdays: string[],
  everyN: number
): string | null {
  switch (type) {
    case "none":
      return null
    case "daily":
      return "daily"
    case "weekly":
      return weekdays.length > 0 ? `weekly:${weekdays.join(",")}` : null
    case "every":
      return `every:${Math.max(1, everyN)}days`
  }
}

interface RecurrencePickerProps {
  onChange: (rule: string | null) => void
}

export function RecurrencePicker({ onChange }: RecurrencePickerProps) {
  const [type, setType] = useState<RecurrenceType>("none")
  const [weekdays, setWeekdays] = useState<string[]>([])
  const [everyN, setEveryN] = useState(3)

  function handleTypeChange(next: RecurrenceType) {
    setType(next)
    onChange(buildRule(next, weekdays, everyN))
  }

  function toggleWeekday(day: string) {
    const next = weekdays.includes(day)
      ? weekdays.filter((d) => d !== day)
      : [...weekdays, day]
    setWeekdays(next)
    onChange(buildRule(type, next, everyN))
  }

  function handleEveryNChange(n: number) {
    setEveryN(n)
    onChange(buildRule(type, weekdays, n))
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        value={type}
        onChange={(e) => handleTypeChange(e.target.value as RecurrenceType)}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
        aria-label="Repeat"
      >
        <option value="none">Does not repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Specific weekdays</option>
        <option value="every">Every N days</option>
      </select>

      {type === "weekly" && (
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleWeekday(key)}
              className={cn(
                "rounded-md border border-input px-2 py-1 text-xs",
                weekdays.includes(key) && "border-primary bg-primary text-primary-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {type === "every" && (
        <div className="flex items-center gap-2 text-sm">
          <span>Every</span>
          <input
            type="number"
            min={1}
            value={everyN}
            onChange={(e) => handleEveryNChange(Number(e.target.value) || 1)}
            className="h-8 w-16 rounded-lg border border-input bg-transparent px-2 text-sm"
          />
          <span>days</span>
        </div>
      )}
    </div>
  )
}
