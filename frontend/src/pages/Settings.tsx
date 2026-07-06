import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { cardBase, pageShell } from "@/lib/styles"
import { cn } from "@/lib/utils"

const API_URL = import.meta.env.VITE_API_URL

type SaveState = "idle" | "saving" | "saved" | "error"

interface NotificationPreferences {
  email_address: string
  channels: { email: boolean }
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email_address: "",
  channels: { email: false },
}

export default function Settings() {
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  )
  const [notifLoading, setNotifLoading] = useState(true)
  const [notifSaveState, setNotifSaveState] = useState<SaveState>("idle")

  useEffect(() => {
    let cancelled = false

    fetch(`${API_URL}/api/notification-preferences`)
      .then((res) => res.json())
      .then((data: NotificationPreferences) => {
        if (cancelled) return
        setNotifPrefs({
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...data,
          channels: { ...DEFAULT_NOTIFICATION_PREFERENCES.channels, ...data.channels },
        })
      })
      .finally(() => {
        if (!cancelled) setNotifLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleNotifSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNotifSaveState("saving")
    try {
      const res = await fetch(`${API_URL}/api/notification-preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifPrefs),
      })
      if (!res.ok) throw new Error(`request failed (${res.status})`)
      const data: NotificationPreferences = await res.json()
      setNotifPrefs({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...data,
        channels: { ...DEFAULT_NOTIFICATION_PREFERENCES.channels, ...data.channels },
      })
      setNotifSaveState("saved")
    } catch {
      setNotifSaveState("error")
    }
  }

  return (
    <div className={cn(pageShell, "mx-auto max-w-3xl")}>
      <div className="mb-6">
        <h1 className="font-script text-4xl font-bold text-primary">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Configure how and when Buddy reaches out to you.
        </p>
      </div>

      {!notifLoading && (
        <form onSubmit={handleNotifSubmit}>
          <Card className={cardBase}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <Bell className="size-4.5" />
                </div>
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>
                    Buddy won't email you anything until you turn this on — in-app
                    notifications always show up regardless.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="notif-email">Email address</Label>
                <Input
                  id="notif-email"
                  type="email"
                  value={notifPrefs.email_address}
                  onChange={(e) =>
                    setNotifPrefs((prev) => ({
                      ...prev,
                      email_address: e.target.value,
                    }))
                  }
                  placeholder="you@example.com"
                />
              </div>
              <label className="flex items-center gap-2 text-sm sm:h-8">
                <input
                  type="checkbox"
                  checked={notifPrefs.channels.email}
                  onChange={(e) =>
                    setNotifPrefs((prev) => ({
                      ...prev,
                      channels: { ...prev.channels, email: e.target.checked },
                    }))
                  }
                />
                Also email me reminders for upcoming tasks
              </label>
            </CardContent>
          </Card>

          <div className="mt-4 flex items-center gap-3">
            <Button
              type="submit"
              disabled={
                notifSaveState === "saving" ||
                (notifPrefs.channels.email && !notifPrefs.email_address.trim())
              }
              className="bg-gradient-to-r from-primary to-accent shadow-card hover:opacity-90"
            >
              {notifSaveState === "saving" ? "Saving…" : "Save"}
            </Button>
            {notifSaveState === "saved" && (
              <span className="text-sm text-muted-foreground">Saved.</span>
            )}
            {notifSaveState === "error" && (
              <span className="text-sm text-destructive">Couldn't save. Try again.</span>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
