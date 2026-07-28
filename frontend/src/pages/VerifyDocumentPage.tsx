import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { CheckCircle2, XCircle, FileText, User, Hash, Building2, ShieldCheck, ShieldAlert } from 'lucide-react'
import { getDocumentForVerification, type PublicDocumentVerification } from '@/api/documents'
import { ClustrMark } from '@/components/ClustrLogo'
import { Spinner } from '@/components/ui/spinner'

const DOCUMENT_TITLES: Record<string, string> = {
  barangay_clearance: 'Barangay Clearance',
  business_permit: 'Barangay Business Permit Clearance',
  certificate_of_indigency: 'Certificate of Indigency',
  certificate_of_residency: 'Certificate of Residency',
  certificate_of_good_moral: 'Certificate of Good Moral Character',
  cedula: 'Community Tax Certificate (Cedula)',
  other: 'Barangay Certification',
}

function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function VerifyDocumentPage() {
  const { id } = useParams<{ id: string }>()
  const [doc, setDoc] = useState<PublicDocumentVerification | null | undefined>(undefined)

  useEffect(() => {
    if (!id) {
      setDoc(null)
      return
    }
    getDocumentForVerification(id).then(setDoc)
  }, [id])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-secondary via-background to-background p-4 font-display">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <ClustrMark className="size-8" />
          <span className="text-lg font-bold tracking-tight text-foreground">CLUSTR</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          {doc === undefined ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Spinner size="lg" />
              <p className="text-sm text-muted-foreground">Checking document…</p>
            </div>
          ) : doc === null ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="size-14 text-destructive" />
              <h1 className="text-lg font-semibold text-foreground">Document Not Verified</h1>
              <p className="text-sm text-muted-foreground">
                This document ID could not be verified. It may not exist, may not yet be released, or the link may be
                incorrect.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-2 text-center">
                <CheckCircle2 className="size-14 text-teal" />
                <h1 className="text-lg font-semibold text-foreground">Valid Document</h1>
                <p className="text-xs text-muted-foreground">
                  This document was issued through CLUSTR and its details match our records.
                </p>
              </div>

              <div className="space-y-3 rounded-xl bg-muted/40 p-4 text-sm">
                <div className="flex items-start gap-2.5">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Document Type</p>
                    <p className="font-medium text-foreground">
                      {DOCUMENT_TITLES[doc.document_type] || doc.document_type}
                      {doc.other_document_type ? ` — ${doc.other_document_type}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Issued To</p>
                    <p className="font-medium text-foreground">{doc.resident_name}</p>
                  </div>
                </div>
                {doc.barangay_name && (
                  <div className="flex items-start gap-2.5">
                    <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Issued By</p>
                      <p className="font-medium text-foreground">Barangay {doc.barangay_name}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <Hash className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Queue # / Released</p>
                    <p className="font-medium text-foreground">
                      {doc.queue_number}
                      {doc.released_at ? ` — ${formatDate(doc.released_at)}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {doc.chain_verified === true && (
                <div className="flex items-center gap-2 rounded-lg border border-teal/30 bg-teal/10 px-3 py-2 text-xs font-medium text-teal">
                  <ShieldCheck className="size-4 shrink-0" />
                  Tamper-evident — chain verified
                </div>
              )}
              {doc.chain_verified === false && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                  <ShieldAlert className="size-4 shrink-0" />
                  Tamper check failed — this record no longer matches its recorded release hash
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
          Verification lookups are public by design — only documents already released are shown, and only to someone
          holding the exact link printed on the certificate.
        </p>
      </div>
    </div>
  )
}
