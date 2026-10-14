import { useEffect, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconReceipt, IconShoppingCart } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { EVENT_LABEL } from '../../lib/eventTypes'
import { voLabelWithName } from '../../lib/vo'
import { buildMenuSections } from '../../lib/menuCalc'
import { detailsFromRow, hiddenBlocksOf, menuSummaryConfig, ticketTimeOf } from '../../lib/menuSummary'
import { fetchAllRows } from '../../lib/ingredients'
import { buildIngredientSummary } from '../../lib/ingredientCalc'
import { toISO } from '../../utils/diaryWeeks'
import { DAYS_SHORT } from '../../utils/format'
import { ingredientsA4Html } from '../../utils/ingredientPrint'
import {
  hallShortOf, buildDaySummary, buildKitchenTicket, renderDaySummary,
} from '../../utils/kitchenTicket'
import TicketPreview from '../menu/TicketPreview'

const MONTHS = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún',
                'Júl', 'August', 'September', 'Október', 'November', 'December']
const WEEKDAYS = ['Po', 'Ut', 'St', 'Št', 'Pi', 'So', 'Ne']

// Stĺpce rezervácie potrebné na kalkuláciu (počty osôb, raut, požiadavky)
const BOOKING_COLS = `id, date, hall, customer_name, event_type, menu_created, raut_enabled, main_enabled, main_time, raut_time, is_vo, vo_order_no,
  guests_adults, guests_adults_no_meal, guests_specials, guests_kids_meal, guests_kids_no_meal,
  raut_extra, raut_grams, notes, main_notes, raut_notes`
// Výbery menu ako v MenuEditor (živý názov + kategória z katalógu, variant)
const SEL_COLS =
  '*, menu_items(name, category_id, has_variants, variant_group_name), variant:menu_item_variants(name)'

