import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconCalendar, IconPhone } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { formatDateSk } from '../utils/format'
import { EVENT_TYPES, EVENT_LABEL } from '../lib/eventTypes'
import { useBookingsStore } from '../store/bookings'
import BottomNav from '../components/layout/BottomNav'

const HALL_COLOR = {
  ARTENZ_PLUS: '#4cbfb3',
  ARTENZ:      '#d4a036',
  LUNA:        '#b55db8',
  CATERING:    '#7aaaca',
}

const HALL_LABEL = {
  ARTENZ_PLUS: 'ARTENZ PLUS',
  ARTENZ:      'ARTENZ',
  LUNA:        'LUNA',
  CATERING:    'CATERING',
}

const HALL_VENUE = {
  ARTENZ_PLUS: 'artenzPlus',
  ARTENZ:      'artenz',
  LUNA:        'luna',
  CATERING:    'catering',
}

const STATUSES = [
  { value: 'dopyt',     label: 'Nezáväzný dopyt' },
  { value: 'zaloha',    label: 'Čakajúca záloha' },
  { value: 'potvrdene', label: 'Potvrdené' },
]

const STATUS_STYLE = {
  dopyt:     { background: '#f0f2f4', color: '#5a7a8c' },
  zaloha:    { background: '#fff5e6', color: '#a87d20' },
  potvrdene: { background: '#eaf7f0', color: '#2a8d83' },
}

