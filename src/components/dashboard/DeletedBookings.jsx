import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useBookingsStore } from '../../store/bookings'
import { formatDateSk } from '../../utils/format'
import { EVENT_LABEL } from '../../lib/eventTypes'

// Sekcia „Posledné vymazané" – posledných 10 soft-deleted rezervácií.
// Tlačidlo Obnoviť nastaví deleted_at = null → rezervácia sa vráti do diára.
export default function DeletedBookings() {
  const restoreBooking = useBookingsStore(s => s.restoreBooking)
  const [rows, setRows] = useState([])
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    supabase
      .from('bookings')
      .select('id, date, hall, customer_name, event_type, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (error) console.error('[DeletedBookings] fetch error:', error.message)
        setRows(data ?? [])
      })
  }, [])

  async function handleRestore(id) {
    setBusyId(id)
    const err = await restoreBooking(id)
    setBusyId(null)
    if (!err) setRows(rs => rs.filter(r => r.id !== id))
  }

  if (rows.length === 0) return null

  return (
    <div className="rounded-card border border-red-200 bg-red-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-red-200 flex items-center gap-2">
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <h3 className="text-sm font-bold text-red-700">Posledné vymazané</h3>
      </div>

      <ul className="divide-y divide-red-100">
        {rows.map(r => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800 truncate">
                {(EVENT_LABEL[r.event_type] ?? r.event_type ?? 'Akcia')} – {r.customer_name}
              </p>
              <p className="text-xs text-red-500">
                {formatDateSk(r.date)} · {r.hall.replace('_', ' ')}
              </p>
            </div>
            <button
              onClick={() => handleRestore(r.id)}
              disabled={busyId === r.id}
              className="shrink-0 px-3 py-1.5 rounded-md text-xs font-bold border border-red-300
                         text-red-700 bg-white hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {busyId === r.id ? 'Obnovujem…' : 'Obnoviť'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
