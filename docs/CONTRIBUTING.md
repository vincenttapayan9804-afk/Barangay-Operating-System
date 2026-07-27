# Contributing to BarangayOS

First off, thank you for considering contributing! This project helps Philippine Barangay LGUs manage their records digitally, and every contribution makes a difference.

## Code of Conduct

This project and everyone participating in it is governed by the [BarangayOS Code of Conduct](../CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before reporting a bug, please check our [existing issues](https://github.com/YOUR_USER/barangayos/issues) to see if it's already been reported.

If not, [create a new bug report](https://github.com/YOUR_USER/barangayos/issues/new?template=bug_report.md) with:

- A clear, descriptive title
- Steps to reproduce the bug
- Expected vs actual behavior
- Screenshots (if applicable)
- Browser, OS, and deployment environment details

### Suggesting Features

We welcome feature suggestions! [Open a feature request](https://github.com/YOUR_USER/barangayos/issues/new?template=feature_request.md) and describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered
- Why this would benefit barangay LGUs

### Code Contributions

#### Getting Started

1. Fork the repository
2. Clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/barangayos.git
cd barangayos
```

3. Set up the development environment — see [DEVELOPMENT.md](DEVELOPMENT.md)
4. Create a branch:

```bash
git checkout -b feat/your-feature-name
```

Use a descriptive prefix for your branch name:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat/` | New feature | `feat/resident-export` |
| `fix/` | Bug fix | `fix/offline-queue-dedupe` |
| `docs/` | Documentation | `docs/api-endpoints` |
| `refactor/` | Code restructuring | `refactor/state-management` |
| `test/` | Test additions | `test/blotter-workflow` |
| `chore/` | Tooling / CI | `chore/update-dockerfile` |

#### Development Workflow

1. Make your changes following our [coding standards](DEVELOPMENT.md#coding-standards)
2. Write or update tests as needed
3. Run the verification pipeline:

```bash
cd frontend
npm run lint          # No lint errors
npx tsc -b            # No type errors
npm run test          # All tests pass
npm run build         # Build succeeds
```

4. Commit your changes using [conventional commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat: add resident data export to Excel"
```

5. Push and create a Pull Request:

```bash
git push origin feat/your-feature-name
```

#### Commit Message Convention

We use [conventional commits](https://www.conventionalcommits.org/) for clear, machine-readable history:

| Prefix | Usage | Example |
|--------|-------|---------|
| `feat:` | A new feature | `feat: add offline queue retry` |
| `fix:` | A bug fix | `fix: handle empty resident list` |
| `chore:` | Build process, tooling, dependencies | `chore: update vite to v8.1` |
| `docs:` | Documentation changes | `docs: add deployment troubleshooting` |
| `refactor:` | Code restructuring (no functional change) | `refactor: extract table pagination hook` |
| `test:` | Adding or updating tests | `test: add blotter workflow e2e` |
| `style:` | Formatting, semicolons (not CSS/Tailwind) | `style: sort imports alphabetically` |

#### Pull Request Guidelines

1. **Keep PRs focused** — Each PR should address a single concern. If you have multiple unrelated changes, create separate PRs.

2. **Reference related issues** — Link to the issue your PR addresses: `Closes #123`

3. **Describe your changes** — Include a clear description of what you changed and why. Use the [PR template](../.github/PULL_REQUEST_TEMPLATE.md).

4. **Ensure CI passes** — All lint, typecheck, test, and build checks must pass. CI runs automatically on every PR.

5. **Review feedback** — Be responsive to reviewer comments. We aim to review PRs within a few days.

6. **Update documentation** — If your change affects how the system is used or deployed, update the relevant docs.

## Project Structure Overview

```
frontend/
  src/api/          API client modules (real backend via @supabase/supabase-js, demo-mode branch via mockPocketBase.ts)
  src/auth/         Authentication and authorization
  src/components/   Shared UI components
  src/features/     Feature-specific modules (one per domain)
  src/lib/          Utilities and helpers
  src/offline/      Offline queue and sync
  src/pages/        Page-level components
  src/routes/       Route definitions
backend/
  supabase/         Postgres, GoTrue, PostgREST, Realtime, Edge Functions, Kong
    migrations/     SQL schema + Row-Level Security policies
    functions/      Edge Functions (Deno)
    docker-compose.yml Production stack configuration
docs/               Documentation
scripts/            Deploy and utility scripts
```

## Development Tips

- **Frontend only**: You don't need the real backend running at all to work on UI — demo mode (click "Try instantly" on the login page) runs entirely in the browser and covers most feature work.
- **Migrations**: Postgres applies every `*.sql` file in `backend/supabase/migrations/` in filename order on first boot (`docker-entrypoint-initdb.d`). Prefix with a zero-padded sequence number for ordering: `0030_your_change.sql`. Every table uses Row-Level Security, not application-level rule strings — see `backend/supabase/migrations/0000_auth_helpers.sql` for the JWT-claim helpers every policy is built from.
- **Database reset**: `docker compose down -v` from `backend/supabase/` (removes the `db_data` volume) and `docker compose up -d db` to re-run every migration from scratch.

## Need Help?

- Check existing [Issues](https://github.com/YOUR_USER/barangayos/issues) and [Discussions](https://github.com/YOUR_USER/barangayos/discussions)
- Review the [Architecture Guide](ARCHITECTURE.md) for system design context
- Read the [Development Guide](DEVELOPMENT.md) for setup and coding conventions

---

Thank you for helping make barangay governance more efficient!
