import { useEffect, useRef, useState } from 'react'
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
  Zap,
  ChevronDown,
  Menu,
  X,
  Network,
  Globe2,
  Target,
  Sparkles,
  Fingerprint,
  KeyRound,
  Image as ImageIcon,
  Search,
  Mail,
  HardDrive,
  ListChecks,
  Shield,
  Cloud,
  LayoutGrid,
  Workflow,
  EyeOff,
  Boxes,
  ClipboardCheck,
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
  { href: '#integrations', label: 'Integrations' },
  { href: '#faq', label: 'FAQ' },
]

const capabilities = [
  {
    label: 'Server-Enforced RBAC (RLS)',
    benefit: 'You get permissions checked by the database itself, not just hidden buttons — a viewer account can never sneak into an admin action, even by calling the API directly.',
  },
  {
    label: 'MFA · TOTP + WebAuthn',
    benefit: 'You can lock your account down with an authenticator app or a fingerprint/passkey, so a stolen password alone is never enough to get in.',
  },
  {
    label: 'Tamper-Evident Audit Trail',
    benefit: "You get a history that's cryptographically sealed — if anyone tries to quietly edit a past record, you'll know immediately.",
  },
  {
    label: 'Offline-First Sync',
    benefit: "You keep working through an internet outage — everything you enter is saved on your device and syncs automatically the moment you're back online.",
  },
  {
    label: 'Installable PWA',
    benefit: 'You can install CLUSTR straight to your desktop or phone like a native app — no app store, no hunting for a browser tab.',
  },
  {
    label: 'Dedicated Onboarding & Support',
    benefit: "You're never on your own — a support team sets up your barangay's workspace and is on hand whenever you need help.",
  },
]

