import { useEffect, useState } from 'react'
import { IconCalendar } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { formatDateSk } from '../../utils/format'
import { EVENT_LABEL } from '../../lib/eventTypes'
import { toISO } from '../../utils/diaryWeeks'

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

// Všetky akcie na najbližších 7 dní (vrátane dneška)
export default function UpcomingEvents() {
  const [events, setEvents] = useState([])

  useEffect(() => {
    const today = new Date()
    const end   = new Date(today)
    end.setDate(today.getDate() + 6)
    supabase
      .from('bookings')
      .select('id, date, hall, customer_name, event_type')
      .is('deleted_at', null)
      .gte('date', toISO(today))
      .lte('date', toISO(end))
      .order('date')
      .then(({ data }) => setEvents(data ?? []))
  }, [])

  return (
    <div className="rounded-card bg-white border border-[#e0e8ec] overflow-hidden">
      <p className="text-[10px] text-[#8aaabb] tracking-widest uppercase px-4 pt-3 pb-1">
        Najbližšie akcie — 7 dní
      </p>

      {events.length === 0 ? (
        <p className="px-4 pb-3 text-sm text-[#8aaabb] italic">
          Žiadne akcie v najbližších 7 dňoch
        </p>
      ) : (
        <ul className="divide-y divide-[#eef3f6]">
          {events.map(e => {
            const color = STRIPE[e.hall] ?? '#4cbfb3'
            const title = `${EVENT_LABEL[e.event_type] ?? e.event_type ?? ''} – ${e.customer_name ?? ''}`
            return (
              <li key={e.id} className="relative px-4 py-2.5 pl-5">
                <div className="absolute left-0 inset-y-0 w-1" style={{ background: color }} />
                <p className="text-[14px] font-semibold text-[#1a2830]">{title}</p>
                <div className="flex gap-3 mt-1 items-center">
                  <span className="flex items-center gap-1 text-xs text-[#6a8898]">
                    <IconCalendar size={13} />
                    {formatDateSk(e.date)}
                  </span>
                  <span className="text-xs font-bold" style={{ color }}>
                    {HALL_LABEL[e.hall] ?? e.hall}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
