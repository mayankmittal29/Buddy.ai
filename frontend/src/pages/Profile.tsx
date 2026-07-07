import { useEffect, useRef, useState } from "react"
import { User, Moon, UtensilsCrossed, Briefcase, Camera, Loader2, IdCard } from "lucide-react"
import { showSuccess, showError } from "@/lib/toast"
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
import { Skeleton } from "@/components/ui/skeleton"
import { cardBase, pageShell, sectionGap } from "@/lib/styles"
import { cn } from "@/lib/utils"
import { calculateAge, formatDob } from "@/lib/date"
import { useAuthStore } from "@/stores/authStore"

const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
}

const API_URL = import.meta.env.VITE_API_URL

interface ProfileData {
  name: string
  avatar_url: string
  timezone: string
  wake_time: string
  sleep_time: string
  meal_times: Record<string, string>
  work_start: string
  work_end: string
}

const DEFAULT_PROFILE: ProfileData = {
  name: "",
  avatar_url: "",
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

/** Small colored icon badge used before each section's title, matching the
 * skill-card / stat-card visual language used across the app. */
function SectionIcon({
  icon: Icon,
  className,
}: {
  icon: typeof User
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl",
        className
      )}
    >
      <Icon className="size-4.5" />
    </div>
  )
}

export default function Profile() {
  const authUser = useAuthStore((s) => s.user)

  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>("idle")

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarUploading(true)
    setAvatarError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`${API_URL}/api/profile/avatar`, {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.detail ?? `Upload failed (${res.status}).`)
      }
      const data: ProfileData = await res.json()
      setProfile((prev) => ({ ...prev, avatar_url: data.avatar_url }))
      showSuccess("Profile photo updated.", { duration: 5000 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed."
      setAvatarError(message)
      showError(message, { duration: 5000 })
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
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
      showSuccess("Profile saved.", { duration: 5000 })
    } catch {
      setSaveState("error")
      showError("Couldn't save your profile.", { duration: 5000 })
    }
  }

  if (loading) {
    return (
      <div className={cn(pageShell, "mx-auto max-w-5xl")}>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Profile</h1>
          <p className="mt-2 text-muted-foreground">
            Tell Buddy a bit about your daily rhythm so it can plan around it.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
          <div className={cardBase}>
            <Skeleton className="mx-auto size-24 rounded-full" />
          </div>
          <div className={cn(sectionGap, "grid grid-cols-1 gap-4 sm:grid-cols-2")}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cardBase}>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-2 h-3 w-56" />
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(pageShell, "mx-auto max-w-5xl")}>
      <div className="mb-6">
        <h1 className="font-script text-4xl font-bold text-primary">Profile</h1>
        <p className="mt-2 text-muted-foreground">
          Tell Buddy a bit about your daily rhythm so it can plan around it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr] lg:items-start">
        <div className={cn(cardBase, "flex flex-col items-center text-center lg:sticky lg:top-6")}>
          <div className="relative">
            <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="size-full object-cover"
                />
              ) : (
                <User className="size-10 text-white" />
              )}
              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Loader2 className="size-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change profile photo"
              className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full bg-primary text-white shadow-card transition-all duration-200 hover:bg-primary-hover"
            >
              <Camera className="size-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <p className="mt-3 font-medium text-foreground">
            {profile.name || "Your name"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click the camera icon to change your photo.
          </p>
          {avatarError && (
            <p className="mt-2 text-xs text-destructive">{avatarError}</p>
          )}
        </div>

        <div className={sectionGap}>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card className={cardBase}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <SectionIcon
                      icon={User}
                      className="bg-primary-50 text-primary"
                    />
                    <div>
                      <CardTitle>Basics</CardTitle>
                      <CardDescription>Your name and timezone.</CardDescription>
                    </div>
                  </div>
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

              {authUser && (
                <Card className={cn(cardBase, "sm:col-span-2")}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <SectionIcon
                        icon={IdCard}
                        className="bg-violet-100 text-violet-600"
                      />
                      <div>
                        <CardTitle>About you</CardTitle>
                        <CardDescription>From your account, set at signup.</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Occupation</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">
                        {authUser.occupation || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Current CTC</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">
                        {authUser.current_ctc != null
                          ? new Intl.NumberFormat("en-IN").format(authUser.current_ctc)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Gender</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">
                        {GENDER_LABELS[authUser.gender] ?? authUser.gender}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Date of birth</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">
                        {formatDob(authUser.dob)}{" "}
                        <span className="text-muted-foreground">
                          ({calculateAge(authUser.dob)} yrs)
                        </span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className={cardBase}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <SectionIcon
                      icon={Moon}
                      className="bg-blue-100 text-blue-600"
                    />
                    <div>
                      <CardTitle>Sleep</CardTitle>
                      <CardDescription>
                        When your day starts and ends.
                      </CardDescription>
                    </div>
                  </div>
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

              <Card className={cn(cardBase, "sm:col-span-2")}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <SectionIcon
                      icon={UtensilsCrossed}
                      className="bg-amber-100 text-amber-600"
                    />
                    <div>
                      <CardTitle>Meal times</CardTitle>
                      <CardDescription>
                        Roughly when you eat, so Buddy can plan around it.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4 sm:max-w-md">
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

              <Card className={cn(cardBase, "sm:col-span-2")}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <SectionIcon
                      icon={Briefcase}
                      className="bg-teal-100 text-teal-600"
                    />
                    <div>
                      <CardTitle>Work hours</CardTitle>
                      <CardDescription>
                        When you're typically working.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 sm:max-w-xs">
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
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button
                type="submit"
                disabled={saveState === "saving"}
                className="bg-gradient-to-r from-primary to-accent shadow-card hover:opacity-90"
              >
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
        </div>
      </div>
    </div>
  )
}
