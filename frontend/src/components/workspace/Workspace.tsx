import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { pageShell } from "@/lib/styles"

interface PanelProps {
  children?: ReactNode
  className?: string
}

export function Workspace({ children, className }: PanelProps) {
  return (
    <div className={cn("flex h-full min-h-0 flex-1 overflow-hidden", className)}>
      {children}
    </div>
  )
}

export function WorkspaceLeftPanel({ children, className }: PanelProps) {
  return (
    <aside
      className={cn(
        pageShell,
        "hidden w-64 shrink-0 overflow-y-auto border-r border-border-subtle md:block",
        className
      )}
    >
      {children}
    </aside>
  )
}

export function WorkspaceCenterPanel({ children, className }: PanelProps) {
  return (
    <main className={cn(pageShell, "flex min-w-0 flex-1 flex-col", className)}>
      {children}
    </main>
  )
}

export function WorkspaceRightPanel({ children, className }: PanelProps) {
  return (
    <aside
      className={cn(
        pageShell,
        "hidden w-72 shrink-0 overflow-y-auto border-l border-border-subtle lg:block",
        className
      )}
    >
      {children}
    </aside>
  )
}
