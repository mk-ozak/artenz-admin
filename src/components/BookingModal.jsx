import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBookingsStore } from '../store/bookings'
import { EVENT_TYPES, DEFAULT_EVENT_TYPE } from '../lib/eventTypes'

// Čas rezervácie: 09–19 h, minúty po 15
const HOURS   = Array.from({ length: 11 }, (_, i) => String(i + 9).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

const VENUES = [
  { key: 'artenzPlus', label: 'ARTENZ PLUS' },
  { key: 'artenz',     label: 'ARTENZ' },
  { key: 'luna',       label: 'LUNA' },
  { key: 'catering',   label: 'CATERING' },
]

const STATUSES = [
  { value: 'dopyt',     label: 'Nezáväzný dopyt' },
  { value: 'zaloha',    label: 'Čakajúca záloha' },
  { value: 'potvrdene', label: 'Potvrdené' },
]

const EMPTY = {
  customerName: '',
  phone: '',
  time: '',
  type: DEFAULT_EVENT_TYPE,
  status: 'dopyt',
  // Polia editovateľné v Detaile rezervácie — vo formulári sa nezobrazujú,
  // ale držíme ich v stave, aby sa pri uložení neprepísali.
  guestCount: '',
  deposit: '',
  depositPaid: false,
  notes: '',
}

export default function BookingModal() {
  const navigate = useNavigate()
  const { modalState, closeModal, addBooking, updateBooking, deleteBooking, showToast } = useBookingsStore()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    if (!modalState) return
    console.log('[BookingModal] opened, mode:', modalState.mode, modalState)
    setError('')
    setSaving(false)
    setConfirmDelete(false)
    setConfirmText('')
    if (modalState.mode === 'add') {
      setForm({
        ...EMPTY,
        date:  modalState.date,
        venue: modalState.venue,
        // V sále CATERING je predvolený typ akcie Catering
        type:  modalState.venue === 'catering' ? 'catering' : EMPTY.type,
      })
    } else {
      const b = modalState.booking
      setForm({
        customerName: b.customerName,
        date:         b.date,
        venue:        b.venue,
        time:         b.time ?? '',
        type:         b.type ?? DEFAULT_EVENT_TYPE,
        status:       b.status ?? 'dopyt',
        guestCount:   b.guestCount || '',
        deposit:      b.deposit || '',
        depositPaid:  b.depositPaid ?? false,
        notes:        b.notes ?? '',
        phone:        b.phone ?? '',
      })
    }
  }, [modalState])

  if (!modalState) return null

  const isEdit     = modalState.mode === 'edit'
  const venueName  = VENUES.find(v => v.key === form.venue)?.label ?? form.venue
  const typeLabel  = EVENT_TYPES.find(t => t.value === form.type)?.label ?? form.type
  const eventTitle = `${typeLabel} – ${form.customerName}`
  const canDelete  =
    confirmText.trim() !== '' &&
    confirmText.trim().toLowerCase() === (form.customerName ?? '').trim().toLowerCase()

  async function handleDelete() {
    setDeleting(true)
    setError('')
    const err = await deleteBooking(modalState.booking.id, modalState.booking.googleEventId)
    setDeleting(false)
    if (err) { setError(err); setConfirmDelete(false); return }
    showToast({ message: 'Rezervácia vymazaná', bookingId: modalState.booking.id })
    closeModal()
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // Čas: "HH:MM" alebo '' (nepovinný); minúty po 15
  const timeHH = form.time ? form.time.slice(0, 2) : ''
  const timeMM = form.time ? form.time.slice(3, 5) : '00'

  function setHour(h) {
    set('time', h === '' ? '' : `${h}:${timeMM}`)
  }
  function setMinute(m) {
    if (timeHH) set('time', `${timeHH}:${m}`)
  }

  // Zmena sály pri pridávaní: drží pravidlo „CATERING → predvolený typ Catering"
  function setVenue(venue) {
    setForm(f => ({
      ...f,
      venue,
      type: venue === 'catering' && f.type === DEFAULT_EVENT_TYPE
        ? 'catering'
        : venue !== 'catering' && f.type === 'catering'
          ? DEFAULT_EVENT_TYPE
          : f.type,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.customerName?.trim()) { setError('Meno zákazníka je povinné.'); return }
    if (!form.date)  { setError('Dátum je povinný.'); return }
    if (!form.venue) { setError('Sála je povinná.'); return }
    if (!isEdit && form.date < new Date().toISOString().split('T')[0]) {
      setError('Dátum nemôže byť v minulosti.'); return
    }
    setSaving(true)
    setError('')
    console.log('[BookingModal] submitting form:', form)
    const err = isEdit
      ? await updateBooking(modalState.booking.id, form, modalState.booking.googleEventId)
      : await addBooking(form)
    setSaving(false)
    if (err) {
      console.error('[BookingModal] submit error:', err)
      setError(err)
    } else {
      console.log('[BookingModal] submit success')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ background: '#354d5d' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#ddeef6' }}>
            {isEdit ? 'Editovať rezerváciu' : 'Nová rezervácia'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Context chips: Čas | Dátum | Sála */}
          <div className="flex gap-3">
            <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Čas</p>
              <div className="flex items-center gap-1 mt-0.5">
                <select
                  value={timeHH}
                  onChange={e => setHour(e.target.value)}
                  className="bg-white border border-gray-200 rounded px-1 py-0.5 text-sm
                    font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">–</option>
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-sm font-semibold text-gray-500">:</span>
                <select
                  value={timeMM}
                  onChange={e => setMinute(e.target.value)}
                  disabled={!timeHH}
                  className="bg-white border border-gray-200 rounded px-1 py-0.5 text-sm
                    font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500
                    disabled:opacity-40"
                >
                  {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Dátum</p>
              {isEdit ? (
                <p className="font-semibold text-gray-800 text-sm mt-0.5">{form.date}</p>
              ) : (
                <input
                  type="date"
                  value={form.date ?? ''}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => set('date', e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded px-1 py-0.5 mt-0.5
                    text-sm font-semibold text-gray-800
                    focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>
            <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Sála</p>
              {isEdit ? (
                <p className="font-semibold text-gray-800 text-sm mt-0.5">{venueName}</p>
              ) : (
                <select
                  value={form.venue ?? ''}
                  onChange={e => setVenue(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded px-1 py-0.5 mt-0.5
                    text-sm font-semibold text-gray-800
                    focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="" disabled>–</option>
                  {VENUES.map(v => (
                    <option key={v.key} value={v.key}>{v.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Customer + phone */}
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Zákazník <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={form.customerName}
                onChange={e => set('customerName', e.target.value)}
                placeholder="Meno zákazníka / firmy"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-gray-700">Telefón</label>
                {form.phone?.trim() && (
                  <a
                    href={`tel:${form.phone.replace(/\s+/g, '')}`}
                    className="md:hidden text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Zavolať
                  </a>
                )}
              </div>
              <input
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+421 905 123 456"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Event type + status */}
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Typ akcie</label>
              <select
                value={form.type}
                onChange={e => set('type', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {EVENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Stav rezervácie</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            {isEdit && (
              <button
                type="button"
                onClick={() => { closeModal(); navigate(`/booking/${modalState.booking.id}`) }}
                className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 text-sm
                  font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Detaily rezervácie
              </button>
            )}
            {isEdit && (
              <button
                type="button"
                disabled={deleting || saving}
                onClick={() => { setConfirmText(''); setConfirmDelete(true) }}
                className="w-full px-4 py-2.5 border border-red-300 text-red-600 text-sm
                  font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Vymazať rezerváciu
              </button>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm
                  font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Zrušiť
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-bold rounded-lg
                  transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: '#4cbfb3', color: '#0a2d2a' }}
              >
                {saving ? 'Ukladám…' : isEdit ? 'Uložiť zmeny' : 'Pridať rezerváciu'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Potvrdenie vymazania */}
      {confirmDelete && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setConfirmDelete(false) }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-red-600 px-5 py-4">
              <h2 className="text-white font-semibold text-sm">Vymazať rezerváciu?</h2>
            </div>

            <div className="p-5 space-y-4">
              {/* Zhrnutie rezervácie */}
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-1.5">
                <p className="font-semibold text-gray-900 text-sm">{eventTitle}</p>
                <dl className="text-xs text-gray-600 space-y-0.5">
                  <div className="flex gap-2">
                    <dt className="text-gray-400 w-14 shrink-0">Dátum</dt>
                    <dd className="font-medium text-gray-700">{form.date}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-gray-400 w-14 shrink-0">Sála</dt>
                    <dd className="font-medium text-gray-700">{venueName}</dd>
                  </div>
                  {form.phone?.trim() && (
                    <div className="flex gap-2">
                      <dt className="text-gray-400 w-14 shrink-0">Telefón</dt>
                      <dd className="font-medium text-gray-700">
                        <a
                          href={`tel:${form.phone.replace(/\s+/g, '')}`}
                          className="text-indigo-600 underline md:text-gray-700 md:no-underline md:pointer-events-none"
                        >
                          {form.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Pre potvrdenie prepíš meno zákazníka:{' '}
                  <span className="font-semibold text-gray-900">{form.customerName}</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="Meno zákazníka"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm
                    font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Späť
                </button>
                <button
                  type="button"
                  disabled={!canDelete || deleting}
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium
                    rounded-lg hover:bg-red-700 transition-colors
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Mažem…' : 'Vymazať'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
