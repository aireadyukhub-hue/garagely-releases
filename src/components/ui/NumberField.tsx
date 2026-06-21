import { useEffect, useRef, useState } from 'react'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> & {
  value: number | null | undefined
  onChange: (n: number) => void
  /** Allow a decimal point (prices). false = whole numbers only (mileage, qty counts). */
  decimal?: boolean
}

/**
 * Controlled numeric input that never shows a stray leading zero.
 * Types like "18" instead of "018", but still allows "0.5".
 * Empty is treated as 0. Renders as a text input with a numeric keypad.
 */
export default function NumberField({ value, onChange, decimal = true, ...rest }: Props) {
  const [text, setText] = useState(() => (value ? String(value) : ''))
  const editing = useRef(false)

  // Keep the box in sync when the value changes from outside (e.g. form reset),
  // but don't fighting the user while they're typing.
  useEffect(() => {
    if (editing.current) return
    setText(value ? String(value) : '')
  }, [value])

  const handle = (raw: string) => {
    let v = raw.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, '')
    if (decimal) {
      const parts = v.split('.')
      v = parts.shift()! + (parts.length ? '.' + parts.join('') : '')
    }
    v = v.replace(/^0+(?=\d)/, '') // drop leading zeros, but keep "0." and a lone "0"
    setText(v)
    onChange(v === '' || v === '.' ? 0 : Number(v))
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={text}
      onFocus={(e) => { editing.current = true; rest.onFocus?.(e) }}
      onBlur={(e) => { editing.current = false; setText(value ? String(value) : ''); rest.onBlur?.(e) }}
      onChange={(e) => handle(e.target.value)}
    />
  )
}
