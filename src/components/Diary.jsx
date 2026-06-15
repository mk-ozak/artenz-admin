import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconHome, IconTable } from '@tabler/icons-react'
import { exportDiaryYear, exportAllBookings } from '../utils/exportDiary'
import { exportDiaryYearPdf } from '../utils/exportDiaryPdf'
import { supabase } from '../lib/supabase'
import DiaryMonth from './diary/DiaryMonth'
import BookingModal from './BookingModal'
import { useBookingsStore } from '../store/bookings'
import { useAuthStore } from '../store/auth'
import { toISO } from '../utils/diaryWeeks'

const MIN_YEAR = 2024

const HALL_COLOR = {
  ARTENZ_PLUS: '#4cbfb3',
  ARTENZ:      '#d4a036',
  LUNA:        '#b55db8',
  CATERING:    '#7aaaca',
}

function pad(n) { return String(n).padStart(2, '0') }

export default function Diary() {
  const navigate = useNavigate()
  const today    = new Date()
  const todayISO = toISO(today)

  const currentYear  = today.getFullYear()
  const currentMonth = today.getMonth()
  // V januári niet predošlých mesiacov tohto roku → samostatná strana „rok*" neexistuje.
  const hasPastPart  = currentMonth > 0

  // Stránka diára:
  //  - { year, part:'full' }   → celý (minulý/budúci) rok
  //  - { year:currentYear, part:'past' }   → predošlé mesiace tohto roku (label „2026*")
  //  - { year:currentYear, part:'future' } → aktuálny mesiac a ďalej (label „2026")
  const [page, setPage] = useState({ year: currentYear, part: 'future' })

  function prevPage(p) {
    if (p.year === currentYear && p.part === 'future')
      return hasPastPart ? { year: currentYear, part: 'past' } : { year: currentYear - 1, part: 'full' }
    if (p.year === currentYear && p.part === 'past')
      return { year: currentYear - 1, part: 'full' }
    if (p.year - 1 === currentYear) return { year: currentYear, part: 'future' }
    return { year: p.year - 1, part: 'full' }
  }
  function nextPage(p) {
    if (p.year === currentYear && p.part === 'past')   return { year: currentYear, part: 'future' }
    if (p.year === currentYear && p.part === 'future') return { year: currentYear + 1, part: 'full' }
    if (p.year + 1 === currentYear)
      return hasPastPart ? { year: currentYear, part: 'past' } : { year: currentYear, part: 'future' }
    return { year: p.year + 1, part: 'full' }
  }

  const canGoPrev  = !(page.year <= MIN_YEAR && page.part === 'full')
  const isPastPage = page.part === 'past' || page.year < currentYear
  const yearLabel  = page.part === 'past' ? `${currentYear}*` : `${page.year}`

  const { openAddModal, openEditModal, modalState } = useBookingsStore()
  const isAdmin = useAuthStore(s => s.role) === 'admin'
  const prevModal = useRef(modalState)

  const [bookings,  setBookings]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [exporting,     setExporting]     = useState(null)  // 'year' | 'pdf' | 'all' | null
  const [confirmExport, setConfirmExport] = useState(false)

  async function handleExport(kind) {
    setExporting(kind)
    try {
      if (kind === 'year')      await exportDiaryYear(page.year, bookings)
      else if (kind === 'pdf')  exportDiaryYearPdf(page.year, bookings)
      else                      await exportAllBookings()
      setConfirmExport(false)
    } catch (e) {
      console.error('[Diary] export error:', e)
    } finally {
      setExporting(null)
    }
  }

  // Viditeľné mesiace podľa časti stránky
  const visibleMonths =
    page.part === 'past'
      ? Array.from({ length: currentMonth }, (_, i) => i)
      : page.part === 'future'
        ? Array.from({ length: 12 - currentMonth }, (_, i) => currentMonth + i)
        : Array.from({ length: 12 }, (_, i) => i)

  function fetchYear(yr) {
    const start = `${yr}-01-01`
    const end   = `${yr}-12-31`
    return supabase
      .from('bookings')
      .select('*')
      .is('deleted_at', null)
      .gte('date', start)
      .lte('date', end)
      .order('date')
      .then(({ data, error }) => {
        if (error) console.error('[Diary] fetch error:', error.message)
        setBookings(data ?? [])
      })
  }

  useEffect(() => {
    setLoading(true)
    fetchYear(page.year).then(() => setLoading(false))
  }, [page.year]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when modal closes — catches add / edit / delete from BookingModal
  useEffect(() => {
    if (prevModal.current !== null && modalState === null) {
      fetchYear(page.year)
    }
    prevModal.current = modalState
  }, [modalState]) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel(`diary-year-${page.year}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        const start = `${page.year}-01-01`
        const end   = `${page.year}-12-31`
        supabase
          .from('bookings')
          .select('*')
          .is('deleted_at', null)
          .gte('date', start)
          .lte('date', end)
          .order('date')
          .then(({ data }) => {
            setBookings(data ?? [])
          })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [page.year])

  const HALL_VENUE = {
    ARTENZ_PLUS: 'artenzPlus',
    ARTENZ:      'artenz',
    LUNA:        'luna',
    CATERING:    'catering',
  }

  function toFrontend(b) {
    return {
      id:            b.id,
      customerName:  b.customer_name,
      date:          b.date,
      venue:         HALL_VENUE[b.hall] ?? b.hall.toLowerCase(),
      type:          b.event_type ?? 'svadba',
      deposit:       b.deposit_amount != null ? Number(b.deposit_amount) : 0,
      depositPaid:   b.deposit_paid ?? false,
      decoration:    b.decoration ?? '',
      guestCount:    b.guest_count ?? 0,
      notes:         b.notes ?? '',
      googleEventId: b.google_calendar_event_id ?? null,
      status:        b.status ?? 'dopyt',
      phone:         b.customer_phone ?? null,
      time:          b.start_time ? b.start_time.slice(0, 5) : '',
      expectedGuests: b.expected_guests ?? 0,
      estimatedPrice: b.estimated_price != null ? Number(b.estimated_price) : 0,
    }
  }

  function handleBookingClick(booking) {
    openEditModal(toFrontend(booking))
  }

  function handleCellClick(dateISO, hall) {
    if (!isAdmin) return  // read_only nepridáva rezervácie
    const venueMap = {
      ARTENZ_PLUS: 'artenzPlus',
      ARTENZ:      'artenz',
      LUNA:        'luna',
      CATERING:    'catering',
    }
    openAddModal(dateISO, venueMap[hall] ?? hall.toLowerCase())
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* Year header */}
      <div className="shrink-0 relative" style={{ background: '#354d5d' }}>
        {/* Domov – ikona vždy pri ľavom okraji stránky */}
        <button
          onClick={() => navigate('/')}
          aria-label="Domov"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 xl:w-8 xl:h-8 rounded
                     flex items-center justify-center transition-opacity opacity-60 hover:opacity-100"
          style={{ color: '#ddeef6' }}
        >
          <IconHome className="w-7 h-7 xl:w-5 xl:h-5" stroke={2} />
        </button>
        {/* Rok so šípkami vľavo (hneď za domčekom), Nová rezervácia úplne vpravo */}
        <div className="pl-[68px] xl:pl-14 pr-3 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (canGoPrev) setPage(prevPage) }}
              disabled={!canGoPrev}
              className="w-10 h-10 text-[24px] xl:w-7 xl:h-7 xl:text-[17px] rounded flex items-center justify-center transition-opacity hover:opacity-100 opacity-60 disabled:opacity-20 disabled:cursor-not-allowed"
              style={{ background: 'rgba(255,255,255,.12)', color: '#b0ccd8' }}
            >
              ‹
            </button>
            <span className="text-[18px] font-bold min-w-[60px] text-center select-none"
                  style={{ color: '#ddeef6' }}>
              {yearLabel}
            </span>
            <button
              onClick={() => setPage(nextPage)}
              className="w-10 h-10 text-[24px] xl:w-7 xl:h-7 xl:text-[17px] rounded flex items-center justify-center transition-opacity hover:opacity-100 opacity-60"
              style={{ background: 'rgba(255,255,255,.12)', color: '#b0ccd8' }}
            >
              ›
            </button>
          </div>
          <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirmExport(true)}
            disabled={exporting}
            aria-label="Exporty"
            title="Exporty"
            className="w-10 h-10 xl:w-9 xl:h-9 rounded-lg flex items-center justify-center
                       transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: '#8a9aa6', color: '#1d2f3c' }}
          >
            <IconTable size={20} stroke={2} />
          </button>
          {isAdmin && (
          <button
            onClick={() => openAddModal(null, null)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold
                       transition-opacity hover:opacity-90"
            style={{ background: '#4cbfb3', color: '#0a2d2a' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
            </svg>
            Nová rezervácia
          </button>
          )}
          </div>
        </div>
      </div>

      {/* Scrollable diary table */}
      <div className="flex-1 overflow-auto" data-diary-scroll>
        {/* Mobil (< sm): o polovicu užšie stĺpce + horizontálny posun.
            Tablet/desktop (≥ sm): plná šírka bez posunu. */}
        <div className="min-w-[430px] sm:min-w-full">
          <table className="diary-table w-full border-collapse" style={{ tableLayout: 'fixed' }}>

            {/* Sticky column headers */}
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-14 py-2.5 px-1 text-[10px] font-semibold text-[#5a7a8c]
                               bg-[#243545] border-r border-[#354d5d] text-center" />
                {[
                  ['ARTENZ+', 'ARTENZ_PLUS'],
                  ['ARTENZ',  'ARTENZ'],
                  ['LUNA',    'LUNA'],
                  ['CATERING','CATERING'],
                ].map(([label, key]) => (
                  <th key={key}
                      className="py-2.5 px-3 text-left text-[12px] font-bold tracking-[.08em]
                                 whitespace-nowrap overflow-hidden
                                 bg-[#2b3f4e] text-[#c0d8e8] border-r border-[#354d5d] last:border-r-0"
                      style={{ boxShadow: `inset 0 3px 0 ${HALL_COLOR[key]}` }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Month bodies */}
            {visibleMonths.map((month) => (
              <DiaryMonth
                key={`${page.year}-${month}`}
                year={page.year}
                month={month}
                dimmed={isPastPage}
                todayISO={todayISO}
                bookings={bookings}
                onCellClick={handleCellClick}
                onBookingClick={handleBookingClick}
              />
            ))}
          </table>

          {/* Legend */}
          <div className="px-4 py-2.5 border-t border-[#e8eef2] bg-[#f8fafb]
                          flex gap-4 flex-wrap items-center text-[11px] text-[#6a8898]">
            <span className="font-bold text-[#8aaabb]">STATUS:</span>
            {[
              { bg: '#f0f2f4', strip: '#9ab0ba', label: 'Nezáväzný dopyt' },
              { bg: '#fff5e6', strip: '#d4a036', label: 'Potvrdené' },
              { bg: '#eaf7f0', strip: '#3db8ad', label: 'Záloha zaplatená' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className="w-3.5 h-3 rounded-sm border-l-[3px]"
                     style={{ background: s.bg, borderLeftColor: s.strip }} />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Výber exportu */}
      {confirmExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-5 py-4" style={{ background: '#354d5d' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#ddeef6' }}>Exporty</h2>
            </div>
            <div className="p-5 space-y-3">
              <button
                type="button"
                disabled={exporting !== null}
                onClick={() => handleExport('pdf')}
                className="w-full px-4 py-3 rounded-lg text-sm font-bold text-left
                  transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: '#4cbfb3', color: '#0a2d2a' }}
              >
                {exporting === 'pdf' ? 'Pripravujem…' : `Exportovať rok ${yearLabel} do PDF`}
                <span className="block text-[11px] font-normal opacity-70 mt-0.5">
                  Vizuál diára naležato, 2 mesiace na stranu A4 (6 strán)
                </span>
              </button>
              <button
                type="button"
                disabled={exporting !== null}
                onClick={() => handleExport('year')}
                className="w-full px-4 py-3 rounded-lg text-sm font-bold text-left border border-gray-300
                  text-gray-800 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {exporting === 'year' ? 'Exportujem…' : `Exportovať rok ${yearLabel} do Excelu`}
                <span className="block text-[11px] font-normal text-gray-500 mt-0.5">
                  Mriežka diára po mesiacoch
                </span>
              </button>
              <button
                type="button"
                disabled={exporting !== null}
                onClick={() => handleExport('all')}
                className="w-full px-4 py-3 rounded-lg text-sm font-bold text-left border border-gray-300
                  text-gray-800 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {exporting === 'all' ? 'Exportujem…' : 'Exportovať všetky rezervácie'}
                <span className="block text-[11px] font-normal text-gray-500 mt-0.5">
                  Zoznam akcií za všetky roky so všetkými údajmi
                </span>
              </button>
              <button
                type="button"
                disabled={exporting !== null}
                onClick={() => setConfirmExport(false)}
                className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 text-sm
                  font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Zrušiť
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow px-3 py-2
                        text-xs text-gray-500 flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Načítavam…
        </div>
      )}

      <BookingModal />
    </div>
  )
}
