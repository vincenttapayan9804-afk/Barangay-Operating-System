import { z } from 'zod'

// Mirrors backend/supabase/migrations/0005_households.sql's `not null` columns.
// household_type/tenure_status/household_unit values come from the
// barangay-editable `lookups` table (useLookups()), not a fixed enum here —
// same reasoning as resident.ts.
export const householdSchema = z
  .object({
    region: z.string().trim().min(1, 'Region is required'),
    province: z.string().trim().min(1, 'Province is required'),
    city_municipality: z.string().trim().min(1, 'City/Municipality is required'),
    barangay: z.string().trim().min(1, 'Barangay is required'),
    household_complete_address: z.string().trim().min(1, 'Complete address is required'),
    household_type: z.string().min(1, 'Household type is required'),
    household_type_other: z.string(),
    tenure_status: z.string().min(1, 'Tenure status is required'),
    tenure_status_other: z.string(),
    household_unit: z.string().min(1, 'Household unit is required'),
    household_unit_other: z.string(),
    no_of_families: z.number().min(0, 'Must be 0 or more'),
    monthly_income: z.number().min(0, 'Monthly income must be 0 or more'),
  })
  .superRefine((data, ctx) => {
    if (data.household_type === 'Others' && !data.household_type_other.trim()) {
      ctx.addIssue({ code: 'custom', path: ['household_type_other'], message: 'Please specify household type' })
    }
    if (data.tenure_status === 'Others' && !data.tenure_status_other.trim()) {
      ctx.addIssue({ code: 'custom', path: ['tenure_status_other'], message: 'Please specify tenure status' })
    }
    if (data.household_unit === 'Others' && !data.household_unit_other.trim()) {
      ctx.addIssue({ code: 'custom', path: ['household_unit_other'], message: 'Please specify household unit' })
    }
  })
