import { useEffect, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { useBookingsStore } from '../../store/bookings'
import { formatDateSkYear, formatTimestampSkYear } from '../../utils/format'
import { EVENT_LABEL } from '../../lib/eventTypes'

// Sekcia „Posledné pridané" – 15 naposledy vytvorených rezervácií,
// vpravo autor a dátum vzniku (ako dátum prijatia pri „Prijaté zálohy").
export default function RecentlyAdded({ refreshKey }) {
  const openEditById = useBookingsStore(s => s.openEditById)
  const [rows, setRows] = useState([])

  useEffect(() => {
    supabase
      .from('bookings')
      .select('id, date, hall, customer_name, event_type, created_at, created_by_name')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data, error }) => {
        if (error) console.error('[RecentlyAdded] fetch error:', error.message)
        setRows(data ?? [])
      })
  }, [refreshKey])

  if (rows.length === 0) return null

  return (
    <div className="rounded-card border border-[#cdebe6] bg-[#f2faf8] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#cdebe6] flex items-center gap-2">
        <IconPlus size={16} className="text-[#2a8d83]" />
        <h3 className="text-sm font-bold text-[#2a8d83]">Posledné pridané</h3>
      </div>

      <ul className="divide-y divide-[#e0f2ee]">
        {rows.map(r => (
          <li key={r.id}
              onClick={() => openEditById(r.id)}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#e9f6f3] transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1f4a45] truncate">
                {r.customer_name}
                <span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-gray-400">
                  {EVENT_LABEL[r.event_type] ?? r.event_type ?? 'Akcia'}
                </span>
              </p>
              <p className="text-xs text-[#5f9a92]">
                {formatDateSkYear(r.date)} · {r.hall.replace('_', ' ')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-[#5f9a92]">
                pridané{r.created_by_name ? ` · ${r.created_by_name}` : ''}
              </p>
              <p className="text-xs text-[#5f9a92]">{formatTimestampSkYear(r.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
