import { z } from 'zod'

// backend/supabase/migrations/0020_disbursements.sql leaves every one of
// these columns nullable — this schema is a stricter application-level rule
// (a recorded disbursement should always have a payee, a linked
// appropriation, a date, and a positive amount), not a DB-integrity mirror.
export const disbursementSchema = z.object({
  appropriation: z.string().min(1, 'Appropriation is required'),
  payee: z.string().trim().min(1, 'Payee is required'),
  disbursement_date: z
    .string()
    .min(1, 'Disbursement date is required')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Disbursement date is invalid'),
  amount: z.number().refine((v) => v > 0, 'Amount must be greater than 0'),
  check_no: z.string(),
  or_no: z.string(),
  particular: z.string(),
})
