import { useEffect, useState } from "react"
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

const API_URL = import.meta.env.VITE_API_URL

interface ProfileData {
  name: string
  timezone: string
  wake_time: string
  sleep_time: string
  meal_times: Record<string, string>
  work_start: string
  work_end: string
}

const DEFAULT_PROFILE: ProfileData = {
  name: "",
  timezone: "UTC",
  wake_time: "07:00",
  sleep_time: "23:00",
  meal_times: { breakfast: "08:00", lunch: "13:00", dinner: "19:00" },
  work_start: "09:00",
  work_end: "17:00",
}

const TIMEZONES =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : []

type SaveState = "idle" | "saving" | "saved" | "error"

interface NotificationPreferences {
  email_address: string
  channels: { email: boolean }
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email_address: "",
  channels: { email: false },
}

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>("idle")

  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  )
  const [notifLoading, setNotifLoading] = useState(true)
  const [notifSaveState, setNotifSaveState] = useState<SaveState>("idle")

  useEffect(() => {
    let cancelled = false

    fetch(`${API_URL}/api/profile`)
      .then((res) => res.json())
      .then((data: ProfileData) => {
        if (cancelled) return
        setProfile({
          ...DEFAULT_PROFILE,
          ...data,
          meal_times: { ...DEFAULT_PROFILE.meal_times, ...data.meal_times },
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

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

  function updateField<K extends keyof ProfileData>(
    field: K,
    value: ProfileData[K]
  ) {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }

  function updateMealTime(meal: string, value: string) {
    setProfile((prev) => ({
      ...prev,
      meal_times: { ...prev.meal_times, [meal]: value },
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveState("saving")
    try {
      const res = await fetch(`${API_URL}/api/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      if (!res.ok) throw new Error(`request failed (${res.status})`)
      const data: ProfileData = await res.json()
      setProfile({
        ...DEFAULT_PROFILE,
        ...data,
        meal_times: { ...DEFAULT_PROFILE.meal_times, ...data.meal_times },
      })
      setSaveState("saved")
    } catch {
      setSaveState("error")
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Loading profile…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="mt-2 text-muted-foreground">
        Tell Buddy a bit about your daily rhythm so it can plan around it.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
            <CardDescription>Your name and timezone.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={profile.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={profile.timezone}
                onChange={(e) => updateField("timezone", e.target.value)}
                list="timezone-options"
                placeholder="e.g. Asia/Kolkata"
              />
              {TIMEZONES.length > 0 && (
                <datalist id="timezone-options">
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz} />
                  ))}
                </datalist>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sleep</CardTitle>
            <CardDescription>When your day starts and ends.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="wake_time">Wake time</Label>
              <Input
                id="wake_time"
                type="time"
                value={profile.wake_time}
                onChange={(e) => updateField("wake_time", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sleep_time">Sleep time</Label>
              <Input
                id="sleep_time"
                type="time"
                value={profile.sleep_time}
                onChange={(e) => updateField("sleep_time", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meal times</CardTitle>
            <CardDescription>
              Roughly when you eat, so Buddy can plan around it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            {(["breakfast", "lunch", "dinner"] as const).map((meal) => (
              <div key={meal} className="space-y-1.5">
                <Label htmlFor={meal} className="capitalize">
                  {meal}
                </Label>
                <Input
                  id={meal}
                  type="time"
                  value={profile.meal_times[meal] ?? ""}
                  onChange={(e) => updateMealTime(meal, e.target.value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work hours</CardTitle>
            <CardDescription>When you're typically working.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="work_start">Start</Label>
              <Input
                id="work_start"
                type="time"
                value={profile.work_start}
                onChange={(e) => updateField("work_start", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="work_end">End</Label>
              <Input
                id="work_end"
                type="time"
                value={profile.work_end}
                onChange={(e) => updateField("work_end", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saveState === "saving"}>
            {saveState === "saving" ? "Saving…" : "Save"}
          </Button>
          {saveState === "saved" && (
            <span className="text-sm text-muted-foreground">Saved.</span>
          )}
          {saveState === "error" && (
            <span className="text-sm text-destructive">
              Couldn't save. Try again.
            </span>
          )}
        </div>
      </form>

      {!notifLoading && (
        <form onSubmit={handleNotifSubmit} className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Buddy won't send anything until you turn this on.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <label className="flex items-center gap-2 text-sm">
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
                Email me reminders for upcoming tasks
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
            >
              {notifSaveState === "saving" ? "Saving…" : "Save"}
            </Button>
            {notifSaveState === "saved" && (
              <span className="text-sm text-muted-foreground">Saved.</span>
            )}
            {notifSaveState === "error" && (
              <span className="text-sm text-destructive">
                Couldn't save. Try again.
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
