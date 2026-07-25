import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { motion, AnimatePresence, useMotionValue, useTransform, useScroll } from 'framer-motion'
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
  ChevronDown,
  Menu,
  X,
  Network,
  Globe2,
  Target,
  Sparkles,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ClustrMark } from '@/components/ClustrLogo'

const REPO = 'vincenttapayan9804-afk/Barangay-Operating-System'
const REPO_URL = `https://github.com/${REPO}`

const navLinks = [
  { href: '#about', label: 'About' },
  { href: '#features', label: 'Features' },
  { href: '#platform', label: 'Platform' },
  { href: '#security', label: 'Security' },
  { href: '#faq', label: 'FAQ' },
]

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
      'Intermittent internet is the norm in many barangays. CLUSTR queues changes offline and syncs automatically — no workflow interruption.',
  },
  {
    icon: Building2,
    title: 'Multi-Tenant by Design',
    description:
      'One platform, many barangays — each with data the others can never see, enforced at the database layer and covered by automated isolation tests.',
  },
]

const aboutValues = [
  {
    icon: Target,
    title: 'Purpose-Built',
    description: 'Every module maps to a real barangay office workflow, not a generic template.',
  },
  {
    icon: Network,
    title: 'One Platform, Many Barangays',
    description: 'A single, multi-tenant system that scales from one barangay to hundreds without changing how it works.',
  },
  {
    icon: Globe2,
    title: 'Built for the Philippines',
    description: 'Offline-first, low-bandwidth tolerant, and aligned with the Data Privacy Act from the ground up.',
  },
  {
    icon: Sparkles,
    title: 'Open by Default',
    description: 'MIT-licensed and open source — inspect the code, self-host it, or extend it for your LGU’s needs.',
  },
]

const faqs = [
  {
    q: 'What exactly is CLUSTR?',
    a: 'CLUSTR is an enterprise-grade barangay operating system — a single platform for resident records, document requests, blotter cases, finance, and day-to-day office operations, built specifically for how Philippine barangays actually work.',
  },
  {
    q: 'Can CLUSTR serve more than one barangay?',
    a: 'Yes — CLUSTR is multi-tenant by design. Many barangays run on one shared platform, each with its own isolated data. A barangay’s residents, finances, and records are never visible to another barangay, enforced at the database layer and covered by an automated isolation test suite, not just hidden in the interface.',
  },
  {
    q: 'Does CLUSTR work without reliable internet?',
    a: 'Yes. CLUSTR is offline-first — staff can keep creating and editing records during an outage, and everything queues locally and syncs automatically the moment connectivity returns. No lost work, no waiting for a signal.',
  },
  {
    q: 'Is our barangay’s data compliant with the Data Privacy Act (RA 10173)?',
    a: 'CLUSTR’s architecture is designed with RA 10173 in mind: server-enforced role-based access, a dedicated audit trail for sensitive actions, and a published Privacy Notice, Terms of Use, and Data Processing Agreement. Your barangay’s designated Data Protection Officer remains responsible for compliance in practice.',
  },
  {
    q: 'What roles and permissions are available?',
    a: 'Admin, Staff, and Viewer roles, each with permissions enforced on the server — not just hidden UI elements. A viewer account can never perform an admin-only action, even by calling the API directly.',
  },
  {
    q: 'How is our data backed up?',
    a: 'CLUSTR supports continuous, near-real-time backup replication to S3-compatible storage, so a lost or corrupted server costs seconds of data, not hours — plus periodic snapshot backups as a second line of defense.',
  },
  {
    q: 'How much does CLUSTR cost?',
    a: 'CLUSTR itself is free and open source under the MIT license — no license fees, no vendor lock-in. Your only real cost is hosting, and CLUSTR is built to run comfortably on free-tier cloud infrastructure.',
  },
  {
    q: 'Can staff install CLUSTR like a regular app?',
    a: 'Yes — CLUSTR is an installable Progressive Web App. It installs directly to desktops and phones like a native app, with no app store required, and keeps working offline once installed.',
  },
  {
    q: 'We’re not technical — can we still adopt CLUSTR?',
    a: 'Onboarding a new barangay is a short, guided setup — your platform administrator creates your barangay’s workspace and first admin account, and your team signs in and starts working immediately. No infrastructure knowledge required to use it day-to-day.',
  },
  {
    q: 'Can we self-host CLUSTR instead of using a shared instance?',
    a: 'Yes. Because CLUSTR is open source, your LGU’s IT staff or a technology partner can deploy and run their own instance independently, with full control over hosting and data residency.',
  },
]

function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="group relative py-1 transition-colors hover:text-foreground"
    >
      {label}
      <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-mint transition-transform duration-300 ease-out group-hover:scale-x-100" />
    </a>
  )
}

