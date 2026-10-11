import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ACTION_LABEL, FIELD_LABEL, VO_ACTION_LABEL, fetchUserNames, formatTime, formatValue, userLabel } from '../../lib/activityLog'
import { VO_VISIBLE_FIELDS } from '../../lib/vo'

// Akcie so zákazníckym účtom — v kontexte rezervácie zrozumiteľnejšie názvy
const CUSTOMER_ACTION_LABEL = {
  customer_access_create: 'Vytvoril prístup zákazníka',
  user_password_reset:    'Vygeneroval nové heslo zákazníka',
  user_delete:            'Odobral prístup zákazníka',
}

// Zmeny len v poliach, ktoré smie vidieť VO (bez nich záznam úpravy vypadne)
function onlyVisibleChanges(log) {
  const changes = log.details?.changes
  if (!changes) return log
  const visible = Object.fromEntries(
    Object.entries(changes).filter(([field]) => VO_VISIBLE_FIELDS.includes(field))
  )
  const details = { ...log.details, changes: Object.keys(visible).length ? visible : undefined }
  return { ...log, details }
}

// História rezervácie — logy činností len k tejto rezervácii (malým šedým
// písmom naspodu detailu). Logy číta cez RLS len admin.
//   • záznamy rezervácie (entity_id = id rezervácie)
//   • vytvorenie prístupu zákazníka (details.booking_id)
//   • nové heslo / odobratie prístupu (entity_id = zákaznícky účet z predošlého)
// booking/access sa menia po uložení v modáli a pri zmenách prístupu →
// história sa načíta znova.
// vo: objednávka VO (texty „…objednávku"); restricted: históriu číta VO —
// vidí len zmeny polí objednávky, nie naše interné údaje (cena, záloha…).
export default function BookingHistory({ bookingId, booking, access, vo = false, restricted = false }) {
  const [logs, setLogs]   = useState([])
  const [names, setNames] = useState({})  // { user_id: meno }

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [{ data: own, error }, userNames] = await Promise.all([
        supabase
          .from('activity_logs')
          .select('*')
          .or(`entity_id.eq.${bookingId},details->>booking_id.eq.${bookingId}`),
        fetchUserNames(),
      ])
      if (error) { console.error('[BookingHistory]', error.message); return }

      const customerIds = own
        .filter(l => l.action === 'customer_access_create' && l.entity_id)
        .map(l => l.entity_id)
      let customer = []
      if (customerIds.length) {
        const { data } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('entity', 'user')
          .in('entity_id', customerIds)
          .in('action', ['user_password_reset', 'user_delete'])
        customer = data ?? []
      }

      // Úprava bez zmenených polí = technický zápis (napr. priradenie
      // zákazníckeho účtu) — ten je v histórii vlastným riadkom
      const all = [...own, ...customer]
        .map(l => restricted ? onlyVisibleChanges(l) : l)
        .filter(l => l.action !== 'booking_update' || l.details?.changes)
        .sort((a, b) => a.id - b.id)
      if (!cancelled) { setLogs(all); setNames(userNames) }
    }

    load()
    return () => { cancelled = true }
  }, [bookingId, booking, access, restricted])

  if (!logs.length) return null

  return (
    <div className="pt-4 mt-2 border-t border-[#eef3f6]">
      <p className="text-[10px] text-[#9ab0ba] tracking-widest uppercase mb-1.5">
        {vo ? 'História objednávky' : 'História rezervácie'}
      </p>
      <ul className="space-y-1">
        {logs.map(log => (
          <li key={log.id} className="text-[11px] leading-snug text-[#9ab0ba]">
            <span className="tabular-nums">{formatTime(log.created_at)}</span>
            {' · '}
            <span className="text-[#7f98a5]">
              {CUSTOMER_ACTION_LABEL[log.action] ?? (vo ? VO_ACTION_LABEL[log.action] : undefined) ?? ACTION_LABEL[log.action] ?? log.action}
            </span>
            {' · '}
            {userLabel(log, names)}
            {log.details?.changes && (
              <ul className="pl-3">
                {Object.entries(log.details.changes).map(([field, [oldVal, newVal]]) => (
                  <li key={field}>
                    {FIELD_LABEL[field] ?? field}: {formatValue(field, oldVal)} → {formatValue(field, newVal)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
