import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Počet nevybavených dopytov z webu — pre odznak pri položke v menu.
export function useNewInquiriesCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    supabase
      .from('inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new')
      .then(({ count, error }) => {
        if (error) {
          console.error('[useNewInquiriesCount] fetch error:', error.message)
          return
        }
        setCount(count ?? 0)
      })
  }, [])

  return count
}
