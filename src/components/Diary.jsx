import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import DiaryMonth from './diary/DiaryMonth'
import BookingModal from './BookingModal'
import { useBookingsStore } from '../store/bookings'

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
  const [year, setYear] = useState(today.getFullYear())

  const { openAddModal, openEditModal, modalState } = useBookingsStore()
  const prevModal = useRef(modalState)

  const [bookings, setBookings] = useState([])
  const [loading,  setLoading]  = useState(true)

  // Visible months: current year → only from current month; other years → all 12
  const currentYear  = today.getFullYear()
  const currentMonth = today.getMonth()
  const visibleMonths = Array.from({ length: 12 }, (_, i) => i)
    .filter(m => year !== currentYear || m >= currentMonth)

  function fetchYear(yr) {
    const start = `${yr}-01-01`
    const end   = `${yr}-12-31`
    return supabase
      .from('bookings')
      .select('id, date, hall, customer_name, event_type, deposit_paid, deposit_amount, guest_count, notes')
      .gte('date', start)
      .lte('date', end)
      .order('date')
      .then(({ data, error }) => {
        if (error) console.error('[Diary] fetch error:', error.message)
        setBookings((data ?? []).map(b => ({ ...b, status: 'dopyt' })))
      })
  }

  useEffect(() => {
    setLoading(true)
    fetchYear(year).then(() => setLoading(false))
  }, [year]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when modal closes — catches add / edit / delete from BookingModal
  useEffect(() => {
    if (prevModal.current !== null && modalState === null) {
      fetchYear(year)
    }
    prevModal.current = modalState
  }, [modalState]) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel(`diary-year-${year}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        const start = `${year}-01-01`
        const end   = `${year}-12-31`
        supabase
          .from('bookings')
          .select('id, date, hall, customer_name, event_type, deposit_paid, deposit_amount, guest_count, notes')
          .gte('date', start)
          .lte('date', end)
          .order('date')
          .then(({ data }) => {
            setBookings((data ?? []).map(b => ({ ...b, status: 'dopyt' })))
          })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [year])

  const HALL_VENUE = {
    ARTENZ_PLUS: 'artenzPlus',
    ARTENZ:      'artenz',
    LUNA:        'luna',
    CATERING:    'catering',
  }

  function toFrontend(b) {
    return {
      id:           b.id,
      customerName: b.customer_name,
      date:         b.date,
      venue:        HALL_VENUE[b.hall] ?? b.hall.toLowerCase(),
      type:         b.event_type ?? 'svadba',
      deposit:      b.deposit_amount != null ? Number(b.deposit_amount) : 0,
      depositPaid:  b.deposit_paid ?? false,
      guestCount:   b.guest_count ?? 0,
      notes:        b.notes ?? '',
    }
  }

  function handleBookingClick(booking) {
    openEditModal(toFrontend(booking))
  }

  function handleCellClick(dateISO, hall) {
    const venueMap = {
      ARTENZ_PLUS: 'artenzPlus',
      ARTENZ:      'artenz',
      LUNA:        'luna',
      CATERING:    'catering',
    }
    openAddModal(dateISO, venueMap[hall] ?? hall.toLowerCase())
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Year header */}
      <div className="shrink-0" style={{ background: '#354d5d' }}>
        <div className="px-5 py-3 flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-sm transition-colors mr-2"
              style={{ color: 'rgba(221,238,246,.5)' }}
            >
              ← Domov
            </button>
            <button
              onClick={() => setYear(y => y - 1)}
              className="w-7 h-7 rounded flex items-center justify-center text-[17px] transition-opacity hover:opacity-100 opacity-60"
              style={{ background: 'rgba(255,255,255,.12)', color: '#b0ccd8' }}
            >
              ‹
            </button>
            <span className="text-[18px] font-bold min-w-[60px] text-center select-none"
                  style={{ color: '#ddeef6' }}>
              {year}
            </span>
            <button
              onClick={() => setYear(y => y + 1)}
              className="w-7 h-7 rounded flex items-center justify-center text-[17px] transition-opacity hover:opacity-100 opacity-60"
              style={{ background: 'rgba(255,255,255,.12)', color: '#b0ccd8' }}
            >
              ›
            </button>
          </div>
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
        </div>
      </div>

      {/* Scrollable diary table */}
      <div className="flex-1 overflow-x-auto">
        <div style={{ minWidth: 860 }}>
          <table className="diary-table w-full border-collapse" style={{ tableLayout: 'fixed' }}>

            {/* Sticky column headers */}
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-14 py-2.5 px-1 text-[10px] font-semibold text-[#5a7a8c]
                               bg-[#243545] border-r border-[#354d5d] text-center" />
                {[
                  ['ARTENZ PLUS', 'ARTENZ_PLUS'],
                  ['ARTENZ',      'ARTENZ'],
                  ['LUNA',        'LUNA'],
                  ['CATERING',    'CATERING'],
                ].map(([label, key]) => (
                  <th key={key}
                      className="py-2.5 px-3 text-left text-[12px] font-bold tracking-[.08em]
                                 bg-[#2b3f4e] text-[#c0d8e8] border-r border-[#354d5d] last:border-r-0"
                      style={{ borderTop: `3px solid ${HALL_COLOR[key]}` }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Month bodies */}
            {visibleMonths.map((month, idx) => (
              <DiaryMonth
                key={`${year}-${month}`}
                year={year}
                month={month}
                isOdd={idx % 2 !== 0}
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
            <span className="w-px h-4 bg-[#dde8ec] mx-1" />
            <span className="font-bold text-[#8aaabb]">SÁLA:</span>
            {Object.entries(HALL_COLOR).map(([key, color]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-3.5 h-3 rounded-sm border-l-[3px]"
                     style={{ background: color + '22', borderLeftColor: color }} />
                {key.replace('_', ' ')}
              </div>
            ))}
          </div>
        </div>
      </div>

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
