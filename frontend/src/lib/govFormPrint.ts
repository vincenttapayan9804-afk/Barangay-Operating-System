/**
 * Standard Government Forms Phase 0: shared print/PDF template engine.
 *
 * Generalizes the print-optimized-HTML approach proven out in bims-export.ts
 * (DILG BIMS Form A1) into a reusable builder, since that pattern scales to
 * multi-page bureaucratic layouts (COA/BIR/DBM/DOLE forms) far better than
 * pdf-lib's manual coordinate drawing in certificatePdf.ts. Every Phase 1-4
 * form generator should build its content through renderGovForm() rather
 * than hand-writing a full HTML document — one shared letterhead, section,
 * table, and signature-grid vocabulary instead of N one-off copies of the
 * same CSS.
 *
 * Same mechanism as bims-export.ts: opens a new window, writes the HTML,
 * and auto-triggers window.print() so the user can Save as PDF.
 */

export interface GovFormFieldRow {
  label: string
  value: string | number | null | undefined
}

/** A label/value grid, e.g. header particulars or a form's static fields. */
export interface GovFormFieldsSection {
  kind: 'fields'
  title?: string
  rows: GovFormFieldRow[]
}

/** A columnar table, e.g. RCD line items or a Disbursement Voucher's account breakdown. */
export interface GovFormTableSection {
  kind: 'table'
  title?: string
  columns: { label: string; align?: 'left' | 'center' | 'right'; width?: string }[]
  rows: (string | number | null | undefined)[][]
  emptyLabel?: string
}

/** Free-form note/paragraph block (e.g. a certification statement). */
export interface GovFormNoteSection {
  kind: 'note'
  title?: string
  text: string
}

export type GovFormSection = GovFormFieldsSection | GovFormTableSection | GovFormNoteSection

export interface GovFormSignatory {
  label: string
  role: string
}

export interface GovFormOptions {
  /** e.g. "Report of Collections and Deposits" */
  title: string
  /** e.g. "COA GAM Appendix 26" */
  formRef: string
  /** e.g. "Government Accounting Manual, COA Circular No. 2015-007" */
  legalRef?: string
  barangayName: string
  /** e.g. "January 2027" or "Q1 2027" */
  periodLabel?: string
  sections: GovFormSection[]
  signatories: GovFormSignatory[]
  /** Shown above the signature grid, e.g. a certification statement. */
  certification?: string
  pageSize?: 'letter' | 'legal' | 'a4'
}

export function renderGovForm(opts: GovFormOptions) {
  const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const pageSize = opts.pageSize ?? 'letter'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(opts.title)}</title>
