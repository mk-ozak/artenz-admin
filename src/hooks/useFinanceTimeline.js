import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { toISO } from '../utils/diaryWeeks'

// Farba podľa sály — zhodné s „Najbližšie akcie" a diárom
export const HALL_COLOR = {
  ARTENZ_PLUS: '#4cbfb3',
  ARTENZ:      '#d4a036',
  LUNA:        '#b55db8',
  CATERING:    '#7aaaca',
}

const MONTHS_NOM = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún',
                    'Júl', 'August', 'September', 'Október', 'November', 'December']

// Očakávaná tržba akcie = očakávaní hostia × cena na osobu.
// Vracia budúce akcie (od dnešného dňa) zoskupené po dňoch a mesiacoch,
// s dennými a mesačnými súčtami a s maximom dňa (na škálovanie grafu).
export function useFinanceTimeline() {
  const [months, setMonths]         = useState([])
  const [maxDayTotal, setMaxDay]    = useState(0)
  const [grandTotal, setGrandTotal] = useState(0)
  const [missingCount, setMissing]  = useState(0)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    supabase
      .from('bookings')
      .select('id, date, hall, event_type, expected_guests, estimated_price, start_time')
      .is('deleted_at', null)
      .gte('date', toISO(new Date()))
      .order('date')
      .order('start_time', { ascending: true, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) console.error('[useFinanceTimeline] fetch error:', error.message)

        // Booking → udalosť s vypočítanou tržbou
        const events = (data ?? []).map(b => {
          const guests  = Number(b.expected_guests) || 0
          const price   = Number(b.estimated_price) || 0
          const revenue = guests * price
          return {
            id: b.id,
            date: b.date,
            hall: b.hall,
            color: HALL_COLOR[b.hall] ?? '#4cbfb3',
            guests,
            price,
            revenue,
            missing:       revenue === 0,   // niečo nevyplnené → tržba je nula
            missingGuests: guests === 0,
            missingPrice:  price === 0,
          }
        })

        // Zoskupenie po dňoch (Map zachová poradie z dopytu = podľa dátumu a času)
        const byDay = new Map()
        for (const ev of events) {
          if (!byDay.has(ev.date)) byDay.set(ev.date, [])
          byDay.get(ev.date).push(ev)
        }
        const days = [...byDay.entries()].map(([date, evs]) => ({
          date,
          // vyplnené najprv, nulové (červené) na koniec riadku
          events: [...evs].sort((a, b) => (a.missing === b.missing ? 0 : a.missing ? 1 : -1)),
          total: evs.reduce((s, e) => s + e.revenue, 0),
        }))

        // Zoskupenie po mesiacoch — len mesiace, ktoré majú akcie
        const byMonth = new Map()
        for (const d of days) {
          const key = d.date.slice(0, 7)   // YYYY-MM
          if (!byMonth.has(key)) byMonth.set(key, [])
          byMonth.get(key).push(d)
        }
        const monthList = [...byMonth.entries()].map(([key, ds]) => {
          const m = Number(key.slice(5, 7)) - 1
          return {
            key,
            label: `${MONTHS_NOM[m]} ${key.slice(0, 4)}`,
            days: ds,
            total: ds.reduce((s, d) => s + d.total, 0),
          }
        })

        setMonths(monthList)
        setMaxDay(days.reduce((mx, d) => Math.max(mx, d.total), 0))
        setGrandTotal(days.reduce((s, d) => s + d.total, 0))
        setMissing(events.filter(e => e.missing).length)
        setLoading(false)
      })
  }, [])

  return { months, maxDayTotal, grandTotal, missingCount, loading }
}
