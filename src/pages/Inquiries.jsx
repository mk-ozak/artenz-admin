import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconHome, IconInbox } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import BottomNav from '../components/layout/BottomNav'
import InquiryDetail from '../components/inquiries/InquiryDetail'
import {
  INQUIRY_STATUSES, STATUS_BY_VALUE, typeLabel, eventDateLabel, arrivedLabel,
} from '../lib/inquiries'

// Filtre: „Všetky" + päť stavov
const FILTERS = [{ value: 'all', label: 'Všetky' }, ...INQUIRY_STATUSES]

function hostiaPlural(n) {
  if (n === 1) return 'hosť'
  if (n >= 2 && n <= 4) return 'hostia'
  return 'hostí'
}

// Riadok zoznamu — nové dopyty sú farebne aj typograficky výraznejšie
function InquiryRow({ inq, onOpen }) {
  const isNew  = inq.status === 'new'
  const status = STATUS_BY_VALUE[inq.status] ?? STATUS_BY_VALUE.new

  return (
    <li
      onClick={() => onOpen(inq)}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
                  ${isNew ? 'bg-inq-new hover:bg-[#dbeaf8]' : 'hover:bg-gray-50'}`}
    >
      {isNew && <span className="w-2 h-2 rounded-full shrink-0 bg-inq-new-ink" />}

      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isNew ? 'font-bold text-[#123f66]' : 'font-semibold text-[#1a2830]'}`}>
          {inq.name}
          <span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-gray-400">
            {typeLabel(inq.event_type)}
          </span>
        </p>
        <p className={`text-xs truncate ${isNew ? 'text-[#3d7cae]' : 'text-[#8aaabb]'}`}>
          {eventDateLabel(inq.event_date)}
          {inq.guests ? ` · ${inq.guests} ${hostiaPlural(inq.guests)}` : ''}
        </p>
      </div>

      <div className="text-right shrink-0">
        {!isNew && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${status.bg} ${status.ink}`}>
            {status.label}
          </span>
        )}
        <p className="text-[11px] text-[#8aaabb] mt-0.5">{arrivedLabel(inq.created_at)}</p>
      </div>
    </li>
  )
}

// Sekcia Dopyty — dopyty z webového formulára.
// Zámerne bez akéhokoľvek prepojenia na rezervácie.
export default function Inquiries() {
  const navigate = useNavigate()
  const role     = useAuthStore(s => s.role)
  const canEdit  = role === 'admin'

  const [rows,     setRows]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [filter,   setFilter]   = useState('all')
  const [openId,   setOpenId]   = useState(null)

  useEffect(() => {
    supabase
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) {
          console.error('[Inquiries] fetch error:', error.message)
          setError('Dopyty sa nepodarilo načítať.')
        }
        setRows(data ?? [])
        setLoading(false)
      })
  }, [])

  const counts = useMemo(() => {
    const c = { all: rows.length }
    for (const s of INQUIRY_STATUSES) c[s.value] = 0
    for (const r of rows) if (c[r.status] !== undefined) c[r.status]++
    return c
  }, [rows])

  const visible = filter === 'all' ? rows : rows.filter(r => r.status === filter)
  const open    = rows.find(r => r.id === openId) ?? null

  // Zmena v jednom dopyte sa premietne do zoznamu z lokálneho stavu
  function patchRow(id, patch) {
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  // Otvorenie dopytu: nový sa rovno označí ako prečítaný
  async function openInquiry(inq) {
    setOpenId(inq.id)
    if (inq.status !== 'new' || !canEdit) return
    patchRow(inq.id, { status: 'read' })
    const { error } = await supabase.from('inquiries').update({ status: 'read' }).eq('id', inq.id)
    if (error) {
      console.error('[Inquiries] status error:', error.message)
      patchRow(inq.id, { status: 'new' })
    }
  }

  async function changeStatus(id, status) {
    const prev = rows.find(r => r.id === id)?.status
    patchRow(id, { status })
    const { error } = await supabase.from('inquiries').update({ status }).eq('id', id)
    if (error) {
      console.error('[Inquiries] status error:', error.message)
      patchRow(id, { status: prev })
      setError('Stav sa nepodarilo uložiť.')
    }
  }

  async function saveNote(id, text) {
    const prev = rows.find(r => r.id === id)?.internal_note ?? ''
    patchRow(id, { internal_note: text })
    const { error } = await supabase
      .from('inquiries')
      .update({ internal_note: text === '' ? null : text })
      .eq('id', id)
    if (error) {
      console.error('[Inquiries] note error:', error.message)
      patchRow(id, { internal_note: prev })
      setError('Poznámku sa nepodarilo uložiť.')
    }
  }

  async function removeInquiry(id) {
    const snapshot = rows
    setOpenId(null)
    setRows(rs => rs.filter(r => r.id !== id))
    const { error } = await supabase.from('inquiries').delete().eq('id', id)
    if (error) {
      console.error('[Inquiries] delete error:', error.message)
      setRows(snapshot)
      setError('Dopyt sa nepodarilo zmazať.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hlavička — rovnaký vzor ako Financie */}
      <header className="px-4 py-3 flex items-center gap-3" style={{ background: '#354d5d' }}>
        <button
          onClick={() => navigate('/')}
          aria-label="Domov"
          className="w-10 h-10 xl:w-8 xl:h-8 rounded flex items-center justify-center
                     transition-opacity opacity-60 hover:opacity-100"
          style={{ color: '#ddeef6' }}
        >
          <IconHome className="w-7 h-7 xl:w-5 xl:h-5" stroke={2} />
        </button>
        <div>
          <p className="text-[10px] tracking-[.16em] uppercase" style={{ color: 'rgba(255,255,255,.4)' }}>
            ARTENZ
          </p>
          <p className="text-[18px] font-bold leading-tight" style={{ color: '#ddeef6' }}>Dopyty</p>
        </div>
      </header>

      <main className="w-full max-w-3xl xl:max-w-5xl mx-auto px-3 sm:px-4 py-4 flex-1">
        {/* Filter stavov */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1">
          {FILTERS.map(f => {
            const active = filter === f.value
            const n = counts[f.value] ?? 0
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors
                            border ${active
                              ? 'border-transparent bg-[#4cbfb3] text-[#0a2d2a]'
                              : 'border-[#e0e8ec] bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {f.label}
                <span className={active ? 'ml-1.5 opacity-70' : 'ml-1.5 text-gray-400'}>{n}</span>
              </button>
            )
          })}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg mb-3">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[#8aaabb] px-1 py-6">Načítavam…</p>
        ) : visible.length === 0 ? (
          <div className="rounded-card bg-white border border-[#e0e8ec] px-4 py-10 text-center">
            <IconInbox size={28} className="mx-auto mb-2 text-[#c3d3dc]" />
            <p className="text-sm text-[#8aaabb]">
              {rows.length === 0
                ? 'Zatiaľ neprišiel žiadny dopyt z webu.'
                : 'V tomto stave nie je žiadny dopyt.'}
            </p>
          </div>
        ) : (
          <ul className="rounded-card bg-white border border-[#e0e8ec] overflow-hidden divide-y divide-[#eef2f5]">
            {visible.map(inq => (
              <InquiryRow key={inq.id} inq={inq} onOpen={openInquiry} />
            ))}
          </ul>
        )}
      </main>

      <div className="xl:hidden">
        <BottomNav newCount={counts.new} />
      </div>

      {open && (
        <InquiryDetail
          inquiry={open}
          canEdit={canEdit}
          onStatus={status => changeStatus(open.id, status)}
          onNote={text => saveNote(open.id, text)}
          onDelete={() => removeInquiry(open.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}
