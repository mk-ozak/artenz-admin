import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookingChip from './BookingChip'
import BookingModal from './BookingModal'
import { useBookingsStore } from '../store/bookings'

const VENUES = [
  { key: 'artenzPlus', label: 'ARTENZ PLUS' },
  { key: 'artenz',     label: 'ARTENZ' },
  { key: 'luna',       label: 'LUNA' },
  { key: 'catering',   label: 'CATERING' },
]

const TYPE_LABELS = { svadba: 'Svadba', oslava: 'Oslava', firmovna: 'Firemná akcia' }
const DAY_NAMES   = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So']
const MONTH_NAMES = [
  'Január','Február','Marec','Apríl','Máj','Jún',
  'Júl','August','September','Október','November','December',
]

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function Diary() {
  const navigate = useNavigate()
  const today = new Date()
  const [year,  setYear]  = useState(2026)
  const [month, setMonth] = useState(5)  // June
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const {
    bookings, loading, error,
    selectedBooking, selectBooking, clearSelection,
    fetchBookings, subscribeToMonth, unsubscribe,
    openAddModal, openEditModal,
    deleteBooking,
  } = useBookingsStore()

  useEffect(() => {
    fetchBookings(year, month)
    subscribeToMonth(year, month)
    return () => unsubscribe()
  }, [year, month]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset delete confirm when selection changes
  useEffect(() => { setDeleteConfirmId(null) }, [selectedBooking])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    clearSelection()
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    clearSelection()
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function getBooking(day, venueKey) {
    const date = formatDate(year, month, day)
    return bookings.find(b => b.date === date && b.venue === venueKey) ?? null
  }

  function isToday(day) {
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
  }

  async function handleDelete(id) {
    const err = await deleteBooking(id)
    if (err) alert(err)
    setDeleteConfirmId(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center sticky top-0 z-10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors mr-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </button>

        <div className="flex-1 flex items-center justify-center gap-3">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-gray-800 w-36 text-center select-none">
            {MONTH_NAMES[month]} {year}
          </h1>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Loading indicator */}
        <div className="w-24 flex justify-end">
          {loading && (
            <span className="text-xs text-gray-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
              Načítavam
            </span>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">{error}</p>
              {error.includes('neexistuje') && (
                <p className="mt-1 text-red-600 text-xs">
                  Otvor{' '}
                  <a
                    href="https://supabase.com/dashboard/project/fmkralairvdhjnsfhcxo/sql/new"
                    target="_blank" rel="noreferrer"
                    className="underline font-semibold"
                  >
                    Supabase SQL Editor
                  </a>
                  {' '}a spusti obsah súboru <code className="bg-red-100 px-1 rounded">supabase/setup.sql</code>.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={`overflow-x-auto pb-48 transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white text-[11px] font-semibold uppercase tracking-widest">
              <th className="w-14 py-3 px-2 text-center border-r border-gray-700">Deň</th>
              {VENUES.map(v => (
                <th key={v.key} className="py-3 px-3 text-center border-r border-gray-700 last:border-r-0">
                  {v.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dow     = new Date(year, month, day).getDay()
              const weekend = dow === 0 || dow === 6
              const todayRow = isToday(day)

              return (
                <tr
                  key={day}
                  className={`border-b
                    ${todayRow  ? 'bg-indigo-50 border-indigo-200'
                    : weekend   ? 'bg-amber-50 border-amber-100'
                    : 'bg-white border-gray-100 hover:bg-gray-50/60'}`}
                >
                  {/* Day label */}
                  <td className="w-14 py-2 px-2 text-center border-r border-gray-200">
                    <span className={`text-sm font-bold leading-none block
                      ${todayRow ? 'text-indigo-700' : weekend ? 'text-amber-700' : 'text-gray-800'}`}>
                      {day}
                    </span>
                    <span className={`text-[10px] leading-none mt-0.5 block
                      ${todayRow ? 'text-indigo-400' : weekend ? 'text-amber-500' : 'text-gray-400'}`}>
                      {DAY_NAMES[dow]}
                    </span>
                    {todayRow && (
                      <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-wide">dnes</span>
                    )}
                  </td>

                  {/* Venue cells */}
                  {VENUES.map(v => {
                    const booking = getBooking(day, v.key)
                    return (
                      <td
                        key={v.key}
                        className="py-1.5 px-2 border-r border-gray-200 last:border-r-0 min-w-[148px]"
                      >
                        {booking ? (
                          <BookingChip booking={booking} onClick={selectBooking} />
                        ) : (
                          <button
                            onClick={() => openAddModal(formatDate(year, month, day), v.key)}
                            className="w-full h-7 rounded text-xs transition-all flex items-center justify-center gap-1
                              text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 border border-transparent hover:border-indigo-200"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selectedBooking && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-2xl z-20">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex items-start gap-4">

              {/* Fields grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 flex-1 min-w-0">
                {[
                  ['Zákazník',   selectedBooking.customerName],
                  ['Dátum',      selectedBooking.date],
                  ['Sála',       VENUES.find(v => v.key === selectedBooking.venue)?.label ?? selectedBooking.venue],
                  ['Typ akcie',  TYPE_LABELS[selectedBooking.type] ?? selectedBooking.type],
                  ['Záloha',     `${selectedBooking.deposit} €${selectedBooking.depositPaid ? ' ✓' : ''}`],
                  ['Počet hostí', selectedBooking.guestCount || '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                    <p className="font-semibold text-gray-900 text-sm mt-0.5 truncate">{val}</p>
                  </div>
                ))}
                {selectedBooking.notes && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Poznámky</p>
                    <p className="text-gray-700 text-sm mt-0.5 line-clamp-2">{selectedBooking.notes}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => openEditModal(selectedBooking)}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium
                    rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Editovať
                </button>

                {deleteConfirmId === selectedBooking.id ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleDelete(selectedBooking.id)}
                      className="flex-1 px-3 py-2 bg-red-600 text-white text-xs font-medium
                        rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Áno, zmazať
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium
                        rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Nie
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(selectedBooking.id)}
                    className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium
                      rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                  >
                    Zmazať
                  </button>
                )}

                <button
                  onClick={clearSelection}
                  className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium
                    rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Zavrieť
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay */}
      <BookingModal />
    </div>
  )
}
