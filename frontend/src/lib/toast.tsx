import toast, { type Toast, type ToastOptions } from "react-hot-toast"
import { CheckCircle2, X, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const DEFAULT_DURATION = 3000

function ToastBody({
  t,
  message,
  variant,
}: {
  t: Toast
  message: string
  variant: "success" | "error"
}) {
  const Icon = variant === "success" ? CheckCircle2 : XCircle

  return (
    <div className="flex items-start gap-2.5">
      <Icon
        className={cn(
          "mt-0.5 size-4.5 shrink-0",
          variant === "success" ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
        )}
      />
      <p className="flex-1 text-sm leading-snug text-foreground">{message}</p>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        aria-label="Dismiss notification"
        className="-mt-0.5 shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

/** Thin wrappers around toast.success/toast.error that render a shared
 * close (X) button and force a consistent 3s duration app-wide, regardless
 * of whatever options a call site passes — every notification in the app
 * should look and behave the same way. Drop-in replacements: call sites
 * keep passing a plain string message exactly as they did with
 * toast.success/toast.error directly. */
export function showSuccess(message: string, options?: ToastOptions) {
  return toast.success((t) => <ToastBody t={t} message={message} variant="success" />, {
    ...options,
    duration: DEFAULT_DURATION,
    icon: null, // ToastBody renders its own icon — suppress react-hot-toast's default one
  })
}

export function showError(message: string, options?: ToastOptions) {
  return toast.error((t) => <ToastBody t={t} message={message} variant="error" />, {
    ...options,
    duration: DEFAULT_DURATION,
    icon: null,
  })
}
