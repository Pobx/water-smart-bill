import { useCallback } from 'react'
import * as XLSX from 'xlsx'

export type CollectionRow = Record<string, unknown>

const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/
const LEADING_SPACE_FORMULA_RE = /^\s+[=+\-@]/

/**
 * Neutralize CSV/Excel formula injection (DDE / spreadsheet formulas)
 * by prefixing leading =, +, -, @, tab, or CR characters with a single quote.
 */
export function sanitizeCellValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }
  if (FORMULA_PREFIX_RE.test(value) || LEADING_SPACE_FORMULA_RE.test(value)) {
    return `'${value}`
  }
  return value
}

export function sanitizeRow<T extends CollectionRow>(row: T): CollectionRow {
  const sanitized: CollectionRow = {}
  for (const [key, val] of Object.entries(row)) {
    sanitized[key] = sanitizeCellValue(val)
  }
  return sanitized
}

export function useExcelExport() {
  const exportToXlsx = useCallback(
    <T extends CollectionRow = CollectionRow>(
      rows: T[],
      filename: string,
      sheetName = 'รายงานการรับชำระ'
    ): void => {
      const sanitizedRows = rows.map(sanitizeRow)
      const worksheet = XLSX.utils.json_to_sheet(sanitizedRows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
      const safeFilename = filename.toLowerCase().endsWith('.xlsx')
        ? filename
        : `${filename}.xlsx`
      XLSX.writeFile(workbook, safeFilename)
    },
    []
  )

  return { exportToXlsx }
}
