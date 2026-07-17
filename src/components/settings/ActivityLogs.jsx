import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { EVENT_LABEL } from '../../lib/eventTypes'
import { SETTLEMENT_DOCUMENT_LABEL, SETTLEMENT_METHOD_LABEL } from '../../lib/settlement'

const ACTION_LABEL = {
  booking_create:         'Vytvoril rezerváciu',
  booking_update:         'Upravil rezerváciu',
  booking_soft_delete:    'Vymazal rezerváciu',
  booking_restore:        'Obnovil rezerváciu',
  booking_delete:         'Natrvalo vymazal rezerváciu',
  user_create:            'Vytvoril používateľa',
  customer_access_create: 'Vytvoril zákaznícky prístup',
  user_delete:            'Zmazal používateľa',
  user_password_reset:    'Resetoval heslo',
}

const ACTION_BADGE = {
  booking_create:         'bg-emerald-100 text-emerald-700',
  booking_update:         'bg-indigo-100 text-indigo-700',
  booking_soft_delete:    'bg-red-100 text-red-700',
  booking_restore:        'bg-amber-100 text-amber-700',
  booking_delete:         'bg-red-200 text-red-800',
  user_create:            'bg-emerald-100 text-emerald-700',
  customer_access_create: 'bg-teal-100 text-teal-700',
  user_delete:            'bg-red-100 text-red-700',
  user_password_reset:    'bg-amber-100 text-amber-700',
}

const HALL_LABEL = {
  ARTENZ_PLUS: 'ARTENZ PLUS',
  ARTENZ:      'ARTENZ',
  LUNA:        'LUNA',
  CATERING:    'CATERING',
}

const STATUS_LABEL = {
  dopyt:     'Nezáväzný dopyt',
  zaloha:    'Čakajúca záloha',
  potvrdene: 'Potvrdené',
}

// Slovenské názvy stĺpcov pre riadky zmien
const FIELD_LABEL = {
  customer_name:   'Názov',
  customer_phone:  'Telefón',
  date:            'Dátum',
  start_time:      'Čas',
  hall:            'Sála',
  event_type:      'Typ akcie',
  status:          'Stav',
  expected_guests: 'Očakávaný počet osôb',
  estimated_price: 'Cena na osobu',
  guest_count:     'Počet hostí',
  deposit_amount:  'Záloha',
  deposit_payments: 'Zaplatené zálohy',
  settlement_document: 'Vyúčtovanie – doklad',
  settlement_method:   'Vyúčtovanie – spôsob',
  // decoration = všeobecné poznámky z formulára; notes = požiadavky ku strave (Menu)
  decoration:      'Poznámky',
  notes:           'Požiadavky ku strave',
}

function formatValue(field, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'status')     return STATUS_LABEL[value] ?? value
  if (field === 'hall')       return HALL_LABEL[value] ?? value
  if (field === 'event_type') return EVENT_LABEL[value] ?? value
  if (field === 'settlement_document') return SETTLEMENT_DOCUMENT_LABEL[value] ?? value
  if (field === 'settlement_method')   return SETTLEMENT_METHOD_LABEL[value] ?? value
  if (field === 'start_time')   return String(value).slice(0, 5)
  if (field === 'deposit_payments') {
    const arr = Array.isArray(value) ? value : []
    return arr.length ? arr.map(p => `${p.amount} € (${p.date})`).join(', ') : '—'
  }
  const s = String(value)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('sk', {
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function detailText(log) {
  const d = log.details ?? {}
  if (log.entity === 'booking') {
    return [d.customer_name, d.date, HALL_LABEL[d.hall] ?? d.hall].filter(Boolean).join(' · ')
  }
  return [d.full_name || d.customer_name, d.email, d.role].filter(Boolean).join(' · ')
}

export default function ActivityLogs() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [userFilter, setUserFilter] = useState('')

  useEffect(() => {
    supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setLogs(data ?? [])
        setLoading(false)
      })
  }, [])

  const users    = [...new Set(logs.map(l => l.user_email).filter(Boolean))].sort()
  const filtered = userFilter ? logs.filter(l => l.user_email === userFilter) : logs

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#4cbfb3] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter podľa používateľa */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500">Používateľ:</label>
        <select
          value={userFilter}
          onChange={e => setUserFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Všetci</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} {filtered.length === 1 ? 'záznam' : filtered.length < 5 ? 'záznamy' : 'záznamov'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">Žiadne záznamy.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {filtered.map(log => (
              <li key={log.id} className="px-4 py-2.5 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium
                                      ${ACTION_BADGE[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ACTION_LABEL[log.action] ?? log.action}
                    </span>
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {detailText(log)}
                    </span>
                  </div>
                  {/* Zmenené polia pri úprave: Stav: Čakajúca záloha → Potvrdené */}
                  {log.details?.changes && (
                    <ul className="mt-1 space-y-0.5">
                      {Object.entries(log.details.changes).map(([field, [oldVal, newVal]]) => (
                        <li key={field} className="text-xs text-gray-500">
                          <span className="text-gray-400">{FIELD_LABEL[field] ?? field}:</span>{' '}
                          {formatValue(field, oldVal)}
                          <span className="text-gray-400"> → </span>
                          <span className="font-medium text-gray-600">{formatValue(field, newVal)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {log.user_email ?? 'systém'} · {formatTime(log.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