// Čas rezervácie: 09–19 h, minúty po 15 (ako v BookingModal)
const HOURS   = Array.from({ length: 11 }, (_, i) => String(i + 9).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

const inputCls = `w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`

// Detail rezervácie – dizajn ako dashboard. Upravujú sa tu základné polia
// (ako v modáli) aj detaily (počet hostí, záloha, poznámky).
export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { updateBooking, showToast } = useBookingsStore()

  const [booking, setBooking] = useState(undefined) // undefined = načítava, null = nenašlo sa
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) { console.error('[BookingDetail] fetch error:', error.message); setBooking(null); return }
        setBooking(data)
        setForm({
          customerName: data.customer_name,
          phone:        data.customer_phone ?? '',
          date:         data.date,
          venue:        HALL_VENUE[data.hall] ?? data.hall.toLowerCase(),
          time:         data.start_time ? data.start_time.slice(0, 5) : '',
          type:         data.event_type ?? 'oslava',
          status:       data.status ?? 'dopyt',
          guestCount:   data.guest_count ?? '',
          deposit:      data.deposit_amount != null ? Number(data.deposit_amount) : '',
          depositPaid:  data.deposit_paid ?? false,
          notes:        data.notes ?? '',
        })
      })
  }, [id])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const timeHH = form?.time ? form.time.slice(0, 2) : ''
  const timeMM = form?.time ? form.time.slice(3, 5) : '00'

  async function handleSave() {
    if (!form.customerName?.trim()) { setError('Meno zákazníka je povinné.'); return }
    setSaving(true)
    setError('')
    const err = await updateBooking(id, form, booking.google_calendar_event_id)
    setSaving(false)
    if (err) { setError(err); return }
    showToast({ message: 'Rezervácia uložená' })
  }

  const color = booking ? (HALL_COLOR[booking.hall] ?? '#4cbfb3') : '#4cbfb3'
  const title = form
    ? `${EVENT_LABEL[form.type] ?? form.type ?? 'Akcia'} – ${form.customerName}`
    : ''

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Hlavička */}
      <header className="px-4 py-4 flex items-center gap-3" style={{ background: '#354d5d' }}>
        <button
          onClick={() => navigate(-1)}
          aria-label="Späť"
          className="w-9 h-9 rounded flex items-center justify-center transition-opacity
                     opacity-70 hover:opacity-100"
          style={{ color: '#ddeef6' }}
        >
          <IconArrowLeft size={22} stroke={2} />
        </button>
        <p className="text-[16px] font-bold" style={{ color: '#ddeef6' }}>Detail rezervácie</p>
      </header>

      <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col gap-3 px-4 py-4">
        {booking === undefined && (
          <p className="text-sm text-[#8aaabb] italic">Načítavam…</p>
        )}
        {booking === null && (
          <p className="text-sm text-red-600">Rezervácia sa nenašla.</p>
        )}

        {booking && form && (
          <>
            {/* Zhrnutie */}
            <div className="relative rounded-card bg-white border border-[#e0e8ec] px-4 py-3 pl-5 overflow-hidden">
              <div className="absolute left-0 inset-y-0 w-1" style={{ background: color }} />
              <div className="flex items-start justify-between gap-3">
                <p className="text-[17px] font-semibold text-[#1a2830]">{title}</p>
                <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={STATUS_STYLE[form.status ?? 'dopyt']}>
                  {STATUSES.find(s => s.value === form.status)?.label ?? form.status}
                </span>
              </div>
              <div className="flex gap-4 mt-2 items-center flex-wrap">
                <span className="flex items-center gap-1 text-xs text-[#6a8898]">
                  <IconCalendar size={14} />
                  {formatDateSk(booking.date)}
                </span>
                <span className="text-xs font-bold" style={{ color }}>
                  {HALL_LABEL[booking.hall] ?? booking.hall}
                </span>
                {form.phone?.trim() && (
                  <a href={`tel:${form.phone.replace(/\s+/g, '')}`}
                     className="flex items-center gap-1 text-xs font-medium text-indigo-600">
                    <IconPhone size={14} />
                    {form.phone}
                  </a>
                )}
              </div>
            </div>

            {/* Rezervácia – základné údaje (ako v modáli) */}
            <div className="rounded-card bg-white border border-[#e0e8ec] overflow-hidden">
              <p className="text-[10px] text-[#8aaabb] tracking-widest uppercase px-4 pt-3 pb-1">
                Rezervácia
              </p>
              <div className="px-4 pb-4 space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Zákazník <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.customerName}
                      onChange={e => set('customerName', e.target.value)}
                      placeholder="Meno zákazníka / firmy"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Telefón</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                      placeholder="+421 905 123 456"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Čas</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={timeHH}
                      onChange={e => set('time', e.target.value === '' ? '' : `${e.target.value}:${timeMM}`)}
                      className="bg-white border border-gray-300 rounded-lg px-2 py-2 text-sm
                        font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">–</option>
                      {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-sm font-semibold text-gray-500">:</span>
                    <select
                      value={timeMM}
                      onChange={e => { if (timeHH) set('time', `${timeHH}:${e.target.value}`) }}
                      disabled={!timeHH}
                      className="bg-white border border-gray-300 rounded-lg px-2 py-2 text-sm
                        font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500
                        disabled:opacity-40"
                    >
                      {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Typ akcie</label>
                    <select
                      value={form.type}
                      onChange={e => set('type', e.target.value)}
                      className={`${inputCls} bg-white`}
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
                      className={`${inputCls} bg-white`}
                    >
                      {STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Detaily */}
            <div className="rounded-card bg-white border border-[#e0e8ec] overflow-hidden">
              <p className="text-[10px] text-[#8aaabb] tracking-widest uppercase px-4 pt-3 pb-1">
                Detaily
              </p>
              <div className="px-4 pb-4 space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Počet hostí</label>
                    <input
                      type="number"
                      value={form.guestCount}
                      onChange={e => set('guestCount', e.target.value)}
                      placeholder="0"
                      min="0"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Záloha (€)</label>
                    <input
                      type="number"
                      value={form.deposit}
                      onChange={e => set('deposit', e.target.value)}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      className={inputCls}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.depositPaid}
                    onChange={e => set('depositPaid', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Záloha zaplatená</span>
                </label>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Poznámky</label>
                  <textarea
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    placeholder="Špeciálne požiadavky, alergény, výzdoba..."
                    rows={4}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-4 py-2.5 text-sm font-bold rounded-lg
                transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: '#4cbfb3', color: '#0a2d2a' }}
            >
              {saving ? 'Ukladám…' : 'Uložiť'}
            </button>
          </>
        )}

        <div className="flex-1" />
      </div>

      <div className="xl:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
