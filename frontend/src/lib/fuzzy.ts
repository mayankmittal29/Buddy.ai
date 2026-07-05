/** Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  )
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[a.length][b.length]
}

/**
 * Score how well `query` matches `text`, case-insensitive and tolerant of
 * typos/misspellings — 1 is a perfect/substring match, 0 is unrelated.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase()
  const t = text.trim().toLowerCase()
  if (!q) return 1
  if (!t) return 0
  if (t.includes(q)) return 1

  // Best per-word similarity, for typo-tolerant single-word queries
  // (e.g. "gorcery" close to "grocery").
  const words = t.split(/\s+/)
  let best = 0
  for (const w of words) {
    const dist = levenshtein(q, w)
    const similarity = 1 - dist / Math.max(q.length, w.length)
    if (similarity > best) best = similarity
  }

  // Also compare against the whole string, for multi-word queries.
  const distWhole = levenshtein(q, t)
  const simWhole = 1 - distWhole / Math.max(q.length, t.length)

  return Math.max(best, simWhole)
}

/** Whether `text` is a good-enough fuzzy match for `query`. */
export function fuzzyMatch(query: string, text: string, threshold = 0.6): boolean {
  return fuzzyScore(query, text) >= threshold
}
