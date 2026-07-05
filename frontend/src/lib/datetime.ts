/** Format an ISO datetime string for a `<input type="datetime-local">` value,
 * in the browser's local time (not UTC) — e.g. "2026-07-06T13:00". */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

/** Short display label for a due date, including the time (e.g. "Jul 6, 1:00 PM"). */
export function formatDueLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Short time label for a chat message (e.g. "1:00 PM") — uses the local
 * device clock rather than a server round-trip, so it's instant. */
export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}
