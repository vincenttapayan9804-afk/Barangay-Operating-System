import { useEffect, useState } from 'react'
import { Building2, Plus, ShieldCheck, ShieldOff, KeyRound } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/lib/toast'
import {
  listBarangays,
  createBarangay,
  createBarangayAdmin,
  setBarangayActive,
  setBarangayRequireStaffMfa,
  type Barangay,
} from '@/api/platformAdmin'
import { ApiError } from '@/api/errorHandler'

export default function PlatformAdmin() {
  const [barangays, setBarangays] = useState<Barangay[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '',
    municipality_city: '',
    province: '',
    region: '',
    adminEmail: '',
    adminPassword: '',
    adminName: '',
  })

  async function refresh() {
    setLoading(true)
    try {
      setBarangays(await listBarangays())
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load barangays')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  function updateField(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.adminEmail || !form.adminPassword) {
      toast.error('Barangay name, admin email, and admin password are required.')
      return
    }
    if (form.adminPassword.length < 8) {
      toast.error('Admin password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    try {
      const barangay = await createBarangay({
        name: form.name,
        municipality_city: form.municipality_city || undefined,
        province: form.province || undefined,
        region: form.region || undefined,
      })
      try {
        await createBarangayAdmin({
          barangay_id: barangay.id,
          email: form.adminEmail,
          password: form.adminPassword,
          name: form.adminName || undefined,
        })
      } catch (adminErr) {
        // The tenant now exists but has no admin yet — surface this clearly
        // rather than leaving the operator guessing why login doesn't work.
        toast.error(
          `Barangay "${form.name}" was created, but its admin account failed: ` +
            `${adminErr instanceof ApiError ? adminErr.message : 'unknown error'}. ` +
            'Retry creating the admin account from this page, or contact an operator to create it directly.',
        )
        await refresh()
        return
      }
      toast.success(`Barangay "${form.name}" and its admin account were created.`)
      setForm({
        name: '',
        municipality_city: '',
        province: '',
        region: '',
        adminEmail: '',
        adminPassword: '',
        adminName: '',
      })
      await refresh()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create barangay')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(b: Barangay) {
    try {
      await setBarangayActive(b.id, !b.active)
      toast.success(`${b.name} is now ${!b.active ? 'active' : 'suspended'}.`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update barangay')
    }
  }

  async function toggleStaffMfa(b: Barangay) {
    try {
      await setBarangayRequireStaffMfa(b.id, !b.require_staff_mfa)
      toast.success(`Staff MFA is now ${!b.require_staff_mfa ? 'required' : 'optional'} for ${b.name}.`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update barangay')
    }
  }

  return (
    <div className="font-display space-y-5">
      <PageHeader
        title="Platform Administration"
        subtitle="Onboard new barangay tenants and their first admin account. Visible only to platform operators — barangay data itself stays out of scope here."
      />

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Plus className="size-4" /> Onboard a new barangay
        </h2>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Barangay name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Barangay San Isidro"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="municipality_city">Municipality / City</Label>
            <Input
              id="municipality_city"
              value={form.municipality_city}
              onChange={(e) => updateField('municipality_city', e.target.value)}
              placeholder="Quezon City"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="province">Province</Label>
            <Input
              id="province"
              value={form.province}
              onChange={(e) => updateField('province', e.target.value)}
              placeholder="Metro Manila"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              value={form.region}
              onChange={(e) => updateField('region', e.target.value)}
              placeholder="NCR"
            />
          </div>

          <div className="md:col-span-2 mt-2 border-t border-border pt-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">First admin account for this barangay</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adminEmail">Admin email *</Label>
            <Input
              id="adminEmail"
              type="email"
              value={form.adminEmail}
              onChange={(e) => updateField('adminEmail', e.target.value)}
              placeholder="admin@sanisidro.gov.ph"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adminName">Admin name</Label>
            <Input
              id="adminName"
              value={form.adminName}
              onChange={(e) => updateField('adminName', e.target.value)}
              placeholder="Juan Dela Cruz"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="adminPassword">Temporary admin password *</Label>
            <Input
              id="adminPassword"
              type="text"
              value={form.adminPassword}
              onChange={(e) => updateField('adminPassword', e.target.value)}
              placeholder="At least 8 characters — share this with the barangay admin securely"
              required
            />
          </div>

          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner size="sm" /> : 'Create barangay + admin'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Building2 className="size-4" /> Existing barangays ({barangays.length})
        </h2>
        {loading ? (
          <Spinner label="Loading barangays…" />
        ) : (
          <div className="divide-y divide-border">
            {barangays.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{b.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[b.municipality_city, b.province, b.region].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleStaffMfa(b)}
                    title="Require staff accounts in this barangay to complete email-OTP MFA at login"
                  >
                    <KeyRound className={`mr-1.5 size-3.5 ${b.require_staff_mfa ? 'text-teal' : 'text-muted-foreground'}`} />
                    Staff MFA {b.require_staff_mfa ? 'Required' : 'Optional'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(b)}
                  >
                    {b.active ? (
                      <>
                        <ShieldCheck className="mr-1.5 size-3.5 text-teal" /> Active
                      </>
                    ) : (
                      <>
                        <ShieldOff className="mr-1.5 size-3.5 text-muted-foreground" /> Suspended
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
            {barangays.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">No barangays yet.</p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
