// Výber času "HH:MM" alebo '' (nevybratý = „–") — hodina + minúty po 15.
// Hodiny od rána až po polnoc (polnočný raut).
const HOURS   = [...Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, '0')), '00', '01', '02']
const MINUTES = ['00', '15', '30', '45']

const selectCls = `bg-white border border-gray-300 rounded-lg px-2 py-2 text-sm font-semibold
  text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500
  disabled:opacity-60 disabled:cursor-not-allowed`

export default function TimeSelect({ value, onChange, disabled = false }) {
  const hh = value ? value.slice(0, 2) : ''
  const mm = value ? value.slice(3, 5) : '00'
  return (
    <div className="flex items-center gap-1">
      <select
        value={hh}
        disabled={disabled}
        onChange={e => onChange(e.target.value === '' ? '' : `${e.target.value}:${mm}`)}
        className={selectCls}
        aria-label="Hodina"
      >
        <option value="">–</option>
        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-sm font-semibold text-gray-500">:</span>
      <select
        value={mm}
        disabled={disabled || !hh}
        onChange={e => onChange(`${hh}:${e.target.value}`)}
        className={selectCls}
        aria-label="Minúty"
      >
        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  )
}