<style>
  @page { size: ${pageSize} portrait; margin: 12mm 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 10pt; color: #000; line-height: 1.35; }

  .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6pt; margin-bottom: 8pt; }
  .header .rep { font-size: 11pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5pt; }
  .header .barangay { font-size: 9pt; font-weight: bold; margin-top: 2pt; }
  .header .form-ref { font-size: 8pt; font-weight: bold; color: #222; margin-top: 1pt; }
  .header .legal-ref { font-size: 7.5pt; color: #444; margin-top: 1pt; }

  .form-title { text-align: center; font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 10pt 0 4pt; padding: 3pt 0; border-bottom: 1px solid #000; }
  .period-label { text-align: center; font-size: 9pt; font-style: italic; margin-bottom: 8pt; }

  .section-title { font-size: 10pt; font-weight: bold; margin: 8pt 0 4pt; padding: 2pt 5pt; background: #e8e8e8; border: 1px solid #999; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 6pt; }
  th, td { border: 1px solid #000; padding: 2pt 4pt; text-align: left; font-size: 9pt; vertical-align: top; }
  th { background: #f0f0f0; font-weight: bold; text-align: center; }
  .field-label { font-weight: bold; width: 32%; background: #f8f8f8; }
  .field-value { width: 68%; }

  .note-block { font-size: 8.5pt; padding: 6pt; border: 1px solid #999; background: #fafafa; margin-bottom: 6pt; }

  .sig-section { margin-top: 16pt; border-top: 1px solid #000; padding-top: 4pt; }
  .sig-grid { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12pt; margin-top: 8pt; }
  .sig-box { text-align: center; flex: 1; min-width: 140pt; }
  .sig-box .label { font-size: 8pt; font-weight: bold; }
  .sig-box .line { border-top: 1px solid #000; margin-top: 32pt; padding-top: 2pt; font-size: 8pt; }
  .sig-box .role { font-size: 7.5pt; color: #555; font-style: italic; }

  .footer { text-align: center; font-size: 7pt; color: #666; margin-top: 12pt; border-top: 1px solid #ccc; padding-top: 4pt; }

  @media screen {
    .no-print { text-align: right; margin-bottom: 8pt; }
    .no-print button { padding: 5pt 14pt; font-size: 10pt; cursor: pointer; margin-left: 4pt; border: 1px solid #999; background: #fff; border-radius: 3pt; }
    .no-print button:hover { background: #eee; }
  }
  @media print {
    .no-print { display: none; }
    .sig-box .line { margin-top: 36pt; }
  }
</style>
</head>
<body>

<div class="no-print">
  <button onclick="window.print()">🖨️ Print / Save as PDF</button>
  <button onclick="window.close()">✕ Close</button>
</div>

<div class="header">
  <div class="rep">Republic of the Philippines</div>
  <div class="barangay">${esc(opts.barangayName)}</div>
  <div class="form-ref">${esc(opts.formRef)}</div>
  ${opts.legalRef ? `<div class="legal-ref">${esc(opts.legalRef)}</div>` : ''}
</div>

<div class="form-title">${esc(opts.title)}</div>
${opts.periodLabel ? `<div class="period-label">Period Covered: ${esc(opts.periodLabel)}</div>` : ''}

${opts.sections.map(renderSection).join('\n')}

${opts.certification ? `<div class="note-block">${esc(opts.certification)}</div>` : ''}

<div class="sig-section">
  <div class="sig-grid">
    ${opts.signatories.map((s) => `
    <div class="sig-box">
      <div class="label">${esc(s.label)}:</div>
      <div class="line">
        <span class="role">${esc(s.role)}</span>
      </div>
    </div>`).join('')}
  </div>
</div>

<div class="footer">
  <strong>CLUSTR</strong> — Generated ${esc(today)}. Pending official primary-source verification where noted; not a substitute for professional accounting/legal review.
</div>

<script>
  setTimeout(function() { window.print(); }, 500);
</script>

</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('Popup blocked. Please allow popups for this site to export.')
    return
  }
  win.document.write(html)
  win.document.close()
}

function renderSection(section: GovFormSection): string {
  if (section.kind === 'fields') {
    return `
${section.title ? `<div class="section-title">${esc(section.title)}</div>` : ''}
<table>
  ${section.rows.map((r) => `<tr><td class="field-label">${esc(r.label)}</td><td class="field-value">${esc(r.value)}</td></tr>`).join('')}
</table>`
  }
  if (section.kind === 'table') {
    return `
${section.title ? `<div class="section-title">${esc(section.title)}</div>` : ''}
<table>
  <thead>
    <tr>${section.columns.map((c) => `<th style="${c.width ? `width:${c.width};` : ''}text-align:${c.align ?? 'center'};">${esc(c.label)}</th>`).join('')}</tr>
  </thead>
  <tbody>
    ${section.rows.length === 0
      ? `<tr><td colspan="${section.columns.length}" style="text-align:center;font-style:italic;">${esc(section.emptyLabel ?? 'No entries recorded.')}</td></tr>`
      : section.rows.map((row) => `<tr>${row.map((cell, i) => `<td style="text-align:${section.columns[i]?.align ?? 'left'};">${esc(cell)}</td>`).join('')}</tr>`).join('')}
  </tbody>
</table>`
  }
  return `
${section.title ? `<div class="section-title">${esc(section.title)}</div>` : ''}
<div class="note-block">${esc(section.text)}</div>`
}

function esc(s: unknown): string {
  if (s == null || s === '') return '—'
  const str = String(s)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
