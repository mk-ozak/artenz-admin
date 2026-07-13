import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconCoins } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { formatDateSkYear } from '../../utils/format'
import { EVENT_LABEL } from '../../lib/eventTypes'

// Sekcia „Prijaté zálohy" – 10 naposledy prijatých platieb záloh
// (z deposit_payments naprieč rezerváciami). Vizuál ako „Očakávané zálohy",
// navyše dátum prijatia platby.
export default function ReceivedDeposits() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])

  useEffect(() => {
    supabase
      .from('bookings')
      .select('id, date, hall, customer_name, event_type, deposit_payments')
      .is('deleted_at', null)
      .neq('deposit_payments', '[]')
      .then(({ data, error }) => {
        if (error) console.error('[ReceivedDeposits] fetch error:', error.message)
        // Každá platba = jeden riadok; zoradené od najnovšie prijatej
        const payments = (data ?? []).flatMap(b =>
          (Array.isArray(b.deposit_payments) ? b.deposit_payments : []).map((p, i) => ({
            key:      `${b.id}-${i}`,
            booking:  b,
            paidDate: p.date,
            amount:   Number(p.amount || 0),
          }))
        )
        payments.sort((a, b) => (a.paidDate < b.paidDate ? 1 : a.paidDate > b.paidDate ? -1 : 0))
        setRows(payments.slice(0, 10))
      })
  }, [])

  if (rows.length === 0) return null

  return (
    <div className="rounded-card border border-gray-200 bg-gray-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
        <IconCoins size={16} className="text-gray-500" />
        <h3 className="text-sm font-bold text-gray-600">Prijaté zálohy</h3>
      </div>

      <ul className="divide-y divide-gray-100">
        {rows.map(r => (
          <li key={r.key}
              onClick={() => navigate(`/booking/${r.booking.id}`)}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-100 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700 truncate">
                {r.booking.customer_name}
                <span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-gray-400">
                  {EVENT_LABEL[r.booking.event_type] ?? r.booking.event_type ?? 'Akcia'}
                </span>
              </p>
              <p className="text-xs text-gray-400">
                {formatDateSkYear(r.booking.date)} · {r.booking.hall.replace('_', ' ')}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-gray-700">{r.amount} €</p>
              <p className="text-xs text-gray-400">prijaté {formatDateSkYear(r.paidDate)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
