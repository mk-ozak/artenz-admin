import { useEffect, useRef, useState } from 'react'
import { IconEraser, IconPlus, IconPrinter, IconTemplate, IconX } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import MenuEditor from '../menu/MenuEditor'

const fmtQty = q => String(Number(q)).replace('.', ',')
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const headerBtnCls = `w-9 h-9 rounded-lg flex items-center justify-center
  transition-colors hover:bg-white/10`

// Počty hostí — pole vo formulári → stĺpec v bookings
const DETAIL_COLS = {
  guestsAdults:       'guests_adults',
  guestsAdultsNoMeal: 'guests_adults_no_meal',
  guestsSpecials:     'guests_specials',
  guestsKidsMeal:     'guests_kids_meal',
  guestsKidsNoMeal:   'guests_kids_no_meal',
  rautExtra:          'raut_extra',
  notes:              'notes',
}
const detailInputCls = `w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
  focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500`

// MENU rezervácie: hlavička s akciami (načítať šablónu, reset, tlač)
// + spoločný editor menu. Zmeny sa ukladajú okamžite.
export default function BookingMenu({ bookingId, editable, printSubtitle = '' }) {
  // Po hromadnej zmene (šablóna / reset) editor remountneme — načíta sa nanovo
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy]   = useState(false)

  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates]         = useState(null)  // null = načítava

  // Prvý klik = potvrdenie (~4 s), druhý = vymazanie všetkých položiek
  const [confirmReset, setConfirmReset] = useState(false)
  const resetTimer = useRef(null)

  // Počty hostí + požiadavky ku strave — vlastní táto sekcia, ukladá sa samo (onBlur)
  const [details, setDetails] = useState(null)
  // Je pre rezerváciu vytvorené menu? (null = načítava)
  const [menuCreated, setMenuCreated] = useState(null)

  useEffect(() => {
    supabase
      .from('bookings')
      .select('guests_adults, guests_adults_no_meal, guests_specials, guests_kids_meal, guests_kids_no_meal, raut_extra, notes, menu_created')
      .eq('id', bookingId)
      .single()
      .then(({ data }) => {
        setDetails({
          guestsAdults:       data?.guests_adults ?? '',
          guestsAdultsNoMeal: data?.guests_adults_no_meal ?? '',
          guestsSpecials:     data?.guests_specials ?? '',
          guestsKidsMeal:     data?.guests_kids_meal ?? '',
          guestsKidsNoMeal:   data?.guests_kids_no_meal ?? '',
          rautExtra:          data?.raut_extra ?? '',
          notes:              data?.notes ?? '',
        })
        setMenuCreated(!!data?.menu_created)
      })
  }, [bookingId])

  // Vytvorenie prázdneho menu — nastaví príznak, položky ostanú prázdne
  async function createEmptyMenu() {
    setBusy(true)
    setError('')
    await supabase.from('booking_menu_items').delete().eq('booking_id', bookingId)
    const { error } = await supabase
      .from('bookings')
      .update({ menu_created: true })
      .eq('id', bookingId)
    setBusy(false)
    if (error) { setError(error.message); return }
    setMenuCreated(true)
    setShowTemplates(false)
    setRefreshKey(k => k + 1)
  }

  async function saveDetail(field) {
    const raw = details[field]
    const value = field === 'notes'
      ? (raw.trim() || null)
      : (raw === '' ? null : Number(raw))
    const { error } = await supabase
      .from('bookings')
      .update({ [DETAIL_COLS[field]]: value })
      .eq('id', bookingId)
    if (error) setError(error.message)
  }

  // Číselné okienko počtu hostí
  function numField(field, label) {
    return (
      <div className="min-w-0">
        <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
        <input
          type="number"
          min="0"
          placeholder="0"
          value={details[field]}
          disabled={!editable}
          onChange={e => setDetails(d => ({ ...d, [field]: e.target.value }))}
          onBlur={() => saveDetail(field)}
          className={detailInputCls}
        />
      </div>
    )
  }

  // Počet ľudí na raut = (dospelí + špeciály) + zaokrúhlené nahor(deti s jedlom / 2)
  const rautBase = details
    ? (Number(details.guestsAdults) || 0) + (Number(details.guestsSpecials) || 0)
      + Math.ceil((Number(details.guestsKidsMeal) || 0) / 2)
    : 0
  const rautTotal = rautBase + (Number(details?.rautExtra) || 0)

  // Polia napevno navrchu blokov:
  // dospelí → blok 1, deti → blok 2, špeciály + požiadavky → blok 3, raut → blok 4
  const menuBlockSlots = details ? {
    1: (
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        {numField('guestsAdults', 'Dospelí (bez špeciálov)')}
        {numField('guestsAdultsNoMeal', 'Dospelí bez jedla')}
      </div>
    ),
    2: (
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        {numField('guestsKidsMeal', 'Deti s jedlom')}
        {numField('guestsKidsNoMeal', 'Deti bez jedla')}
      </div>
    ),
    3: (
      <div className="px-4 py-3 flex gap-3 items-end">
        <div className="w-20 shrink-0">
          {numField('guestsSpecials', 'Špeciály')}
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Špeciálne požiadavky ku strave
          </label>
          <input
            type="text"
            value={details.notes}
            disabled={!editable}
            onChange={e => setDetails(d => ({ ...d, notes: e.target.value }))}
            onBlur={() => saveDetail('notes')}
            placeholder="Alergény, diéty, bezlepkové…"
            className={detailInputCls}
          />
        </div>
      </div>
    ),
    4: (
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Počet ľudí na raut</label>
          <input type="text" readOnly value={rautTotal} className={`${detailInputCls} bg-gray-50`} />
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Raut navyše/menej</label>
          <input
            type="number"
            placeholder="0"
            value={details.rautExtra}
            disabled={!editable}
            onChange={e => setDetails(d => ({ ...d, rautExtra: e.target.value }))}
            onBlur={() => saveDetail('rautExtra')}
            className={detailInputCls}
          />
        </div>
      </div>
    ),
  } : undefined

  // Konfigurácia zhrnutia — sekcie podľa blokov + množstvá z počtov hostí
  const menuSummary = details ? {
    titles: {
      1: 'Hlavné jedlo - dospelí',
      2: 'Hlavné jedlo deti',
      3: 'Hlavné jedlo špeciál',
      4: 'Švédske stoly',
      5: 'Studená kuchyňa',
    },
    fixedQty: {
      1: Number(details.guestsAdults) || 0,
      // 2 deti s jedlom = 1 porcia (zaokrúhlené nahor)
      2: Math.ceil((Number(details.guestsKidsMeal) || 0) / 2),
      4: rautTotal,
    },
    checkBlock:  3,
    checkTarget: Number(details.guestsSpecials) || 0,
    // Raut: naklikané kg vs počet ľudí na raut × 0,2 kg
    weightCheck: { block: 4, perPerson: 0.2, people: rautTotal },
  } : undefined

  async function openTemplates() {
    setShowTemplates(true)
    setTemplates(null)
    const { data, error } = await supabase
      .from('menu_templates')
      .select('*, menu_template_items(count)')
      .order('name')
    if (error) { setError(error.message); setShowTemplates(false); return }
    setTemplates(data ?? [])
  }

  // Načítanie šablóny nahradí doterajší výber kópiou položiek šablóny
  async function applyTemplate(tpl) {
    setBusy(true)
    setError('')
    const { data: tplItems, error: tErr } = await supabase
      .from('menu_template_items')
      .select('*')
      .eq('template_id', tpl.id)
    if (tErr) { setError(tErr.message); setBusy(false); return }

    const { error: delErr } = await supabase
      .from('booking_menu_items')
      .delete()
      .eq('booking_id', bookingId)
    if (delErr) { setError(delErr.message); setBusy(false); return }

    if (tplItems.length > 0) {
      const rows = tplItems.map(t => ({
        booking_id:  bookingId,
        category_id: t.category_id,
        item_id:     t.item_id,
        item_name:   t.item_name,
        quantity:    t.quantity,
      }))
      const { error: insErr } = await supabase.from('booking_menu_items').insert(rows)
      if (insErr) setError(insErr.message)
    }
    await supabase.from('bookings').update({ menu_created: true }).eq('id', bookingId)
    setMenuCreated(true)
    setBusy(false)
    setShowTemplates(false)
    setRefreshKey(k => k + 1)
  }

  async function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true)
      clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setConfirmReset(false), 4000)
      return
    }
    clearTimeout(resetTimer.current)
    setConfirmReset(false)
    setBusy(true)
    const { error } = await supabase
      .from('booking_menu_items')
      .delete()
      .eq('booking_id', bookingId)
    setBusy(false)
    if (error) { setError(error.message); return }
    setRefreshKey(k => k + 1)
  }

  // Systémový print dialóg — jednoduchý výpis menu, zatiaľ bez šablóny.
  // Okno otvárame pred fetchom, aby ho prehliadač nezablokoval ako popup.
  async function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) { setError('Prehliadač zablokoval okno tlače.'); return }
    const [c, s] = await Promise.all([
      supabase.from('menu_categories').select('*').order('block').order('position'),
      supabase.from('booking_menu_items')
        .select('*, menu_items(name)')
        .eq('booking_id', bookingId)
        .order('created_at'),
    ])
    if (c.error || s.error) {
      win.close()
      setError((c.error || s.error).message)
      return
    }
    const cats = c.data ?? []
    const sels = s.data ?? []

    const sections = cats.map(cat => {
      const catSels = sels.filter(x => x.category_id === cat.id)
      if (catSels.length === 0) return ''
      const split = cat.split_portions && catSels.length > 1 ? ` (1/${catSels.length})` : ''
      const lis = catSels.map(x => {
        const name = x.menu_items?.name ?? x.item_name
        const qty = cat.qty_step != null
          ? ` — ${fmtQty(x.quantity)}${cat.qty_unit ? ` ${cat.qty_unit}` : ''}`
          : split
        return `<li>${esc(name)}${esc(qty)}</li>`
      }).join('')
      return `<h2>${esc(cat.name)}</h2><ul>${lis}</ul>`
    }).join('')

    win.document.write(`<!doctype html>
<html lang="sk"><head><meta charset="utf-8"><title>Menu</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a2830; margin: 40px; }
  h1 { font-size: 22px; letter-spacing: .3em; text-transform: uppercase; text-align: center; }
  .sub { text-align: center; color: #5d7d8e; margin-bottom: 28px; font-size: 14px; }
  h2 { font-size: 12px; letter-spacing: .18em; text-transform: uppercase;
       color: #5d7d8e; border-bottom: 1px solid #d5e2e9; padding-bottom: 4px; margin: 22px 0 8px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { font-size: 14px; padding: 3px 0; }
</style></head><body>
<h1>Menu</h1>
${printSubtitle ? `<p class="sub">${esc(printSubtitle)}</p>` : ''}
${sections || '<p>Menu je prázdne.</p>'}
</body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div>
      {/* Hlavička MENU vo farbe top baru, s akciami */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-2 rounded-card"
           style={{ background: '#354d5d' }}>
        <p className="text-[13px] font-bold tracking-[.18em] uppercase" style={{ color: '#ddeef6' }}>
          Menu
        </p>
        {/* Akcie len keď je menu vytvorené */}
        {menuCreated && (
        <div className="flex items-center gap-1">
          {editable && (
            <>
              <button
                type="button"
                onClick={openTemplates}
                disabled={busy}
                title="Načítať šablónu / prázdne menu"
                aria-label="Načítať šablónu / prázdne menu"
                className={headerBtnCls}
                style={{ color: '#ddeef6' }}
              >
                <IconTemplate size={18} />
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={busy}
                title={confirmReset ? 'Naozaj vymazať všetky položky?' : 'Vymazať všetky položky menu'}
                aria-label="Vymazať všetky položky menu"
                className={`${headerBtnCls} ${confirmReset ? 'bg-red-600 hover:bg-red-700' : ''}`}
                style={{ color: confirmReset ? '#fff' : '#ddeef6' }}
              >
                <IconEraser size={18} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handlePrint}
            title="Vytlačiť menu"
            aria-label="Vytlačiť menu"
            className={headerBtnCls}
            style={{ color: '#ddeef6' }}
          >
            <IconPrinter size={18} />
          </button>
        </div>
        )}
      </div>

      {error && (
        <p className="mx-4 mt-3 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* Menu ešte nevytvorené → ponuka na vytvorenie */}
      {menuCreated === false && (
        editable ? (
          <div className="py-3">
            <button
              type="button"
              onClick={openTemplates}
              disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-card
                         text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: '#4cbfb3', color: '#0a2d2a' }}
            >
              <IconPlus size={18} stroke={2.5} /> Vytvoriť menu
            </button>
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-gray-500">Menu nie je vytvorené.</p>
        )
      )}

      {menuCreated && (
        <MenuEditor
          key={refreshKey}
          table="booking_menu_items"
          ownerColumn="booking_id"
          ownerId={bookingId}
          editable={editable && !busy}
          extraBeforeBlock={menuBlockSlots}
          summary={menuSummary}
        />
      )}

      {/* Výber šablóny menu */}
      {showTemplates && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget && !busy) setShowTemplates(false) }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden
                          flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 flex items-center justify-between shrink-0"
                 style={{ background: '#354d5d' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#ddeef6' }}>
                Vytvoriť menu
              </h2>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                disabled={busy}
                aria-label="Zavrieť"
                className="w-8 h-8 rounded-full flex items-center justify-center
                           bg-white/10 hover:bg-white/20 transition-colors"
              >
                <IconX size={16} style={{ color: '#ddeef6' }} />
              </button>
            </div>

            <div className="overflow-y-auto divide-y divide-gray-100 flex-1">
              {/* Prvá možnosť — prázdne menu */}
              <button
                type="button"
                onClick={createEmptyMenu}
                disabled={busy}
                className="w-full flex items-center gap-2 px-5 py-3 text-left
                           text-sm font-bold text-[#2a8d83] hover:bg-[#eaf7f5]
                           transition-colors disabled:opacity-50"
              >
                <IconPlus size={16} stroke={2.5} />
                Načítať prázdne menu
              </button>

              {templates === null && (
                <p className="px-5 py-6 text-sm text-[#8aaabb] italic">Načítavam…</p>
              )}
              {templates?.length === 0 && (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">
                  Zatiaľ žiadne šablóny — vytvoríte ich v Nastaveniach → Menu.
                </p>
              )}
              {templates?.map(tpl => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  disabled={busy}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left
                             text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <span className="font-medium text-gray-800">{tpl.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {tpl.menu_template_items?.[0]?.count ?? 0} pol.
                  </span>
                </button>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 shrink-0">
              <p className="text-xs text-gray-400 mb-2">
                Načítanie šablóny nahradí doterajšie položky menu.
              </p>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                disabled={busy}
                className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 text-sm
                           font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Zrušiť
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
