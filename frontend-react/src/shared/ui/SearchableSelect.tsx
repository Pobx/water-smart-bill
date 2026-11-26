import Select, { type StylesConfig } from 'react-select'

export interface SelectOption<T extends string | number = string> {
  value: T
  label: string
}

export interface SearchableSelectProps<T extends string | number = string> {
  options: SelectOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  inputId?: string
  placeholder?: string
  isDisabled?: boolean
  className?: string
  size?: 'sm' | 'md'
}

/**
 * Searchable dropdown select powered by react-select.
 * Supports Thai/English/code keyword filtering, keyboard navigation, and accessible combobox ARIA.
 */
export function SearchableSelect<T extends string | number = string>({
  options,
  value,
  onChange,
  ariaLabel,
  inputId,
  placeholder = 'พิมพ์เพื่อค้นหาหรือเลือก...',
  isDisabled = false,
  className,
  size = 'md',
}: SearchableSelectProps<T>) {
  const selectedOption = options.find((opt) => opt.value === value) ?? null

  const styles: StylesConfig<SelectOption<T>, false> = {
    control: (base, state) => ({
      ...base,
      minHeight: size === 'sm' ? '34px' : '38px',
      borderRadius: '0.5rem',
      borderColor: state.isFocused ? '#0ea5e9' : '#e2e8f0',
      boxShadow: state.isFocused ? '0 0 0 2px rgba(14, 165, 233, 0.2)' : 'none',
      backgroundColor: '#ffffff',
      fontSize: size === 'sm' ? '0.75rem' : '0.875rem',
      '&:hover': {
        borderColor: state.isFocused ? '#0ea5e9' : '#cbd5e1',
      },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: size === 'sm' ? '0 8px' : '2px 10px',
    }),
    input: (base) => ({
      ...base,
      margin: 0,
      padding: 0,
      color: '#0f172a',
    }),
    singleValue: (base) => ({
      ...base,
      color: '#0f172a',
      fontWeight: 500,
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (base) => ({
      ...base,
      padding: size === 'sm' ? '4px 6px' : '6px 8px',
      color: '#64748b',
    }),
    menu: (base) => ({
      ...base,
      borderRadius: '0.75rem',
      overflow: 'hidden',
      border: '1px solid #e2e8f0',
      boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12)',
      zIndex: 50,
    }),
    option: (base, state) => ({
      ...base,
      fontSize: size === 'sm' ? '0.75rem' : '0.875rem',
      backgroundColor: state.isSelected
        ? '#0284c7'
        : state.isFocused
          ? '#f0f9ff'
          : '#ffffff',
      color: state.isSelected ? '#ffffff' : '#0f172a',
      cursor: 'pointer',
    }),
  }

  return (
    <Select<SelectOption<T>, false>
      instanceId={inputId ?? ariaLabel}
      inputId={inputId}
      aria-label={ariaLabel}
      className={className}
      classNamePrefix="wsb-select"
      options={options}
      value={selectedOption}
      isSearchable
      isDisabled={isDisabled}
      placeholder={placeholder}
      noOptionsMessage={() => 'ไม่พบรายการที่ค้นหา'}
      styles={styles}
      onChange={(opt) => {
        if (opt) {
          onChange(opt.value)
        }
      }}
    />
  )
}
