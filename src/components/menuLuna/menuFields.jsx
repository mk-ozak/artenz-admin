// Zdieľané polia pre menuLuna editory (denné + trvalé menu).

export const inputCls =
  'w-full border border-[#e2e8ed] rounded-lg px-2.5 py-1.5 text-sm bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#4cbfb3]/40 focus:border-[#4cbfb3] ' +
  'placeholder:text-[#b0c4cc]'

export const Label = ({ children }) => (
  <span className="text-[11px] uppercase tracking-wide text-[#8aaabb] block mb-0.5">{children}</span>
)

// Gramáž select – povolí aj existujúcu hodnotu mimo zoznamu (staré dáta).
export function PortionSelect({ value, options, onChange }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls + ' appearance-none'}
    >
      <option value="">—</option>
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}
