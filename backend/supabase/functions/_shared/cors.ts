// Standard Supabase Edge Function CORS preflight headers. Reflecting a
// fixed wildcard (not the request origin) is fine here — same rationale as
// the WebAuthn sidecar's permissive CORS: every route below is
// Bearer-token-only (no cookies), so there's no CSRF surface to protect
// against by restricting the origin.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
