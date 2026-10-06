import { useEffect, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconReceipt } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { EVENT_LABEL } from '../../lib/eventTypes'
import { buildMenuSections } from '../../lib/menuCalc'
import { RAUT_BLOCKS, detailsFromRow, menuSummaryConfig } from '../../lib/menuSummary'
import { toISO } from '../../utils/diaryWeeks'
import { DAYS_SHORT } from '../../utils/format'
import {
  HALL_SHORT, buildDaySummary, buildKitchenTicket, renderDaySummary,
} from '../../utils/kitchenTicket'
import TicketPreview from '../menu/TicketPreview'

const MONTHS = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún',
                'Júl', 'August', 'September', 'Október', 'November', 'December']
const WEEKDAYS = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']

// Stĺpce rezervácie potrebné na kalkuláciu (počty osôb, raut, požiadavky)
const BOOKING_COLS = `id, date, hall, customer_name, event_type, start_time, menu_created, raut_enabled,
  guests_adults, guests_adults_no_meal, guests_specials, guests_kids_meal, guests_kids_no_meal,
  raut_extra, raut_grams, notes`
// Výbery menu ako v MenuEditor (živý názov + kategória z katalógu, variant)
const SEL_COLS =
  '*, menu_items(name, category_id, has_variants, variant_group_name), variant:menu_item_variants(name)'

