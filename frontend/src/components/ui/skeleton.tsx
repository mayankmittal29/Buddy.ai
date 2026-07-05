import { cn } from "@/lib/utils"

/** A single pulsing placeholder rectangle. Size/shape via className. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-border-subtle", className)}
      {...props}
    />
  )
}

/** Mimics the shape of a cardBase-styled card (icon + title + description lines). */
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-surface rounded-2xl border border-border-subtle p-5",
        className
      )}
    >
      <Skeleton className="size-6 rounded-md" />
      <Skeleton className="mt-4 h-4 w-2/5" />
      <Skeleton className="mt-2 h-3 w-full" />
      <Skeleton className="mt-1.5 h-3 w-4/5" />
    </div>
  )
}

/** A single pulsing row, for list items (e.g. a task row) while loading. */
function RowSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border-subtle p-2",
        className
      )}
    >
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
  )
}

export { Skeleton, CardSkeleton, RowSkeleton }