const complianceStandards = [
  {
    icon: ShieldCheck,
    code: 'OWASP ASVS',
    name: 'Application Security Verification Standard',
    note: 'L2 controls mapped across authentication, session, and access-control code.',
  },
  {
    icon: ListChecks,
    code: 'CIS Controls',
    name: 'CIS Critical Security Controls v8',
    note: 'Safeguards mapped to our RBAC, logging, and data-protection implementation.',
  },
  {
    icon: Shield,
    code: 'NIST CSF',
    name: 'NIST Cybersecurity Framework',
    note: 'Identify–Protect–Detect–Respond–Recover functions mapped to platform controls.',
  },
  {
    icon: Cloud,
    code: 'CSA STAR',
    name: 'Cloud Security Alliance STAR',
    note: 'Cloud Controls Matrix self-assessed against our hosting and data-handling controls.',
  },
  {
    icon: LayoutGrid,
    code: 'Essential Eight',
    name: 'ACSC Essential Eight Maturity Model',
    note: 'Used as a mitigation-strategy reference for our own hardening baseline.',
  },
  {
    icon: Workflow,
    code: 'DICT SDLC',
    name: 'DICT Secure Software Development Lifecycle',
    note: 'Security gates mapped across our own build, review, and release pipeline.',
  },
  {
    icon: EyeOff,
    code: 'NIST Privacy',
    name: 'NIST Privacy Framework',
    note: 'Privacy controls mapped alongside our Data Privacy Act (RA 10173) safeguards.',
  },
  {
    icon: Boxes,
    code: 'OWASP Supply Chain',
    name: 'Dependency & Supply Chain Security',
    note: 'SBOM generation and license scanning mapped into every CI build, per OWASP guidance.',
  },
  {
    icon: ClipboardCheck,
    code: 'UK Cyber Essentials',
    name: 'NCSC Cyber Essentials Scheme',
    note: 'Boundary, access, and patching controls mapped against its five core themes.',
  },
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

const integrations = [
  {
    icon: KeyRound,
    title: 'Self-Hosted Supabase Stack',
    description:
      'GoTrue auth, PostgREST API, and a Kong gateway with rate-limiting in front of a Postgres database — the same production-grade building blocks Supabase Cloud runs, deployed entirely under your own control.',
  },
  {
    icon: Fingerprint,
    title: 'WebAuthn / Passkeys',
    description:
      'Hardware-backed, phishing-resistant passwordless login sits alongside TOTP — enrolled the same way as any modern passkey-enabled app.',
  },
  {
    icon: ImageIcon,
    title: 'Signed Cloudinary Uploads',
    description:
      'Asset photo uploads are signed server-side on request — no exposed upload presets, no unauthenticated write path into your media library.',
  },
  {
    icon: Search,
    title: 'Meilisearch Full-Text Search',
    description:
      'Fast, typo-tolerant search across residents, households, and case records once enabled for your deployment.',
  },
  {
    icon: Mail,
    title: 'SMTP Notifications',
    description:
      'Automated email alerts when a document request changes status or a hearing is scheduled.',
  },
  {
    icon: HardDrive,
    title: 'S3-Compatible Continuous Backup',
    description:
      'Continuous, near-real-time database replication to any S3-compatible object store, on top of periodic snapshots.',
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
    title: 'Built to Last',
    description: 'A commercially licensed, vendor-supported platform with continuous updates, maintenance, and a dedicated support team behind it.',
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
    q: 'How do you protect against brute-force login attempts?',
    a: 'The API gateway rate-limits authentication and write-heavy endpoints by source IP, and every account can enroll multi-factor authentication — TOTP or a WebAuthn passkey — for phishing-resistant sign-in.',
  },
  {
    q: 'Can our audit logs be silently altered?',
    a: 'No. Activity and finance audit-log entries are SHA-256 hash-chained per barangay, so editing any historical row breaks the chain. An admin-only verification check detects the break immediately — tampering is provable, not just logged.',
  },
  {
    q: 'How is our data backed up?',
    a: 'CLUSTR supports continuous, near-real-time backup replication to S3-compatible storage, so a lost or corrupted server costs seconds of data, not hours — plus periodic snapshot backups as a second line of defense.',
  },
  {
    q: 'How much does CLUSTR cost?',
    a: 'CLUSTR is offered as a licensed subscription platform, with pricing scoped to your barangay’s size and deployment needs. Contact us for a quote.',
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
    q: 'Can we run a dedicated, single-tenant deployment instead of a shared instance?',
    a: 'Yes — a dedicated deployment is available as part of an enterprise license, giving your LGU a fully isolated instance with control over hosting and data residency.',
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

function TermReveal({
  benefit,
  children,
  tone = 'light',
}: {
  benefit: string
  children: React.ReactNode
  tone?: 'light' | 'dark'
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  return (
    <div
      ref={rootRef}
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        className={`cursor-help rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          tone === 'dark' ? 'focus-visible:ring-mint focus-visible:ring-offset-ink' : 'focus-visible:ring-mint-deep focus-visible:ring-offset-background'
        }`}
      >
        {children}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            role="tooltip"
            className="absolute left-1/2 top-full z-30 mt-2 w-60 max-w-[calc(100vw-2.5rem)] -translate-x-1/2 rounded-xl border border-border bg-card px-4 py-3 text-left font-display text-xs leading-relaxed text-foreground shadow-xl"
          >
            {benefit}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ComplianceBadge({
  item,
  className = '',
}: {
  item: (typeof complianceStandards)[number]
  className?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -6, rotateX: 6, rotateY: -6, scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      style={{ transformPerspective: 900 }}
      className={`relative flex w-72 shrink-0 items-start gap-4 overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-card/90 p-5 shadow-md ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-mint/15 blur-2xl"
      />
      <div className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint to-mint-deep text-ink shadow-elevated">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/50 via-white/10 to-transparent opacity-80"
        />
        <item.icon className="relative size-5" strokeWidth={2.25} />
      </div>
      <div className="relative">
        <div className="flex items-center gap-2">
          <p className="font-display text-sm font-semibold text-foreground">{item.code}</p>
          <span className="rounded-full border border-mint-deep/30 bg-mint/10 px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wide text-mint-deep dark:text-mint">
            Mapped
          </span>
        </div>
        <p className="mt-1 font-display text-xs text-muted-foreground">{item.name}</p>
        <p className="mt-1.5 font-display text-xs leading-relaxed text-muted-foreground/80">{item.note}</p>
      </div>
    </motion.div>
  )
}

function ComplianceCarousel({ items }: { items: typeof complianceStandards }) {
  const track = [...items, ...items]

  return (
    <div className="mt-10">
      <ul className="sr-only">
        {items.map((item) => (
          <li key={item.code}>
            {item.code} — {item.name}: {item.note}
          </li>
        ))}
      </ul>
      <div
        aria-hidden="true"
        className="group relative overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:[mask-image:none]"
      >
        <div
          className="flex w-max gap-5 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center"
          style={{ animationDuration: '48s' }}
        >
          {track.map((item, i) => (
            <ComplianceBadge key={i} item={item} className={i >= items.length ? 'motion-reduce:hidden' : ''} />
          ))}
        </div>
      </div>
    </div>
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
                  key={c.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.05 }}
                >
                  <TermReveal benefit={c.benefit} tone="dark">
                    <div className="flex items-center gap-2 font-display text-sm text-white/70">
                      <CheckCircle2 className="size-4 shrink-0 text-mint" />
                      <span>{c.label}</span>
                    </div>
                  </TermReveal>
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
              { icon: ShieldCheck, label: 'Server-Enforced RBAC', benefit: "You can trust that every permission check happens on the server, every time — never just hidden in the interface." },
              { icon: Fingerprint, label: 'MFA · TOTP + WebAuthn', benefit: 'You add a second proof it\'s really you — an authenticator code or a fingerprint/passkey — before anyone can sign in.' },
              { icon: KeyRound, label: 'Rate-Limited API Gateway (Kong)', benefit: "You're protected from automated password-guessing — rapid-fire login attempts get slowed down or blocked automatically." },
              { icon: Lock, label: 'SHA-256 Tamper-Evident Audit Logs', benefit: 'You get proof, not just promises — if any historical log entry is altered, the system detects it instantly.' },
              { icon: Building2, label: 'Multi-Tenant Isolation, Test-Verified', benefit: "You never see another barangay's data, and they never see yours — enforced at the database level and checked by automated tests on every release." },
              { icon: WifiOff, label: 'Offline-First Architecture', benefit: "You keep working through spotty internet — records save locally and catch up automatically once you're connected again." },
            ].map((badge, i) => (
              <Reveal key={badge.label} delay={i * 0.05}>
                <TermReveal benefit={badge.benefit}>
                  <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-display text-xs font-medium text-foreground shadow-sm">
                    <badge.icon className="size-3.5 text-mint" />
                    {badge.label}
                  </div>
                </TermReveal>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2}>
            <p className="mx-auto mt-8 max-w-2xl text-center font-display text-sm text-muted-foreground">
              Built for the Philippines' <span className="font-semibold text-foreground">42,000+ barangays</span> —
              a single platform designed to scale from one barangay office to hundreds, with every
              claim above enforced in code, not just promised in marketing.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Benchmarked compliance & standards mapping ── */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-mint-deep">
              Benchmarked Compliance and Standards Mapping
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Measured Against the Frameworks That Matter
            </h2>
            <p className="mt-4 font-display text-base text-muted-foreground">
              From application security and cloud assurance to privacy, secure development, and
              supply-chain integrity, CLUSTR's controls are mapped, documented, and kept current
              against nine recognized frameworks — self-assessed and published in the open, for
              anyone to verify.
            </p>
          </Reveal>

          <ComplianceCarousel items={complianceStandards} />

          <Reveal delay={0.15}>
            <p className="mx-auto mt-6 max-w-2xl text-center font-display text-sm text-muted-foreground">
              Framework alignment is self-assessed and documented in our{' '}
              <a
                href={`${REPO_URL}/blob/main/docs/COMPLIANCE_MAPPING.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-mint-deep underline decoration-transparent transition-colors hover:decoration-current dark:text-mint"
              >
                public Compliance Mapping
              </a>{' '}
              — transparent by design, open for anyone to review line by line.
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
                  'Admin, Staff, and Viewer roles enforced at the database layer via row-level security — not just hidden UI',
                  'Multi-factor authentication: TOTP and WebAuthn/passkeys on every account',
                  'Content Security Policy, PKCE session flow, and refresh-token rotation',
                  'API gateway rate-limiting on login and write-heavy endpoints to blunt automated abuse',
                  'SHA-256 hash-chained audit logs for records, finance, and system activity — tamper-evident, with an admin-only chain-verification check',
                  'Fail-secure error handling — internal failures never leak system details to a client',
                  'Sensitive-field masking: redacted-by-default in logs and exports, with an audited admin-only opt-in',
                  'Multi-tenant data isolation, verified by an automated test suite',
                  'Continuous, near-real-time database backups to secure S3-compatible storage',
                  'Published Privacy Notice, Terms of Use, and Data Processing Agreement',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 font-display text-sm text-foreground">
                    <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-mint-deep dark:text-mint" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href={`${REPO_URL}/blob/main/docs/COMPLIANCE_MAPPING.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-mint-deep underline decoration-transparent transition-colors hover:decoration-current dark:text-mint"
              >
                See the full compliance mapping
                <ArrowRight className="size-3.5" />
              </a>
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
                  {['React 19', 'TypeScript', 'Supabase', 'Kong', 'Docker'].map((tag) => (
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

      {/* ── Integrations ── */}
      <section id="integrations" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.15em] text-mint-deep">
            Under the Hood
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Real Integrations, Not Vaporware
          </h2>
          <p className="mt-4 font-display text-base text-muted-foreground">
            Every integration below ships in the codebase today and is running in production —
            not a roadmap promise.
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map(({ icon: Icon, title, description }, i) => (
            <Reveal key={title} delay={(i % 3) * 0.08}>
              <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="inline-flex size-11 items-center justify-center rounded-xl bg-mint/10 text-mint-deep dark:bg-mint/15 dark:text-mint">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-2 font-display text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </Reveal>
          ))}
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
