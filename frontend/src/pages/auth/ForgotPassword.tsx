import { useState } from "react"
import { Link } from "react-router-dom"
import { showSuccess, showError } from "@/lib/toast"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import AuthLayout from "@/components/auth/AuthLayout"

const API_URL = import.meta.env.VITE_API_URL

export default function ForgotPassword() {
  const [username, setUsername] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      })
      if (!res.ok) throw new Error("Something went wrong. Try again.")
      setSent(true)
      showSuccess("Check your email for a reset link.", { duration: 5000 })
    } catch (err) {
      showError(err instanceof Error ? err.message : "Something went wrong.", {
        duration: 5000,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <div className="mx-auto w-full max-w-sm">
        <Link
          to="/"
          className="font-script text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"
        >
          Buddy
        </Link>
        <h1 className="mt-6 text-2xl font-semibold text-foreground">Forgot your password?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the email you signed up with and we'll send you a reset link.
        </p>

        {sent ? (
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-border-subtle bg-primary-50 p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-sm text-foreground">
              If an account with that email exists, we've sent a password reset link — check
              your inbox.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Email address</Label>
              <Input
                id="username"
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@example.com"
                autoComplete="username"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-primary to-accent shadow-card hover:opacity-90"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
