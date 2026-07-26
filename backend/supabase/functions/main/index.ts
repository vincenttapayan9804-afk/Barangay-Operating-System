// Router for the self-hosted `edge-runtime` container (Phase 6 infra
// rebuild). Self-hosted edge-runtime has no platform-side routing table the
// way managed Supabase does — a single "main service" process receives
// every /functions/v1/<name> request and is responsible for dispatching it
// to the right function directory itself. This is the standard main-service
// shape documented for self-hosted Supabase; none of the five functions
// under ../ (create-barangay-admin, notify-document-status,
// notify-hearing-scheduled, search-index, search-query) needed any change
// to work with it — each already assumes it's reached at
// /functions/v1/<its-own-directory-name>, which is exactly what strips out
// below.
//
// FUNCTIONS_VERIFY_JWT (docker-compose.yml) is left at its default "true":
// every one of the five functions here calls requireUser(req) itself (see
// ../_shared/auth.ts), so requiring *some* valid JWT (anon key at minimum)
// before a request even reaches the worker is a second, cheaper layer, not
// a redundant one — it rejects garbage/missing-apikey requests before
// spinning up a Deno worker for them at all.
const JWT_SECRET = Deno.env.get('JWT_SECRET') ?? ''
const VERIFY_JWT = (Deno.env.get('FUNCTIONS_VERIFY_JWT') ?? 'true') === 'true'

async function verifyJwt(token: string): Promise<boolean> {
  const parts = token.split('.')
  if (parts.length !== 3) return false
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    return await crypto.subtle.verify('HMAC', key, sig, data)
  } catch {
    return false
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  // Answered directly by this router, with no JWT check and no worker
  // spun up — docker-compose.yml's healthcheck for this service hits it.
  if (url.pathname === '/_health') {
    return new Response('ok', { status: 200 })
  }

  if (VERIFY_JWT) {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token || !(await verifyJwt(token))) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // Kong strips the /functions/v1 prefix (see ../../kong.yml's
  // functions-v1 route, strip_path: true) before forwarding here, so the
  // first path segment is the function's own directory name.
  const functionName = url.pathname.split('/').filter(Boolean)[0]
  if (!functionName) {
    return new Response(JSON.stringify({ error: 'No function name in request path' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const servicePath = `/home/deno/functions/${functionName}`
  try {
    // @ts-expect-error — EdgeRuntime is a global injected by the
    // supabase/edge-runtime image itself, not a Deno/std API; it does not
    // exist in this repo's own tsc/lint toolchain, which never type-checks
    // Deno edge-function sources (see ../_shared's own files, same reason).
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb: 150,
      workerTimeoutMs: 5 * 60 * 1000,
      noModuleCache: false,
      importMapPath: null,
      envVars: Object.entries(Deno.env.toObject()),
    })
    return await worker.fetch(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: `Function '${functionName}' failed to load: ${message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
