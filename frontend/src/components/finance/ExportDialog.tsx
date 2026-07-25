import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCurrentUser } from '@/auth/session'

interface ExportColumn {
  header: string
  key: string
  format?: 'currency' | 'date' | 'text'
}

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  title: string
  columns: ExportColumn[]
  fetchData: (startDate: string, endDate: string) => Promise<Record<string, unknown>[]>
  filename: string
}

export function ExportDialog({ open, onClose, title, columns, fetchData, filename }: ExportDialogProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exporting, setExporting] = useState(false)

  const user = getCurrentUser()
  if (!user || user.role !== 'admin') return null

  async function handleExport() {
    setExporting(true)
    try {
      const data = await fetchData(startDate, endDate)
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Sheet1')

      sheet.columns = columns.map((col) => ({
        header: col.header,
        key: col.key,
        width: Math.max(col.header.length + 5, 15),
      }))

      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25

      data.forEach((row, i) => {
        const excelRow = sheet.addRow(row)
        if (i % 2 === 0) {
          excelRow.eachCell((cell: any) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } }
          })
        }
      })

      columns.forEach((col, i) => {
        const colIdx = i + 1
        if (col.format === 'currency') {
          sheet.getColumn(colIdx).numFmt = '"₱"#,##0.00'
        }
        if (col.format === 'date') {
          sheet.getColumn(colIdx).numFmt = 'yyyy-mm-dd'
        }
      })

      if (data.length > 0) {
        sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: data.length + 1, column: columns.length } }
      }

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}-${Date.now()}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onClose()
    } catch (e) {
      console.error('Export failed', e)
    }
    setExporting(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card rounded-xl shadow-xl p-6 m-4">
        <h2 className="font-display text-sm font-semibold mb-4">Export {title}</h2>
        <div className="space-y-4">
          <div>
            <Label>From Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>To Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button onClick={handleExport} disabled={exporting}>{exporting ? 'Exporting...' : 'Export'}</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}