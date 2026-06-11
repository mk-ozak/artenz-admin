import { IconCalendar } from '@tabler/icons-react'
import { formatDateSk } from '../../utils/format'
import { EVENT_LABEL } from '../../lib/eventTypes'

const STRIPE = {
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

export default function NextEventCard({ event }) {
  if (!event) return (
    <div className="rounded-card bg-white border border-[#e0e8ec] px-4 py-3
                    text-sm text-[#8aaabb] italic">
      Žiadne nadchádzajúce akcie
    </div>
  )

  const color = STRIPE[event.hall] ?? '#4cbfb3'
  const title = `${EVENT_LABEL[event.event_type] ?? event.event_type ?? ''} – ${event.customer_name ?? ''}`

  return (
    <div className="relative rounded-card bg-white border border-[#e0e8ec]
                    px-4 py-3 pl-5 overflow-hidden">
      <div className="absolute left-0 inset-y-0 w-1" style={{ background: color }} />
      <p className="text-[10px] text-[#8aaabb] tracking-widest uppercase mb-1">
        Najbližšia akcia
      </p>
      <p className="text-[15px] font-semibold text-[#1a2830]">{title}</p>
      <div className="flex gap-3 mt-1.5 items-center">
        <span className="flex items-center gap-1 text-xs text-[#6a8898]">
          <IconCalendar size={13} />
          {formatDateSk(event.date)}
        </span>
        <span className="text-xs font-bold" style={{ color }}>
          {HALL_LABEL[event.hall] ?? event.hall}
        </span>
      </div>
    </div>
  )
}
