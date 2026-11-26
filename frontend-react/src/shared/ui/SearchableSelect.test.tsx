import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchableSelect, type SelectOption } from './SearchableSelect'

const OPTIONS: SelectOption<number>[] = [
  { value: 1, label: 'HSG-0001 — บ้าน 101/1 (นายสมหมาย ใจดี)' },
  { value: 2, label: 'HSG-0002 — บ้าน 205/4 (นางมาลี ศรีสุข)' },
  { value: 3, label: 'HSG-0003 — บ้าน 309/2 (นางวิภา สุขใจ)' },
]

function SelectHarness() {
  const [selected, setSelected] = useState<number>(1)
  return (
    <div>
      <SearchableSelect
        ariaLabel="เลือกมิเตอร์น้ำ"
        options={OPTIONS}
        value={selected}
        onChange={(val) => setSelected(val)}
      />
      <output data-testid="selected-val">{selected}</output>
    </div>
  )
}

describe('SearchableSelect (react-select)', () => {
  it('renders searchable combobox, filters options by Thai/code query, and selects matched option', async () => {
    const user = userEvent.setup()
    render(<SelectHarness />)

    const combobox = screen.getByRole('combobox', { name: 'เลือกมิเตอร์น้ำ' })
    expect(combobox).toBeInTheDocument()

    // Type search query to filter
    await user.click(combobox)
    await user.type(combobox, 'วิภา')

    // Only matching option is shown
    expect(screen.getByText(/HSG-0003/)).toBeInTheDocument()
    expect(screen.queryByText(/HSG-0002/)).not.toBeInTheDocument()

    // Select the option
    await user.click(screen.getByText(/HSG-0003/))
    expect(screen.getByTestId('selected-val').textContent).toBe('3')
  })

  it('shows Thai empty message when search matches no options', async () => {
    const user = userEvent.setup()
    render(<SelectHarness />)

    const combobox = screen.getByRole('combobox', { name: 'เลือกมิเตอร์น้ำ' })
    await user.click(combobox)
    await user.type(combobox, 'ไม่มีข้อมูลนี้')

    expect(screen.getByText('ไม่พบรายการที่ค้นหา')).toBeInTheDocument()
  })
})
