/** Age in whole years as of today, given a "YYYY-MM-DD" date of birth —
 * accounts for whether this year's birthday has happened yet. Uses UTC
 * getters throughout (a date-only ISO string parses as UTC midnight) so
 * the result doesn't shift by a day depending on the browser's timezone. */
export function calculateAge(dob: string): number {
  const birthDate = new Date(dob)
  const today = new Date()

  let age = today.getUTCFullYear() - birthDate.getUTCFullYear()
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1
  }
  return age
}

/** "YYYY-MM-DD" -> "14 May 1998" for display. */
export function formatDob(dob: string): string {
  return new Date(dob).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}
