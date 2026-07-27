import { describe, it, expect } from 'vitest'
import { residentSchema } from './resident'

function validResident() {
  return {
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    type_of_resident: 'Non-migrant',
    date_of_birth: '1990-01-01',
    place_of_birth: 'Manila',
    sex: 'Male',
    civil_status: 'Single/Never Married',
    nationality: 'Filipino Citizen',
    religion: 'Roman Catholic',
    region: 'Region IV-A',
    province: 'Laguna',
    city_municipality: 'Calamba',
    barangay: 'Barangay 1',
    philsys_card_no: '',
    email_address: '',
    mobile_number: '',
    zip_code: '',
    height_m: 0,
    weight_kg: 0,
    last_voted_year: 0,
  }
}

describe('residentSchema', () => {
  it('accepts a minimal valid resident', () => {
    expect(residentSchema.safeParse(validResident()).success).toBe(true)
  })

  it('rejects a missing first name', () => {
    const result = residentSchema.safeParse({ ...validResident(), first_name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a future date of birth', () => {
    const result = residentSchema.safeParse({ ...validResident(), date_of_birth: '2999-01-01' })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed mobile number', () => {
    const result = residentSchema.safeParse({ ...validResident(), mobile_number: '12345' })
    expect(result.success).toBe(false)
  })

  it('accepts a valid mobile number and PhilSys card number', () => {
    const result = residentSchema.safeParse({
      ...validResident(),
      mobile_number: '09171234567',
      philsys_card_no: '1234-5678-9012-3456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a malformed email address', () => {
    const result = residentSchema.safeParse({ ...validResident(), email_address: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid sex value', () => {
    const result = residentSchema.safeParse({ ...validResident(), sex: 'Other' })
    expect(result.success).toBe(false)
  })
})
