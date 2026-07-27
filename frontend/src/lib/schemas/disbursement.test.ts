import { describe, it, expect } from 'vitest'
import { disbursementSchema } from './disbursement'

function validDisbursement() {
  return {
    appropriation: 'appropriation-id-1',
    payee: 'Juan Dela Cruz',
    disbursement_date: '2026-01-15',
    amount: 5000,
    check_no: '',
    or_no: '',
    particular: '',
  }
}

describe('disbursementSchema', () => {
  it('accepts a valid disbursement', () => {
    expect(disbursementSchema.safeParse(validDisbursement()).success).toBe(true)
  })

  it('rejects a zero amount', () => {
    const result = disbursementSchema.safeParse({ ...validDisbursement(), amount: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects a negative amount', () => {
    const result = disbursementSchema.safeParse({ ...validDisbursement(), amount: -50 })
    expect(result.success).toBe(false)
  })

  it('rejects a missing payee', () => {
    const result = disbursementSchema.safeParse({ ...validDisbursement(), payee: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a missing appropriation', () => {
    const result = disbursementSchema.safeParse({ ...validDisbursement(), appropriation: '' })
    expect(result.success).toBe(false)
  })
})
