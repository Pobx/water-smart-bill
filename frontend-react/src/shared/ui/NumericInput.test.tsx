import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumericInput } from './NumericInput'

function Harness({ initial = '' }: { initial?: string }) {
  const [val, setVal] = useState(initial)
  return (
    <div>
      <NumericInput
        aria-label="จำนวนเงิน"
        value={val}
        onValueChange={(raw) => setVal(raw)}
      />
      <output data-testid="raw-val">{val}</output>
    </div>
  )
}

describe('NumericInput (react-number-format)', () => {
  it('renders a plain text input with decimal inputMode (never type="number")', () => {
    render(<Harness initial="1230" />)
    const input = screen.getByLabelText('จำนวนเงิน') as HTMLInputElement
    expect(input.type).toBe('text')
    expect(input.getAttribute('inputmode')).toBe('decimal')
    expect(input.value).toBe('1,230')
  })

  it('formats numbers >= 4 digits with commas, supports 0 and 0.10, and strips invalid leading zeros like 0,1234', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByLabelText('จำนวนเงิน') as HTMLInputElement

    // 4+ digits -> comma formatted
    await user.type(input, '1230')
    expect(input.value).toBe('1,230')
    expect(screen.getByTestId('raw-val').textContent).toBe('1230')

    // Decimal with trailing zero: 0.10
    await user.clear(input)
    await user.type(input, '0.10')
    expect(input.value).toBe('0.10')
    expect(screen.getByTestId('raw-val').textContent).toBe('0.10')

    // Plain 0
    await user.clear(input)
    await user.type(input, '0')
    expect(input.value).toBe('0')
    expect(screen.getByTestId('raw-val').textContent).toBe('0')

    // Prevent 0,1234 -> normalize to 1,234
    await user.clear(input)
    await user.type(input, '01234')
    expect(input.value).toBe('1,234')
    expect(screen.getByTestId('raw-val').textContent).toBe('1234')
  })

  it('rejects non-numeric characters, negative signs, and extra decimal points', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByLabelText('จำนวนเงิน') as HTMLInputElement

    await user.type(input, '-abc12e34.5.6')
    expect(input.value).toBe('1,234.56')
    expect(screen.getByTestId('raw-val').textContent).toBe('1234.56')
  })
})
