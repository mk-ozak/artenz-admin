// Segmentový prepínač — vizuál ako „Stav rezervácie" (StatusSegment).
// Klik na aktívnu možnosť ju odznačí (value → null).
export default function Segmented({ options, value, onChange, disabled = false }) {
  return (
    <div
      className="grid rounded-lg bg-white border border-gray-200 p-1
                 shadow-[0_2px_10px_rgba(53,77,93,.10)]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(o => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(active ? null : o.value)}
            className={`px-1 py-2 rounded-md text-xs font-semibold truncate transition-colors
                        disabled:opacity-60
                        ${active ? '' : 'text-gray-600 hover:text-gray-900'}`}
            style={active ? { background: '#4cbfb3', color: '#0a2d2a' } : undefined}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