function AnimatedNav() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <ClustrMark className="size-8" />
          <span className="font-display text-lg font-bold tracking-tight">CLUSTR</span>
        </div>

        <nav className="hidden items-center gap-8 font-display text-sm font-medium text-muted-foreground md:flex">
          {navLinks.map((l) => (
            <NavLink key={l.href} href={l.href} label={l.label} />
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            to="/login"
            className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-mint to-mint-deep px-5 py-2.5 font-display text-sm font-semibold text-ink shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-mint/20 sm:inline-flex"
          >
            Sign In
            <ArrowRight className="size-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="inline-flex size-9 items-center justify-center rounded-md text-foreground md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-border/60 md:hidden"
          >
            <nav className="flex flex-col gap-1 px-5 py-4 font-display text-sm font-medium text-muted-foreground">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-2 py-2.5 transition-colors hover:bg-mint/10 hover:text-foreground"
                >
                  {l.label}
                </a>
              ))}
              <Link
                to="/login"
                className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-mint to-mint-deep px-5 py-2.5 font-display text-sm font-semibold text-ink shadow-sm"
              >
                Sign In
                <ArrowRight className="size-3.5" />
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

function TiltVisual() {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useTransform(y, [-0.5, 0.5], [10, -10])
  const rotateY = useTransform(x, [-0.5, 0.5], [-10, 10])

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    x.set((e.clientX - rect.left) / rect.width - 0.5)
    y.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  function handleMouseLeave() {
    x.set(0)
    y.set(0)
  }

  const nodes = [
    { cx: 100, cy: 60, r: 9, delay: 0 },
    { cx: 190, cy: 90, r: 12, delay: 0.4 },
    { cx: 70, cy: 170, r: 11, delay: 0.8 },
    { cx: 170, cy: 200, r: 8, delay: 1.2 },
    { cx: 230, cy: 170, r: 7, delay: 1.6 },
  ]
  const links: [number, number][] = [
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
    [2, 3],
    [3, 4],
    [1, 4],
  ]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 1200 }}
      className="relative mx-auto w-full max-w-md"
    >
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative aspect-square w-full rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-60"
          style={{ background: 'radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--mint) 35%, transparent) 0%, transparent 55%)' }}
          aria-hidden="true"
        />
        <svg viewBox="0 0 300 260" className="absolute inset-0 h-full w-full p-8" style={{ transform: 'translateZ(40px)' }}>
          {links.map(([a, b], i) => (
            <motion.line
              key={i}
              x1={nodes[a].cx}
              y1={nodes[a].cy}
              x2={nodes[b].cx}
              y2={nodes[b].cy}
              stroke="var(--mint)"
              strokeOpacity="0.35"
              strokeWidth="1.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, delay: 0.3 + i * 0.08, ease: 'easeOut' }}
            />
          ))}
          {nodes.map((n, i) => (
            <motion.circle
              key={i}
              cx={n.cx}
              cy={n.cy}
              r={n.r}
              fill="var(--mint)"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, cy: [n.cy, n.cy - 6, n.cy] }}
              transition={{
                scale: { duration: 0.4, delay: n.delay },
                opacity: { duration: 0.4, delay: n.delay },
                cy: { duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: n.delay },
              }}
              style={{ transformOrigin: `${n.cx}px ${n.cy}px` }}
            />
          ))}
        </svg>
        <div className="absolute bottom-6 left-6 right-6 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-md" style={{ transform: 'translateZ(60px)' }}>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-mint">Live Isolation</p>
          <p className="mt-1 font-display text-sm text-white">Every barangay, its own verified boundary.</p>
        </div>
      </motion.div>

      {/* Floating ambient orbs for depth */}
      <motion.div
        aria-hidden="true"
        animate={{ y: [0, -16, 0], x: [0, 8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-mint/30 blur-2xl"
      />
      <motion.div
        aria-hidden="true"
        animate={{ y: [0, 14, 0], x: [0, -10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="pointer-events-none absolute -bottom-8 -left-8 size-24 rounded-full bg-mint-deep/25 blur-2xl"
      />
    </motion.div>
  )
}

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function FaqItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={isOpen}
      >
        <span className="font-display text-base font-semibold text-foreground">{q}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="shrink-0 text-mint"
        >
          <ChevronDown className="size-5" />
        </motion.span>
      </button>
      <div
        className="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <p className="pb-5 font-display text-sm leading-relaxed text-muted-foreground">{a}</p>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroTextY = useTransform(scrollYProgress, [0, 1], [0, -60])
  const heroVisualY = useTransform(scrollYProgress, [0, 1], [0, 40])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AnimatedNav />

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative overflow-hidden bg-gradient-to-br from-ink via-[#0A1F17] to-ink">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{ background: 'radial-gradient(ellipse at 15% 0%, color-mix(in srgb, var(--mint) 30%, transparent) 0%, transparent 60%)' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{ background: 'radial-gradient(ellipse at 90% 100%, color-mix(in srgb, var(--mint-deep) 35%, transparent) 0%, transparent 55%)' }}
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-2">
          <motion.div style={{ y: heroTextY }}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-mint/25 bg-mint/10 px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.15em] text-mint"
            >
              Enterprise-Grade · Multi-Tenant · Built for LGUs
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-6 font-display text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]"
            >
              One Operating System,
              <br />
              Every Barangay <span className="text-mint">Connected</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-6 max-w-xl font-display text-base leading-relaxed text-white/65 sm:text-lg"
            >
              CLUSTR replaces paper records, spreadsheets, and disconnected tools with a single,
              secure, multi-tenant platform for resident records, finance, documents, and
              operations — engineered to keep working even when the internet doesn't.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-10 flex flex-col items-start gap-3 sm:flex-row"
            >
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-mint to-mint-deep px-7 py-3.5 font-display text-sm font-semibold text-ink shadow-lg shadow-mint/20 transition-all duration-200 hover:shadow-xl hover:shadow-mint/30 sm:w-auto"
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
            </motion.div>

            <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {capabilities.map((c, i) => (
                <motion.div
                  key={c}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.05 }}
                  className="flex items-center gap-2 font-display text-sm text-white/70"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-mint" />
                  <span>{c}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div style={{ y: heroVisualY }}>
            <TiltVisual />
          </motion.div>
        </div>

        <div className="flex h-[3px]" aria-hidden="true">
          <div className="h-full w-1/3 bg-mint/70" />
          <div className="h-full w-1/3 bg-mint-deep/70" />
          <div className="h-full w-1/3 bg-mint/40" />
        </div>
      </section>

      {/* ── Trust badges / social proof ── */}
      <section className="border-b border-border bg-paper">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <Reveal>
            <p className="text-center font-display text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Verifiable, Not Just Promised
            </p>
          </Reveal>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {[
              { icon: ShieldCheck, label: 'Server-Enforced RBAC' },
              { icon: Lock, label: 'Data Privacy Act–Aligned' },
              { icon: Building2, label: 'Multi-Tenant Isolation, Test-Verified' },
              { icon: WifiOff, label: 'Offline-First Architecture' },
              { icon: Code2, label: 'Open Source · MIT' },
            ].map((badge, i) => (
              <Reveal key={badge.label} delay={i * 0.05}>
                <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-display text-xs font-medium text-foreground shadow-sm">
                  <badge.icon className="size-3.5 text-mint" />
                  {badge.label}
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">
                <img
                  src={`https://img.shields.io/github/license/${REPO}?color=00D9A3&label=License`}
                  alt="License"
                  className="h-5"
                />
              </a>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <img
                  src={`https://img.shields.io/github/stars/${REPO}?color=00D9A3&label=Stars&style=flat`}
                  alt="GitHub stars"
                  className="h-5"
                />
              </a>
              <a href={`${REPO_URL}/commits/main`} target="_blank" rel="noopener noreferrer">
                <img
                  src={`https://img.shields.io/github/last-commit/${REPO}?color=00D9A3&label=Last%20Commit`}
                  alt="Last commit"
                  className="h-5"
                />
              </a>
              <a href={`${REPO_URL}/network/members`} target="_blank" rel="noopener noreferrer">
                <img
                  src={`https://img.shields.io/github/forks/${REPO}?color=00D9A3&label=Forks`}
                  alt="Forks"
                  className="h-5"
                />
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mx-auto mt-8 max-w-2xl text-center font-display text-sm text-muted-foreground">
              Built for the Philippines' <span className="font-semibold text-foreground">42,000+ barangays</span> —
              a single platform designed to scale from one barangay office to hundreds, with every
              claim above enforced in code and verifiable in the public repository.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── About ── */}
      <section id="about" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-mint-deep">
              About CLUSTR
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              A Cluster of Barangays, Running as One System
            </h2>
            <p className="mt-5 font-display text-base leading-relaxed text-muted-foreground">
              CLUSTR started as a straightforward question: why should every barangay office run on
              a different stack of spreadsheets, paper logs, and disconnected tools? CLUSTR is a
              single, multi-tenant operating system that any number of barangays can run on —
              each with its own fully isolated workspace — instead of standing up separate,
              redundant systems one office at a time.
            </p>
            <p className="mt-4 font-display text-base leading-relaxed text-muted-foreground">
              It's built specifically for the operating conditions of Philippine LGUs: intermittent
              connectivity, real government PII that deserves real safeguards, and staff who need a
              tool that works the way their office already does — not the other way around.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {aboutValues.map(({ icon: Icon, title, description }, i) => (
              <Reveal key={title} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="inline-flex size-11 items-center justify-center rounded-xl bg-mint/10 text-mint-deep dark:bg-mint/15 dark:text-mint">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-display text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 font-display text-xs leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section id="features" className="border-y border-border bg-paper">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-mint-deep">
              Everything Your Office Needs
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              One Platform, Every Barangay Function
            </h2>
            <p className="mt-4 font-display text-base text-muted-foreground">
              From resident records to financial reporting, CLUSTR consolidates the tools your
              office relies on into a single, connected system.
            </p>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }, i) => (
              <Reveal key={title} delay={(i % 3) * 0.08}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="group h-full rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow duration-200 hover:shadow-lg hover:shadow-mint/5"
                >
                  <div className="inline-flex size-11 items-center justify-center rounded-xl bg-mint/10 text-mint-deep transition-colors duration-200 group-hover:bg-mint group-hover:text-ink dark:bg-mint/15 dark:text-mint">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 font-display text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why CLUSTR / pillars ── */}
      <section id="platform" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-mint-deep">
            Why Barangays Choose CLUSTR
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Designed Around How Barangays Actually Work
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {pillars.map(({ icon: Icon, title, description }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <div className="flex h-full gap-5 rounded-2xl border border-border bg-card p-7 shadow-sm">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-mint to-mint-deep text-ink">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 font-display text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Security / compliance ── */}
      <section id="security" className="border-y border-border bg-paper">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <p className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-mint-deep">
                Security & Governance
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Built for Public Trust
              </h2>
              <p className="mt-5 font-display text-base leading-relaxed text-muted-foreground">
                Resident data deserves the same rigor as any government system. CLUSTR enforces
                access control at the server, logs every material action, and ships with the
                documentation your office needs to operate responsibly under Philippine data
                privacy law.
              </p>
              <ul className="mt-8 space-y-4">
                {[
                  'Admin, Staff, and Viewer roles with server-enforced permissions',
                  'Multi-tenant data isolation, verified by an automated test suite',
                  'Dedicated audit trail for records, finance, and system activity',
                  'Published Privacy Notice, Terms of Use, and Data Processing Agreement',
                  'Continuous, near-real-time database backups to secure storage',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 font-display text-sm text-foreground">
                    <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-mint-deep dark:text-mint" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-ink via-[#0A1F17] to-ink p-8 shadow-lg sm:p-10">
                <div className="flex items-center gap-3">
                  <Smartphone className="size-6 text-mint" />
                  <span className="font-display text-sm font-semibold uppercase tracking-[0.15em] text-white/70">
                    Installable PWA
                  </span>
                </div>
                <p className="mt-4 font-display text-lg font-semibold leading-snug text-white">
                  Install it once. Your office runs on it every day.
                </p>
                <p className="mt-3 font-display text-sm leading-relaxed text-white/70">
                  CLUSTR installs directly to desktops and staff phones like a native app —
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
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="mx-auto max-w-4xl px-5 py-24 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-mint-deep">
            Questions, Answered
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Frequently Asked Questions
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          <div>
            {faqs.map((f, i) => (
              <FaqItem
                key={f.q}
                q={f.q}
                a={f.a}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink via-[#0A1F17] to-ink px-8 py-16 text-center shadow-xl sm:px-16">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--mint) 35%, transparent) 0%, transparent 65%)' }}
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
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-mint to-mint-deep px-8 py-3.5 font-display text-sm font-semibold text-ink shadow-lg shadow-mint/20 transition-all duration-200 hover:shadow-xl hover:shadow-mint/30"
                >
                  Sign In
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <ClustrMark className="size-7" />
              <span className="font-display text-sm font-semibold text-foreground">CLUSTR</span>
              <span className="font-display text-sm text-muted-foreground">
                &middot; Made for every Barangay in the Philippines
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-display text-xs text-muted-foreground">
              <a
                href={`${REPO_URL}/blob/main/docs/PRIVACY_NOTICE.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-transparent transition-colors hover:text-foreground hover:decoration-current"
              >
                Privacy Notice
              </a>
              <a
                href={`${REPO_URL}/blob/main/docs/TERMS_OF_USE.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-transparent transition-colors hover:text-foreground hover:decoration-current"
              >
                Terms of Use
              </a>
              <a
                href={`${REPO_URL}/blob/main/docs/DATA_PROCESSING_AGREEMENT.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-transparent transition-colors hover:text-foreground hover:decoration-current"
              >
                DPA
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
