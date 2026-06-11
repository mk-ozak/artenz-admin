import { useEffect, useRef, useState } from 'react'
import { IconTrash } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { useBookingsStore } from '../../store/bookings'
import { useAuthStore } from '../../store/auth'
import { formatDateSk } from '../../utils/format'
import { EVENT_LABEL } from '../../lib/eventTypes'

// Sekcia „Posledné vymazané" – posledných 10 soft-deleted rezervácií.
// Obnoviť nastaví deleted_at = null → rezervácia sa vráti do diára.
// Kôš maže natrvalo (druhý klik potvrdí).
export default function DeletedBookings() {
  const restoreBooking = useBookingsStore(s => s.restoreBooking)
  const isAdmin = useAuthStore(s => s.role) === 'admin'
  const [rows, setRows] = useState([])
  const [busyId, setBusyId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const confirmTimer = useRef(null)

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
    return () => clearTimeout(confirmTimer.current)
  }, [])

  async function handleRestore(id) {
    setBusyId(id)
    const err = await restoreBooking(id)
    setBusyId(null)
    if (!err) setRows(rs => rs.filter(r => r.id !== id))
  }

  // Prvý klik = vyžiada potvrdenie (na ~4 s), druhý klik = natrvalo vymaže riadok z DB.
  async function handlePermanentDelete(id) {
    if (confirmId !== id) {
      setConfirmId(id)
      clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirmId(null), 4000)
      return
    }
    clearTimeout(confirmTimer.current)
    setConfirmId(null)
    setBusyId(id)
    const { error } = await supabase.from('bookings').delete().eq('id', id)
    setBusyId(null)
    if (error) { console.error('[DeletedBookings] delete error:', error.message); return }
    setRows(rs => rs.filter(r => r.id !== id))
  }

  if (rows.length === 0) return null

  return (
    <div className="rounded-card border border-red-200 bg-red-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-red-200 flex items-center gap-2">
        <IconTrash size={16} className="text-red-600" />
        <h3 className="text-sm font-bold text-red-700">Posledné vymazané</h3>
      </div>

      <ul className="divide-y divide-red-100">
        {rows.map(r => (
          <li key={r.id} className="flex items-center gap-2 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800 truncate">
                {r.customer_name}
                <span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-gray-400">
                  {EVENT_LABEL[r.event_type] ?? r.event_type ?? 'Akcia'}
                </span>
              </p>
              <p className="text-xs text-red-500">
                {formatDateSk(r.date)} · {r.hall.replace('_', ' ')}
              </p>
            </div>
            {isAdmin && (
            <>
            <button
              onClick={() => handleRestore(r.id)}
              disabled={busyId === r.id}
              className="shrink-0 px-3 py-1.5 rounded-md text-xs font-bold border border-red-300
                         text-red-700 bg-white hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {busyId === r.id ? 'Obnovujem…' : 'Obnoviť'}
            </button>
            <button
              onClick={() => handlePermanentDelete(r.id)}
              disabled={busyId === r.id}
              title="Vymazať natrvalo"
              aria-label="Vymazať natrvalo"
              className={`shrink-0 px-2.5 py-1.5 rounded-md text-xs font-bold border
                          transition-colors disabled:opacity-50 flex items-center gap-1
                          ${confirmId === r.id
                            ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                            : 'border-red-300 text-red-700 bg-white hover:bg-red-100'}`}
            >
              <IconTrash size={14} />
              {confirmId === r.id && 'Naozaj?'}
            </button>
            </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
