import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { execSync } from 'node:child_process'

let version = 'dev'
try {
  const pkg = execSync('node -p "require(\'./package.json\').version"', { encoding: 'utf-8' }).trim()
  const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  version = `v${pkg}-${hash}`
} catch {
  version = 'dev'
}

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // No dev proxy: the app talks to the backend via an absolute URL resolved
  // by lib/apiConfig.ts's getApiUrl() (VITE_API_URL, Kong's gateway), not a
  // relative path Vite would need to forward. A `/api`/`/_` proxy to a local
  // PocketBase instance used to live here — dropped along with PocketBase.
  server: {
    port: 5173,
  },
  build: {
    // Explicit, not just relying on Vite's own default — a prod build must
    // never ship a source map that reverses the minified bundle back to
    // original source.
    sourcemap: false,
    // Vite 8 defaults to its 'oxc' minifier, which doesn't yet expose a
    // drop-console/debugger option through Vite's own config surface (only
    // rolldown's lower-level compress API does). Pinning back to 'esbuild'
    // keeps that surface (esbuild.drop below) working, at the cost of
    // opting out of the newer default minifier.
    minify: 'esbuild',
  },
  esbuild: {
    // Strip console/debugger from production output only — dev keeps them
    // for local debugging. Prevents accidental info-leak logging (auth
    // tokens, resident data, stack traces) from ever reaching a shipped
    // bundle.
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}))
