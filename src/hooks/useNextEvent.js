import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useNextEvent() {
  const [data, setData] = useState(undefined)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('bookings')
      .select('id, date, hall, customer_name, event_type')
      .is('deleted_at', null)
      .gte('date', today)
      .order('date')
      .limit(1)
      .then(({ data }) => setData(data?.[0] ?? null))
  }, [])

  return { data }
}
