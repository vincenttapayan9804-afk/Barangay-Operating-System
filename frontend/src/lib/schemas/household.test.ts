import { describe, it, expect } from 'vitest'
import { householdSchema } from './household'

function validHousehold() {
  return {
    region: 'Region IV-A',
    province: 'Laguna',
    city_municipality: 'Calamba',
    barangay: 'Barangay 1',
    household_complete_address: '123 Rizal St.',
    household_type: 'Nuclear Family',
    household_type_other: '',
    tenure_status: 'Owner',
    tenure_status_other: '',
    household_unit: 'Single House',
    household_unit_other: '',
    no_of_families: 1,
    monthly_income: 15000,
  }
}

describe('householdSchema', () => {
  it('accepts a valid household', () => {
    expect(householdSchema.safeParse(validHousehold()).success).toBe(true)
  })

  it('rejects a missing required field', () => {
    const result = householdSchema.safeParse({ ...validHousehold(), region: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a negative monthly income', () => {
    const result = householdSchema.safeParse({ ...validHousehold(), monthly_income: -100 })
    expect(result.success).toBe(false)
  })

  it('requires household_type_other when household_type is "Others"', () => {
    const result = householdSchema.safeParse({ ...validHousehold(), household_type: 'Others', household_type_other: '' })
    expect(result.success).toBe(false)
  })

  it('accepts "Others" with a specified value', () => {
    const result = householdSchema.safeParse({ ...validHousehold(), household_type: 'Others', household_type_other: 'Boarding house' })
    expect(result.success).toBe(true)
  })
})
