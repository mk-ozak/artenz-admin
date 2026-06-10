import { useEffect, useState } from 'react'
import { useBookingsStore } from '../store/bookings'

// Globálny toast – po vymazaní rezervácie zobrazí krátku správu
// s tlačidlom Späť (~7 s), ktoré obnoví soft-deleted rezerváciu.
export default function Toast() {
  const { toast, hideToast, restoreBooking } = useBookingsStore()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(hideToast, 7000)
    return () => clearTimeout(t)
  }, [toast, hideToast])

  if (!toast) return null

  async function handleUndo() {
    if (!toast.bookingId) return
    setBusy(true)
    await restoreBooking(toast.bookingId)
    setBusy(false)
    hideToast()
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3
                    rounded-lg shadow-2xl px-4 py-3 text-sm text-white"
         style={{ background: '#354d5d' }}>
      <span className="font-medium">{toast.message}</span>
      {toast.bookingId && (
        <button
          onClick={handleUndo}
          disabled={busy}
          className="font-bold px-3 py-1 rounded-md transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: '#4cbfb3', color: '#0a2d2a' }}
        >
          {busy ? 'Obnovujem…' : 'Späť'}
        </button>
      )}
    </div>
  )
}
