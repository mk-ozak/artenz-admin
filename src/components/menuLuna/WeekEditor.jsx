import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { toISO, addDays, dayNameSk, fmtDatumSk } from '../../utils/menuDates'
import { inputCls, Label, PortionSelect } from './menuFields'

const STATUS_OPTS = [
  { value: 'open', label: 'Otvorené' },
  { value: 'closed', label: 'Zatvorené' },
]

// Prázdny deň (zobrazený, kým sa neuloží do DB). Polievka 2 a cena
// hlavných jedál sú predvyplnené – nové jedlo dostane default cenu.
function emptyRow(menu_date, defaultPrice) {
  return {
    menu_date,
    status: 'open',
    note: '',
    soup1_name: '',
    soup1_allergens: '',
    soup2_name: 'Vývar s rezancami/cestovinou',
    soup2_allergens: '1,3,9',
    main1_name: '', main1_allergens: '', main1_portion: '', main1_price: defaultPrice ?? null,
    main2_name: '', main2_allergens: '', main2_portion: '', main2_price: defaultPrice ?? null,
  }
}

function StatusToggle({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 rounded-lg bg-white border border-gray-200 p-1
                    shadow-[0_2px_10px_rgba(53,77,93,.10)] w-full sm:w-auto">
      {STATUS_OPTS.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold truncate transition-colors
                        ${active ? '' : 'text-gray-600 hover:text-gray-900'}`}
            style={active ? { background: '#4cbfb3', color: '#0a2d2a' } : undefined}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function DayCard({ date, row, portionOptions, onPatch }) {
  const open = row.status === 'open'
  return (
    <div className="rounded-card border border-[#e8eef2] bg-white p-3.5">
      {/* hlavička dňa + status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="font-bold text-[15px] text-[#2b3f4c] capitalize">
          {dayNameSk(date)}{' '}
          <span className="font-normal text-[13px] text-[#8aaabb]">{fmtDatumSk(date)}</span>
        </div>
        <StatusToggle value={open ? 'open' : 'closed'} onChange={(v) => onPatch({ status: v })} />
      </div>

      {!open ? (
        <div>
          <Label>Dôvod zatvorenia</Label>
          <input
            className={inputCls}
            value={row.note ?? ''}
            placeholder="Napr. sviatok – Veľká noc, dovolenka…"
            onChange={(e) => onPatch({ note: e.target.value })}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Polievka 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
            <div>
              <Label>Polievka (0,33 l)</Label>
              <input className={inputCls} value={row.soup1_name ?? ''} placeholder="Denná polievka"
                     onChange={(e) => onPatch({ soup1_name: e.target.value })} />
            </div>
            <div>
              <Label>Alergény</Label>
              <input className={inputCls} value={row.soup1_allergens ?? ''} placeholder="napr. 1,3,9"
                     onChange={(e) => onPatch({ soup1_allergens: e.target.value })} />
            </div>
          </div>

          {/* Polievka 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
            <div>
              <Label>Polievka 2</Label>
              <input className={inputCls} value={row.soup2_name ?? ''}
                     onChange={(e) => onPatch({ soup2_name: e.target.value })} />
            </div>
            <div>
              <Label>Alergény</Label>
              <input className={inputCls} value={row.soup2_allergens ?? ''}
                     onChange={(e) => onPatch({ soup2_allergens: e.target.value })} />
            </div>
          </div>

          {/* Hlavné 1 a 2 */}
          {[1, 2].map((n) => (
            <div key={n} className="grid grid-cols-1 sm:grid-cols-[1fr_110px_120px_90px] gap-2">
              <div>
                <Label>Hlavné jedlo {n}</Label>
                <input className={inputCls} value={row[`main${n}_name`] ?? ''} placeholder={`Jedlo ${n}`}
                       onChange={(e) => onPatch({ [`main${n}_name`]: e.target.value })} />
              </div>
              <div>
                <Label>Alergény</Label>
                <input className={inputCls} value={row[`main${n}_allergens`] ?? ''} placeholder="1,3,7"
                       onChange={(e) => onPatch({ [`main${n}_allergens`]: e.target.value })} />
              </div>
              <div>
                <Label>Gramáž</Label>
                <PortionSelect value={row[`main${n}_portion`]} options={portionOptions}
                               onChange={(v) => onPatch({ [`main${n}_portion`]: v })} />
              </div>
              <div>
                <Label>Cena €</Label>
                <input type="number" inputMode="decimal" step="0.10" min="0" className={inputCls}
                       value={row[`main${n}_price`] ?? ''}
                       onChange={(e) => onPatch({ [`main${n}_price`]: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Znovupoužiteľný editor jedného týždňa (pondelok–piatok).
// Použije ho aj Task 6 (Import) pre ľubovoľný `monday`.
//   monday          – Date (pondelok týždňa)
//   portionOptions  – string[] z app_settings
//   defaultPrice    – number (default cena nového denného jedla)
//   onSaved         – voliteľný callback po uložení
export default function WeekEditor({ monday, portionOptions = [], defaultPrice = null, onSaved }) {
  const mondayIso = toISO(monday)
  const fridayIso = toISO(addDays(monday, 4))
  const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i))

  const [rows, setRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [stav, setStav] = useState('')
  const timers = useRef({})
  const pending = useRef(new Set()) // dni s neuloženou/rozpracovanou zmenou

  const nacitaj = useCallback(async () => {
    const { data } = await supabase
      .from('daily_menus')
      .select('*')
      .gte('menu_date', mondayIso)
      .lte('menu_date', fridayIso)
      .order('menu_date')
    setRows((prev) => {
      const map = {}
      for (const r of data ?? []) map[r.menu_date] = r
      // zachovaj práve editované dni (debounce ešte beží)
      for (const md of pending.current) if (prev[md]) map[md] = prev[md]
      return map
    })
    setLoading(false)
  }, [mondayIso, fridayIso])

  useEffect(() => {
    setLoading(true)
    nacitaj()
  }, [nacitaj])

  // realtime – sync medzi zariadeniami; práve editované dni neprepisuje
  useEffect(() => {
    const ch = supabase
      .channel('daily_menus_' + mondayIso)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_menus' }, (payload) => {
        const md = payload.new?.menu_date ?? payload.old?.menu_date
        if (!md || md < mondayIso || md > fridayIso) return
        if (pending.current.has(md)) return
        nacitaj()
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [mondayIso, fridayIso, nacitaj])

  function ulozDen(menu_date, row) {
    setRows((prev) => ({ ...prev, [menu_date]: row })) // hneď v UI
    pending.current.add(menu_date)
    clearTimeout(timers.current[menu_date])
    setStav('Ukladám…')
    timers.current[menu_date] = setTimeout(async () => {
      const { error } = await supabase
        .from('daily_menus')
        .upsert({ ...row, menu_date }, { onConflict: 'menu_date' })
      pending.current.delete(menu_date)
      setStav(error ? 'Chyba pri ukladaní' : 'Uložené ✓')
      onSaved?.()
    }, 700)
  }

  if (loading) {
    return <div className="text-sm text-[#8aaabb] px-1 py-6">Načítavam týždeň…</div>
  }

  return (
    <div>
      <div className="flex justify-end h-5 mb-1">
        <span className={`text-xs ${stav.startsWith('Chyba') ? 'text-red-500' : 'text-[#8aaabb]'}`}>{stav}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {days.map((date) => {
          const iso = toISO(date)
          const row = rows[iso] ?? emptyRow(iso, defaultPrice)
          return (
            <DayCard
              key={iso}
              date={date}
              row={row}
              portionOptions={portionOptions}
              onPatch={(patch) => ulozDen(iso, { ...row, ...patch })}
            />
          )
        })}
      </div>
    </div>
  )
}