// „Sob 10. 10." pre zoznam vybratých dní
const dayLabel = iso => {
  const d = new Date(`${iso}T00:00:00`)
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`
}

// Sumár jedál — kalkulácia všetkých akcií vo vybratých dňoch (jeden alebo
// viac dní). Rovnaké položky z viacerých akcií sa sčítajú; tlač na termo
// tlačiareň (RawBT) a PNG cez náhľad.
export default function DaySummary({ refreshKey }) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(() => new Set())
  const [eventDays, setEventDays] = useState({})   // ISO → { menu, noMenu }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

  // Akcie v zobrazenom mesiaci — bodky v kalendári
  useEffect(() => {
    const first = toISO(month)
    const last = toISO(new Date(month.getFullYear(), month.getMonth() + 1, 0))
    supabase
      .from('bookings')
      .select('date, menu_created')
      .is('deleted_at', null)
      .gte('date', first)
      .lte('date', last)
      .then(({ data }) => {
        const map = {}
        for (const r of data ?? []) {
          const e = (map[r.date] ??= { menu: 0, noMenu: 0 })
          if (r.menu_created) e.menu++
          else e.noMenu++
        }
        setEventDays(map)
      })
  }, [month, refreshKey])

  function toggle(iso) {
    setSelected(s => {
      const n = new Set(s)
      if (n.has(iso)) n.delete(iso)
      else n.add(iso)
      return n
    })
  }

  // Načíta akcie vybratých dní, každú prepočíta ako lístok do kuchyne a sčíta
  async function printSummary() {
    setBusy(true)
    setError('')
    const dates = [...selected].sort()
    const b = await supabase
      .from('bookings')
      .select(BOOKING_COLS)
      .is('deleted_at', null)
      .in('date', dates)
      .order('date')
      .order('start_time', { ascending: true, nullsFirst: false })
    if (b.error) { setError(b.error.message); setBusy(false); return }
    const rows = b.data ?? []
    if (!rows.length) {
      setError('Vo vybratých dňoch nie sú žiadne akcie.')
      setBusy(false)
      return
    }
    const ids = rows.filter(r => r.menu_created).map(r => r.id)
    const [c, s] = await Promise.all([
      supabase.from('menu_categories').select('*').order('block').order('position'),
      ids.length
        ? supabase.from('booking_menu_items').select(SEL_COLS).in('booking_id', ids).order('created_at')
        : { data: [] },
    ])
    if (c.error || s.error) { setError((c.error || s.error).message); setBusy(false); return }

    const events = rows.map(r => {
      const title = `${EVENT_LABEL[r.event_type] ?? r.event_type ?? 'Akcia'} – ${r.customer_name}`
      const time = r.start_time ? r.start_time.slice(0, 5) : ''
      const event = { hallShort: HALL_SHORT[r.hall] ?? r.hall, date: r.date, time, title, model: null }
      if (!r.menu_created) return event
      const summary = menuSummaryConfig(detailsFromRow(r), {
        ticketInfo: { title, date: r.date, time, hall: r.hall, hallShort: event.hallShort, notes: '' },
      })
      const { sections, selsByCat } = buildMenuSections({
        categories:   c.data ?? [],
        selections:   (s.data ?? []).filter(x => x.booking_id === r.id),
        summary,
        hiddenBlocks: r.raut_enabled === false ? RAUT_BLOCKS : [],
      })
      return { ...event, model: buildKitchenTicket({ sections, selsByCat, summary }) }
    })
    setPreview({ title: 'Kalkulácia', ticket: buildDaySummary(dates, events), render: renderDaySummary, file: 'kalkulacia' })
    setBusy(false)
  }

  // Mriežka mesiaca od pondelka
  const offset = (month.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const today = toISO(new Date())
  const cells = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toISO(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ]
  const shiftMonth = n => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1))
  const chosen = [...selected].sort()

  return (
    <div className="rounded-card bg-white border border-[#e0e8ec] overflow-hidden">
      <p className="text-[10px] text-[#8aaabb] tracking-widest uppercase px-4 pt-3 pb-1">
        Sumár jedál
      </p>

      <div className="px-4 pb-4">
        {/* Kalendár — ťuknutím sa deň vyberie / zruší; bodka = akcia v ten deň */}
        <div className="flex items-center justify-between mb-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Predchádzajúci mesiac"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5d7d8e] hover:bg-[#f0f6f9]"
          >
            <IconChevronLeft size={18} />
          </button>
          <p className="text-sm font-semibold text-[#1a2830]">
            {MONTHS[month.getMonth()]} {month.getFullYear()}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Nasledujúci mesiac"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5d7d8e] hover:bg-[#f0f6f9]"
          >
            <IconChevronRight size={18} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map(w => (
            <p key={w} className="text-[10px] font-semibold uppercase text-[#9ab0ba] py-1">{w}</p>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <span key={`e${i}`} />
            const on = selected.has(iso)
            const ev = eventDays[iso]
            return (
              <button
                key={iso}
                type="button"
                onClick={() => toggle(iso)}
                aria-pressed={on}
                className={`h-10 rounded-lg flex flex-col items-center justify-center text-sm transition-colors
                            ${on
                              ? 'bg-[#4cbfb3] text-[#0a2d2a] font-bold'
                              : `text-[#3a5160] hover:bg-[#f0f6f9] ${iso === today ? 'ring-1 ring-[#4cbfb3]' : ''}`}`}
              >
                {Number(iso.slice(8))}
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5
                                  ${ev?.menu ? (on ? 'bg-[#0a2d2a]' : 'bg-[#2a8d83]')
                                    : ev?.noMenu ? 'bg-[#cfdbe2]' : 'bg-transparent'}`} />
              </button>
            )
          })}
        </div>

        {chosen.length > 0 && (
          <p className="mt-2 text-[12px] text-[#5d7d8e]">
            <span className="font-semibold">Vybraté:</span> {chosen.map(dayLabel).join(', ')}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-2 text-[#2a8d83] font-semibold hover:underline"
            >
              zrušiť
            </button>
          </p>
        )}

        {error && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={printSummary}
          disabled={!chosen.length || busy}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg
                     text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: '#4cbfb3', color: '#0a2d2a' }}
        >
          <IconReceipt size={18} />
          {busy ? 'Pripravujem…' : 'Tlačiť kalkuláciu'}
        </button>
      </div>

      {preview && <TicketPreview {...preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
