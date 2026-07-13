import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconCalendar, IconMessage, IconPhone } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { formatDateSk, formatDateSkYear } from '../../utils/format'
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

// Predvyplnený text SMS (?body= funguje na Androide aj novšom iOS)
function smsHref(phone, typeLabel, date, hallLabel) {
  const text = `Dobrý deň, kontaktujeme Vás ohľadom Vašej rezervácie v ${hallLabel} (${typeLabel}, ${formatDateSkYear(date)}). `
  return `sms:${phone}?body=${encodeURIComponent(text)}`
}

// Všetky akcie na najbližších 14 dní (vrátane dneška),
// zoradené podľa dátumu a v rámci dňa podľa času (bez času na konci dňa)
export default function UpcomingEvents() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])

  useEffect(() => {
    const today = new Date()
    const end   = new Date(today)
    end.setDate(today.getDate() + 13)
    supabase
      .from('bookings')
      .select('id, date, hall, customer_name, event_type, customer_phone, start_time')
      .is('deleted_at', null)
      .gte('date', toISO(today))
      .lte('date', toISO(end))
      .order('date')
      .order('start_time', { ascending: true, nullsFirst: false })
      .then(({ data }) => setEvents(data ?? []))
  }, [])

  return (
    <div className="rounded-card bg-white border border-[#e0e8ec] overflow-hidden">
      <p className="text-[10px] text-[#8aaabb] tracking-widest uppercase px-4 pt-3 pb-1">
        Najbližšie akcie — 14 dní
      </p>

      {events.length === 0 ? (
        <p className="px-4 pb-3 text-sm text-[#8aaabb] italic">
          Žiadne akcie v najbližších 14 dňoch
        </p>
      ) : (
        <ul className="divide-y divide-[#eef3f6]">
          {events.map(e => {
            const color     = STRIPE[e.hall] ?? '#4cbfb3'
            const typeLabel = EVENT_LABEL[e.event_type] ?? e.event_type ?? ''
            const phone     = e.customer_phone?.replace(/\s+/g, '')
            return (
              <li key={e.id}
                  onClick={() => navigate(`/booking/${e.id}`)}
                  className="relative px-4 py-2.5 pl-5 cursor-pointer hover:bg-[#f6f9fb] transition-colors
                             flex items-center gap-3">
                <div className="absolute left-0 inset-y-0 w-1" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1a2830] truncate">
                    {e.customer_name}
                    <span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-[#9ab0ba]">
                      {typeLabel}
                    </span>
                  </p>
                  <div className="flex gap-3 mt-1 items-center">
                    <span className="flex items-center gap-1 text-xs text-[#6a8898]">
                      <IconCalendar size={13} />
                      {formatDateSk(e.date)}
                      {e.start_time && ` · ${e.start_time.slice(0, 5)}`}
                    </span>
                    <span className="text-xs font-bold" style={{ color }}>
                      {HALL_LABEL[e.hall] ?? e.hall}
                    </span>
                  </div>
                </div>
                {phone && (
                  <div className="flex gap-2 shrink-0">
                    <a
                      href={`tel:${phone}`}
                      onClick={ev => ev.stopPropagation()}
                      title={`Zavolať ${e.customer_phone}`}
                      aria-label="Zavolať"
                      className="w-9 h-9 rounded-lg border border-[#d5e2e9] bg-white flex items-center
                                 justify-center text-[#3a5160] hover:bg-[#eaf4f2] hover:text-[#2a8d83]
                                 transition-colors"
                    >
                      <IconPhone size={16} />
                    </a>
                    <a
                      href={smsHref(phone, typeLabel, e.date, HALL_LABEL[e.hall] ?? e.hall)}
                      onClick={ev => ev.stopPropagation()}
                      title={`SMS na ${e.customer_phone}`}
                      aria-label="Poslať SMS"
                      className="w-9 h-9 rounded-lg border border-[#d5e2e9] bg-white flex items-center
                                 justify-center text-[#3a5160] hover:bg-[#eef2fa] hover:text-[#4a6bb8]
                                 transition-colors"
                    >
                      <IconMessage size={16} />
                    </a>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
