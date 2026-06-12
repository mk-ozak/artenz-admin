import { useEffect, useState } from 'react'

// Input, ktorý uloží hodnotu až po opustení poľa (blur / Enter)
export default function BlurInput({ value, onSave, className = '', ...props }) {
  const [val, setVal] = useState(value ?? '')
  useEffect(() => { setVal(value ?? '') }, [value])
  return (
    <input
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val !== (value ?? '')) onSave(val) }}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
      className={`border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-lg
                  px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-transparent
                  ${className}`}
      {...props}
    />
  )
}
