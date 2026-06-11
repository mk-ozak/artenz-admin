import { useEffect, useState } from 'react'
import { IconCoins } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { formatDateSk } from '../../utils/format'
import { EVENT_LABEL } from '../../lib/eventTypes'

// Sekcia „Očakávané zálohy" – všetky rezervácie v stave „Čakajúca záloha".
// Rovnaké rozloženie ako „Posledné vymazané", ale šedé.
export default function ExpectedDeposits() {
  const [rows, setRows] = useState([])

  useEffect(() => {
    supabase
      .from('bookings')
      .select('id, date, hall, customer_name, event_type, deposit_amount')
      .is('deleted_at', null)
      .eq('status', 'zaloha')
      .order('date')
      .then(({ data, error }) => {
        if (error) console.error('[ExpectedDeposits] fetch error:', error.message)
        setRows(data ?? [])
      })
  }, [])

  if (rows.length === 0) return null

  return (
    <div className="rounded-card border border-gray-200 bg-gray-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <IconCoins size={16} className="text-gray-500" />
        <h3 className="text-sm font-bold text-gray-600">Očakávané zálohy</h3>
      </div>

      <ul className="divide-y divide-gray-100">
        {rows.map(r => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700 truncate">
                {(EVENT_LABEL[r.event_type] ?? r.event_type ?? 'Akcia')} – {r.customer_name}
              </p>
              <p className="text-xs text-gray-400">
                {formatDateSk(r.date)} · {r.hall.replace('_', ' ')}
                {r.deposit_amount != null && ` · ${Number(r.deposit_amount)} €`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
