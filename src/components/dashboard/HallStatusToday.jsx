const HALL_COLOR = {
  ARTENZ_PLUS: '#4cbfb3',
  ARTENZ:      '#d4a036',
  LUNA:        '#b55db8',
  CATERING:    '#7aaaca',
}

const HALL_LABEL = {
  ARTENZ_PLUS: 'ARTENZ PLUS',
  ARTENZ:      'ARTENZ',
  LUNA:        'LUNA',
  CATERING:    'CATERING',
}

const EVENT_LABEL = {
  svadba:   'Svadba',
  oslava:   'Oslava',
  firmovna: 'Firemná akcia',
}

export default function HallStatusToday({ bookings }) {
  if (!bookings?.length) return null

  return (
    <section className="px-4 pb-5">
      <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#8aaabb' }}>
        DNES — STAV SÁL
      </p>
      {bookings.map(b => {
        const color = HALL_COLOR[b.hall] ?? '#9ab0ba'
        const title = [EVENT_LABEL[b.event_type], b.customer_name].filter(Boolean).join(' – ')
        return (
          <div key={b.id}
            className="bg-white border border-[#e8eef2] rounded-xl px-3.5 py-2.5
                       flex items-center justify-between mb-2 last:mb-0">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[14px] font-bold text-[#1a2830]">{HALL_LABEL[b.hall] ?? b.hall}</span>
            </div>
            <span className="text-[12px] font-medium text-right max-w-[160px] truncate"
                  style={{ color }}>
              {title}
            </span>
          </div>
        )
      })}
    </section>
  )
}
