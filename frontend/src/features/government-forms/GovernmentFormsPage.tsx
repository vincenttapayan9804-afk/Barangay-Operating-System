import { useEffect, useState } from 'react'
import { Landmark, Receipt, Calculator, HardHat, ShieldCheck, Clock } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Tabs } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/auth/session'
import {
  getGovernmentForms,
  verifyGovernmentFormChain,
  type ApiGovernmentForm,
  type GovFormAgency,
} from '@/api/governmentForms'

interface PlannedForm {
  name: string
  purpose: string
}

const AGENCY_META: Record<GovFormAgency, { label: string; icon: typeof Landmark; phase: string }> = {
  coa: { label: 'COA / GAM', icon: Landmark, phase: 'Phase 1' },
  bir: { label: 'BIR', icon: Receipt, phase: 'Phase 2' },
  dbm: { label: 'DBM', icon: Calculator, phase: 'Phase 3' },
  dole: { label: 'DOLE / TUPAD', icon: HardHat, phase: 'Phase 4' },
}

// Planned form catalog, shown as "Coming Soon" until each agency's phase
// lands. Names/purposes here are the working titles from the feature
// request — several remain pending primary-source verification against the
// actual COA/BIR/DBM/DOLE issuances before their generators are built (see
// each phase's own PR description for the sourcing status).
const PLANNED_FORMS: Record<GovFormAgency, PlannedForm[]> = {
  coa: [
    { name: 'Report of Collections and Deposits (RCD)', purpose: 'Daily collections and bank deposits by the Barangay Treasurer' },
    { name: 'Report of Accountability for Accountable Forms (RAAF)', purpose: 'Issuance and remaining balances of official receipts, checks, and cash tickets' },
    { name: 'Disbursement Voucher (DV) & Petty Cash Voucher', purpose: 'Mandatory forms required before public funds can be released' },
    { name: 'FDP Form 3 — Statement of Receipts and Expenditures', purpose: 'Full Disclosure Policy compliance' },
    { name: 'Acknowledgement Receipt for Donated Property (ARDPESM)', purpose: 'Tracking donated relief goods or equipment' },
    { name: 'Property & Inventory Forms', purpose: 'Requisition & Issue Slip, Inventory Custodian Slip, Stock Card, Purchase Request, Purchase Order, Acceptance & Inspection Report' },
    { name: 'Mandatory Financial Statements', purpose: 'Financial Performance, Financial Position, Cash Flows, Comparison of Budget and Actual Amounts' },
  ],
  bir: [
    { name: 'BIR Form 2307', purpose: 'Certificate of Creditable Tax Withheld at Source (suppliers/contractors)' },
    { name: 'BIR Form 2316', purpose: 'Certificate of Compensation Payment/Tax Withheld (employees)' },
    { name: 'BIR Form 2550Q', purpose: 'Quarterly Value-Added Tax Return' },
    { name: 'BIR Forms 1604-C, 1604-E, 1604-F', purpose: 'Annual Information Returns of taxes withheld' },
    { name: 'Summary Lists of Sales and Purchases (SLSP)', purpose: 'VAT compliance monitoring' },
  ],
  dbm: [
    { name: 'Barangay Budget Forms 1, 2A, 4', purpose: 'Core budget preparation and expenditure tracking' },
    { name: 'Barangay Budget Form 3', purpose: 'Plantilla of Personnel / SK Officials — honorarium rates and adjustments' },
    { name: 'Annex C', purpose: 'Report on Fund Utilization and Status of Program/Project Implementation' },
    { name: 'Annex D', purpose: 'Project Profile/Proposal' },
  ],
  dole: [
    { name: 'Annex B — TUPAD Work Program', purpose: 'Community work to be executed' },
    { name: 'Annex C — Project Proposal', purpose: 'Longer-duration TUPAD projects' },
    { name: 'Annex D — Profile of TUPAD Beneficiaries', purpose: 'Demographics, valid IDs, proof of indigency/displacement' },
    { name: 'Annex E-2 — Contract of Service', purpose: 'Agreement between the Co-Partner (LGU) and TUPAD workers' },
    { name: 'Annex F — Letter of Intent', purpose: 'Submitted prior to project commencement' },
    { name: 'Certification of Fit to Work', purpose: 'Senior citizens, pregnant workers, and PWDs' },
    { name: 'Daily Time Record & Completion Report', purpose: 'Wage payout and the mandatory 60-day liquidation' },
  ],
}

