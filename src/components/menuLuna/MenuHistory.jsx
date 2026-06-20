import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toISO, mondayOf, fromISO, dayNameSk, fmtDatumSk, weekRangeLabel } from '../../utils/menuDates'

// Zoskupí riadky daily_menus po týždňoch (kľúč = pondelok), najnovší hore.
function groupByWeek(rows) {
  const groups = new Map()
  for (const r of rows) {
    const mon = toISO(mondayOf(fromISO(r.menu_date)))
    if (!groups.has(mon)) groups.set(mon, [])
    groups.get(mon).push(r)
  }
  // rows už prichádzajú menu_date desc → kľúče v poradí najnovší → najstarší
  return [...groups.entries()].map(([mon, days]) => ({
    mon,
    days: [...days].sort((a, b) => a.menu_date.localeCompare(b.menu_date)),
  }))
}

function DayLine({ r }) {
  if (r.status !== 'open') {
    return (
      <div className="flex gap-2 text-[13px] py-1">
        <span className="w-28 shrink-0 text-[#8aaabb] capitalize">
          {dayNameSk(fromISO(r.menu_date))} {fmtDatumSk(fromISO(r.menu_date))}
        </span>
        <span className="italic text-[#b0626a]">
          {r.status === 'holiday' ? 'Sviatok' : 'Zatvorené'}{r.note ? ` – ${r.note}` : ''}
        </span>
      </div>
    )
  }
  return (
    <div className="flex gap-2 text-[13px] py-1 border-b border-[#f0f4f7] last:border-0">
      <span className="w-28 shrink-0 text-[#8aaabb] capitalize">
        {dayNameSk(fromISO(r.menu_date))} {fmtDatumSk(fromISO(r.menu_date))}
      </span>
      <span className="min-w-0 text-[#2b3f4c]">
        {r.soup1_name && <span className="text-[#6a8898]">{r.soup1_name} · </span>}
        {[r.main1_name, r.main2_name].filter(Boolean).join('  |  ') || <span className="text-[#b0c4cc]">—</span>}
      </span>
    </div>
  )
}

// História – minulé týždne (menu_date < pondelok aktuálneho týždňa).
export default function MenuHistory({ beforeMonday }) {
  const [weeks, setWeeks] = useState(null)

  useEffect(() => {
    let alive = true
    supabase
      .from('daily_menus')
      .select('*')
      .lt('menu_date', toISO(beforeMonday))
      .order('menu_date', { ascending: false })
      .limit(150)
      .then(({ data }) => {
        if (alive) setWeeks(groupByWeek(data ?? []))
      })
    return () => {
      alive = false
    }
  }, [beforeMonday])

  if (weeks === null) return null
  if (weeks.length === 0) {
    return <p className="text-[13px] text-[#b0c4cc] px-1 py-4">Zatiaľ žiadna história.</p>
  }

  return (
    <div className="mt-8">
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#6a8898] px-1 mb-2">História</h2>
      <div className="flex flex-col">
        {weeks.map(({ mon, days }) => (
          <div key={mon} className="py-3 border-t border-[#dbe4ea]">
            <p className="text-[12px] font-semibold text-[#8aaabb] mb-1.5">
              Týždeň {weekRangeLabel(fromISO(mon))}
            </p>
            <div>
              {days.map((r) => (
                <DayLine key={r.menu_date} r={r} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
