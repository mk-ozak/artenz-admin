import { useEffect, useState } from 'react'
import { IconCalendar, IconClock, IconLogout, IconUsers } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import { formatDateSk } from '../utils/format'
import { EVENT_LABEL } from '../lib/eventTypes'

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

const STATUS_LABEL = {
  dopyt:     'Nezáväzný dopyt',
  zaloha:    'Čakajúca záloha',
  potvrdene: 'Potvrdené',
}

const STATUS_STYLE = {
  dopyt:     { background: '#f0f2f4', color: '#5a7a8c' },
  zaloha:    { background: '#fff5e6', color: '#a87d20' },
  potvrdene: { background: '#eaf7f0', color: '#2a8d83' },
}

// Zákaznícky pohľad – len na čítanie, RLS vráti iba jeho rezerváciu.
export default function MyBooking() {
  const { fullName, signOut } = useAuthStore()
  const [booking, setBooking] = useState(undefined)

  useEffect(() => {
    supabase
      .from('bookings')
      .select('*')
      .is('deleted_at', null)
      .order('date')
      .limit(1)
      .then(({ data, error }) => {
        if (error) { console.error('[MyBooking] fetch error:', error.message); setBooking(null); return }
        setBooking(data?.[0] ?? null)
      })
  }, [])

  const color = booking ? (HALL_COLOR[booking.hall] ?? '#4cbfb3') : '#4cbfb3'

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Hlavička */}
      <header className="px-5 pt-3 pb-4" style={{ background: '#354d5d' }}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] tracking-[.16em] uppercase"
               style={{ color: 'rgba(255,255,255,.4)' }}>ARTENZ</p>
            <p className="text-[22px] font-bold leading-tight" style={{ color: '#ddeef6' }}>
              Moja rezervácia
            </p>
            {fullName?.trim() && (
              <p className="text-[13px] mt-1" style={{ color: '#8aaabb' }}>
                Dobrý deň vážený zákazník{' '}
                <span className="font-semibold" style={{ color: '#b0ccd8' }}>{fullName.trim()}</span>
              </p>
            )}
          </div>
          <button
            onClick={signOut}
            title="Odhlásiť sa"
            aria-label="Odhlásiť sa"
            className="w-10 h-10 rounded-full flex items-center justify-center
                       transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,.1)' }}
          >
            <IconLogout size={19} style={{ color: '#7a9aac' }} />
          </button>
        </div>
      </header>

      <div className="w-full max-w-2xl mx-auto flex-1 px-4 py-4">
        {booking === undefined && (
          <p className="text-sm text-[#8aaabb] italic">Načítavam…</p>
        )}
        {booking === null && (
          <p className="text-sm text-[#8aaabb]">
            Nenašla sa žiadna rezervácia. Kontaktujte prosím Artenz.
          </p>
        )}

        {booking && (
          <div className="relative rounded-card bg-white border border-[#e0e8ec] px-5 py-4 pl-6 overflow-hidden">
            <div className="absolute left-0 inset-y-0 w-1.5" style={{ background: color }} />

            <div className="flex items-start justify-between gap-3">
              <p className="text-[18px] font-semibold text-[#1a2830]">
                {(EVENT_LABEL[booking.event_type] ?? booking.event_type ?? 'Akcia')} – {booking.customer_name}
              </p>
              <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={STATUS_STYLE[booking.status ?? 'dopyt']}>
                {STATUS_LABEL[booking.status ?? 'dopyt']}
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-sm text-[#3a5160]">
              <p className="flex items-center gap-2">
                <IconCalendar size={16} className="text-[#8aaabb]" />
                {formatDateSk(booking.date)}
                {booking.start_time && (
                  <>
                    <IconClock size={16} className="text-[#8aaabb] ml-2" />
                    {booking.start_time.slice(0, 5)}
                  </>
                )}
              </p>
              <p>
                <span className="text-xs font-bold" style={{ color }}>
                  {HALL_LABEL[booking.hall] ?? booking.hall}
                </span>
              </p>
              {booking.expected_guests > 0 && (
                <p className="flex items-center gap-2">
                  <IconUsers size={16} className="text-[#8aaabb]" />
                  Očakávaný počet osôb: <span className="font-semibold">{booking.expected_guests}</span>
                </p>
              )}
              {booking.estimated_price > 0 && (
                <p>
                  Predbežná cena:{' '}
                  <span className="font-semibold">{Number(booking.estimated_price)} €</span>
                </p>
              )}
              {booking.deposit_amount != null && Number(booking.deposit_amount) > 0 && (
                <p>
                  Záloha: <span className="font-semibold">{Number(booking.deposit_amount)} €</span>
                  {' '}
                  <span className={booking.deposit_paid ? 'text-[#2a8d83]' : 'text-[#a87d20]'}>
                    ({booking.deposit_paid ? 'zaplatená' : 'čaká sa na úhradu'})
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
