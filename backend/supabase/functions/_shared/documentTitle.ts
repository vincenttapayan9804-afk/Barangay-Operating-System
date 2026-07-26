// Ported verbatim from notify.pb.js's documentTitle().
export function documentTitle(type: string): string {
  switch (type) {
    case 'barangay_clearance': return 'Barangay Clearance'
    case 'business_permit': return 'Barangay Business Permit Clearance'
    case 'certificate_of_indigency': return 'Certificate of Indigency'
    case 'certificate_of_residency': return 'Certificate of Residency'
    case 'certificate_of_good_moral': return 'Certificate of Good Moral Character'
    case 'cedula': return 'Community Tax Certificate (Cedula)'
    default: return 'document'
  }
}
