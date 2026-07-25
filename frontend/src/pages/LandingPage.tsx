import { Link } from 'react-router'
import {
  ArrowRight,
  ShieldCheck,
  WifiOff,
  Smartphone,
  BarChart3,
  Users,
  FileText,
  ScrollText,
  Landmark,
  Calendar,
  DoorOpen,
  Lock,
  Building2,
  CheckCircle2,
  Code2,
  Zap,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'

const capabilities = [
  'Role-Based Access Control',
  'Offline-First Sync',
  'Full Audit Trail',
  'Installable PWA',
  'Automated Backups',
  'Open Source · MIT',
]

const features = [
  {
    icon: Users,
    title: 'Resident & Household Records',
    description:
      'Maintain a single, always-current source of truth for every resident and household — no more duplicate spreadsheets or lost paper folders.',
  },
  {
    icon: FileText,
    title: 'Document Requests & Release',
    description:
      'Move barangay clearances, certificates, and permits from request to release through a tracked workflow residents and staff can both trust.',
  },
  {
    icon: ScrollText,
    title: 'Blotter & Incident Records',
    description:
      'Document complaints, hearings, and settlements in one structured case file instead of scattered logbooks and loose paperwork.',
  },
  {
    icon: Landmark,
    title: 'Finance & Budget Management',
    description:
      'Track appropriations, revenues, and disbursements against statutory fund rules, with a dedicated audit trail for every transaction.',
  },
  {
    icon: Calendar,
    title: 'Assets, Calendar & Agenda',
    description:
      'Coordinate council sessions, agenda items, and barangay assets from one shared operational calendar — nothing falls through the cracks.',
  },
  {
    icon: DoorOpen,
    title: 'Visitor & Activity Logs',
    description:
      'Know who is on-site and exactly what changed in your records, with timestamped logs that keep every office action accountable.',
  },
  {
    icon: ShieldCheck,
    title: 'Server-Enforced Permissions',
    description:
      'Give secretaries, captains, and viewers exactly the access they need — enforced on the server, not just hidden behind the interface.',
  },
  {
    icon: WifiOff,
    title: 'Offline-First Reliability',
    description:
      'Keep working through outages. Entries queue locally and sync automatically the moment connectivity returns — no lost data, no downtime.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description:
      'Turn raw records into decision-ready charts and statistics your council can use for planning, reporting, and budget review.',
  },
]

const pillars = [
  {
    icon: Zap,
    title: 'Operational Efficiency',
    description:
      'Replace manual searching, redundant data entry, and paper-based approvals with structured digital workflows built for daily barangay operations.',
  },
  {
    icon: Lock,
    title: 'Privacy & Compliance',
    description:
      'Designed with the Data Privacy Act (RA 10173) in mind — role-based access, audit logging, and a published privacy notice and data processing agreement.',
  },
  {
    icon: WifiOff,
    title: 'Built for Real Connectivity',
    description:
      'Intermittent internet is the norm in many barangays. BarangayOS queues changes offline and syncs automatically — no workflow interruption.',
  },
  {
    icon: Building2,
    title: 'Free, Open, and Extensible',
    description:
      'No license fees, no vendor lock-in. BarangayOS is open-source under MIT, so your IT staff or LGU partners can adapt it to local needs.',
  },
]

function Logo({ className }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icon-logo.png`}
      alt="BarangayOS"
      className={className ?? 'size-8 object-contain'}
    />
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <Logo className="size-8 object-contain" />
            <span className="font-display text-base font-semibold tracking-tight">BarangayOS</span>
          </div>
          <nav className="hidden items-center gap-8 font-display text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#platform" className="transition-colors hover:text-foreground">Platform</a>
            <a href="#security" className="transition-colors hover:text-foreground">Security</a>
            <a
              href="https://github.com/rodneydelacruz/barangayos"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Code2 className="size-4" />
              GitHub
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-barangay to-[#0D1F2D] px-5 py-2.5 font-display text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md"
            >
              Sign In
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-barangay via-[#152F3D] to-[#0D1F2D]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: 'radial-gradient(ellipse at 20% 0%, color-mix(in srgb, var(--gold) 25%, transparent) 0%, transparent 60%)' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{ background: 'radial-gradient(ellipse at 90% 100%, color-mix(in srgb, var(--teal) 30%, transparent) 0%, transparent 55%)' }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.15em] text-gold">
              Built for Philippine LGUs
            </div>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Enterprise-Grade Governance,
              <br className="hidden sm:block" />
              Built for Every Barangay
            </h1>
            <p className="mx-auto mt-6 max-w-2xl font-display text-base leading-relaxed text-white/70 sm:text-lg">
              BarangayOS replaces paper records, spreadsheets, and disconnected tools with a single,
              secure system for resident records, finance, documents, and operations —
              engineered to keep working even when the internet doesn't.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-gold to-[#B8923E] px-7 py-3.5 font-display text-sm font-semibold text-[#1A1513] shadow-lg transition-all duration-200 hover:shadow-xl sm:w-auto"
              >
                Sign In to Your Barangay
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-3.5 font-display text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10 sm:w-auto"
              >
                Explore Features
              </a>
            </div>
          </div>

          {/* Capability strip */}
          <div className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {capabilities.map((c) => (
              <div key={c} className="flex items-center gap-2 font-display text-sm text-white/70">
                <CheckCircle2 className="size-4 shrink-0 text-teal" />
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom accent line — same motif as the login screen */}
        <div className="flex h-[3px]" aria-hidden="true">
          <div className="h-full w-[34%] bg-red-pinoy/70" />
          <div className="h-full w-[32%] bg-gold/70" />
          <div className="h-full w-[34%] bg-teal/70" />
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section id="features" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-teal">
            Everything Your Office Needs
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            One Platform, Every Barangay Function
          </h2>
          <p className="mt-4 font-display text-base text-muted-foreground">
            From resident records to financial reporting, BarangayOS consolidates the tools your
            office relies on into a single, connected system.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="inline-flex size-11 items-center justify-center rounded-xl bg-barangay/10 text-barangay dark:bg-barangay/20">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-2 font-display text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why BarangayOS / pillars ── */}
      <section id="platform" className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-teal">
              Why Barangays Choose BarangayOS
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Designed Around How Barangays Actually Work
            </h2>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {pillars.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex gap-5 rounded-2xl border border-border bg-card p-7 shadow-sm"
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-barangay to-[#0D1F2D] text-white">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 font-display text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security / compliance ── */}
      <section id="security" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-teal">
              Security & Governance
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Built for Public Trust
            </h2>
            <p className="mt-5 font-display text-base leading-relaxed text-muted-foreground">
              Resident data deserves the same rigor as any government system. BarangayOS enforces
              access control at the server, logs every material action, and ships with the
              documentation your office needs to operate responsibly under Philippine data
              privacy law.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                'Admin, Staff, and Viewer roles with server-enforced permissions',
                'Dedicated audit trail for records, finance, and system activity',
                'Published Privacy Notice, Terms of Use, and Data Processing Agreement',
                'Automatic database backups to secure, S3-compatible storage',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 font-display text-sm text-foreground">
                  <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-teal" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-gradient-to-br from-barangay via-[#152F3D] to-[#0D1F2D] p-8 shadow-lg sm:p-10">
            <div className="flex items-center gap-3">
              <Smartphone className="size-6 text-gold" />
              <span className="font-display text-sm font-semibold uppercase tracking-[0.15em] text-white/70">
                Installable PWA
              </span>
            </div>
            <p className="mt-4 font-display text-lg font-semibold leading-snug text-white">
              Install it once. Your office runs on it every day.
            </p>
            <p className="mt-3 font-display text-sm leading-relaxed text-white/70">
              BarangayOS installs directly to desktops and staff phones like a native app —
              no app store, no separate download. It keeps working offline and stays in sync
              automatically once you're back online.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['React 19', 'TypeScript', 'PocketBase', 'Docker'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-display text-xs font-medium text-white/80"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-barangay via-[#152F3D] to-[#0D1F2D] px-8 py-16 text-center shadow-xl sm:px-16">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--gold) 30%, transparent) 0%, transparent 65%)' }}
            aria-hidden="true"
          />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to Modernize Your Barangay?
            </h2>
            <p className="mx-auto mt-4 max-w-xl font-display text-base text-white/70">
              Sign in with your barangay's credentials to access records, finance, and operations
              in one place.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold to-[#B8923E] px-8 py-3.5 font-display text-sm font-semibold text-[#1A1513] shadow-lg transition-all duration-200 hover:shadow-xl"
              >
                Sign In
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <Logo className="size-7 object-contain" />
              <span className="font-display text-sm font-semibold text-foreground">BarangayOS</span>
              <span className="font-display text-sm text-muted-foreground">
                &middot; Made for every Barangay in the Philippines
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-display text-xs text-muted-foreground">
              <a
                href="https://github.com/rodneydelacruz/barangayos/blob/main/docs/PRIVACY_NOTICE.md"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-transparent transition-colors hover:text-foreground hover:decoration-current"
              >
                Privacy Notice
              </a>
              <a
                href="https://github.com/rodneydelacruz/barangayos/blob/main/docs/TERMS_OF_USE.md"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-transparent transition-colors hover:text-foreground hover:decoration-current"
              >
                Terms of Use
              </a>
              <a
                href="https://github.com/rodneydelacruz/barangayos/blob/main/docs/DATA_PROCESSING_AGREEMENT.md"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-transparent transition-colors hover:text-foreground hover:decoration-current"
              >
                DPA
              </a>
              <a
                href="https://github.com/rodneydelacruz/barangayos"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 underline decoration-transparent transition-colors hover:text-foreground hover:decoration-current"
              >
                <Code2 className="size-3.5" />
                Source
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
