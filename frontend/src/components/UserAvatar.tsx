import { useEffect, useState } from "react"
import { User } from "lucide-react"
import { cn } from "@/lib/utils"

const API_URL = import.meta.env.VITE_API_URL

interface UserAvatarProps {
  className?: string
}

/** Circular avatar — shows the uploaded profile picture, or a fallback icon
 * if none has been set yet. Used in the nav bar and in chat message rows. */
export default function UserAvatar({ className }: UserAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`${API_URL}/api/profile`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAvatarUrl(data.avatar_url || null)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-card",
        className
      )}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        <User className="size-5" />
      )}
    </div>
  )
}
