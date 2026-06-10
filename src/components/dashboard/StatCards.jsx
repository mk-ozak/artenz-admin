const HALLS = [
  { key: 'ap',   label: 'ARTENZ PLUS', color: '#4cbfb3' },
  { key: 'a',    label: 'ARTENZ',      color: '#d4a036' },
  { key: 'luna', label: 'LUNA',        color: '#b55db8' },
  { key: 'cat',  label: 'CATERING',    color: '#7aaaca' },
]

export default function StatCards({ stats }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {HALLS.map(({ key, label, color }) => (
        <div key={key}
             className="bg-white border border-[#e0e8ec] rounded-card px-4 py-3 border-t-[3px]"
             style={{ borderTopColor: color }}>
          <p className="text-xs text-[#8aaabb] font-medium">{label}</p>
          <p className="text-2xl font-bold text-[#1a2830] mt-1">{stats?.[key] ?? 0}</p>
          <p className="text-xs text-[#b0c4cc]">akcie tento mesiac</p>
        </div>
      ))}
    </div>
  )
}
