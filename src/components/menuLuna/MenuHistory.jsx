import { useState, useEffect, useMemo } from 'react'
import { IconSearch } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { toISO, mondayOf, fromISO, dayNameSk, fmtDatumSk, weekRangeLabel } from '../../utils/menuDates'

const PAGE = 30 // koľko týždňov ukázať naraz (bez vyhľadávania)

// normalizácia pre vyhľadávanie: bez diakritiky, malé písmená
function norm(s) {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Zv\u00fdrazn\u00ed h\u013eadan\u00e9 slov\u00e1 v p\u00f4vodnom texte (so zachovan\u00edm diakritiky).
// Normalizuje znak po znaku, aby sa poz\u00edcia zhody dala namapova\u0165 sp\u00e4\u0165 na origin\u00e1l.
function Highlight({ text, words }) {
  const src = text ?? ''
  if (!words || words.length === 0 || !src) return src

  // normalizovan\u00fd re\u0165azec + mapa: poz\u00edcia v norme \u2192 index p\u00f4vodn\u00e9ho znaku
  let normStr = ''
  const idxMap = []
  for (let i = 0; i < src.length; i++) {
    const n = norm(src[i])
    for (let k = 0; k < n.length; k++) idxMap.push(i)
    normStr += n
  }

  // ozna\u010d p\u00f4vodn\u00e9 znaky, ktor\u00e9 spadaj\u00fa do nejakej zhody
  const hit = new Array(src.length).fill(false)
  for (const w of words) {
    if (!w) continue
    let from = 0
    let at
    while ((at = normStr.indexOf(w, from)) !== -1) {
      for (let j = at; j < at + w.length; j++) hit[idxMap[j]] = true
      from = at + w.length
    }
  }

  // poskladaj s\u00favisl\u00e9 \u00faseky (zv\u00fdraznen\u00e9 / nezv\u00fdraznen\u00e9)
  const parts = []
  let buf = ''
  let bufHit = hit[0] ?? false
  for (let i = 0; i < src.length; i++) {
    if (hit[i] === bufHit) {
      buf += src[i]
    } else {
      parts.push({ text: buf, hit: bufHit })
      buf = src[i]
      bufHit = hit[i]
    }
  }
  if (buf) parts.push({ text: buf, hit: bufHit })

  return parts.map((p, i) =>
    p.hit ? (
      <mark key={i} className="bg-[#fff0a6] text-inherit rounded-[2px] px-0.5">
        {p.text}
      </mark>
    ) : (
      <span key={i}>{p.text}</span>
    ),
  )
}

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

function DayLine({ r, words }) {
  if (r.status !== 'open') {
    return (
      <div className="flex gap-2 text-[13px] py-1">
        <span className="w-28 shrink-0 text-[#8aaabb] capitalize">
          {dayNameSk(fromISO(r.menu_date))} {fmtDatumSk(fromISO(r.menu_date))}
        </span>
        <span className="italic text-[#b0626a]">
          Zatvorené{r.note ? <> – <Highlight text={r.note} words={words} /></> : ''}
        </span>
      </div>
    )
  }
  const mains = [r.main1_name, r.main2_name].filter(Boolean)
  return (
    <div className="flex gap-2 text-[13px] py-1 border-b border-[#f0f4f7] last:border-0">
      <span className="w-28 shrink-0 text-[#8aaabb] capitalize">
        {dayNameSk(fromISO(r.menu_date))} {fmtDatumSk(fromISO(r.menu_date))}
      </span>
      <span className="min-w-0 text-[#2b3f4c]">
        {r.soup1_name && (
          <span className="text-[#6a8898]">
            <Highlight text={r.soup1_name} words={words} /> ·{' '}
          </span>
        )}
        {mains.length > 0
          ? mains.map((m, i) => (
              <span key={i}>
                {i > 0 && '  |  '}
                <Highlight text={m} words={words} />
              </span>
            ))
          : <span className="text-[#b0c4cc]">—</span>}
      </span>
    </div>
  )
}

// História – minulé týždne (menu_date < pondelok aktuálneho týždňa)
// + naživo filtrujúci fulltext (bez diakritiky, podľa slov).
export default function MenuHistory({ beforeMonday }) {
  const [rows, setRows] = useState(null)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)

  useEffect(() => {
    let alive = true
    supabase
      .from('daily_menus')
      .select('*')
      .lt('menu_date', toISO(beforeMonday))
      .order('menu_date', { ascending: false })
      .limit(2000)
      .then(({ data }) => {
        if (alive) setRows(data ?? [])
      })
    return () => {
      alive = false
    }
  }, [beforeMonday])

  const q = norm(query).trim()
  const words = useMemo(() => (q ? q.split(/\s+/) : []), [q])

  const filtered = useMemo(() => {
    if (!rows) return []
    if (!q) return rows
    return rows.filter((r) => {
      const text = norm(`${r.soup1_name ?? ''} ${r.main1_name ?? ''} ${r.main2_name ?? ''} ${r.note ?? ''}`)
      return words.every((w) => text.includes(w))
    })
  }, [rows, q])

  const weeks = useMemo(() => groupByWeek(filtered), [filtered])

  if (rows === null) return null

  const searching = q.length > 0
  const visible = searching ? weeks : weeks.slice(0, shown)
  const hasMore = !searching && weeks.length > shown

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-3 px-1 mb-2">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#6a8898]">História</h2>
        <div className="relative">
          <IconSearch size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#b0c4cc]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hľadať v histórii…"
            className="w-44 sm:w-60 border border-[#e2e8ed] rounded-lg pl-8 pr-2.5 py-1.5 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-[#4cbfb3]/40 focus:border-[#4cbfb3]
                       placeholder:text-[#b0c4cc]"
          />
        </div>
      </div>

      {weeks.length === 0 ? (
        <p className="text-[13px] text-[#b0c4cc] px-1 py-4">
          {searching ? 'Žiadne jedlo nezodpovedá hľadaniu.' : 'Zatiaľ žiadna história.'}
        </p>
      ) : (
        <div className="flex flex-col">
          {visible.map(({ mon, days }) => (
            <div key={mon} className="py-3 border-t border-[#dbe4ea]">
              <p className="text-[12px] font-semibold text-[#8aaabb] mb-1.5">
                Týždeň {weekRangeLabel(fromISO(mon))}
              </p>
              <div>
                {days.map((r) => (
                  <DayLine key={r.menu_date} r={r} words={words} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => setShown((s) => s + 100)}
            className="rounded-lg border border-[#cdd9e0] px-4 py-2 text-sm font-semibold
                       text-[#6a8898] hover:border-[#8aaabb] hover:text-[#2b3f4c] transition-colors"
          >
            Načítať staršie týždne
          </button>
        </div>
      )}
    </div>
  )
}
