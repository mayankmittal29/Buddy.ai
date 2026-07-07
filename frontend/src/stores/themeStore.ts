import { create } from "zustand"

export const THEMES = [
  { id: "light", label: "Light", swatch: ["#F5F6FA", "#4F46E5", "#8B5CF6"] },
  { id: "dark", label: "Dark", swatch: ["#151515", "#e5e5e5", "#8b8b8b"] },
  { id: "dracula", label: "Dracula", swatch: ["#282a36", "#bd93f9", "#ff79c6"] },
  { id: "synthwave", label: "Synthwave", swatch: ["#262335", "#e779c1", "#58c7f3"] },
  { id: "forest", label: "Forest", swatch: ["#1b211d", "#2bb35f", "#5cc490"] },
  { id: "corporate", label: "Corporate", swatch: ["#f4f6f9", "#4b6bfb", "#0ea5b7"] },
  { id: "luxury", label: "Luxury", swatch: ["#0b0b0d", "#cfa15e", "#b48b46"] },
  { id: "cupcake", label: "Cupcake", swatch: ["#faf7f5", "#65c3c8", "#eeaf3a"] },
] as const

export type ThemeId = (typeof THEMES)[number]["id"]

const STORAGE_KEY = "buddy-theme"

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute("data-theme", theme)
}

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "light"
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return (THEMES.find((t) => t.id === stored)?.id ?? "light") as ThemeId
}

const initialTheme = readStoredTheme()
if (typeof document !== "undefined") applyTheme(initialTheme)

interface ThemeState {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  setTheme(theme) {
    window.localStorage.setItem(STORAGE_KEY, theme)
    applyTheme(theme)
    set({ theme })
  },
}))
