import { corsHeaders } from './cors.ts'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Fail-secure: only an HttpError's message is ever considered safe to show
// a client — those are thrown deliberately by app code with a client-facing
// string in mind (e.g. "Missing required fields."). Any other thrown value
// (a fetch failure, a Postgres/Meilisearch error, an unexpected exception)
// gets a fixed generic message instead — its real content often embeds
// internal hostnames, table/column names, or stack details — while the
// full error still reaches the server-side log via console.error.
export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    console.error(err)
    return json({ error: err.message }, err.status)
  }
  console.error(err)
  return json({ error: 'Internal server error.' }, 500)
}
