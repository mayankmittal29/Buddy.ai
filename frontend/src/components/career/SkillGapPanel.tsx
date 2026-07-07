import { useEffect, useRef, useState } from "react"
import { showSuccess, showError } from "@/lib/toast"
import { ExternalLink, FileSearch, Upload } from "lucide-react"
import { type Resume, listResumes, extractJdText } from "@/components/career/api"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { cardBase } from "@/lib/styles"
import { cn } from "@/lib/utils"

interface SkillGapPanelProps {
  /** Bump this (e.g. increment a counter) to force a refetch of the resume
   * list — after a new version is uploaded elsewhere on the page. */
  refreshToken?: number
  /** Fired with a composed message when "Analyze in Chat" is clicked — the
   * parent forwards this into the floating chat widget. */
  onAnalyze: (message: string) => void
}

export function SkillGapPanel({ refreshToken, onAnalyze }: SkillGapPanelProps) {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [resumeId, setResumeId] = useState<string>("")
  const [jdText, setJdText] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listResumes().then((result) => {
      setResumes(result)
      setResumeId((prev) => {
        if (prev && result.some((r) => String(r.id) === prev)) return prev
        const active = result.find((r) => r.is_active)
        return active ? String(active.id) : result[0] ? String(result[0].id) : ""
      })
    })
  }, [refreshToken])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    setError(null)
    try {
      const text = await extractJdText(file)
      setJdText(text)
      showSuccess("Job description analyzed.", { duration: 5000 })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't extract text from that file."
      setError(message)
      showError(message, { duration: 5000 })
    } finally {
      setExtracting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function handleAnalyze() {
    if (!resumeId || !jdText.trim()) return
    const resume = resumes.find((r) => String(r.id) === resumeId)
    const message =
      `Analyze my resume (version "${resume?.version_label ?? resumeId}", id ${resumeId}) ` +
      `against this job description:\n\n${jdText.trim()}`
    onAnalyze(message)
  }

  return (
    <div className={cn(cardBase, "flex flex-col gap-3")}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <FileSearch className="size-4 text-primary" />
        Skill Gap Analysis
      </h2>

      {resumes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Upload a resume above first.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Resume version</label>
            <Select value={resumeId} onValueChange={(value) => setResumeId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a resume version">
                  {(value: string | null) => {
                    const resume = resumes.find((r) => String(r.id) === value)
                    if (!resume) return "Choose a resume version"
                    return `${resume.version_label}${resume.is_active ? " (active)" : ""}`
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {resumes.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.version_label}
                    {r.is_active ? " (active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Job description
              </label>
              <Button
                type="button"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
                className="bg-gradient-to-r from-primary to-accent"
              >
                <Upload className="size-3" />
                {extracting ? "Extracting…" : "Upload PDF/image"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the job description here, or upload a PDF/image above…"
              rows={6}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={!resumeId || !jdText.trim()}
            className="w-full bg-gradient-to-r from-primary to-accent"
          >
            Analyze in Chat
          </Button>
        </>
      )}

      <div className="rounded-xl border border-border-subtle bg-canvas p-3">
        <p className="text-xs text-muted-foreground">
          This is a simple keyword-overlap check, not a real ATS score. For a more thorough
          read, cross-check with a dedicated tool:
        </p>
        <a
          href="https://www.jobscan.co/"
          target="_blank"
          rel="noreferrer"
          className="mt-1 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ExternalLink className="size-3" />
          Check on Jobscan (external ATS tool)
        </a>
      </div>
    </div>
  )
}