export function GovernmentFormsPage() {
  const currentUser = getCurrentUser()
  const [activeAgency, setActiveAgency] = useState<GovFormAgency>('coa')
  const [forms, setForms] = useState<ApiGovernmentForm[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<string | null>(null)

  async function load(agency: GovFormAgency) {
    setLoading(true)
    try { setForms(await getGovernmentForms(agency)) } catch { setForms([]) }
    setLoading(false)
  }

  useEffect(() => { load(activeAgency) }, [activeAgency])

  async function handleVerifyChain() {
    if (!currentUser) return
    setVerifying(true)
    setVerifyResult(null)
    try {
      const results = await verifyGovernmentFormChain(currentUser.barangay_id)
      const broken = results.filter((r) => !r.valid)
      setVerifyResult(
        results.length === 0
          ? 'No generated forms to verify yet.'
          : broken.length === 0
            ? `Chain intact — all ${results.length} generated form(s) verified.`
            : `${broken.length} of ${results.length} form(s) failed verification.`,
      )
    } catch {
      setVerifyResult('Verification failed to run.')
    }
    setVerifying(false)
  }

  const columns: Column<ApiGovernmentForm>[] = [
    { key: 'title', label: 'Title', sortable: true, filterType: 'text' },
    { key: 'form_code', label: 'Form Code', filterType: 'text', hideBelow: 'sm' },
    { key: 'period_covered', label: 'Period', filterType: 'text', render: (f) => f.period_covered || '—' },
    {
      key: 'status', label: 'Status', filterType: 'select',
      filterOptions: [{ label: 'Final', value: 'final' }, { label: 'Void', value: 'void' }],
      render: (f) => (
        <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${f.status === 'final' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
          {f.status}
        </span>
      ),
    },
    { key: 'created', label: 'Generated', sortable: true, hideBelow: 'sm', render: (f) => new Date(f.created).toLocaleString() },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-lg font-semibold">Standard Government Forms</h1>
          <p className="text-sm text-muted-foreground">Auto-generated official forms for COA, BIR, DBM, and DOLE compliance.</p>
        </div>
        {currentUser?.role === 'admin' && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleVerifyChain} disabled={verifying}>
            <ShieldCheck className="size-3.5" />
            {verifying ? 'Verifying…' : 'Verify Chain Integrity'}
          </Button>
        )}
      </div>
      {verifyResult && <p className="text-xs text-muted-foreground">{verifyResult}</p>}

      <Tabs
        tabs={(Object.keys(AGENCY_META) as GovFormAgency[]).map((a) => {
          const Icon = AGENCY_META[a].icon
          return { id: a, label: AGENCY_META[a].label, icon: <Icon className="size-3.5" /> }
        })}
        activeId={activeAgency}
        onChange={(id) => setActiveAgency(id as GovFormAgency)}
      />

      <div className="rounded-md border bg-card p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-3">
          <Clock className="size-3.5" />
          {AGENCY_META[activeAgency].label} — planned forms ({AGENCY_META[activeAgency].phase})
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {PLANNED_FORMS[activeAgency].map((f) => (
            <div key={f.name} className="rounded-md border border-dashed p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{f.name}</p>
                <span className="shrink-0 inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Coming Soon
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{f.purpose}</p>
            </div>
          ))}
        </div>
      </div>

      <DataTable
        title="GENERATED FORMS"
        columns={columns}
        data={forms}
        loading={loading}
        rowKey={(f) => f.id}
        emptyState={<p className="text-center text-muted-foreground py-6">No {AGENCY_META[activeAgency].label} forms generated yet.</p>}
        toolbar
        exportable
      />
    </div>
  )
}

export default GovernmentFormsPage
