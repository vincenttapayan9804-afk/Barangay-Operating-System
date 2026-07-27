import { z } from 'zod'
import { isValidMobileNumber, isValidPhilsysCardNo } from '@/lib/validation'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const currentYear = new Date().getFullYear()

// Mirrors backend/supabase/migrations/0006_residents.sql's `not null` columns
// and CHECK constraints for sex/type_of_resident — the only two enums this
// form hardcodes in JSX rather than sourcing from the barangay-editable
// `lookups` table (civil_status/nationality/religion/etc. come from
// useLookups(), so their allowed values aren't fixed here — the dropdown
// already constrains input, and the DB CHECK constraint is the real gate).
export const residentSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  type_of_resident: z.enum(['Non-migrant', 'Migrant', 'Transient'], {
    message: 'Type of resident is required',
  }),
  date_of_birth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Date of birth is invalid')
    .refine((v) => new Date(v) <= new Date(), 'Date of birth cannot be in the future'),
  place_of_birth: z.string().trim().min(1, 'Place of birth is required'),
  sex: z.enum(['Male', 'Female'], { message: 'Sex is required' }),
  civil_status: z.string().trim().min(1, 'Civil status is required'),
  nationality: z.string().trim().min(1, 'Nationality is required'),
  religion: z.string().trim().min(1, 'Religion is required'),
  region: z.string().trim().min(1, 'Region is required'),
  province: z.string().trim().min(1, 'Province is required'),
  city_municipality: z.string().trim().min(1, 'City/Municipality is required'),
  barangay: z.string().trim().min(1, 'Barangay is required'),
  philsys_card_no: z
    .string()
    .refine((v) => v === '' || isValidPhilsysCardNo(v), 'PhilSys card number must be in 0000-0000-0000-0000 format'),
  email_address: z.string().refine((v) => v === '' || EMAIL_RE.test(v), 'Email address is invalid'),
  mobile_number: z
    .string()
    .refine((v) => v === '' || isValidMobileNumber(v), 'Mobile number must be a valid PH mobile number (09XXXXXXXXX)'),
  zip_code: z.string().refine((v) => v === '' || /^\d{3,10}$/.test(v), 'ZIP code must be numeric'),
  height_m: z.number().refine((v) => v === 0 || (v > 0 && v <= 3), 'Height must be between 0 and 3 meters'),
  weight_kg: z.number().refine((v) => v === 0 || (v > 0 && v <= 500), 'Weight must be between 0 and 500 kg'),
  last_voted_year: z
    .number()
    .refine((v) => v === 0 || (v >= 1900 && v <= currentYear), 'Last voted year is not valid'),
})
