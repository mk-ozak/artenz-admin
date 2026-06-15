import { useEffect, useState } from 'react'
import { IconCheck, IconChevronRight, IconMinus, IconPlus, IconPrinter, IconX } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'

// Množstvo: 0.5 → „0,5"
const fmtQty = q => String(Number(q)).replace('.', ',')

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Predvolené množstvo pri pridaní položky: 1, orezané do rozsahu kategórie
function defaultQty(cat) {
  if (cat.qty_step == null) return 1
  return Math.min(Math.max(1, Number(cat.qty_min)), Number(cat.qty_max))
}

// Názov vybratej položky: aktuálny názov z katalógu, fallback na snapshot
const selName = sel => sel.menu_items?.name ?? sel.item_name

const X_BTN = `w-8 h-8 shrink-0 rounded-lg bg-[#cc8e8e] flex items-center justify-center
  text-white hover:bg-[#bd7c7c] active:bg-[#ad6b6b] transition-colors`

// Editor menu — kategórie ako klikateľné pásiky, okno výberu položiek,
// množstvá ako v košíku. Zmeny sa ukladajú okamžite (bez Uložiť).
// Generický nad „vlastníkom" výberov: menu rezervácie (booking_menu_items /
// booking_id) aj šablóna menu (menu_template_items / template_id).
// extraBeforeBlock: { [číslo bloku]: ReactNode } — vloží sa navrch daného bloku.
// summary: konfigurácia zhrnutia (sekcie podľa blokov + množstvá); null = jednoduché zhrnutie
export default function MenuEditor({ table, ownerColumn, ownerId, editable, extraBeforeBlock, summary }) {
  const [categories, setCategories] = useState([])
  const [items, setItems]           = useState([])   // aktívne položky katalógu
  const [selections, setSelections] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [pickerCatId, setPickerCatId] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('menu_categories').select('*').order('block').order('position'),
      supabase.from('menu_items').select('*').is('archived_at', null).order('position'),
      supabase.from(table)
        .select('*, menu_items(name)')
        .eq(ownerColumn, ownerId)
        .order('created_at'),
    ]).then(([c, i, s]) => {
      const err = c.error || i.error || s.error
      if (err) { setError(err.message); setLoading(false); return }
      setCategories(c.data ?? [])
      setItems(i.data ?? [])
      setSelections(s.data ?? [])
      setLoading(false)
    })
  }, [table, ownerColumn, ownerId])

  const selsByCat = {}
  for (const sel of selections) {
    (selsByCat[sel.category_id] ??= []).push(sel)
  }

  // Archivovaná kategória sa zobrazí, len ak v nej výber už niečo má
  const visibleCats = categories.filter(c =>
    !c.archived_at || (selsByCat[c.id]?.length > 0)
  )

  // Reálne vykreslené kategórie (v read-only sa prázdne vynechávajú) —
  // potrebné na oddeľovač medzi blokmi
  const renderCats = visibleCats.filter(c => editable || (selsByCat[c.id]?.length > 0))

  const pickerCat = pickerCatId ? categories.find(c => c.id === pickerCatId) : null

  async function addItem(cat, item) {
    const { data, error } = await supabase
      .from(table)
      .insert({
        [ownerColumn]: ownerId,
        category_id:   cat.id,
        item_id:       item.id,
        item_name:     item.name,
        quantity:      defaultQty(cat),
      })
      .select('*, menu_items(name)')
      .single()
    if (error) { setError(error.message); return }
    setSelections(s => [...s, data])
  }

  async function removeSelection(sel) {
    setSelections(s => s.filter(x => x.id !== sel.id))
    const { error } = await supabase.from(table).delete().eq('id', sel.id)
    if (error) { setError(error.message); setSelections(s => [...s, sel]) }
  }

  // Najnižšie množstvo pri stepovaní — na nulu sa mínusom nedá dostať,
  // položka sa odoberá len krížikom
  function minQty(cat) {
    const min = Number(cat.qty_min)
    return min > 0 ? min : Number(cat.qty_step)
  }

  // Uloženie množstva (optimisticky + rollback pri chybe)
  async function saveQty(sel, next) {
    if (next === Number(sel.quantity)) return
    const prev = sel.quantity
    setSelections(s => s.map(x => x.id === sel.id ? { ...x, quantity: next } : x))
    const { error } = await supabase
      .from(table)
      .update({ quantity: next })
      .eq('id', sel.id)
    if (error) {
      setError(error.message)
      setSelections(s => s.map(x => x.id === sel.id ? { ...x, quantity: prev } : x))
    }
  }

  function changeQty(sel, cat, dir) {
    const step = Number(cat.qty_step)
    const next = Math.round((Number(sel.quantity) + dir * step) * 100) / 100
    if (next > Number(cat.qty_max) || next < minQty(cat)) return
    saveQty(sel, next)
  }

  // Zadanie množstva z klávesnice — počas písania drží draft, commit pri opustení
  const [qtyDraft, setQtyDraft] = useState({})

  function commitQty(sel, cat) {
    const raw = qtyDraft[sel.id]
    setQtyDraft(d => { const n = { ...d }; delete n[sel.id]; return n })
    if (raw == null || raw === '') return
    let n = Number(String(raw).replace(',', '.'))
    if (!Number.isFinite(n)) return
    const step = Number(cat.qty_step)
    n = Math.round(n / step) * step
    n = Math.min(Math.max(n, minQty(cat)), Number(cat.qty_max))
    n = Math.round(n * 100) / 100
    saveQty(sel, n)
  }

  const hasAnySelection = selections.length > 0

  // Reálne vykreslené čísla blokov (v poradí)
  const blockNums = [...new Set(renderCats.map(c => c.block))]

  // Zhrnutie po sekciách (blokoch) — len bloky s výberom
  const summarySections = []
  if (summary) {
    for (const cat of visibleCats) {
      const sels = selsByCat[cat.id] ?? []
      if (!sels.length) continue
      let entry = summarySections.find(s => s.block === cat.block)
      if (!entry) { entry = { block: cat.block, items: [] }; summarySections.push(entry) }
      for (const sel of sels) entry.items.push({ sel, cat })
    }
    // Zrkadlenie (napr. polievka pre dospelých → automaticky aj deťom)
    if (summary.mirror) {
      const mirrored = categories
        .filter(c => c.name === summary.mirror.fromCategory)
        .flatMap(c => (selsByCat[c.id] ?? []).map(sel => ({ sel, cat: c })))
      if (mirrored.length) {
        let entry = summarySections.find(s => s.block === summary.mirror.toBlock)
        if (!entry) {
          entry = { block: summary.mirror.toBlock, items: [] }
          summarySections.push(entry)
          summarySections.sort((a, b) => a.block - b.block)
        }
        entry.items = [...mirrored, ...entry.items]
      }
    }
  }

  // Zoskupenie sekcií do riadkov — pár blokov (napr. 4+5) ide vedľa seba
  function buildRows(sections) {
    const pair = summary?.pairBlocks
    if (!pair) return sections.map(s => [s])
    const rows = []
    const used = new Set()
    for (const sec of sections) {
      if (used.has(sec.block)) continue
      if (sec.block === pair[0]) {
        const second = sections.find(s => s.block === pair[1])
        if (second) { rows.push([sec, second]); used.add(pair[1]); continue }
      }
      if (sec.block === pair[1] && sections.some(s => s.block === pair[0])) continue
      rows.push([sec])
    }
    return rows
  }

  // Obsah jednej sekcie zhrnutia (nadpis + položky)
  function renderSummarySectionInner(sec) {
    const title = summary.titles?.[sec.block]
    const count = sec.block === summary.checkBlock ? summary.checkTarget : summary.fixedQty?.[sec.block]
    return (
      <>
        {title && (
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#5d7d8e] mb-1">
            {sec.block}. {title}
            {count != null && (
              <span className="normal-case font-medium text-[#9ab0ba]"> — pre {count} osôb</span>
            )}
          </p>
        )}
        {sec.items.map(({ sel, cat }) => {
          const catSels = selsByCat[cat.id] ?? []
          const splitBadge = cat.split_portions && catSels.length > 1 ? `1/${catSels.length}` : null
          const showQty = summary.qtyBlocks?.includes(sec.block) && cat.qty_step != null
          return (
            <p key={sel.id} className="text-[13px] leading-snug text-[#3a5160] py-px flex items-center gap-2">
              {splitBadge && (
                <span className="shrink-0 text-[10px] font-semibold text-[#5d7d8e]
                                 bg-[#eef3f6] rounded px-1 py-px">
                  {splitBadge}
                </span>
              )}
              <span>
                {selName(sel)}
                {showQty && (
                  <span className="font-medium text-[#9ab0ba]">
                    {' '}— {fmtQty(sel.quantity)}{cat.qty_unit ? ` ${cat.qty_unit}` : ''}
                  </span>
                )}
              </span>
            </p>
          )
        })}
      </>
    )
  }

  // Obsah jednej sekcie kalkulácie (nadpis + položky so stĺpcami)
  function renderCalcSectionInner(sec) {
    const title = summary.titles?.[sec.block]
    const count = summary.calc.countByBlock?.[sec.block]
    return (
      <>
        {title && (
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#5d7d8e] mb-1">
            {sec.block}. {title}
            {count != null && (
              <span className="normal-case font-medium text-[#9ab0ba]"> — pre {count} osôb</span>
            )}
          </p>
        )}
        {sec.items.map(({ sel, cat }) => {
          const catSels = selsByCat[cat.id] ?? []
          const splitBadge = cat.split_portions && catSels.length > 1 ? `1/${catSels.length}` : null
          const splitDiv = (cat.split_portions && catSels.length > 1) ? catSels.length : 1
          const isCalc = count != null
          const dash = isCalc ? '—' : ''
          const unitSuffix = cat.default_unit ? ` ${cat.default_unit}` : ''
          const jednAmount = cat.default_amount != null
            ? Math.round((Number(cat.default_amount) / splitDiv) * 1000) / 1000
            : null
          const jedn = jednAmount != null ? `${fmtQty(jednAmount)}${unitSuffix}` : dash
          let mnozstvo = dash
          if (isCalc && jednAmount != null) {
            const amt = Math.round(jednAmount * count * 100) / 100
            mnozstvo = `${fmtQty(amt)}${unitSuffix}`
          } else if (!isCalc && cat.qty_step != null) {
            mnozstvo = `${fmtQty(sel.quantity)}${cat.qty_unit ? ` ${cat.qty_unit}` : ''}`
          }
          return (
            <div key={sel.id} className="flex items-center gap-2 text-[13px] text-[#3a5160] py-px">
              <span className="flex-1 min-w-0 flex items-center gap-2">
                {splitBadge && (
                  <span className="shrink-0 text-[10px] font-semibold text-[#5d7d8e]
                                   bg-[#eef3f6] rounded px-1 py-px">
                    {splitBadge}
                  </span>
                )}
                <span className="truncate">{selName(sel)}</span>
              </span>
              {jedn && <span className="w-14 text-right text-[#5d7d8e] shrink-0">{jedn}</span>}
              <span className="w-20 text-right font-semibold text-[#1a2830] shrink-0">{mnozstvo}</span>
            </div>
          )
        })}
      </>
    )
  }

  // Tlač zhrnutia / kalkulácie — systémový print dialóg
  function printView(mode) {
    const win = window.open('', '_blank')
    if (!win) { setError('Prehliadač zablokoval okno tlače.'); return }
    const titleText = mode === 'calc' ? 'Kalkulácia pre kuchyňu' : 'Zhrnutie'
    const sub = summary?.printSubtitle ? `<p class="sub">${esc(summary.printSubtitle)}</p>` : ''
    const sections = summarySections.map(sec => {
      const title = summary.titles?.[sec.block]
      const count = mode === 'calc'
        ? summary.calc?.countByBlock?.[sec.block]
        : (sec.block === summary.checkBlock ? summary.checkTarget : summary.fixedQty?.[sec.block])
      const heading = title
        ? `<h2>${sec.block}. ${esc(title)}${count != null ? ` <span class="cnt">— pre ${count} osôb</span>` : ''}</h2>`
        : ''
      const lines = sec.items.map(({ sel, cat }) => {
        const catSels = selsByCat[cat.id] ?? []
        const splitDiv = (cat.split_portions && catSels.length > 1) ? catSels.length : 1
        const badge = cat.split_portions && catSels.length > 1
          ? `<span class="b">1/${catSels.length}</span> ` : ''
        const name = esc(selName(sel))
        if (mode === 'calc') {
          const isCalc = count != null
          const unit = cat.default_unit ? ` ${esc(cat.default_unit)}` : ''
          const jednAmount = cat.default_amount != null
            ? Math.round((Number(cat.default_amount) / splitDiv) * 1000) / 1000 : null
          const jedn = jednAmount != null ? `${fmtQty(jednAmount)}${unit}` : (isCalc ? '—' : '')
          let mnozstvo = isCalc ? '—' : ''
          if (isCalc && jednAmount != null) mnozstvo = `${fmtQty(Math.round(jednAmount * count * 100) / 100)}${unit}`
          else if (!isCalc && cat.qty_step != null) mnozstvo = `${fmtQty(sel.quantity)}${cat.qty_unit ? ` ${esc(cat.qty_unit)}` : ''}`
          return `<tr><td>${badge}${name}</td><td class="r">${jedn}</td><td class="r b2">${mnozstvo}</td></tr>`
        }
        const showQty = summary.qtyBlocks?.includes(sec.block) && cat.qty_step != null
        const qty = showQty ? ` — ${fmtQty(sel.quantity)}${cat.qty_unit ? ` ${esc(cat.qty_unit)}` : ''}` : ''
        return `<tr><td>${badge}${name}${qty}</td></tr>`
      }).join('')
      return `<section>${heading}<table>${lines}</table></section>`
    }).join('')

    win.document.write(`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>${titleText}</title>
<style>
  body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #1a2830; margin: 32px; }
  h1 { font-size: 18px; letter-spacing: .16em; text-transform: uppercase; margin: 0 0 4px; }
  .sub { color: #5d7d8e; font-size: 13px; margin: 0 0 18px; }
  section { margin-bottom: 14px; page-break-inside: avoid; }
  h2 { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #5d7d8e;
       border-bottom: 1px solid #d5e2e9; padding-bottom: 3px; margin: 0 0 4px; }
  h2 .cnt { font-weight: 400; text-transform: none; letter-spacing: 0; color: #9ab0ba; }
  table { width: 100%; border-collapse: collapse; }
  td { font-size: 13px; padding: 2px 0; vertical-align: top; }
  td.r { text-align: right; color: #5d7d8e; white-space: nowrap; width: 90px; padding-left: 12px; }
  td.b2 { color: #1a2830; font-weight: 600; }
  .b { font-size: 10px; background: #eef3f6; color: #5d7d8e; border-radius: 3px; padding: 0 3px; }
</style></head><body>
<h1>${titleText}</h1>${sub}${sections || '<p>Prázdne.</p>'}
</body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  // Jedna kategória (pásik + vybraté položky)
  function renderCategory(cat) {
    const sels      = selsByCat[cat.id] ?? []
    const hasQty    = cat.qty_step != null
    const clickable = editable && !cat.archived_at
    // Podiel porcie (Mäso, Príloha): pri 2+ položkách príznak „1/2"…
    const splitBadge = cat.split_portions && sels.length > 1 ? `1/${sels.length}` : null
    const header = (
      <>
        <p className="text-[10px] uppercase tracking-[.16em] text-[#5d7d8e]">
          {cat.name}
        </p>
        {clickable && (
          <IconChevronRight size={16} className="shrink-0 text-[#b6c8d2]" />
        )}
      </>
    )
    return (
      <div key={cat.id} className="border-t border-white first:border-t-0">
        {clickable ? (
          <button
            type="button"
            onClick={() => setPickerCatId(cat.id)}
            aria-label={`Vybrať položky — ${cat.name}`}
            className="w-full flex items-end justify-between gap-3 px-4 pt-5 pb-1.5 text-left
                       bg-[#f0f6f9] hover:bg-[#e4eff4] active:bg-[#daeaf1] transition-colors"
          >
            {header}
          </button>
        ) : (
          <div className="flex items-end justify-between gap-3 px-4 pt-5 pb-1.5 bg-[#f0f6f9]">
            {header}
          </div>
        )}

        {sels.length > 0 && (
        <div className="px-4 py-1.5">
        {sels.map(sel => {
          const nameContent = (
            <>
              {splitBadge && (
                <span className="shrink-0 text-[10px] font-semibold text-[#5d7d8e]
                                 bg-[#eef3f6] rounded px-1 py-px">
                  {splitBadge}
                </span>
              )}
              <span className="text-sm font-medium text-[#1a2830]">{selName(sel)}</span>
            </>
          )
          return (
          <div key={sel.id} className="flex items-center justify-between gap-3 py-2">
            {/* Klik na položku otvorí výber jej kategórie */}
            {clickable ? (
              <button
                type="button"
                onClick={() => setPickerCatId(cat.id)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                {nameContent}
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {nameContent}
              </div>
            )}

            {hasQty ? (
              editable ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => removeSelection(sel)}
                    aria-label="Odobrať položku"
                    className={X_BTN}
                  >
                    <IconX size={15} stroke={2.5} />
                  </button>
                  <div className="flex items-center gap-0.5 rounded-lg border
                                  border-[#d9ebe8] bg-[#f1f8f7] p-1">
                  <button
                    type="button"
                    onClick={() => changeQty(sel, cat, -1)}
                    disabled={Number(sel.quantity) <= minQty(cat)}
                    aria-label="Menej"
                    className="w-8 h-8 rounded-lg bg-[#cdeae6] flex items-center justify-center
                               text-[#1f7d74] hover:bg-[#b9e2dd] active:bg-[#a8d9d3]
                               transition-colors disabled:opacity-30"
                  >
                    <IconMinus size={15} stroke={2.5} />
                  </button>
                  <div className="flex items-center">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={qtyDraft[sel.id] ?? fmtQty(sel.quantity)}
                      onFocus={e => { setQtyDraft(d => ({ ...d, [sel.id]: fmtQty(sel.quantity) })); e.target.select() }}
                      onChange={e => setQtyDraft(d => ({ ...d, [sel.id]: e.target.value }))}
                      onBlur={() => commitQty(sel, cat)}
                      onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                      className="w-10 text-center text-sm font-bold text-[#1a2830] bg-transparent
                                 rounded focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#4cbfb3]"
                    />
                    {cat.qty_unit && (
                      <span className="text-xs font-medium text-[#5d7d8e] pr-0.5">{cat.qty_unit}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => changeQty(sel, cat, 1)}
                    disabled={Number(sel.quantity) >= Number(cat.qty_max)}
                    aria-label="Viac"
                    className="w-8 h-8 rounded-lg bg-[#cdeae6] flex items-center justify-center
                               text-[#1f7d74] hover:bg-[#b9e2dd] active:bg-[#a8d9d3]
                               transition-colors disabled:opacity-30"
                  >
                    <IconPlus size={15} stroke={2.5} />
                  </button>
                  </div>
                </div>
              ) : (
                <span className="shrink-0 text-sm font-semibold text-[#3a5160]">
                  {fmtQty(sel.quantity)}{cat.qty_unit ? ` ${cat.qty_unit}` : ''}
                </span>
              )
            ) : editable ? (
              <button
                type="button"
                onClick={() => removeSelection(sel)}
                aria-label="Odobrať"
                className={X_BTN}
              >
                <IconX size={15} stroke={2.5} />
              </button>
            ) : null}
          </div>
          )
        })}
        </div>
        )}
      </div>
    )
  }

  return (
    <>
      {loading && (
        <p className="px-4 py-3 text-sm text-[#8aaabb] italic">Načítavam…</p>
      )}

      {!loading && !editable && !hasAnySelection && (
        <p className="px-4 py-3 text-sm text-gray-500">Menu nie je vytvorené.</p>
      )}

      {!loading && (
        <div className="py-3 space-y-3">
          {blockNums.map(block => {
            // Kontrola súčtu množstiev v bloku — pod jedlami bloku
            let check = null
            if (summary && summary.checkBlock === block) {
              // Špeciály: súčet naklikaných množstiev vs počet špeciálov
              const sum = renderCats
                .filter(c => c.block === block)
                .reduce((s, c) => s + (selsByCat[c.id] ?? []).reduce((a, x) => a + (Number(x.quantity) || 0), 0), 0)
              const ok = sum === summary.checkTarget
              check = (
                <p className={`px-4 pb-2 text-[11px] font-medium ${ok ? 'text-[#2a8d83]' : 'text-[#a87d20]'}`}>
                  Súčet: {sum} / Špeciály: {summary.checkTarget}{ok ? ' ✓' : ' — nesedí'}
                </p>
              )
            } else if (summary?.weightCheck?.blocks?.includes(block)) {
              // Raut: súčet naklikaných kg vs počet ľudí na raut × 0,2 kg
              const wc = summary.weightCheck
              const sumKg = renderCats
                .filter(c => c.block === block && c.qty_unit === 'kg')
                .reduce((s, c) => s + (selsByCat[c.id] ?? []).reduce((a, x) => a + (Number(x.quantity) || 0), 0), 0)
              const target = Math.round(wc.people * wc.perPerson * 100) / 100
              const diff   = Math.round((target - sumKg) * 100) / 100
              const status = diff > 0
                ? `treba ešte ${fmtQty(diff)} kg`
                : diff < 0
                  ? `nad limit o ${fmtQty(-diff)} kg`
                  : '✓'
              const color = diff === 0 ? 'text-[#2a8d83]' : diff < 0 ? 'text-[#c0564a]' : 'text-[#a87d20]'
              check = (
                <p className={`px-4 pb-2 text-[11px] font-medium ${color}`}>
                  Raut: {fmtQty(sumKg)} / {fmtQty(target)} kg — {status}
                </p>
              )
            }
            // Poznámka o zrkadlenej polievke (napr. pre deti rovnaká ako pre dospelých)
            let mirrorNote = null
            if (summary?.mirror?.toBlock === block) {
              const soupNames = categories
                .filter(c => c.name === summary.mirror.fromCategory)
                .flatMap(c => (selsByCat[c.id] ?? []).map(selName))
              if (soupNames.length) {
                mirrorNote = (
                  <p className="px-4 pb-2 text-[11px] text-[#5d7d8e]">
                    Polievka (ako pre dospelých):{' '}
                    <span className="font-medium text-[#3a5160]">{soupNames.join(', ')}</span>
                  </p>
                )
              }
            }
            return (
              <div key={block} className="rounded-card border border-[#e0e8ec] overflow-hidden bg-white">
                <div className="h-3 bg-[#8fa6b2]" />
                {extraBeforeBlock?.[block]}
                {mirrorNote}
                {renderCats.filter(c => c.block === block).map(renderCategory)}
                {check}
                <div className="h-2" />
              </div>
            )
          })}

          {/* Zhrnutie — živý sumár všetkých vybratých položiek s množstvami */}
          {hasAnySelection && (
            <div className="rounded-card border border-[#e0e8ec] overflow-hidden bg-white">
              <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#8fa6b2]">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white">
                  Zhrnutie
                </p>
                {summary && (
                  <button
                    type="button"
                    onClick={() => printView('summary')}
                    title="Vytlačiť zhrnutie"
                    aria-label="Vytlačiť zhrnutie"
                    className="w-7 h-7 rounded flex items-center justify-center text-white
                               hover:bg-white/15 transition-colors"
                  >
                    <IconPrinter size={15} />
                  </button>
                )}
              </div>
              <div className="px-4 py-2.5 space-y-3">
                {summary ? (
                  buildRows(summarySections).map((row, i) =>
                    row.length === 2 ? (
                      <div key={`r${i}`} className="grid grid-cols-2 gap-4">
                        <div>{renderSummarySectionInner(row[0])}</div>
                        <div>{renderSummarySectionInner(row[1])}</div>
                      </div>
                    ) : (
                      <div key={row[0].block}>{renderSummarySectionInner(row[0])}</div>
                    )
                  )
                ) : (
                  visibleCats.map(cat => {
                    const sels = selsByCat[cat.id] ?? []
                    if (sels.length === 0) return null
                    return (
                      <div key={cat.id}>
                        {sels.map(sel => (
                          <p key={sel.id} className="text-[13px] leading-snug text-[#3a5160] py-px">
                            {selName(sel)}
                            {cat.qty_step != null &&
                              ` — ${fmtQty(sel.quantity)}${cat.qty_unit ? ` ${cat.qty_unit}` : ''}`}
                            {cat.split_portions && sels.length > 1 && ` (1/${sels.length})`}
                          </p>
                        ))}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Kalkulácia pre kuchyňu — kópia zhrnutia + stĺpce jednotkové/množstvo */}
          {summary?.calc && hasAnySelection && (
            <div className="rounded-card border border-[#e0e8ec] overflow-hidden bg-white">
              <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#8fa6b2]">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white">
                  Kalkulácia pre kuchyňu
                </p>
                <button
                  type="button"
                  onClick={() => printView('calc')}
                  title="Vytlačiť kalkuláciu"
                  aria-label="Vytlačiť kalkuláciu"
                  className="w-7 h-7 rounded flex items-center justify-center text-white
                             hover:bg-white/15 transition-colors"
                >
                  <IconPrinter size={15} />
                </button>
              </div>
              <div className="px-4 py-2.5 space-y-3">
                {buildRows(summarySections).map((row, i) =>
                  row.length === 2 ? (
                    <div key={`r${i}`} className="grid grid-cols-2 gap-4">
                      <div>{renderCalcSectionInner(row[0])}</div>
                      <div>{renderCalcSectionInner(row[1])}</div>
                    </div>
                  ) : (
                    <div key={row[0].block}>{renderCalcSectionInner(row[0])}</div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mx-4 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* Okno výberu položiek — bez potvrdzovania, klik mimo / Hotovo zatvorí */}
      {pickerCat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setPickerCatId(null) }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden
                          flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 flex items-center justify-between shrink-0"
                 style={{ background: '#354d5d' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#ddeef6' }}>
                {pickerCat.name}
                {pickerCat.max_items != null && (
                  <span className="ml-2 font-normal opacity-70">
                    {(selsByCat[pickerCat.id] ?? []).length} / {pickerCat.max_items}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => setPickerCatId(null)}
                aria-label="Zavrieť"
                className="w-8 h-8 rounded-full flex items-center justify-center
                           bg-white/10 hover:bg-white/20 transition-colors"
              >
                <IconX size={16} style={{ color: '#ddeef6' }} />
              </button>
            </div>

            <div className="overflow-y-auto divide-y divide-gray-100 flex-1">
              {items.filter(i => i.category_id === pickerCat.id).map(item => {
                const sel = selections.find(s => s.item_id === item.id)
                const limitFull = pickerCat.max_items != null &&
                  (selsByCat[pickerCat.id] ?? []).length >= pickerCat.max_items
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => sel ? removeSelection(sel) : addItem(pickerCat, item)}
                    disabled={!sel && limitFull}
                    className={`w-full flex items-center justify-between gap-3 px-5 py-3 text-left
                                text-sm transition-colors disabled:opacity-40
                                ${sel ? 'bg-[#eaf7f5]' : 'hover:bg-gray-50'}`}
                  >
                    <span className={sel ? 'text-[#1a6e66] font-medium' : 'text-gray-700'}>
                      {item.name}
                    </span>
                    <span className={`w-7 h-7 shrink-0 rounded-full border flex items-center justify-center
                                      ${sel
                                        ? 'bg-[#4cbfb3] border-[#4cbfb3] text-white'
                                        : 'border-[#d5e2e9] text-[#2a8d83]'}`}>
                      {sel ? <IconCheck size={15} stroke={2.5} /> : <IconPlus size={15} stroke={2.5} />}
                    </span>
                  </button>
                )
              })}
              {items.filter(i => i.category_id === pickerCat.id).length === 0 && (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">
                  Kategória zatiaľ nemá žiadne položky — pridajte ich v Nastaveniach.
                </p>
              )}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={() => setPickerCatId(null)}
                className="w-full px-4 py-2.5 text-sm font-bold rounded-lg
                           transition-opacity hover:opacity-90"
                style={{ background: '#4cbfb3', color: '#0a2d2a' }}
              >
                Hotovo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
