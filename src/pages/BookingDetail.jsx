import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconCalendar, IconCopy, IconKey, IconMessage, IconPencil, IconPhone } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { usersApi } from '../lib/usersApi'
import { formatDateSk } from '../utils/format'
import { EVENT_LABEL } from '../lib/eventTypes'
import { useBookingsStore } from '../store/bookings'
import { useAuthStore } from '../store/auth'
import { toISO } from '../utils/diaryWeeks'
import BottomNav from '../components/layout/BottomNav'
import BookingModal from '../components/BookingModal'
import BookingMenu from '../components/booking/BookingMenu'
import SettlementPanel from '../components/SettlementPanel'

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

// Suma v €, prázdne → pomlčka
const eur = v => (v !== '' && v != null && Number(v) > 0) ? `${Number(v)} €` : '—'

// Informačný údaj v banneri (popis + hodnota)
function Fact({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-[#9ab0ba]">{label}</span>
      <span className="text-sm font-semibold text-[#3a5160]">{value}</span>
    </div>
  )
}

// Detail rezervácie – dizajn ako dashboard. Základné údaje rezervácie sú tu
// len informačne (editujú sa cez modál „Upraviť"); priamo sa editujú detaily
// (výzdoba, rozpis hostí, požiadavky) a menu.
export default function BookingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { openEditModal, modalState } = useBookingsStore()
  const isAdmin = useAuthStore(s => s.role) === 'admin'

  const [booking, setBooking] = useState(undefined) // undefined = načítava, null = nenašlo sa
  const [form, setForm] = useState(null)

  // Prístup zákazníka
  const [access, setAccess]             = useState(null)  // { email, password? } po vytvorení
  const [accessBusy, setAccessBusy]     = useState(false)
  const [accessError, setAccessError]   = useState('')
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [copied, setCopied]             = useState('')    // 'link' | 'password'
  const revokeTimer = useRef(null)
  const prevModal   = useRef(modalState)

  // Načíta rezerváciu do stavu (booking + form). Volá sa pri otvorení detailu
  // a po zavretí modálu „Upraviť", aby sa zmeny prejavili.
  function loadBooking() {
    return supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) { console.error('[BookingDetail] fetch error:', error.message); setBooking(null); return null }
        setBooking(data)
        setForm({
          customerName: data.customer_name,
          phone:        data.customer_phone ?? '',
          date:         data.date,
          venue:        HALL_VENUE[data.hall] ?? data.hall.toLowerCase(),
          time:         data.start_time ? data.start_time.slice(0, 5) : '',
          type:         data.event_type ?? 'oslava',
          status:       data.status ?? 'dopyt',
          expectedGuests: data.expected_guests != null ? data.expected_guests : '',
          estimatedPrice: data.estimated_price != null ? Number(data.estimated_price) : '',
          guestCount:   data.guest_count ?? '',
          guestsAdults:     data.guests_adults ?? '',
          guestsSpecials:   data.guests_specials ?? '',
          guestsKidsMeal:   data.guests_kids_meal ?? '',
          guestsKidsNoMeal: data.guests_kids_no_meal ?? '',
          decoration:   data.decoration ?? '',
          deposit:      data.deposit_amount != null ? Number(data.deposit_amount) : '',
          deposits:     Array.isArray(data.deposit_payments) ? data.deposit_payments : [],
          notes:        data.notes ?? '',
        })
        return data
      })
  }

  useEffect(() => {
    loadBooking().then(data => {
      // Existujúci zákaznícky prístup → načítaj email pre opätovné zobrazenie linku
      if (data?.user_id) {
        supabase
          .from('profiles')
          .select('email')
          .eq('id', data.user_id)
          .single()
          .then(({ data: prof }) => {
            if (prof?.email) setAccess({ email: prof.email })
          })
      }
    })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Po zavretí modálu „Upraviť" (uloženie/vymazanie v BookingModal) refetchni detail
  useEffect(() => {
    if (prevModal.current !== null && modalState === null) loadBooking()
    prevModal.current = modalState
  }, [modalState]) // eslint-disable-line react-hooks/exhaustive-deps

  // Otvorí modál „Editovať rezerváciu" (rovnaký ako z diára) s aktuálnymi údajmi.
  // Počty hostí a požiadavky ku strave vlastní sekcia Menu (auto-uloženie),
  // preto sa do modálu neposielajú.
  function openEdit() {
    openEditModal({
      id:             booking.id,
      customerName:   form.customerName,
      phone:          form.phone,
      date:           form.date,
      venue:          form.venue,
      time:           form.time,
      type:           form.type,
      status:         form.status,
      expectedGuests: form.expectedGuests,
      estimatedPrice: form.estimatedPrice,
      decoration:     form.decoration,
      deposit:        form.deposit,
      deposits:       form.deposits,
      googleEventId:  booking.google_calendar_event_id,
    })
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
                      className="w-9 h-9 rounded-lg border border-[#d5e2e9] bg-white flex items-center
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
                      className="w-9 h-9 rounded-lg border border-[#d5e2e9] bg-white flex items-center
                                 justify-center text-[#3a5160] hover:bg-[#eef2fa] hover:text-[#4a6bb8]
                                 transition-colors"
                    >
                      <IconMessage size={16} />
                    </a>
                  </span>
                )}
              </div>

              {/* Poznámky z modálu */}
              {form.decoration?.trim() && (
                <p className="mt-2 text-sm text-[#3a5160] whitespace-pre-wrap">
                  <span className="font-semibold text-[#6a8898]">Poznámky: </span>
                  {form.decoration}
                </p>
              )}

              {/* Základné údaje rezervácie — informačne; editujú sa cez „Upraviť" */}
              <div className="flex items-end gap-x-5 gap-y-2 mt-3 pt-3 border-t border-[#eef3f6] flex-wrap">
                <Fact label="Čas" value={form.time || '—'} />
                <Fact label="Očakávaných hostí" value={form.expectedGuests || '—'} />
                <Fact label="Cena na osobu" value={eur(form.estimatedPrice)} />
                <Fact label="Záloha" value={eur(form.deposit)} />
                {editable && (
                  <button
                    onClick={openEdit}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold
                               transition-opacity hover:opacity-90"
                    style={{ background: '#4cbfb3', color: '#0a2d2a' }}
                  >
                    <IconPencil size={14} stroke={2.2} /> Upraviť
                  </button>
                )}
              </div>
            </div>

            {isPastBooking && (
              <>
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
                  Rezervácia sa už uskutočnila — nedá sa upravovať ani vymazať.
                </p>
                {/* Panel vyúčtovania — vždy editovateľný */}
                {isAdmin && <SettlementPanel bookingId={id} />}
              </>
            )}

            {/* Menu — počty hostí, požiadavky ku strave a jedálny lístok;
                všetko sa ukladá samo */}
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

          </>
        )}

        <div className="flex-1" />
      </div>

      <div className="xl:hidden">
        <BottomNav />
      </div>

      {/* Modál „Editovať rezerváciu" — rovnaký ako z diára */}
      <BookingModal />
    </div>
  )
}
