import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import QRCode from 'qrcode'
import type { ApiDocument } from '@/api/documents'

export interface CertificateOrgInfo {
  barangayName: string
  municipalityCity: string
  province: string
  region: string
  barangayCaptain: string
}

const DOCUMENT_TITLES: Record<string, string> = {
  barangay_clearance: 'BARANGAY CLEARANCE',
  business_permit: 'BARANGAY BUSINESS PERMIT CLEARANCE',
  certificate_of_indigency: 'CERTIFICATE OF INDIGENCY',
  certificate_of_residency: 'CERTIFICATE OF RESIDENCY',
  certificate_of_good_moral: 'CERTIFICATE OF GOOD MORAL CHARACTER',
  cedula: 'COMMUNITY TAX CERTIFICATE',
  other: 'BARANGAY CERTIFICATION',
}

function bodyParagraph(doc: ApiDocument, barangayLabel: string): string {
  const name = doc.resident_name || 'the above-named resident'
  const purpose = doc.purpose || 'the purpose stated in the request'
  switch (doc.document_type) {
    case 'barangay_clearance':
      return `This is to certify that ${name}, of legal age, is a bona fide resident of ${barangayLabel} and has no derogatory record on file as of this date. This clearance is issued upon the request of the above-named person for ${purpose}.`
    case 'certificate_of_indigency':
      return `This is to certify that ${name} is a bona fide resident of ${barangayLabel} and belongs to an indigent family based on the records of this office. This certification is issued upon request for ${purpose}.`
    case 'certificate_of_residency':
      return `This is to certify that ${name} is a bona fide resident of ${barangayLabel}. This certification is issued upon request for ${purpose}.`
    case 'certificate_of_good_moral':
      return `This is to certify that ${name}, a resident of ${barangayLabel}, is known to this office to be of good moral character and has no derogatory record on file as of this date. This certification is issued upon request for ${purpose}.`
    case 'cedula':
      return `This is to certify that ${name} is a bona fide resident of ${barangayLabel} for the purpose of securing a Community Tax Certificate (Cedula). Issued upon request for ${purpose}.`
    case 'business_permit':
      return `This is to certify that ${name} is granted barangay clearance to operate a business within ${barangayLabel}, subject to compliance with all applicable local ordinances. Issued upon request for ${purpose}.`
    default: {
      const specified = doc.other_document_type ? ` (${doc.other_document_type})` : ''
      return `This is to certify that ${name} is a bona fide resident of ${barangayLabel}. Issued upon request for ${purpose}${specified}.`
    }
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

function drawCentered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, pageWidth: number) {
  const width = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (pageWidth - width) / 2, y, size, font, color: rgb(0.05, 0.07, 0.06) })
}

