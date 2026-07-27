interface SafeParseFailure {
  success: false
  error: { issues: { message: string; path: PropertyKey[] }[] }
}
type SafeParseLike = { success: true } | SafeParseFailure

/** First issue's message from a failed safeParse — for the single-line `setError(string)` UI pattern most forms already use. */
export function firstZodError(result: SafeParseLike): string | null {
  if (result.success) return null
  return result.error.issues[0]?.message ?? 'Invalid input'
}

/** Every issue keyed by its top-level field name — for the `fieldErrors` record UI pattern (first error per field wins). */
export function zodFieldErrors(result: SafeParseLike): Record<string, string> {
  if (result.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0])
    if (!errors[key]) errors[key] = issue.message
  }
  return errors
}
