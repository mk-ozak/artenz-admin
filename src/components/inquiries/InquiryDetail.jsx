import { useEffect, useRef, useState } from 'react'
import { IconX, IconPhone, IconMail, IconTrash, IconCheck } from '@tabler/icons-react'
import {
  STATUS_BY_VALUE, typeLabel, eventDateLabel, arrivedLabel, telHref, mailtoHref,
} from '../../lib/inquiries'

// Tlačidlá stavu v detaile (stav „read" sa nastavuje sám pri otvorení)
const ACTIONS = [
  { value: 'answered', label: 'Vybavené' },
  { value: 'archived', label: 'Archivovať' },
  { value: 'spam',     label: 'Spam' },
]

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[#8aaabb]">{label}</p>
      <p className="text-sm font-semibold text-[#1a2830]">{children}</p>
    </div>
  )
}

// Detail dopytu: kontakt, správa, zmena stavu, interná poznámka, zmazanie.
export default function InquiryDetail({ inquiry, canEdit, onStatus, onNote, onDelete, onClose }) {
  const [note, setNote]       = useState(inquiry.internal_note ?? '')
  const [noteSaved, setNoteSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmTimer = useRef(null)
  const savedTimer   = useRef(null)

  const status = STATUS_BY_VALUE[inquiry.status] ?? STATUS_BY_VALUE.new

  useEffect(() => {
    setNote(inquiry.internal_note ?? '')
    setConfirmDelete(false)
  }, [inquiry.id, inquiry.internal_note])

  useEffect(() => () => {
    clearTimeout(confirmTimer.current)
    clearTimeout(savedTimer.current)
  }, [])

  // Poznámka sa ukladá pri opustení poľa, len ak sa naozaj zmenila
  function saveNote() {
    const value = note.trim()
    if (value === (inquiry.internal_note ?? '')) return
    onNote(value)
    setNoteSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setNoteSaved(false), 2500)
  }

  // Prvý klik = potvrdenie (~4 s), druhý = nenávratné zmazanie
  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 4000)
      return
    }
    clearTimeout(confirmTimer.current)
    setConfirmDelete(false)
    onDelete()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Hlavička */}
        <div className="px-5 py-4 flex items-start justify-between gap-3 sticky top-0"
             style={{ background: '#354d5d' }}>
          <div className="min-w-0">
            <p className="text-[10px] tracking-[.16em] uppercase" style={{ color: 'rgba(255,255,255,.4)' }}>
              Dopyt z webu
            </p>
            <p className="text-[18px] font-bold leading-tight truncate" style={{ color: '#ddeef6' }}>
              {inquiry.name}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Zavrieť"
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center
                       transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,.1)', color: '#7a9aac' }}
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${status.bg} ${status.ink}`}>
              {status.label}
            </span>
            <span className="text-xs text-[#8aaabb]">{arrivedLabel(inquiry.created_at)}</span>
          </div>

          {/* Kontakt */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={telHref(inquiry.phone)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#cdebe6]
                         bg-[#f2faf8] text-[#1f4a45] transition-colors hover:bg-[#e9f6f3]"
            >
              <IconPhone size={16} className="shrink-0 text-[#2a8d83]" />
              <span className="text-sm font-semibold truncate">{inquiry.phone}</span>
            </a>
            <a
              href={mailtoHref(inquiry)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#d7e6f5]
                         bg-[#f2f8fd] text-[#1f4a63] transition-colors hover:bg-[#e8f2fb]"
            >
              <IconMail size={16} className="shrink-0 text-[#1f6ba8]" />
              <span className="text-sm font-semibold truncate">{inquiry.email}</span>
            </a>
          </div>

          {/* Údaje o akcii */}
          <div className="grid grid-cols-2 gap-3 rounded-card border border-[#e0e8ec] px-4 py-3">
            <Field label="Typ akcie">{typeLabel(inquiry.event_type)}</Field>
            <Field label="Dátum akcie">{eventDateLabel(inquiry.event_date)}</Field>
            <Field label="Počet hostí">{inquiry.guests ?? '—'}</Field>
            <Field label="Zdroj">{inquiry.source ?? 'web'}</Field>
          </div>

          {/* Správa od návštevníka */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#8aaabb] mb-1">Správa</p>
            <p className="text-sm text-[#1a2830] whitespace-pre-wrap break-words bg-gray-50
                          border border-gray-200 rounded-lg px-3 py-2.5 min-h-[44px]">
              {inquiry.message?.trim() ? inquiry.message : '—'}
            </p>
          </div>

          {/* Zmena stavu */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#8aaabb] mb-1.5">Stav</p>
            <div className="grid grid-cols-3 gap-2">
              {ACTIONS.map(a => {
                const active = inquiry.status === a.value
                return (
                  <button
                    key={a.value}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => onStatus(a.value)}
                    className={`px-2 py-2.5 rounded-lg text-xs font-semibold transition-colors
                                border disabled:opacity-50 disabled:cursor-not-allowed
                                ${active
                                  ? 'border-transparent bg-[#4cbfb3] text-[#0a2d2a]'
                                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {a.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Interná poznámka — na webe sa nikdy nezobrazuje */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-wider text-[#8aaabb]">
                Interná poznámka
              </p>
              {noteSaved && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-[#2a8d83]">
                  <IconCheck size={12} /> Uložené
                </span>
              )}
            </div>
            <textarea
              value={note}
              disabled={!canEdit}
              onChange={e => setNote(e.target.value)}
              onBlur={saveNote}
              rows={3}
              placeholder="Poznámka len pre nás…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-[#4cbfb3] focus:border-transparent
                         disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {!canEdit && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
              Máš prístup len na čítanie — stav, poznámku ani zmazanie meniť nemôžeš.
            </p>
          )}

          {/* Zmazanie — naozaj maže riadok, nedá sa vrátiť */}
          {canEdit && (
            <button
              type="button"
              onClick={handleDelete}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                          text-sm font-medium transition-colors border
                          ${confirmDelete
                            ? 'border-red-600 bg-red-600 text-white'
                            : 'border-red-300 text-red-600 hover:bg-red-50'}`}
            >
              <IconTrash size={16} />
              {confirmDelete ? 'Naozaj zmazať? Klikni znova' : 'Zmazať dopyt'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
