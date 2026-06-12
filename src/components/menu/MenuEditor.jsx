import { useEffect, useState } from 'react'
import { IconCheck, IconChevronRight, IconMinus, IconPlus, IconX } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'

// Množstvo: 0.5 → „0,5"
const fmtQty = q => String(Number(q)).replace('.', ',')

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
export default function MenuEditor({ table, ownerColumn, ownerId, editable }) {
  const [categories, setCategories] = useState([])
  const [items, setItems]           = useState([])   // aktívne položky katalógu
  const [selections, setSelections] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [pickerCatId, setPickerCatId] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('menu_categories').select('*').order('position'),
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

  async function changeQty(sel, cat, dir) {
    const step = Number(cat.qty_step)
    const next = Math.round((Number(sel.quantity) + dir * step) * 100) / 100
    if (next > Number(cat.qty_max) || next < minQty(cat)) return
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

  const hasAnySelection = selections.length > 0

  return (
    <>
      {loading && (
        <p className="px-4 py-3 text-sm text-[#8aaabb] italic">Načítavam…</p>
      )}

      {!loading && !editable && !hasAnySelection && (
        <p className="px-4 py-3 text-sm text-gray-500">Menu nie je vytvorené.</p>
      )}

      {!loading && (
        <div className="pb-2">
          {visibleCats.map(cat => {
            const sels = selsByCat[cat.id] ?? []
            // Read-only pohľad: prázdne kategórie sa nezobrazujú
            if (!editable && sels.length === 0) return null
            const hasQty    = cat.qty_step != null
            const clickable = editable && !cat.archived_at
            // Podiel porcie (Mäso, Príloha): pri 2+ položkách príznak „1/2"…
            const splitBadge = cat.split_portions && sels.length > 1
              ? `1/${sels.length}` : null
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
                          <span className="min-w-[52px] px-1 text-center text-sm font-bold text-[#1a2830]">
                            {fmtQty(sel.quantity)}{cat.qty_unit ? ` ${cat.qty_unit}` : ''}
                          </span>
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
          })}

          {/* Zhrnutie — živý sumár všetkých vybratých položiek s množstvami */}
          {hasAnySelection && (
            <>
              <div className="flex items-end justify-between gap-3 px-4 pt-5 pb-1.5
                              bg-[#f0f6f9] border-t border-white">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#5d7d8e]">
                  Zhrnutie
                </p>
              </div>
              <div className="px-4 py-2.5 space-y-2">
                {visibleCats.map(cat => {
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
                })}
              </div>
            </>
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
