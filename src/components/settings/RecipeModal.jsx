import { useEffect, useRef, useState } from 'react'
import { IconAlertTriangle, IconArrowLeft, IconPlus, IconSettings, IconX } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { calcQtyOf, fmtQty } from '../../lib/menuCalc'
import { INGREDIENT_UNITS, LINE_UNITS, dishUnitFactor, normText, parseAmount } from '../../lib/ingredients'
import { TOAST_CATEGORIES } from '../../utils/kitchenTicket'
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
  const listRef   = useRef(null)

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

  // Ponuka je pod riadkom v okne (nie plávajúca — okno by ju orezalo);
  // pri otvorení a hľadaní sa okno posunie, aby bola celá vidieť
  useEffect(() => {
    if (open) listRef.current?.scrollIntoView({ block: 'nearest' })
  }, [open, q])

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
    <div className="pt-1.5">
    <form onSubmit={submit} className="flex flex-wrap items-center gap-1.5">
      <div className="flex-1 min-w-[170px]">
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
        {open && (
          <>
            <div ref={listRef}
                 className="mt-1 max-h-60 overflow-y-auto bg-white rounded-lg border border-gray-200 shadow-lg py-1">
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

// „+ Nová kategória…" vo výbere kategórie surovín
const NEW_CAT = '__new'

// Objem v názve položky („Slivovica 0,04L") — predvolené množstvo prípitku
function volumeInName(name) {
  const m = /(\d+(?:[.,]\d+)?)\s*l\b/i.exec(name ?? '')
  return m ? parseAmount(m[1]) : null
}

// Samo-surovina položky: kategória surovín (aj nová), jednotka, v ktorej sa
// objednáva, a množstvo na 1 jednotku jedla zo sumáru pre kuchyňu.
// saved = uložené hodnoty — každá zmena sa hneď uloží cez onPatch(polia) →
// true/false; saved null = nastavenie, polia (initial) sa uložia naraz
// tlačidlom (onSave). unitLocked = surovinu používa aj iná receptúra.
function SelfIngredientPanel({ categories, saved, initial, dishUnit, unitLocked, onSave, onCancel, onPatch, onError }) {
  const [draft, setDraft]   = useState(initial)
  const [newCat, setNewCat] = useState(null)  // názov novej kategórie, null = vyberá sa z existujúcich
  const [busy, setBusy]     = useState(false)
  const v = saved ?? draft
  const update = fields => (saved ? onPatch(fields) : setDraft(d => ({ ...d, ...fields })))

  function pickCategory(id) {
    if (id === NEW_CAT) { setNewCat(''); return }
    setNewCat(null)
    update({ categoryId: id })
  }

  async function addCategory() {
    if (!newCat.trim()) return
    setBusy(true)
    if (await onPatch({ newCategory: newCat.trim() })) setNewCat(null)
    setBusy(false)
  }

  async function save() {
    setBusy(true)
    await onSave({ ...draft, newCategory: newCat?.trim() || null })
    setBusy(false)
  }

  const btn = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50'
  return (
    <div className="p-3 rounded-lg border border-[#a8d9d3] bg-[#f3faf9] space-y-2.5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-sm">
        <span className="text-gray-600">Kategória surovín</span>
        <select
          value={newCat != null ? NEW_CAT : v.categoryId ?? ''}
          onChange={e => pickCategory(e.target.value)}
          aria-label="Kategória surovín"
          className={`${selectCls} w-full`}
        >
          {!v.categoryId && <option value="">Vyber kategóriu…</option>}
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value={NEW_CAT}>+ Nová kategória…</option>
        </select>

        {newCat != null && (
          <>
            <span />
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                placeholder="Názov novej kategórie"
                aria-label="Názov novej kategórie"
                autoFocus
                className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {saved && (
                <>
                  <button
                    type="button"
                    onClick={addCategory}
                    disabled={busy || !newCat.trim()}
                    className={btn}
                    style={{ background: '#4cbfb3', color: '#0a2d2a' }}
                  >
                    Pridať
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCat(null)}
                    className={`${btn} border border-gray-300 bg-white text-gray-600`}
                  >
                    Zrušiť
                  </button>
                </>
              )}
            </div>
          </>
        )}

        <span className="text-gray-600">Objednáva sa v</span>
        <select
          value={v.unit}
          onChange={e => update({ unit: e.target.value, lineUnit: e.target.value })}
          disabled={unitLocked}
          aria-label="Jednotka suroviny"
          title={unitLocked ? 'Surovinu používa aj iná receptúra — jednotku nejde zmeniť' : 'Jednotka, v ktorej sa surovina objednáva'}
          className={`${selectCls} justify-self-start disabled:opacity-60`}
        >
          {INGREDIENT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <span className="text-gray-600">Na 1 {dishUnit ?? 'jednotku'} jedla</span>
        <div className="flex items-center gap-1.5">
          {saved ? (
            <BlurInput
              value={fmtQty(saved.amount)}
              inputMode="decimal"
              aria-label="Množstvo suroviny"
              onSave={x => {
                const n = parseAmount(x)
                if (n > 0) onPatch({ amount: n })
                else onError('Množstvo musí byť číslo väčšie ako 0.')
              }}
              className="w-20 text-right border-gray-300 bg-white"
            />
          ) : (
            <input
              value={draft.amount}
              onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))}
              inputMode="decimal"
              aria-label="Množstvo suroviny"
              className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right bg-white
                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
          <select
            value={v.lineUnit}
            onChange={e => update({ lineUnit: e.target.value })}
            aria-label="Jednotka množstva"
            className={selectCls}
          >
            {(LINE_UNITS[v.unit] ?? [v.unit]).map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {!saved && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={save}
            disabled={busy || (newCat != null ? !newCat.trim() : !draft.categoryId)}
            className={btn}
            style={{ background: '#4cbfb3', color: '#0a2d2a' }}
          >
            Uložiť ako surovinu
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={`${btn} border border-gray-300 bg-white text-gray-600`}
            >
              Zrušiť
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Receptúra položky menu (Nastavenia → Menu → čiapka pri položke): suroviny na
// dávku jedla v jednotke sumáru pre kuchyňu (napr. na 1 kg), pri variantoch
// základ + suroviny navyše pre variant; alebo „položka je sama surovinou"
// (prípitok, omáčka…): samo-surovina naviazaná na položku (ingredients.menu_item_id,
// názov = názov položky) vo zvolenej kategórii surovín a jeden riadok receptúry
// na ňu — v kalkulácii surovín je medzi surovinami, v Nastavenia → Suroviny
// zašednutá. Ukladá hneď ako zvyšok Nastavení (nastavenie samo-suroviny naraz).
// variants = nearchivované varianty položky (pri zapnutých variantoch).
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
  const [starting, setStarting]       = useState(false)     // zakliknuté, samo-surovina sa nastavuje
  const [confirmOff, setConfirmOff]   = useState(false)     // potvrdenie zrušenia samo-suroviny
  const [usedElsewhere, setUsedElsewhere] = useState([])    // receptúry iných položiek so samo-surovinou

  // Množstvo jedla v sumári pre kuchyňu — v jeho jednotke je dávka receptúry
  const qty  = category ? calcQtyOf(category) : null
  const unit = qty?.unit ?? null

  useEffect(() => {
    let alive = true
    async function load() {
      const [r, l, i, c] = await Promise.all([
        supabase.from('menu_item_recipes').select('*').eq('item_id', item.id),
        supabase.from('menu_item_recipe_lines').select('*').eq('item_id', item.id).order('position'),
        supabase.from('ingredients').select('*').order('position'),
        supabase.from('ingredient_categories').select('*').order('position'),
      ])
      if (!alive) return
      const err = r.error || l.error || i.error || c.error
      if (err) { setError(err.message); setLoading(false); return }
      setRecipe(r.data?.[0] ?? null)
      setLines(l.data ?? [])
      setIngredients(i.data ?? [])
      setIngCats(c.data ?? [])
      const self = (i.data ?? []).find(x => x.menu_item_id === item.id)
      if (self) await loadUsage(self.id)
      if (alive) setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [item.id])

  // Receptúry iných položiek, v ktorých je samo-surovina (napr. Domáca knedľa
  // v „Knedľa + Lokša") — vtedy sa jej jednotka nemení a pri zrušení ostane
  // ako bežná surovina. null = chyba.
  async function loadUsage(ingId) {
    const { data, error } = await supabase
      .from('menu_item_recipe_lines')
      .select('item_id, menu_items(name)')
      .eq('ingredient_id', ingId)
      .neq('item_id', item.id)
    if (error) { setError(error.message); return null }
    const names = [...new Set(data.map(r => r.menu_items?.name ?? '?'))]
    setUsedElsewhere(names)
    return names
  }

  // Späť zo zoznamu surovín — znova načíta suroviny (nové, premenované, vymazané)
  // aj riadky receptúry (surovina mohla byť nahradená alebo vymazaná z receptúr)
  async function backToRecipe() {
    const [i, c, l] = await Promise.all([
      supabase.from('ingredients').select('*').order('position'),
      supabase.from('ingredient_categories').select('*').order('position'),
      supabase.from('menu_item_recipe_lines').select('*').eq('item_id', item.id).order('position'),
    ])
    const err = i.error || c.error || l.error
    if (err) setError(err.message)
    else {
      setIngredients(i.data ?? [])
      setIngCats(c.data ?? [])
      setLines(l.data ?? [])
      const self = (i.data ?? []).find(x => x.menu_item_id === item.id)
      if (self) await loadUsage(self.id)
    }
    setView('recipe')
  }

  // Koniec kategórie surovín — tam ide nová (alebo presunutá) surovina
  const endPosition = categoryId =>
    Math.max(0, ...ingredients.filter(i => i.category_id === categoryId).map(i => i.position)) + 1

  // Nová surovina z vyhľadávania — na koniec svojej kategórie
  async function createIngredient(name, categoryId, ingUnit) {
    setError('')
    const { data, error } = await supabase
      .from('ingredients')
      .insert({ category_id: categoryId, name, unit: ingUnit, position: endPosition(categoryId) })
      .select()
      .single()
    if (error) { setError(error.message); return null }
    setIngredients(is => [...is, data])
    setLastCatId(categoryId)
    return data
  }

  // Nová kategória surovín (pri samo-surovine) — na koniec zoznamu
  async function createCategory(name) {
    const position = Math.max(0, ...ingCats.map(c => c.position)) + 1
    const { data, error } = await supabase
      .from('ingredient_categories')
      .insert({ name, position })
      .select()
      .single()
    if (error) { setError(error.message); return null }
    setIngCats(cs => [...cs, data])
    return data
  }

  async function patchIngredient(ing, fields) {
    const { error } = await supabase.from('ingredients').update(fields).eq('id', ing.id)
    if (error) { setError(error.message); return false }
    setIngredients(is => is.map(i => i.id === ing.id ? { ...i, ...fields } : i))
    return true
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
    if (error) { setError(error.message); return false }
    setLines(ls => ls.map(l => l.id === line.id ? { ...l, ...fields } : l))
    return true
  }

  async function deleteLine(line) {
    setError('')
    const { error } = await supabase.from('menu_item_recipe_lines').delete().eq('id', line.id)
    if (error) { setError(error.message); return }
    setLines(ls => ls.filter(l => l.id !== line.id))
  }

  const selfIng   = ingredients.find(i => i.menu_item_id === item.id) ?? null
  const selfLine  = selfIng ? lines.find(l => l.ingredient_id === selfIng.id) ?? null : null
  const isIngredient = !!recipe?.is_ingredient
  const selfReady = isIngredient && !!selfLine
  const showSelf  = isIngredient || starting

  // Zakliknutie — len pri položke bez receptúry (riadky by sa inak stratili)
  function startSelf() {
    const other = lines.filter(l => l.ingredient_id !== selfIng?.id)
    if (other.length) {
      setError(`Položka má receptúru (${other.length} ${other.length === 1 ? 'surovina' : other.length < 5 ? 'suroviny' : 'surovín'}) — ` +
        'aby bola sama surovinou, najprv suroviny z receptúry odober.')
      return
    }
    setError('')
    setStarting(true)
  }

  // Odškrtnutie: rozrobené nastavenie sa len zavrie, samo-surovina s potvrdením
  function uncheckSelf() {
    if (!isIngredient) { setStarting(false); return }
    if (selfIng) setConfirmOff(true)
    else stopSelf()
  }

  // Predvolené nastavenie: jednotka podľa jedla (kg / L / ks), 1 na 1 jednotku
  // jedla; prípitok (aj s objemom v názve) v litroch — 0,1 L alebo objem z názvu
  function defaultSelf() {
    const du = String(unit ?? '').trim().toLowerCase()
    const vol = volumeInName(item.name)
    const toast = TOAST_CATEGORIES.some(t => t.id === category?.id)
    const liters = toast || (vol != null && !['kg', 'g', 'l', 'ml'].includes(du))
    const ingUnit = liters || du === 'l' || du === 'ml' ? 'L' : du === 'kg' || du === 'g' ? 'kg' : 'ks'
    const lineUnit = liters ? 'L' : du === 'g' ? 'g' : du === 'ml' ? 'ml' : ingUnit
    return {
      categoryId: selfIng?.category_id ?? '',
      unit:       selfIng?.unit ?? ingUnit,
      lineUnit:   selfIng ? (LINE_UNITS[selfIng.unit]?.includes(lineUnit) ? lineUnit : selfIng.unit) : lineUnit,
      amount:     fmtQty(liters ? vol ?? 0.1 : 1),
    }
  }

  // Uloženie nastavenia: hlavička (sama surovinou, na 1 jednotku jedla),
  // samo-surovina (rozrobená sa len upraví) a jej riadok receptúry
  async function saveSelf({ categoryId, newCategory, unit: ingUnit, amount, lineUnit }) {
    setError('')
    const n = parseAmount(amount)
    if (!(n > 0)) { setError('Množstvo musí byť číslo väčšie ako 0.'); return }
    let catId = categoryId
    if (newCategory) {
      const cat = await createCategory(newCategory)
      if (!cat) return
      catId = cat.id
    }
    if (!catId) { setError('Vyber kategóriu surovín.'); return }
    if (!(await saveRecipe({ is_ingredient: true, yield_amount: 1, yield_unit: unit }))) return

    let ing = selfIng
    if (ing) {
      const fields = { category_id: catId, unit: ingUnit, archived_at: null }
      if (ing.category_id !== catId) fields.position = endPosition(catId)
      if (!(await patchIngredient(ing, fields))) return
      ing = { ...ing, ...fields }
    } else {
      const { data, error } = await supabase
        .from('ingredients')
        .insert({ category_id: catId, name: item.name, unit: ingUnit, position: endPosition(catId), menu_item_id: item.id })
        .select()
        .single()
      if (error) { setError(error.message); return }
      ing = data
      setIngredients(is => [...is, data])
    }

    const line = lines.find(l => l.ingredient_id === ing.id)
    if (line) {
      if (!(await patchLine(line, { amount: n, unit: lineUnit }))) return
    } else {
      const { data, error } = await supabase
        .from('menu_item_recipe_lines')
        .insert({ item_id: item.id, variant_id: null, ingredient_id: ing.id, amount: n, unit: lineUnit, position: 1 })
        .select()
        .single()
      if (error) { setError(error.message); return }
      setLines(ls => [...ls, data])
    }
    setStarting(false)
  }

  // Zmena uloženej samo-suroviny (kategória, nová kategória, jednotka, množstvo)
  async function patchSelf(fields) {
    setError('')
    if (fields.newCategory || fields.categoryId) {
      const cat = fields.newCategory ? await createCategory(fields.newCategory) : { id: fields.categoryId }
      if (!cat) return false
      if (cat.id === selfIng.category_id) return true
      return patchIngredient(selfIng, { category_id: cat.id, position: endPosition(cat.id) })
    }
    // Jednotka suroviny a riadku naraz — riadok musí so surovinou sedieť
    if (fields.unit) {
      if (!(await patchIngredient(selfIng, { unit: fields.unit }))) return false
      return patchLine(selfLine, { unit: fields.lineUnit })
    }
    if (fields.amount != null) return patchLine(selfLine, { amount: fields.amount })
    if (fields.lineUnit) return patchLine(selfLine, { unit: fields.lineUnit })
    return true
  }

  // Zrušenie: riadok samo-suroviny sa zmaže a samo-surovina tiež — ak ju
  // používa iná receptúra, ostane ako bežná surovina
  async function stopSelf() {
    setError('')
    if (selfIng) {
      const { error } = await supabase
        .from('menu_item_recipe_lines')
        .delete()
        .eq('item_id', item.id)
        .eq('ingredient_id', selfIng.id)
      if (error) { setError(error.message); return }
      setLines(ls => ls.filter(l => l.ingredient_id !== selfIng.id))
      const used = await loadUsage(selfIng.id)
      if (used == null) return
      const { error: ingError } = used.length
        ? await supabase.from('ingredients').update({ menu_item_id: null }).eq('id', selfIng.id)
        : await supabase.from('ingredients').delete().eq('id', selfIng.id)
      if (ingError) { setError(ingError.message); return }
      setIngredients(is => used.length
        ? is.map(i => i.id === selfIng.id ? { ...i, menu_item_id: null } : i)
        : is.filter(i => i.id !== selfIng.id))
    }
    if (await saveRecipe({ is_ingredient: false })) {
      setConfirmOff(false)
      setUsedElsewhere([])
    }
  }

  const yieldUnit    = recipe ? recipe.yield_unit : unit
  // Kategória teraz počíta v inej jednotke, než v akej je receptúra zapísaná
  // (g↔kg a ml↔L sa prepočíta samo); pri rozrobenej samo-surovine sa to
  // vyrieši uložením
  const unitChanged  = recipe && qty && dishUnitFactor(unit, recipe.yield_unit) == null && (!showSelf || selfReady)
  const ingById      = Object.fromEntries(ingredients.map(i => [i.id, i]))
  const activeCats   = ingCats.filter(c => !c.archived_at || c.id === selfIng?.category_id)
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
                  ? 'v sumári pre kuchyňu nemá množstvo'
                  : qty.portion != null
                    ? `v sumári ${fmtQty(qty.portion)}${unit ? ` ${unit}` : ''} na osobu${qty.split ? ' (pri 2+ položkách delené)' : ''}`
                    : `v sumári ${unit ?? 'množstvo'} zadávané ručne`}
              </p>

              {!qty && (
                <p className="flex gap-2 text-xs text-[#a87d20] bg-[#fdf4e3] border border-[#f0dcb0] rounded-lg px-3 py-2">
                  <IconAlertTriangle size={16} className="shrink-0" />
                  Kategória nemá v sumári pre kuchyňu množstvo (porciu na osobu alebo naklikané množstvo) —
                  kým ho v Nastavenia → Menu nedoplníš, {showSelf ? 'surovina' : 'receptúra'} sa do kalkulácie
                  surovín nezaráta.
                </p>
              )}

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 cursor-pointer
                                hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={showSelf}
                  onChange={e => (e.target.checked ? startSelf() : uncheckSelf())}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-[#2a8d83]"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">Položka je sama surovinou</span>
                  <span className="block text-xs text-gray-500">
                    Nemá receptúru (napr. prípitok, omáčka) — v kalkulácii surovín je priamo medzi
                    surovinami vo zvolenej kategórii, v Nastavenia → Suroviny zašednutá.
                  </span>
                </span>
              </label>

              {confirmOff && selfIng && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50/60 space-y-2">
                  <p className="text-sm text-gray-800">
                    Položka prestane byť surovinou a v kalkulácii surovín bude bez receptúry, kým jej ju
                    nezadáš.{' '}
                    {usedElsewhere.length
                      ? `„${selfIng.name}" ostane v surovinách ako bežná surovina — je aj v receptúre ${usedElsewhere.join(', ')}.`
                      : `„${selfIng.name}" sa vymaže zo surovín.`}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={stopSelf}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-red-600 border-red-600 text-white
                                 hover:bg-red-700 transition-colors"
                    >
                      Zrušiť surovinu
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmOff(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white border-gray-300 text-gray-600
                                 hover:bg-gray-50 transition-colors"
                    >
                      Nechať
                    </button>
                  </div>
                </div>
              )}

              {unitChanged && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#a87d20] bg-[#fdf4e3]
                                border border-[#f0dcb0] rounded-lg px-3 py-2">
                  <IconAlertTriangle size={16} className="shrink-0" />
                  <span className="flex-1 min-w-[200px]">
                    Kategória teraz počíta v {unit ?? 'kusoch bez jednotky'},{' '}
                    {showSelf ? 'množstvo suroviny je zadané' : 'receptúra je zapísaná'} na{' '}
                    {recipe.yield_unit ?? 'bez jednotky'} — kým to nepotvrdíš, v kalkulácii sa nezaráta.
                    Skontroluj {showSelf ? 'množstvo' : 'dávku a množstvá'}.
                  </span>
                  <button
                    type="button"
                    onClick={() => saveRecipe({ yield_unit: unit })}
                    className="px-2.5 py-1 rounded-md font-bold border border-[#e0a43a] bg-white hover:bg-[#fffaf0]"
                  >
                    {showSelf ? 'Množstvo je' : 'Receptúra je'} na {unit ?? 'bez jednotky'}
                  </button>
                </div>
              )}

              {showSelf ? (
                <div className="space-y-2">
                  {isIngredient && !selfReady && (
                    <p className="flex gap-2 text-xs text-[#a87d20] bg-[#fdf4e3] border border-[#f0dcb0] rounded-lg px-3 py-2">
                      <IconAlertTriangle size={16} className="shrink-0" />
                      Vyber kategóriu surovín a ulož — dovtedy je položka v kalkulácii surovín bez receptúry.
                    </p>
                  )}
                  <SelfIngredientPanel
                    key={selfReady ? 'saved' : 'draft'}
                    categories={activeCats}
                    saved={selfReady
                      ? { categoryId: selfIng.category_id, unit: selfIng.unit, amount: Number(selfLine.amount), lineUnit: selfLine.unit }
                      : null}
                    initial={defaultSelf()}
                    dishUnit={selfReady ? yieldUnit : unit}
                    unitLocked={usedElsewhere.length > 0}
                    onSave={saveSelf}
                    onCancel={isIngredient ? null : () => setStarting(false)}
                    onPatch={patchSelf}
                    onError={setError}
                  />
                  {selfReady && (
                    <p className="text-[11px] text-gray-400">
                      V Nastavenia → Suroviny je „{selfIng.name}" v kategórii{' '}
                      {ingCats.find(c => c.id === selfIng.category_id)?.name ?? '?'} zašednutá — upravuje sa tu.
                      {usedElsewhere.length > 0 && ` Používa ju aj receptúra: ${usedElsewhere.join(', ')}.`}
                    </p>
                  )}
                </div>
              ) : (
                <div>
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
                    Dávka jedla je v surovom stave ako v menu (ryža a cestoviny v hotovom). Množstvo suroviny
                    = koľko jej treba na túto dávku, bez odpadu.
                  </p>
                </div>
              )}
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