function formatIssueDate(): string {
  const d = new Date()
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Renders an official-style PDF certificate for a released document
 * request — letterhead, templated certification body, signature block for
 * the barangay captain, and a QR code linking to the public /verify/:id
 * page so anyone holding the printed copy can confirm it's genuine.
 */
export async function generateCertificatePdf(doc: ApiDocument, org: CertificateOrgInfo): Promise<Blob> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792]) // US Letter, points
  const { width } = page.getSize()
  const margin = 72

  const regular = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const bold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
  const italic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)

  let y = 740

  drawCentered(page, 'Republic of the Philippines', y, regular, 11, width)
  y -= 15
  const locality = [org.municipalityCity, org.province].filter(Boolean).join(', ')
  if (locality) {
    drawCentered(page, locality, y, regular, 11, width)
    y -= 15
  }
  drawCentered(page, `BARANGAY ${org.barangayName.toUpperCase()}`, y, bold, 13, width)
  y -= 15
  drawCentered(page, 'OFFICE OF THE PUNONG BARANGAY', y, regular, 10, width)
  y -= 28

  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1.2, color: rgb(0.1, 0.1, 0.1) })
  y -= 34

  const title = DOCUMENT_TITLES[doc.document_type] || DOCUMENT_TITLES.other
  drawCentered(page, title, y, bold, 18, width)
  y -= 40

  const barangayLabel = `Barangay ${org.barangayName}${org.municipalityCity ? `, ${org.municipalityCity}` : ''}`
  const paragraph = bodyParagraph(doc, barangayLabel)
  const bodyFontSize = 12
  const lineHeight = 20
  const maxTextWidth = width - margin * 2
  for (const line of wrapText(paragraph, regular, bodyFontSize, maxTextWidth)) {
    page.drawText(line, { x: margin, y, size: bodyFontSize, font: regular, color: rgb(0.05, 0.07, 0.06) })
    y -= lineHeight
  }
  y -= 20

  const issued = `Issued this ${formatIssueDate()} at Barangay ${org.barangayName}${locality ? `, ${locality}` : ''}.`
  for (const line of wrapText(issued, regular, bodyFontSize, maxTextWidth)) {
    page.drawText(line, { x: margin, y, size: bodyFontSize, font: regular, color: rgb(0.05, 0.07, 0.06) })
    y -= lineHeight
  }

  // Signature block, right-aligned — the issuing official.
  const sigY = Math.max(y - 60, 220)
  const captain = org.barangayCaptain || '_________________________'
  const captainWidth = bold.widthOfTextAtSize(captain, 12)
  page.drawText(captain, { x: width - margin - captainWidth, y: sigY, size: 12, font: bold })
  const roleLabel = 'Punong Barangay'
  const roleWidth = regular.widthOfTextAtSize(roleLabel, 10)
  page.drawText(roleLabel, { x: width - margin - roleWidth, y: sigY - 16, size: 10, font: regular })
  page.drawLine({
    start: { x: width - margin - 180, y: sigY - 4 },
    end: { x: width - margin, y: sigY - 4 },
    thickness: 0.8,
    color: rgb(0.3, 0.3, 0.3),
  })

  // Signature block, left-aligned — proof of receipt, only present once the
  // document has actually been handed over (see ReleasePage's SignaturePad).
  if (doc.status === 'released' && doc.received_by) {
    const sigBlockWidth = 180
    if (doc.signature_data) {
      try {
        const sigBytes = Uint8Array.from(atob(doc.signature_data.split(',')[1]), (c) => c.charCodeAt(0))
        const sigImage = await pdfDoc.embedPng(sigBytes)
        const sigDrawHeight = 45
        const sigDrawWidth = Math.min(sigBlockWidth, (sigImage.width / sigImage.height) * sigDrawHeight)
        page.drawImage(sigImage, { x: margin, y: sigY + 2, width: sigDrawWidth, height: sigDrawHeight })
      } catch {
        // Malformed signature data — skip the image, the printed name below still stands.
      }
    }
    page.drawLine({
      start: { x: margin, y: sigY - 4 },
      end: { x: margin + sigBlockWidth, y: sigY - 4 },
      thickness: 0.8,
      color: rgb(0.3, 0.3, 0.3),
    })
    page.drawText(doc.received_by, { x: margin, y: sigY - 16, size: 10, font: regular })
    page.drawText('Received by', { x: margin, y: sigY - 28, size: 8, font: italic, color: rgb(0.4, 0.45, 0.43) })
  }

  // QR verification block, bottom-left.
  const verifyUrl = `${window.location.origin}/verify/${doc.id}`
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240 })
  const qrBytes = Uint8Array.from(atob(qrDataUrl.split(',')[1]), (c) => c.charCodeAt(0))
  const qrImage = await pdfDoc.embedPng(qrBytes)
  const qrSize = 80
  const qrY = 90
  page.drawImage(qrImage, { x: margin, y: qrY, width: qrSize, height: qrSize })
  page.drawText('Scan to verify authenticity', {
    x: margin + qrSize + 10,
    y: qrY + qrSize - 14,
    size: 9,
    font: italic,
    color: rgb(0.35, 0.4, 0.38),
  })
  page.drawText(`Document ID: ${doc.id}`, {
    x: margin + qrSize + 10,
    y: qrY + qrSize - 28,
    size: 9,
    font: regular,
    color: rgb(0.35, 0.4, 0.38),
  })
  page.drawText(`Queue #: ${doc.queue_number}`, {
    x: margin + qrSize + 10,
    y: qrY + qrSize - 42,
    size: 9,
    font: regular,
    color: rgb(0.35, 0.4, 0.38),
  })

  const bytes = await pdfDoc.save()
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

export function downloadCertificatePdf(blob: Blob, doc: ApiDocument) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${doc.document_type}-${doc.queue_number}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
