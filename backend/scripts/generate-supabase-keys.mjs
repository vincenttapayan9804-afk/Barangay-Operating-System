#!/usr/bin/env node
// Generates the ANON_KEY / SERVICE_ROLE_KEY JWTs that backend/supabase/'s
// docker-compose.yml, kong.yml, GoTrue, and PostgREST all need to agree on
// the same JWT_SECRET (self-hosted Supabase has no separate key-management
// service — these two long-lived JWTs *are* the API keys). No dependencies
// beyond Node's built-in crypto, so this runs the same way in this sandbox
// (no network, no npm install) as on a real deploy host.
//
// Usage:
//   JWT_SECRET=... node scripts/generate-supabase-keys.mjs
// or, reading straight from backend/supabase/.env:
//   node scripts/generate-supabase-keys.mjs backend/supabase/.env

import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerPart = base64url(JSON.stringify(header))
  const payloadPart = base64url(JSON.stringify(payload))
  const signature = createHmac('sha256', secret).update(`${headerPart}.${payloadPart}`).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${headerPart}.${payloadPart}.${signature}`
}

function loadJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  const envFile = process.argv[2]
  if (envFile) {
    const line = readFileSync(envFile, 'utf8').split('\n').find((l) => l.startsWith('JWT_SECRET='))
    if (line) return line.slice('JWT_SECRET='.length).trim()
  }
  return null
}

const JWT_SECRET = loadJwtSecret()
if (!JWT_SECRET || JWT_SECRET === 'change-me-at-least-32-chars') {
  console.error('Set JWT_SECRET (env var, or pass a .env file path with JWT_SECRET= set) to a real secret first.')
  console.error('  openssl rand -base64 48')
  process.exit(1)
}

const iat = Math.floor(Date.now() / 1000)
const exp = iat + 10 * 365 * 24 * 60 * 60 // 10 years — matches Supabase's own default key lifetime

const anonKey = signJwt({ role: 'anon', iss: 'supabase', iat, exp }, JWT_SECRET)
const serviceRoleKey = signJwt({ role: 'service_role', iss: 'supabase', iat, exp }, JWT_SECRET)

console.log(`ANON_KEY=${anonKey}`)
console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}`)
