import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Maps DB hall values (ARTENZ_PLUS) to stat keys (ap)
const HALL_KEY = {
  ARTENZ_PLUS: 'ap',
  ARTENZ:      'a',
  LUNA:        'luna',
  CATERING:    'cat',
}

export function useStatsThisMonth() {
  const [data, setData] = useState(undefined)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    const start = today.slice(0, 7) + '-01'
    const end   = today.slice(0, 7) + '-31'

    supabase
      .from('bookings')
      .select('hall')
      .is('deleted_at', null)
      .gte('date', start)
      .lte('date', end)
      .then(({ data }) => {
        const counts = { ap: 0, a: 0, luna: 0, cat: 0 }
        data?.forEach(r => {
          const k = HALL_KEY[r.hall]
          if (k) counts[k]++
        })
        setData(counts)
      })
  }, [])

  return { data }
}
