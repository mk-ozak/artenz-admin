import { useState, useEffect, useMemo } from 'react'
import { IconCopy, IconCheck } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import {
  activeMonday, mondayOf, addDays, toISO,
  dayNameSk, fmtDatumSk, weekRangeLabel,
} from '../../utils/menuDates'

// Texty do schránky (formát pre web lunacadca.sk)
function mainCopyText(r, n) {
  const portion = r[`main${n}_portion`] ?? ''
  const name = r[`main${n}_name`] ?? ''
  const allergens = r[`main${n}_allergens`] ?? ''
  return `${portion} | ${name} | A: ${allergens} | Polievka zahrnutá v cene menu`
}
function soupCopyText(r) {
  return `${r.soup1_name ?? ''} | 0,33L | A: ${r.soup1_allergens ?? ''}`
}

// Jeden riadok jedla/polievky: COPY ikona + text (gramáž · názov · alergény).
function ItemLine({ copyText, gramaz, nazov, alergeny }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch {
      /* schránka nedostupná – ticho ignoruj */
    }
  }
  return (
    <div className="flex items-start gap-2 py-1">
      <button
        type="button"
        onClick={copy}
        title="Kopírovať pre web"
        className="shrink-0 mt-[1px] text-[#8aaabb] hover:text-[#4cbfb3] transition-colors"
      >
        {done ? <IconCheck size={16} className="text-[#4cbfb3]" /> : <IconCopy size={16} />}
      </button>
      <p className="text-[13px] leading-snug text-[#2b3f4c]">
        {gramaz && <span className="text-[#8aaabb]">{gramaz} · </span>}
        <span>{nazov}</span>
        {alergeny && <span className="text-[#8aaabb]"> · A: {alergeny}</span>}
      </p>
    </div>
  )
}

function DayBlock({ date, row }) {
  const head = (
    <p className="text-[13px] font-bold text-[#2b3f4c] capitalize">
      {dayNameSk(date)}{' '}
      <span className="font-normal text-[12px] text-[#8aaabb]">{fmtDatumSk(date)}</span>
    </p>
  )

  if (!row || row.status === 'closed') {
    return (
      <div className="py-2 border-t border-[#f0f4f7]">
        {head}
        <p className="text-[13px] italic text-[#b0626a] mt-0.5">
          Zatvorené{row?.note ? ` – ${row.note}` : ''}
        </p>
      </div>
    )
  }

  const items = []
  if (row.soup1_name) {
    items.push(
      <ItemLine
        key="soup"
        copyText={soupCopyText(row)}
        gramaz="0,33 L"
        nazov={row.soup1_name}
        alergeny={row.soup1_allergens}
      />,
    )
  }
  for (const n of [1, 2]) {
    if (row[`main${n}_name`]) {
      items.push(
        <ItemLine
          key={`main${n}`}
          copyText={mainCopyText(row, n)}
          gramaz={row[`main${n}_portion`]}
          nazov={row[`main${n}_name`]}
          alergeny={row[`main${n}_allergens`]}
        />,
      )
    }
  }

  return (
    <div className="py-2 border-t border-[#f0f4f7]">
      {head}
      {items.length > 0 ? (
        <div className="mt-0.5">{items}</div>
      ) : (
        <p className="text-[13px] text-[#b0c4cc] mt-0.5">Zatiaľ nedoplnené</p>
      )}
    </div>
  )
}

// Popis týždňa podľa vzdialenosti od tohto pondelka (0, 1, 2 týždne).
function weekInfo(monday, thisMonday) {
  const offset = Math.round((monday - thisMonday) / (7 * 24 * 3600 * 1000))
  if (offset === 0) return { label: 'Tento týždeň', menuFor: 'tento týždeň' }
  if (offset === 1) return { label: 'Nasledujúci týždeň', menuFor: 'nasledujúci týždeň' }
  return { label: 'O dva týždne', menuFor: weekRangeLabel(monday) }
}

// Náhľad menu na domovskej obrazovke – text + COPY ikony.
// „Aktuálne" podľa rovnakých podmienok ako Denné menu (activeMonday),
// „Budúce" = týždeň po aktuálnom.
export default function CurrentMenuPreview() {
  const thisMonday = useMemo(() => mondayOf(new Date()), [])
  const currentMonday = useMemo(() => activeMonday(new Date()), [])
  const [future, setFuture] = useState(false)
  const monday = useMemo(
    () => (future ? addDays(currentMonday, 7) : currentMonday),
    [future, currentMonday],
  )
  const iso = toISO(monday)
  const [loaded, setLoaded] = useState(null) // { iso, rows } – posledný načítaný týždeň

  useEffect(() => {
    let alive = true
    supabase
      .from('daily_menus')
      .select('*')
      .gte('menu_date', toISO(monday))
      .lte('menu_date', toISO(addDays(monday, 4)))
      .order('menu_date')
      .then(({ data }) => {
        if (alive) setLoaded({ iso: toISO(monday), rows: data ?? [] })
      })
    return () => {
      alive = false
    }
  }, [monday])

  if (loaded === null) return null

  const rows = loaded.iso === iso ? loaded.rows : null // null = načítavam iný týždeň
  const byDate = {}
  for (const r of rows ?? []) byDate[r.menu_date] = r
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i))
  const hasAny = (rows ?? []).some(
    (r) => r.soup1_name || r.main1_name || r.main2_name || r.status === 'closed',
  )
  const { label, menuFor } = weekInfo(monday, thisMonday)

  return (
    <div className="px-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-1 mb-1.5">
        <div className="inline-grid grid-cols-2 rounded-lg bg-white border border-gray-200 p-1
                        shadow-[0_2px_10px_rgba(53,77,93,.10)]">
          {[
            { v: false, text: 'Aktuálne menu' },
            { v: true, text: 'Budúce menu' },
          ].map(({ v, text }) => {
            const active = future === v
            return (
              <button
                key={text}
                type="button"
                onClick={() => setFuture(v)}
                aria-pressed={active}
                className={`px-3 py-1.5 rounded-md text-[12px] font-bold uppercase tracking-wide truncate
                            transition-colors ${active ? '' : 'text-[#6a8898] hover:text-[#2b3f4c]'}`}
                style={active ? { background: '#4cbfb3', color: '#0a2d2a' } : undefined}
              >
                {text}
              </button>
            )
          })}
        </div>
        <span className="text-[12px] text-[#8aaabb]">
          {label} · {weekRangeLabel(monday)}
        </span>
      </div>

      {rows === null ? (
        <p className="text-[13px] text-[#8aaabb] px-1 py-3">Načítavam…</p>
      ) : !hasAny ? (
        <p className="text-[13px] text-[#b0c4cc] px-1 py-3">
          Menu na {menuFor} ešte nie je nahraté.
        </p>
      ) : (
        <div className="rounded-card border border-[#e8eef2] bg-white px-3.5 py-1">
          {days.map((date) => (
            <DayBlock key={toISO(date)} date={date} row={byDate[toISO(date)]} />
          ))}
        </div>
      )}
    </div>
  )
}