// „Sob 10. 10." pre zoznam vybratých dní
const dayLabel = iso => {
  const d = new Date(`${iso}T00:00:00`)
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`
}

// Sumár jedál — všetky akcie vo vybratých dňoch (jeden alebo viac dní):
// SUMÁR JEDÁL = rovnaké položky z viacerých akcií sčítané, tlač na termo
// tlačiareň (RawBT) a PNG cez náhľad; KALKULÁCIA SUROVÍN = množstvá jedál ×
// receptúry, tlač na A4.
export default function DaySummary({ refreshKey }) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(() => new Set())
  const [eventDays, setEventDays] = useState({})   // ISO → { menu, noMenu }
  const [busy, setBusy] = useState(null)           // null | 'summary' | 'ingredients'
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

  // Akcie vybratých dní, každá prepočítaná ako lístok do kuchyne — spoločné
  // pre sumár jedál aj kalkuláciu surovín. Chyba → výnimka so správou.
  async function loadEvents(dates) {
    const b = await supabase
      .from('bookings')
      .select(BOOKING_COLS)
      .is('deleted_at', null)
      .in('date', dates)
      .order('date')
      .order('main_time', { ascending: true, nullsFirst: false })
    if (b.error) throw new Error(b.error.message)
    const rows = b.data ?? []
    if (!rows.length) throw new Error('Vo vybratých dňoch nie sú žiadne akcie.')
    const ids = rows.filter(r => r.menu_created).map(r => r.id)
    const [c, s] = await Promise.all([
      supabase.from('menu_categories').select('*').order('block').order('position'),
      ids.length
        ? supabase.from('booking_menu_items').select(SEL_COLS).in('booking_id', ids).order('created_at')
        : { data: [] },
    ])
    if (c.error || s.error) throw new Error((c.error || s.error).message)

    return rows.map(r => {
      const title = r.is_vo
        ? voLabelWithName(r)
        : `${EVENT_LABEL[r.event_type] ?? r.event_type ?? 'Akcia'} – ${r.customer_name}`
      // čas podávania: hlavné jedlo, bez hlavného jedla raut
      const time = ticketTimeOf(r)
      const event = { hallShort: hallShortOf(r), date: r.date, time, title, model: null }
      if (!r.menu_created) return event
      const mainOn = r.main_enabled !== false
      const rautOn = r.raut_enabled !== false
      const summary = menuSummaryConfig(detailsFromRow(r), {
        ticketInfo: { title, date: r.date, time, hall: r.hall, hallShort: event.hallShort, notes: '' },
        // poznámky blokov — sumár ich vypíše pri sekcii s označením akcie
        mainNotes: mainOn ? r.main_notes ?? '' : '',
        rautNotes: rautOn ? r.raut_notes ?? '' : '',
      })
      const { sections, selsByCat } = buildMenuSections({
        categories:   c.data ?? [],
        selections:   (s.data ?? []).filter(x => x.booking_id === r.id),
        summary,
        hiddenBlocks: hiddenBlocksOf({ mainOn, rautOn }),
      })
      return { ...event, model: buildKitchenTicket({ sections, selsByCat, summary }) }
    })
  }

  // SUMÁR JEDÁL — náhľad termo lístka (RawBT, PNG)
  async function printSummary() {
    setBusy('summary')
    setError('')
    try {
      const dates = [...selected].sort()
      const events = await loadEvents(dates)
      setPreview({ title: 'Sumár jedál', ticket: buildDaySummary(dates, events), render: renderDaySummary, file: 'sumar_jedal' })
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  // Receptúry, ich riadky a suroviny (aj vymazané — receptúry ich ďalej počítajú)
  async function loadRecipeData() {
    const [r, l, i, c] = await Promise.all([
      supabase.from('menu_item_recipes').select('item_id, is_ingredient, yield_amount, yield_unit'),
      fetchAllRows((from, to) => supabase
        .from('menu_item_recipe_lines')
        .select('id, item_id, variant_id, ingredient_id, amount, unit')
        .order('id')
        .range(from, to)),
      supabase.from('ingredients').select('id, category_id, name, unit, position, archived_at'),
      supabase.from('ingredient_categories').select('id, name, position, archived_at'),
    ])
    const err = r.error || l.error || i.error || c.error
    if (err) throw new Error(err.message)
    return { recipes: r.data ?? [], lines: l.data, ingredients: i.data ?? [], categories: c.data ?? [] }
  }

  // KALKULÁCIA SUROVÍN — tlač na A4. Okno tlače sa otvorí hneď pri ťuknutí
  // (po await by ho prehliadač zablokoval), obsah sa doň zapíše po načítaní.
  async function printIngredients() {
    const win = window.open('', '_blank')
    if (!win) { setError('Prehliadač zablokoval okno tlače.'); return }
    win.document.write('<p style="font-family:sans-serif;padding:24px;color:#5d7d8e">Pripravujem kalkuláciu surovín…</p>')
    win.document.close()
    setBusy('ingredients')
    setError('')
    try {
      const dates = [...selected].sort()
      const [events, data] = await Promise.all([loadEvents(dates), loadRecipeData()])
      win.document.open()
      win.document.write(ingredientsA4Html(buildIngredientSummary({ dates, events, ...data })))
      win.document.close()
      win.focus()
      win.print()
    } catch (e) {
      win.close()
      setError(e.message)
    } finally {
      setBusy(null)
    }
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

        {/* SUMÁR JEDÁL (termo) a KALKULÁCIA SUROVÍN (A4) — na mobile pod sebou */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { kind: 'summary',     icon: IconReceipt,      text: 'SUMÁR JEDÁL',        onClick: printSummary },
            { kind: 'ingredients', icon: IconShoppingCart, text: 'KALKULÁCIA SUROVÍN', onClick: printIngredients },
          ].map(({ kind, icon: Icon, text, onClick }) => (
            <button
              key={kind}
              type="button"
              onClick={onClick}
              disabled={!chosen.length || !!busy}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg
                         text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: '#4cbfb3', color: '#0a2d2a' }}
            >
              <Icon size={18} />
              {busy === kind ? 'Pripravujem…' : text}
            </button>
          ))}
        </div>
      </div>

      {preview && <TicketPreview {...preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
