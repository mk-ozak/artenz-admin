import { useEffect, useRef, useState } from 'react'
import { IconAlertTriangle, IconArrowLeft, IconPlus, IconSettings, IconX } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { calcQtyOf, fmtQty } from '../../lib/menuCalc'
import { INGREDIENT_UNITS, LINE_UNITS, dishUnitFactor, normText, parseAmount } from '../../lib/ingredients'
import BlurInput from './BlurInput'
import IngredientSettings from './IngredientSettings'

const selectCls = `text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700
                   focus:outline-none focus:ring-2 focus:ring-indigo-500`

// Výber suroviny s vyhľadávaním (bez ohľadu na diakritiku) + množstvo
// a jednotka riadku (g/kg, ml/L, ks; predvolené g / ml). onAdd(surovina,
// množstvo, jednotka) → true = pridané, formulár sa vyprázdni. Keď hľadaná
// surovina nie je v zozname, dá sa hneď pridať do surovín:
// onCreate(názov, kategória, jednotka) → nová surovina alebo null.
function AddLine({ ingredients, categories, onAdd, onCreate, defaultCategoryId }) {
  const [ing, setIng]       = useState(null)
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const [amount, setAmount] = useState('')
  const [unit, setUnit]     = useState('')
  const [creating, setCreating] = useState(null)  // { name, categoryId, unit } — nová surovina
  const amountRef = useRef(null)

  // Ponuka: nearchivované suroviny v nearchivovaných kategóriách, po kategóriách
  const q = normText(query.trim())
  const activeCats = categories.filter(c => !c.archived_at)
  const groups = activeCats
    .map(c => ({
      cat: c,
      items: ingredients.filter(i =>
        i.category_id === c.id && !i.archived_at && (!q || normText(i.name).includes(q))),
    }))
    .filter(g => g.items.length)

  // Vybratá surovina; keď sa napísanému textu hodí jediná, berie sa tá
  const matches  = groups.flatMap(g => g.items)
  const picked   = ing ?? (q && matches.length === 1 ? matches[0] : null)
  const lineUnit = unit || (LINE_UNITS[picked?.unit]?.[0] ?? picked?.unit ?? '')
  const n = parseAmount(amount)
  const canAdd = picked && n > 0
  // Ponúknuť novú surovinu, keď napísaný názov v zozname presne nie je
  const offerNew = q !== '' && !ing && !matches.some(i => normText(i.name) === q)

  function choose(i) {
    setIng(i)
    setQuery(i.name)
    setUnit(LINE_UNITS[i.unit]?.[0] ?? i.unit)
    setOpen(false)
    setTimeout(() => amountRef.current?.focus(), 0)
  }

  async function submit(e) {
    e.preventDefault()
    if (!canAdd) return
    if (await onAdd(picked, n, lineUnit)) {
      setIng(null)
      setQuery('')
      setAmount('')
      setUnit('')
    }
  }

  function startCreate() {
    const categoryId = activeCats.some(c => c.id === defaultCategoryId) ? defaultCategoryId : activeCats[0]?.id
    setCreating({ name: query.trim(), categoryId, unit: 'kg' })
    setOpen(false)
  }

  async function saveCreate() {
    if (!creating.name.trim() || !creating.categoryId) return
    const created = await onCreate(creating.name.trim(), creating.categoryId, creating.unit)
    if (!created) return
    setCreating(null)
    choose(created)
  }

  // Nová surovina: názov, kategória, jednotka → po uložení je hneď vybratá
  if (creating) {
    return (
      <div className="mt-1.5 p-2.5 rounded-lg border border-[#a8d9d3] bg-[#f3faf9] space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#2a8d83]">Nová surovina</p>
        <input
          value={creating.name}
          onChange={e => setCreating(c => ({ ...c, name: e.target.value }))}
          placeholder="Názov suroviny"
          autoFocus
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={creating.categoryId ?? ''}
            onChange={e => setCreating(c => ({ ...c, categoryId: e.target.value }))}
            aria-label="Kategória suroviny"
            className={`${selectCls} flex-1 min-w-[150px]`}
          >
            {activeCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={creating.unit}
            onChange={e => setCreating(c => ({ ...c, unit: e.target.value }))}
            aria-label="Jednotka suroviny"
            title="Jednotka, v ktorej sa surovina objednáva"
            className={selectCls}
          >
            {INGREDIENT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <button
            type="button"
            onClick={saveCreate}
            disabled={!creating.name.trim() || !creating.categoryId}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold
                       transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: '#4cbfb3', color: '#0a2d2a' }}
          >
            <IconPlus size={14} stroke={2.5} />
            Pridať do surovín
          </button>
          <button
            type="button"
            onClick={() => setCreating(null)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-white"
          >
            Zrušiť
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-1.5 pt-1.5">
      <div className="relative flex-1 min-w-[170px]">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setIng(null); setUnit(''); setOpen(true) }}
          onFocus={() => setOpen(true)}
          // Ponuka sa zavrie hneď pri odchode z poľa (inak by na mobile prekryla
          // množstvo a „Pridať"); ťuknutie na návrh pole neopustí (onMouseDown)
          onBlur={() => setOpen(false)}
          placeholder="Pridať surovinu — hľadaj…"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {open && (
          <>
            <div className="absolute z-20 left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto
                            bg-white rounded-lg border border-gray-200 shadow-xl py-1">
              {groups.length === 0 && (
                <p className="px-3 py-2 text-xs text-gray-500">Nič sa nenašlo.</p>
              )}
              {offerNew && (
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={startCreate}
                  className="w-full flex items-center gap-1.5 px-3 py-2 text-left text-sm font-semibold
                             text-[#2a8d83] hover:bg-[#f0f6f9] border-b border-gray-100"
                >
                  <IconPlus size={15} stroke={2.5} className="shrink-0" />
                  Pridať „{query.trim()}" ako novú surovinu
                </button>
              )}
              {groups.map(g => (
                <div key={g.cat.id}>
                  <p className="px-3 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8aaabb]">
                    {g.cat.name}
                  </p>
                  {g.items.map(i => (
                    <button
                      key={i.id}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => choose(i)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left
                                 text-sm text-gray-800 hover:bg-[#f0f6f9]"
                    >
                      {i.name}
                      <span className="text-[11px] text-gray-400 shrink-0">{i.unit}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <input
        ref={amountRef}
        value={amount}
        onChange={e => setAmount(e.target.value)}
        inputMode="decimal"
        placeholder="množstvo"
        className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right bg-white
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <select
        value={lineUnit}
        onChange={e => setUnit(e.target.value)}
        disabled={!picked}
        aria-label="Jednotka"
        className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700
                   disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {(picked ? LINE_UNITS[picked.unit] ?? [picked.unit] : ['g']).map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <button
        type="submit"
        disabled={!canAdd}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold
                   transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: '#4cbfb3', color: '#0a2d2a' }}
      >
        <IconPlus size={14} stroke={2.5} />
        Pridať
      </button>
    </form>
  )
}

// Riadok receptúry: surovina, množstvo, jednotka (g/kg…), odobratie
function LineRow({ line, ingredient, onPatch, onDelete, onError }) {
  const units = LINE_UNITS[ingredient?.unit] ?? []
  // Jednotka riadku nesedí so surovinou (napr. g pri surovine v ks) — kalkulácia
  // ho nezaráta, kým sa neopraví
  const badUnit = !units.includes(line.unit)
  return (
    <div className="py-1">
      <div className="flex items-center gap-1.5">
        <span className="flex-1 min-w-0 text-sm text-gray-800">
          {ingredient?.name ?? 'Neznáma surovina'}
          {ingredient?.archived_at && (
            <span className="ml-1.5 text-[10px] font-semibold uppercase text-[#a87d20] bg-[#fdf4e3]
                             rounded px-1 py-px">
              vymazaná
            </span>
          )}
        </span>
        <BlurInput
          value={fmtQty(line.amount)}
          inputMode="decimal"
          aria-label="Množstvo"
          onSave={v => {
            const n = parseAmount(v)
            if (n > 0) onPatch({ amount: n })
            else onError('Množstvo musí byť číslo väčšie ako 0.')
          }}
          className="w-20 text-right border-gray-200 bg-white"
        />
        <select
          value={line.unit}
          onChange={e => onPatch({ unit: e.target.value })}
          aria-label="Jednotka"
          className={`text-sm border rounded-lg px-1.5 py-1 bg-white text-gray-700 focus:outline-none
                      focus:ring-2 focus:ring-indigo-500 ${badUnit ? 'border-[#e0a43a]' : 'border-gray-200'}`}
        >
          {(badUnit ? [line.unit, ...units] : units).map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button
          type="button"
          onClick={onDelete}
          title="Odobrať surovinu z receptúry"
          aria-label="Odobrať surovinu"
          className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
        >
          <IconX size={16} />
        </button>
      </div>
      {badUnit && (
        <p className="text-[11px] text-[#a87d20]">
          Jednotka {line.unit} nesedí so surovinou ({ingredient?.unit ?? '?'}) — v kalkulácii sa nezaráta.
        </p>
      )}
    </div>
  )
}

// Receptúra položky menu (Nastavenia → Menu → čiapka pri položke): suroviny na
// dávku jedla v jednotke kalkulácie pre kuchyňu (napr. na 1 kg), pri variantoch
// základ + suroviny navyše pre variant; alebo „položka je sama surovinou"
// (Cinzano — v kalkulácii surovín sa vypíše priamo). Ukladá hneď ako zvyšok
// Nastavení. variants = nearchivované varianty položky (pri zapnutých variantoch).
// „Upraviť suroviny" prepne okno na zoznam surovín (ako Nastavenia → Suroviny)
// a „Späť na receptúru" vráti receptúru tak, ako bola rozpísaná.
export default function RecipeModal({ item, category, variants, onClose }) {
  const [recipe, setRecipe]           = useState(null)  // menu_item_recipes, null = ešte nie je
  const [lines, setLines]             = useState([])
  const [ingredients, setIngredients] = useState([])
  const [ingCats, setIngCats]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [view, setView]               = useState('recipe')  // 'recipe' | 'ingredients'
  const [lastCatId, setLastCatId]     = useState(null)      // kategória poslednej novej suroviny

  // Množstvo jedla v kalkulácii — v jeho jednotke je dávka receptúry
  const qty  = category ? calcQtyOf(category) : null
  const unit = qty?.unit ?? null

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('menu_item_recipes').select('*').eq('item_id', item.id),
      supabase.from('menu_item_recipe_lines').select('*').eq('item_id', item.id).order('position'),
      supabase.from('ingredients').select('*').order('position'),
      supabase.from('ingredient_categories').select('*').order('position'),
    ]).then(([r, l, i, c]) => {
      if (!alive) return
      const err = r.error || l.error || i.error || c.error
      if (err) setError(err.message)
      else {
        setRecipe(r.data?.[0] ?? null)
        setLines(l.data ?? [])
        setIngredients(i.data ?? [])
        setIngCats(c.data ?? [])
      }
      setLoading(false)
    })
    return () => { alive = false }
  }, [item.id])

  // Späť zo zoznamu surovín — znova načíta suroviny (nové, premenované, vymazané)
  async function backToRecipe() {
    const [i, c] = await Promise.all([
      supabase.from('ingredients').select('*').order('position'),
      supabase.from('ingredient_categories').select('*').order('position'),
    ])
    if (i.error || c.error) setError((i.error || c.error).message)
    else {
      setIngredients(i.data ?? [])
      setIngCats(c.data ?? [])
    }
    setView('recipe')
  }

  // Nová surovina z vyhľadávania — na koniec svojej kategórie
  async function createIngredient(name, categoryId, ingUnit) {
    setError('')
    const position = Math.max(0, ...ingredients.filter(i => i.category_id === categoryId).map(i => i.position)) + 1
    const { data, error } = await supabase
      .from('ingredients')
      .insert({ category_id: categoryId, name, unit: ingUnit, position })
      .select()
      .single()
    if (error) { setError(error.message); return null }
    setIngredients(is => [...is, data])
    setLastCatId(categoryId)
    return data
  }

  // Hlavička receptúry (dávka, príznak suroviny) — vznikne pri prvej zmene
  // alebo prvej surovine a zapamätá si jednotku jedla z kalkulácie
  async function saveRecipe(fields) {
    setError('')
    const row = {
      item_id:       item.id,
      is_ingredient: recipe?.is_ingredient ?? false,
      yield_amount:  recipe?.yield_amount ?? 1,
      yield_unit:    recipe ? recipe.yield_unit : unit,
      ...fields,
    }
    const { data, error } = await supabase
      .from('menu_item_recipes')
      .upsert(row, { onConflict: 'item_id' })
      .select()
      .single()
    if (error) { setError(error.message); return false }
    setRecipe(data)
    return true
  }

  async function addLine(variantId, ing, amount, lineUnit) {
    setError('')
    if (!recipe && !(await saveRecipe({}))) return false
    const own = lines.filter(l => (l.variant_id ?? null) === variantId)
    const position = Math.max(0, ...own.map(l => l.position)) + 1
    const { data, error } = await supabase
      .from('menu_item_recipe_lines')
      .insert({ item_id: item.id, variant_id: variantId, ingredient_id: ing.id, amount, unit: lineUnit, position })
      .select()
      .single()
    if (error) { setError(error.message); return false }
    setLines(ls => [...ls, data])
    return true
  }

  async function patchLine(line, fields) {
    setError('')
    const { error } = await supabase.from('menu_item_recipe_lines').update(fields).eq('id', line.id)
    if (error) { setError(error.message); return }
    setLines(ls => ls.map(l => l.id === line.id ? { ...l, ...fields } : l))
  }

  async function deleteLine(line) {
    setError('')
    const { error } = await supabase.from('menu_item_recipe_lines').delete().eq('id', line.id)
    if (error) { setError(error.message); return }
    setLines(ls => ls.filter(l => l.id !== line.id))
  }

  const isIngredient = !!recipe?.is_ingredient
  const yieldUnit    = recipe ? recipe.yield_unit : unit
  // Kategória teraz počíta v inej jednotke, než v akej je receptúra zapísaná
  // (g↔kg a ml↔L sa prepočíta samo)
  const unitChanged  = recipe && qty && dishUnitFactor(unit, recipe.yield_unit) == null
  const ingById      = Object.fromEntries(ingredients.map(i => [i.id, i]))
  const sections = [
    { id: null, title: variants.length ? 'Základ — pre všetky varianty' : 'Suroviny' },
    ...variants.map(v => ({ id: v.id, title: `Navyše pri: ${v.name}` })),
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[640px] mx-4 overflow-hidden
                      flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 flex items-start justify-between gap-3 shrink-0"
             style={{ background: '#354d5d' }}>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(221,238,246,.6)' }}>
              {view === 'ingredients' ? 'Receptúra › Suroviny' : 'Receptúra'}
            </p>
            <h2 className="font-semibold text-sm" style={{ color: '#ddeef6' }}>{item.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavrieť"
            className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center
                       bg-white/10 hover:bg-white/20 transition-colors"
          >
            <IconX size={16} style={{ color: '#ddeef6' }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          {view === 'ingredients' && (
            <>
              <button
                type="button"
                onClick={backToRecipe}
                className="flex items-center gap-1.5 text-sm font-bold text-[#2a8d83] hover:underline"
              >
                <IconArrowLeft size={16} stroke={2.5} />
                Späť na receptúru
              </button>
              <IngredientSettings embedded />
            </>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-[#4cbfb3] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            // Receptúra ostáva pri zozname surovín len skrytá — rozpísané riadky sa nestratia
            <div className={view === 'recipe' ? 'space-y-4' : 'hidden'}>
              {/* Ako s položkou počíta kalkulácia pre kuchyňu */}
              <p className="text-xs text-[#5d7d8e]">
                {category?.name ?? 'Bez kategórie'}
                {' · '}
                {!qty
                  ? 'v kalkulácii nemá množstvo'
                  : qty.portion != null
                    ? `v kalkulácii ${fmtQty(qty.portion)}${unit ? ` ${unit}` : ''} na osobu${qty.split ? ' (pri 2+ položkách delené)' : ''}`
                    : `v kalkulácii ${unit ?? 'množstvo'} zadávané ručne`}
              </p>

              {!qty && (
                <p className="flex gap-2 text-xs text-[#a87d20] bg-[#fdf4e3] border border-[#f0dcb0] rounded-lg px-3 py-2">
                  <IconAlertTriangle size={16} className="shrink-0" />
                  Kategória nemá v kalkulácii pre kuchyňu množstvo (porciu na osobu alebo naklikané množstvo) —
                  kým ho v Nastavenia → Menu nedoplníš, receptúra sa do kalkulácie surovín nezaráta.
                </p>
              )}

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 cursor-pointer
                                hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={isIngredient}
                  onChange={e => saveRecipe({ is_ingredient: e.target.checked })}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-[#2a8d83]"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">Položka je sama surovinou</span>
                  <span className="block text-xs text-gray-500">
                    Napr. Cinzano — nemá receptúru, v kalkulácii surovín sa vypíše priamo s množstvom
                    z kalkulácie pre kuchyňu (skupina Z MENU).
                  </span>
                </span>
              </label>

              <div className={isIngredient ? 'opacity-40 pointer-events-none select-none' : ''}
                   aria-disabled={isIngredient}>
                {isIngredient && (
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    Kým je zakliknuté „Položka je sama surovinou", receptúra sa nepočíta.
                  </p>
                )}

                {/* Dávka — na koľko jednotiek jedla z kalkulácie je receptúra */}
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-gray-600">Receptúra na</span>
                  <BlurInput
                    value={fmtQty(recipe?.yield_amount ?? 1)}
                    inputMode="decimal"
                    aria-label="Dávka"
                    onSave={v => {
                      const n = parseAmount(v)
                      if (n > 0) saveRecipe({ yield_amount: n })
                      else setError('Dávka musí byť číslo väčšie ako 0.')
                    }}
                    className="w-20 text-right border-gray-200 bg-white"
                  />
                  <span className="font-semibold text-gray-900">{yieldUnit ? `${yieldUnit} jedla` : 'jedla'}</span>
                </div>

                {unitChanged && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#a87d20] bg-[#fdf4e3]
                                  border border-[#f0dcb0] rounded-lg px-3 py-2">
                    <IconAlertTriangle size={16} className="shrink-0" />
                    <span className="flex-1 min-w-[200px]">
                      Kategória teraz počíta v {unit ?? 'kusoch bez jednotky'}, receptúra je zapísaná
                      na {recipe.yield_unit ?? 'bez jednotky'} — kým to nepotvrdíš, v kalkulácii sa nezaráta.
                      Skontroluj dávku a množstvá.
                    </span>
                    <button
                      type="button"
                      onClick={() => saveRecipe({ yield_unit: unit })}
                      className="px-2.5 py-1 rounded-md font-bold border border-[#e0a43a] bg-white hover:bg-[#fffaf0]"
                    >
                      Receptúra je na {unit ?? 'bez jednotky'}
                    </button>
                  </div>
                )}

                {sections.map((sec, idx) => {
                  const own = lines.filter(l => (l.variant_id ?? null) === sec.id)
                  return (
                    <div key={sec.id ?? 'base'} className="mt-4">
                      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1 mb-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#5d7d8e]">
                          {sec.title}
                        </p>
                        {idx === 0 && (
                          <button
                            type="button"
                            onClick={() => setView('ingredients')}
                            title="Zoznam surovín — pridanie, premenovanie, jednotka, kategória"
                            className="flex items-center gap-1 text-xs font-bold text-[#2a8d83] hover:underline shrink-0"
                          >
                            <IconSettings size={14} />
                            Upraviť suroviny
                          </button>
                        )}
                      </div>
                      {own.length === 0 && (
                        <p className="text-xs text-gray-400 py-1">Zatiaľ žiadna surovina.</p>
                      )}
                      {own.map(line => (
                        <LineRow
                          key={line.id}
                          line={line}
                          ingredient={ingById[line.ingredient_id]}
                          onPatch={fields => patchLine(line, fields)}
                          onDelete={() => deleteLine(line)}
                          onError={setError}
                        />
                      ))}
                      <AddLine
                        ingredients={ingredients}
                        categories={ingCats}
                        onAdd={(ing, amount, lineUnit) => addLine(sec.id, ing, amount, lineUnit)}
                        onCreate={createIngredient}
                        defaultCategoryId={lastCatId}
                      />
                    </div>
                  )
                })}

                <p className="mt-4 text-[11px] text-gray-400">
                  Množstvo suroviny = koľko treba nakúpiť (v hrubom, vrátane čistenia) na dávku jedla vyššie.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex justify-end">
          <button
            type="button"
            onClick={view === 'ingredients' ? backToRecipe : onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: '#4cbfb3', color: '#0a2d2a' }}
          >
            {view === 'ingredients' && <IconArrowLeft size={16} stroke={2.5} />}
            {view === 'ingredients' ? 'Späť na receptúru' : 'Hotovo'}
          </button>
        </div>
      </div>
    </div>
  )
}
