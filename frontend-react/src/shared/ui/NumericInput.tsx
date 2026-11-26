import { NumericFormat, type NumberFormatValues } from 'react-number-format'

export interface NumericInputProps {
  id?: string
  'aria-label'?: string
  value: string | number
  onValueChange?: (rawValue: string, floatValue: number | undefined) => void
  placeholder?: string
  className?: string
  readOnly?: boolean
  disabled?: boolean
  decimalScale?: number
  allowDecimal?: boolean
}

/**
 * Normalizes invalid leading zeros (e.g. "01234" -> "1234", "00.5" -> "0.5")
 * while preserving valid "0", "0.", and "0.10".
 */
export function normalizeNumericRawValue(raw: string): string {
  if (!raw) return ''
  return raw.replace(/^0+(?=\d)/, '')
}

/**
 * Plain text numeric input powered by react-number-format.
 * - Accepts only digits and a single decimal point (no e/+/- or spin arrows).
 * - Formats integers >= 4 digits with thousand separators (e.g. 1,230).
 * - Preserves valid decimals like 0.10 and plain 0.
 * - Strips invalid leading zeros immediately (e.g. 01234 / 0,1234 -> 1,234).
 */
export function NumericInput({
  id,
  'aria-label': ariaLabel,
  value,
  onValueChange,
  placeholder,
  className,
  readOnly,
  disabled,
  decimalScale,
  allowDecimal = true,
}: NumericInputProps) {
  const normalizedControlledValue =
    value === '' || value === undefined || value === null
      ? ''
      : typeof value === 'string'
        ? normalizeNumericRawValue(value)
        : value

  return (
    <NumericFormat
      id={id}
      aria-label={ariaLabel}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={normalizedControlledValue}
      thousandSeparator=","
      decimalSeparator="."
      allowNegative={false}
      allowLeadingZeros={false}
      decimalScale={allowDecimal ? decimalScale : 0}
      allowedDecimalSeparators={allowDecimal ? ['.'] : []}
      placeholder={placeholder}
      className={className}
      readOnly={readOnly}
      disabled={disabled}
      onValueChange={(values: NumberFormatValues) => {
        const cleaned = normalizeNumericRawValue(values.value)
        const parsed = cleaned === '' || cleaned === '.' ? undefined : Number(cleaned)
        onValueChange?.(cleaned, Number.isFinite(parsed) ? parsed : undefined)
      }}
    />
  )
}
