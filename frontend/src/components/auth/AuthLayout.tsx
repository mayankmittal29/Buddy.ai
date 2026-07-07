import type { ReactNode } from "react"

interface AuthLayoutProps {
  children: ReactNode
}

/** Shared split-screen shell for every auth page (Login/Signup/Forgot/Reset
 * Password) — branding panel on the left, form on the right. Deliberately
 * capped at max-w-5xl and centered rather than filling the viewport, so it
 * reads as a focused card rather than a full-page takeover. */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas p-4">
      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl border border-border-subtle bg-surface shadow-card-hover md:grid-cols-2 md:min-h-[640px]">
        <div className="relative hidden bg-gradient-to-br from-primary to-accent md:block">
          <img
            src="/branding/thumbnail.png"
            alt="Buddy — your agentic AI personal assistant"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/80 to-transparent p-8 pt-16">
            <p className="font-script text-2xl font-bold text-white">
              One agent. Nine skills. Zero wasted context.
            </p>
          </div>
        </div>
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 md:px-12">
          {children}
        </div>
      </div>
    </div>
  )
}
