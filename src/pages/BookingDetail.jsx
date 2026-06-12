import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconCalendar, IconCopy, IconKey, IconMessage, IconPhone } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { usersApi } from '../lib/usersApi'
import { formatDateSk } from '../utils/format'
import { EVENT_TYPES, EVENT_LABEL } from '../lib/eventTypes'
import { useBookingsStore } from '../store/bookings'
import { useAuthStore } from '../store/auth'
import { toISO } from '../utils/diaryWeeks'
import BottomNav from '../components/layout/BottomNav'
import StatusSegment from '../components/StatusSegment'
import BookingMenu from '../components/booking/BookingMenu'

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
  const isAdmin = useAuthStore(s => s.role) === 'admin'

  const [booking, setBooking] = useState(undefined) // undefined = načítava, null = nenašlo sa
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Prístup zákazníka
  const [access, setAccess]             = useState(null)  // { email, password? } po vytvorení
  const [accessBusy, setAccessBusy]     = useState(false)
  const [accessError, setAccessError]   = useState('')
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [copied, setCopied]             = useState('')    // 'link' | 'password'
  const revokeTimer = useRef(null)

  useEffect(() => {
    supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) { console.error('[BookingDetail] fetch error:', error.message); setBooking(null); return }
        setBooking(data)
        // Existujúci zákaznícky prístup → načítaj email pre opätovné zobrazenie linku
        if (data.user_id) {
          supabase
            .from('profiles')
            .select('email')
            .eq('id', data.user_id)
            .single()
            .then(({ data: prof }) => {
              if (prof?.email) setAccess({ email: prof.email })
            })
        }
        setForm({
          customerName: data.customer_name,
          phone:        data.customer_phone ?? '',
          date:         data.date,
          venue:        HALL_VENUE[data.hall] ?? data.hall.toLowerCase(),
          time:         data.start_time ? data.start_time.slice(0, 5) : '',
          type:         data.event_type ?? 'oslava',
          status:       data.status ?? 'dopyt',
          expectedGuests: data.expected_guests ?? 0,
          estimatedPrice: data.estimated_price != null ? Number(data.estimated_price) : 0,
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

  const customerLink = access?.email
    ? `${window.location.origin}/login?u=${encodeURIComponent(access.email)}`
    : ''

  async function handleCreateAccess() {
    setAccessBusy(true)
    setAccessError('')
    const { data, error } = await usersApi({ action: 'create_customer', bookingId: id })
    setAccessBusy(false)
    if (error) { setAccessError(error); return }
    setAccess({ email: data.email, password: data.password })
    setBooking(b => ({ ...b, user_id: data.userId }))
  }

  // Prvý klik = potvrdenie (~4 s), druhý = odobratie prístupu (zmazanie účtu)
  async function handleRevokeAccess() {
    if (!confirmRevoke) {
      setConfirmRevoke(true)
      clearTimeout(revokeTimer.current)
      revokeTimer.current = setTimeout(() => setConfirmRevoke(false), 4000)
      return
    }
    clearTimeout(revokeTimer.current)
    setConfirmRevoke(false)
    setAccessBusy(true)
    setAccessError('')
    const { error } = await usersApi({ action: 'revoke', userId: booking.user_id })
    setAccessBusy(false)
    if (error) { setAccessError(error); return }
    setAccess(null)
    setBooking(b => ({ ...b, user_id: null }))
  }

  // Zmena stavu sa ukladá okamžite (bez čakania na Uložiť)
  async function handleStatusChange(next) {
    set('status', next)
    const { error } = await supabase
      .from('bookings')
      .update({ status: next })
      .eq('id', id)
    if (error) { setError(error.message); return }
    showToast({ message: 'Stav uložený' })
  }

  function copyText(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  // Rezervácia v minulosti sa už nedá upravovať (ani adminom).
  // Lokálny dátum (toISO), nie UTC — inak by sa okolo polnoci posúvala hranica.
  const isPastBooking = !!booking && booking.date < toISO(new Date())
  const editable      = isAdmin && !isPastBooking

  const color     = booking ? (HALL_COLOR[booking.hall] ?? '#4cbfb3') : '#4cbfb3'
  const typeLabel = form ? (EVENT_LABEL[form.type] ?? form.type ?? 'Akcia') : ''

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
                <p className="text-[17px] font-semibold text-[#1a2830]">
                  {form.customerName}
                  <span className="ml-2 text-[12px] font-normal uppercase tracking-wider text-[#9ab0ba]">
                    {typeLabel}
                  </span>
                </p>
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
                  <span className="flex items-center gap-2 ml-auto">
                    <span className="text-xs font-medium text-[#3a5160]">{form.phone}</span>
                    <a
                      href={`tel:${form.phone.replace(/\s+/g, '')}`}
                      title={`Zavolať ${form.phone}`}
                      aria-label="Zavolať"
                      className="w-9 h-9 rounded-full border border-[#d5e2e9] bg-white flex items-center
                                 justify-center text-[#3a5160] hover:bg-[#eaf4f2] hover:text-[#2a8d83]
                                 transition-colors"
                    >
                      <IconPhone size={16} />
                    </a>
                    <a
                      href={`sms:${form.phone.replace(/\s+/g, '')}?body=${encodeURIComponent(
                        `Dobrý deň, kontaktujeme Vás ohľadom Vašej rezervácie v Artenz (${typeLabel}, ${formatDateSk(booking.date)}). `
                      )}`}
                      title={`SMS na ${form.phone}`}
                      aria-label="Poslať SMS"
                      className="w-9 h-9 rounded-full border border-[#d5e2e9] bg-white flex items-center
                                 justify-center text-[#3a5160] hover:bg-[#eef2fa] hover:text-[#4a6bb8]
                                 transition-colors"
                    >
                      <IconMessage size={16} />
                    </a>
                  </span>
                )}
              </div>
            </div>

            {isPastBooking && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
                Rezervácia sa už uskutočnila — nedá sa upravovať ani vymazať.
              </p>
            )}

            {/* read_only / minulá rezervácia: všetky polia sú len na čítanie */}
            <fieldset disabled={!editable} className="flex flex-col gap-3 min-w-0">

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

                <div className="flex gap-6">
                  <div className="shrink-0">
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
                  <div className="w-36 ml-auto">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Očakávaný počet osôb</label>
                    <input
                      type="number"
                      value={form.expectedGuests}
                      onChange={e => set('expectedGuests', e.target.value)}
                      placeholder="0"
                      min="0"
                      className={inputCls}
                    />
                  </div>
                  <div className="w-36">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Predbežná cena (€)</label>
                    <input
                      type="number"
                      value={form.estimatedPrice}
                      onChange={e => set('estimatedPrice', e.target.value)}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
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
                    <StatusSegment
                      value={form.status}
                      onChange={handleStatusChange}
                      customerName={form.customerName}
                      phone={form.phone}
                      typeLabel={typeLabel}
                      dateISO={booking.date}
                      amount={Number(form.deposit) > 0 ? Number(form.deposit) : (Number(form.estimatedPrice) || 0)}
                    />
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
            </fieldset>

            {/* Menu — jedálny lístok rezervácie; zmeny sa ukladajú okamžite */}
            <BookingMenu
              bookingId={id}
              editable={editable}
              printSubtitle={`${form.customerName} — ${typeLabel}, ${formatDateSk(booking.date)}`}
            />

            {/* Prístup zákazníka – len admin */}
            {isAdmin && (
            <div className="rounded-card bg-white border border-[#e0e8ec] overflow-hidden">
              <p className="text-[10px] text-[#8aaabb] tracking-widest uppercase px-4 pt-3 pb-1">
                Prístup zákazníka
              </p>
              <div className="px-4 pb-4 space-y-3">
                {!booking.user_id ? (
                  <>
                    <p className="text-sm text-gray-500">
                      Zákazník zatiaľ nemá prístup k detailu tejto rezervácie.
                    </p>
                    <button
                      onClick={handleCreateAccess}
                      disabled={accessBusy}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold
                                 transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ background: '#4cbfb3', color: '#0a2d2a' }}
                    >
                      <IconKey size={16} />
                      {accessBusy ? 'Vytváram…' : 'Vytvoriť prístup pre zákazníka'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-700">
                      Zákazník má prístup k detailu tejto rezervácie.
                    </p>

                    {/* Link */}
                    {customerLink && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg
                                        px-3 py-2 text-xs text-gray-700 truncate">
                          {customerLink}
                        </div>
                        <button
                          onClick={() => copyText(customerLink, 'link')}
                          className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold border border-gray-300
                                     text-gray-700 bg-white hover:bg-gray-50 transition-colors
                                     flex items-center gap-1"
                        >
                          <IconCopy size={14} />
                          {copied === 'link' ? 'Skopírované ✓' : 'Kopírovať link'}
                        </button>
                      </div>
                    )}

                    {/* Heslo – zobrazí sa len hneď po vytvorení */}
                    {access?.password ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 bg-amber-50 border border-amber-200 rounded-lg
                                        px-3 py-2 text-sm font-mono font-bold tracking-widest text-amber-800">
                          {access.password}
                        </div>
                        <button
                          onClick={() => copyText(access.password, 'password')}
                          className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold border border-gray-300
                                     text-gray-700 bg-white hover:bg-gray-50 transition-colors
                                     flex items-center gap-1"
                        >
                          <IconCopy size={14} />
                          {copied === 'password' ? 'Skopírované ✓' : 'Kopírovať heslo'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">
                        Heslo bolo zobrazené pri vytvorení prístupu. Ak sa stratilo,
                        odoberte prístup a vytvorte ho nanovo.
                      </p>
                    )}
                    {access?.password && (
                      <p className="text-xs text-amber-600">
                        Heslo si ulož — po opustení stránky sa už nezobrazí.
                        Link a heslo pošli zákazníkovi napr. cez SMS.
                      </p>
                    )}

                    <button
                      onClick={handleRevokeAccess}
                      disabled={accessBusy}
                      className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors
                                  disabled:opacity-50
                                  ${confirmRevoke
                                    ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                                    : 'border-red-300 text-red-600 bg-white hover:bg-red-50'}`}
                    >
                      {accessBusy ? 'Odoberám…' : confirmRevoke ? 'Naozaj odobrať prístup?' : 'Odobrať prístup'}
                    </button>
                  </>
                )}

                {accessError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                    {accessError}
                  </p>
                )}
              </div>
            </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            {editable && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-4 py-2.5 text-sm font-bold rounded-lg
                transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: '#4cbfb3', color: '#0a2d2a' }}
            >
              {saving ? 'Ukladám…' : 'Uložiť'}
            </button>
            )}
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
