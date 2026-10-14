import { Fragment, useEffect, useRef, useState } from 'react'
import {
  IconChevronDown, IconChevronRight, IconFileSpreadsheet, IconLoader2, IconPlus,
  IconSearch, IconTrash, IconX,
} from '@tabler/icons-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { supabase } from '../../lib/supabase'
import { INGREDIENT_UNITS, fetchAllRows, normText } from '../../lib/ingredients'
import { exportRecipeData } from '../../utils/exportMenu'
import BlurInput from './BlurInput'
import { DragHandle, SortableRow } from './Sortable'

// „v 1 receptúre" / „v 3 receptúrach"
const inRecipes = n => `v ${n} ${n === 1 ? 'receptúre' : 'receptúrach'}`

// Administrácia SUROVÍN pre receptúry a kalkuláciu surovín: kategórie (poradie
// ťahaním, premenovanie) a ich suroviny (poradie, názov, jednotka, presun medzi
// kategóriami). Mazanie = archivácia. Surovinu, ktorá je v receptúrach, pri
// mazaní buď nahradíš inou (všade naraz), vymažeš aj z receptúr, alebo ju
// necháš v receptúrach (označená „vymazaná", ďalej sa počíta). Jednotku
// suroviny, ktorá je už v receptúre, nejde zmeniť (z 200 g by sa stalo 200 ks).
// embedded = v okne receptúry (bez úvodného textu a exportu)
export default function IngredientSettings({ embedded = false }) {
  const [categories, setCategories]   = useState([])
  const [ingredients, setIngredients] = useState([])
  const [usage, setUsage]             = useState({})  // ingredient_id → [{ id, name }] receptúr (jedál)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  const [expandedId, setExpandedId] = useState(null)
  const [search, setSearch]         = useState('')
  const [newCatName, setNewCatName] = useState('')
  const [newIng, setNewIng]         = useState({ name: '', unit: 'kg' })

  // Prvý klik = potvrdenie (~4 s), druhý = archivácia
  const [confirmDelete, setConfirmDelete] = useState(null) // 'cat:<id>' | 'ing:<id>'
  const confirmTimer = useRef(null)
  // Mazanie suroviny, ktorá je v receptúrach: { id, replaceId } — otvorený panel
  const [deleting, setDeleting] = useState(null)

  // Export pre receptúry (Excel s jedlami a surovinami aj s ID)
  const [exporting, setExporting] = useState(false)
  const [exportErr, setExportErr] = useState('')

  // Ťahanie sa spustí až po pohybe o pár px — klik na úchytku nič nepresúva
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => { fetchAll() }, [])

  // quiet = bez točiaceho sa kolieska (obnova po nahradení / vymazaní)
  async function fetchAll(quiet = false) {
    if (!quiet) setLoading(true)
    setError(null)
    const [c, i, l] = await Promise.all([
      supabase.from('ingredient_categories').select('*').is('archived_at', null).order('position'),
      supabase.from('ingredients').select('*').is('archived_at', null).order('position'),
      fetchAllRows((from, to) => supabase
        .from('menu_item_recipe_lines')
        .select('id, item_id, ingredient_id, menu_items(name)')
        .order('id')
        .range(from, to)),
    ])
    const err = c.error || i.error || l.error
    if (err) {
      // Tabuľky ešte nie sú (migrácia nespustená) → zrozumiteľná hláška
      const missing = ['PGRST205', '42P01'].includes(err.code)
      setError(missing
        ? 'Tabuľky surovín v databáze ešte nie sú — najprv treba spustiť migráciu 20261014000001_suroviny_receptury.sql.'
        : err.message)
    } else {
      setCategories(c.data ?? [])
      setIngredients(i.data ?? [])
      // Receptúry (jedlá), v ktorých je surovina — každé jedlo raz
      const byIng = {}
      for (const r of l.data) {
        const list = (byIng[r.ingredient_id] ??= [])
        if (!list.some(x => x.id === r.item_id)) list.push({ id: r.item_id, name: r.menu_items?.name ?? '?' })
      }
      setUsage(byIng)
    }
    setLoading(false)
  }

  async function patch(table, id, fields, applyLocal) {
    const { error } = await supabase.from(table).update(fields).eq('id', id)
    if (error) { setError(error.message); return false }
    applyLocal?.()
    return true
  }

  // Po pretiahnutí prečísluje pozície 1..n a uloží len zmenené riadky
  async function persistOrder(table, prevRows, nextRows, onFail) {
    const changed = nextRows.filter(r =>
      r.position !== prevRows.find(p => p.id === r.id)?.position)
    const results = await Promise.all(changed.map(r =>
      supabase.from(table).update({ position: r.position }).eq('id', r.id)))
    const failed = results.find(r => r.error)
    if (failed) { setError(failed.error.message); onFail?.() }
  }

  function askConfirm(key) {
    setConfirmDelete(key)
    clearTimeout(confirmTimer.current)
    confirmTimer.current = setTimeout(() => setConfirmDelete(null), 4000)
  }

  async function handleExport() {
    setExportErr('')
    setExporting(true)
    try {
      await exportRecipeData()
    } catch (e) {
      setExportErr('Export zlyhal: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  // ---- kategórie ----

  async function addCategory(e) {
    e.preventDefault()
    const name = newCatName.trim()
    if (!name) return
    const position = Math.max(0, ...categories.map(c => c.position)) + 1
    const { data, error } = await supabase
      .from('ingredient_categories')
      .insert({ name, position })
      .select()
      .single()
    if (error) { setError(error.message); return }
    setCategories(cs => [...cs, data])
    setNewCatName('')
  }

  function onCategoryDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIdx = categories.findIndex(c => c.id === active.id)
    const newIdx = categories.findIndex(c => c.id === over.id)
    const reordered = arrayMove(categories, oldIdx, newIdx).map((c, i) => ({ ...c, position: i + 1 }))
    const prev = categories
    setCategories(reordered)
    persistOrder('ingredient_categories', prev, reordered, fetchAll)
  }

  // Vymazať sa dá len prázdna kategória — suroviny by inak zmizli z ponuky
  async function deleteCategory(cat) {
    if (ingredients.some(i => i.category_id === cat.id)) {
      setError(`Kategória „${cat.name}" nie je prázdna — suroviny najprv presuň do inej kategórie alebo vymaž.`)
      return
    }
    if (confirmDelete !== `cat:${cat.id}`) { askConfirm(`cat:${cat.id}`); return }
    clearTimeout(confirmTimer.current)
    setConfirmDelete(null)
    await patch('ingredient_categories', cat.id, { archived_at: new Date().toISOString() }, () =>
      setCategories(cs => cs.filter(c => c.id !== cat.id)))
  }

  // ---- suroviny ----

  async function addIngredient(e, cat) {
    e.preventDefault()
    const name = newIng.name.trim()
    if (!name) return
    const position = Math.max(0, ...ingredients.filter(i => i.category_id === cat.id).map(i => i.position)) + 1
    const { data, error } = await supabase
      .from('ingredients')
      .insert({ category_id: cat.id, name, unit: newIng.unit, position })
      .select()
      .single()
    if (error) { setError(error.message); return }
    setIngredients(is => [...is, data])
    setNewIng(n => ({ ...n, name: '' }))
  }

  function onIngredientDragEnd(cat, { active, over }) {
    if (!over || active.id === over.id) return
    const catIngs = ingredients.filter(i => i.category_id === cat.id)
    const oldIdx = catIngs.findIndex(i => i.id === active.id)
    const newIdx = catIngs.findIndex(i => i.id === over.id)
    const reordered = arrayMove(catIngs, oldIdx, newIdx).map((it, i) => ({ ...it, position: i + 1 }))
    const prev = ingredients
    setIngredients(is => is
      .map(i => reordered.find(r => r.id === i.id) ?? i)
      .sort((a, b) => a.position - b.position))
    persistOrder('ingredients', prev, reordered, fetchAll)
  }

  // Presun do inej kategórie — zaradí sa na koniec cieľovej kategórie
  function moveToCategory(ing, categoryId) {
    if (!categoryId || categoryId === ing.category_id) return
    const position = Math.max(0, ...ingredients.filter(i => i.category_id === categoryId).map(i => i.position)) + 1
    patch('ingredients', ing.id, { category_id: categoryId, position }, () =>
      setIngredients(is => is.map(i => i.id === ing.id ? { ...i, category_id: categoryId, position } : i)))
  }

  function setUnit(ing, unit) {
    if (usage[ing.id]?.length) {
      setError(`Jednotku suroviny „${ing.name}" nejde zmeniť — je ${inRecipes(usage[ing.id].length)}.`)
      return
    }
    patch('ingredients', ing.id, { unit }, () =>
      setIngredients(is => is.map(i => i.id === ing.id ? { ...i, unit } : i)))
  }

  // Surovina v receptúrach → panel s možnosťami; inak 2 kliky „Naozaj?"
  async function deleteIngredient(ing) {
    if (usage[ing.id]?.length) {
      setDeleting(d => (d?.id === ing.id ? null : { id: ing.id, replaceId: '' }))
      return
    }
    if (confirmDelete !== `ing:${ing.id}`) { askConfirm(`ing:${ing.id}`); return }
    clearTimeout(confirmTimer.current)
    setConfirmDelete(null)
    await archiveIngredient(ing)
  }

  // Vymazanie = archivácia; zo zoznamu zmizne
  async function archiveIngredient(ing) {
    return patch('ingredients', ing.id, { archived_at: new Date().toISOString() }, () =>
      setIngredients(is => is.filter(i => i.id !== ing.id)))
  }

  // Nahradiť inou surovinou vo všetkých receptúrach (množstvá a jednotky
  // ostávajú — náhrada má rovnakú jednotku), potom starú vymazať
  async function replaceIngredient(ing, replaceId) {
    const { error } = await supabase
      .from('menu_item_recipe_lines')
      .update({ ingredient_id: replaceId })
      .eq('ingredient_id', ing.id)
    if (error) { setError(error.message); return }
    if (await archiveIngredient(ing)) {
      setDeleting(null)
      fetchAll(true)
    }
  }

  // Vymazať aj z receptúr — riadky s touto surovinou sa odstránia
  async function deleteWithLines(ing) {
    const { error } = await supabase.from('menu_item_recipe_lines').delete().eq('ingredient_id', ing.id)
    if (error) { setError(error.message); return }
    if (await archiveIngredient(ing)) {
      setDeleting(null)
      fetchAll(true)
    }
  }

  // Len zo zoznamu — v receptúrach ostane ako „vymazaná" a ďalej sa počíta
  async function archiveOnly(ing) {
    if (await archiveIngredient(ing)) setDeleting(null)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#4cbfb3] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Vyhľadávanie: kategórie s nájdenými surovinami, rozbalené, bez ťahania
  // (poradie sa mení len v celom zozname)
  const q = normText(search.trim())
  const searching = q !== ''
  const ingsOf = cat => ingredients.filter(i =>
    i.category_id === cat.id && (!searching || normText(i.name).includes(q)))
  const shownCats = searching ? categories.filter(c => ingsOf(c).length) : categories

  // Panel mazania suroviny, ktorá je v receptúrach
  function deletePanel(ing) {
    const recipes = usage[ing.id] ?? []
    const replaceId = deleting.replaceId
    // Náhrada: nevymazané suroviny s rovnakou jednotkou, po kategóriách
    const options = categories
      .map(c => ({ cat: c, items: ingredients.filter(i => i.category_id === c.id && i.unit === ing.unit && i.id !== ing.id) }))
      .filter(g => g.items.length)
    const btn = 'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors'
    return (
      <div className="mx-3 mb-2 p-3 rounded-lg border border-red-200 bg-red-50/60 space-y-2.5">
        <p className="text-sm text-gray-800">
          <span className="font-bold">{ing.name}</span> je {inRecipes(recipes.length)}:{' '}
          <span className="text-gray-600">{recipes.map(r => r.name).join(', ')}</span>
        </p>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={replaceId}
              onChange={e => setDeleting(d => ({ ...d, replaceId: e.target.value }))}
              aria-label="Náhrada"
              className="flex-1 min-w-[180px] text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white
                         text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Nahradiť inou surovinou ({ing.unit})…</option>
              {options.map(g => (
                <optgroup key={g.cat.id} label={g.cat.name}>
                  {g.items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              onClick={() => replaceIngredient(ing, replaceId)}
              disabled={!replaceId}
              className={`${btn} border-[#4cbfb3] disabled:opacity-50`}
              style={{ background: '#4cbfb3', color: '#0a2d2a' }}
            >
              Nahradiť všade
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            V receptúrach sa surovina vymení, množstvá ostanú. Ak už receptúra náhradu má,
            bude v nej dvakrát (kalkulácia ich sčíta).
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => deleteWithLines(ing)}
            className={`${btn} bg-red-600 border-red-600 text-white hover:bg-red-700`}
          >
            Vymazať aj z receptúr
          </button>
          <button
            type="button"
            onClick={() => archiveOnly(ing)}
            title={'V receptúrach ostane označená „vymazaná" a v kalkulácii surovín sa ďalej počíta'}
            className={`${btn} bg-white border-gray-300 text-gray-700 hover:bg-gray-50`}
          >
            Len zo zoznamu
          </button>
          <button
            type="button"
            onClick={() => setDeleting(null)}
            className={`${btn} bg-white border-gray-300 text-gray-500 hover:bg-gray-50`}
          >
            Zrušiť
          </button>
        </div>
      </div>
    )
  }

  // Riadok suroviny; handleProps = null → bez úchytky (vyhľadávanie)
  function ingredientRow(ing, handleProps) {
    const used = usage[ing.id]?.length ?? 0
    return (
      <>
      <div className="px-3 py-1.5 flex items-center gap-1.5 flex-wrap">
        {handleProps ? <DragHandle {...handleProps} /> : <span className="w-7 shrink-0" />}

        <BlurInput
          value={ing.name}
          onSave={name => {
            if (!name.trim()) return
            patch('ingredients', ing.id, { name: name.trim() }, () =>
              setIngredients(is => is.map(i => i.id === ing.id ? { ...i, name: name.trim() } : i)))
          }}
          className="flex-1 min-w-[150px] text-gray-800"
        />

        {used > 0 && <span className="text-[11px] text-gray-400 shrink-0">{inRecipes(used)}</span>}

        <select
          value={ing.unit}
          onChange={e => setUnit(ing, e.target.value)}
          disabled={used > 0}
          title={used > 0
            ? `Jednotku nejde zmeniť — surovina je ${inRecipes(used)}`
            : 'Jednotka, v ktorej sa surovina objednáva'}
          aria-label="Jednotka"
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 shrink-0
                     disabled:bg-field-locked disabled:border-field-locked-border disabled:text-gray-500
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {INGREDIENT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <select
          value={ing.category_id}
          onChange={e => moveToCategory(ing, e.target.value)}
          title="Presunúť do inej kategórie"
          aria-label="Kategória"
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-500
                     shrink-0 max-w-[140px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <button
          onClick={() => deleteIngredient(ing)}
          title={used > 0 ? 'Vymazať surovinu — ukáže, v ktorých receptúrach je' : 'Vymazať surovinu'}
          aria-label="Vymazať surovinu"
          aria-expanded={used > 0 ? deleting?.id === ing.id : undefined}
          className={`px-2 py-1.5 rounded-md text-xs font-bold border transition-colors
                      inline-flex items-center gap-1 shrink-0
                      ${confirmDelete === `ing:${ing.id}` || deleting?.id === ing.id
                        ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                        : 'border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50'}`}
        >
          <IconTrash size={14} />
          {confirmDelete === `ing:${ing.id}` && 'Naozaj?'}
        </button>
      </div>
      {deleting?.id === ing.id && deletePanel(ing)}
      </>
    )
  }

  // Karta kategórie; handleProps = null → bez úchytky (vyhľadávanie)
  function categoryCard(cat, handleProps) {
    const catIngs  = ingsOf(cat)
    const expanded = searching || expandedId === cat.id
    return (
      <>
        <div className="px-3 py-2 flex items-center gap-1.5">
          {handleProps ? <DragHandle {...handleProps} /> : <span className="w-7 shrink-0" />}

          <button
            onClick={() => { setExpandedId(expanded ? null : cat.id); setNewIng(n => ({ ...n, name: '' })) }}
            disabled={searching}
            aria-label={expanded ? 'Zbaliť' : 'Rozbaliť'}
            className="w-7 h-7 shrink-0 rounded flex items-center justify-center
                       text-gray-400 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </button>

          <BlurInput
            value={cat.name}
            onSave={name => {
              if (!name.trim()) return
              patch('ingredient_categories', cat.id, { name: name.trim() }, () =>
                setCategories(cs => cs.map(c => c.id === cat.id ? { ...c, name: name.trim() } : c)))
            }}
            className="flex-1 min-w-[120px] font-semibold text-gray-900"
          />

          <span className="text-xs text-gray-400 shrink-0">{catIngs.length} sur.</span>

          <button
            onClick={() => deleteCategory(cat)}
            title="Vymazať kategóriu (len prázdnu)"
            aria-label="Vymazať kategóriu"
            className={`px-2 py-1.5 rounded-md text-xs font-bold border transition-colors
                        inline-flex items-center gap-1 shrink-0
                        ${confirmDelete === `cat:${cat.id}`
                          ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                          : 'border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50'}`}
          >
            <IconTrash size={14} />
            {confirmDelete === `cat:${cat.id}` && 'Naozaj?'}
          </button>
        </div>

        {expanded && (
          <div className="border-t border-gray-100">
            {searching ? (
              catIngs.map(ing => (
                <div key={ing.id} className="border-b border-gray-50 bg-white">{ingredientRow(ing, null)}</div>
              ))
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={e => onIngredientDragEnd(cat, e)}
              >
                <SortableContext items={catIngs.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  {catIngs.map(ing => (
                    <SortableRow key={ing.id} id={ing.id} className="border-b border-gray-50 bg-white">
                      {ingHandleProps => ingredientRow(ing, ingHandleProps)}
                    </SortableRow>
                  ))}
                </SortableContext>
              </DndContext>
            )}

            {/* Nová surovina */}
            {!searching && (
              <form onSubmit={e => addIngredient(e, cat)} className="px-3 py-2 flex gap-2 bg-gray-50/60">
                <input
                  value={newIng.name}
                  onChange={e => setNewIng(n => ({ ...n, name: e.target.value }))}
                  placeholder="Názov novej suroviny"
                  className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={newIng.unit}
                  onChange={e => setNewIng(n => ({ ...n, unit: e.target.value }))}
                  aria-label="Jednotka"
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {INGREDIENT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <button
                  type="submit"
                  disabled={!newIng.name.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold
                             transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: '#4cbfb3', color: '#0a2d2a' }}
                >
                  <IconPlus size={14} stroke={2.5} />
                  Pridať
                </button>
              </form>
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {!embedded && (
        <p className="text-xs text-[#5d7d8e]">
          Suroviny pre receptúry jedál a kalkuláciu surovín. Receptúru jedla upravíš
          v záložke Menu ikonou čiapky pri položke.
        </p>
      )}

      {/* Hľadanie suroviny */}
      <div className="relative">
        <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Hľadať surovinu"
          className="w-full border border-gray-300 rounded-lg pl-9 pr-9 py-2 text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Zrušiť hľadanie"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded flex items-center
                       justify-center text-gray-400 hover:text-gray-600"
          >
            <IconX size={15} />
          </button>
        )}
      </div>

      {/* Nová kategória */}
      {!searching && (
        <form onSubmit={addCategory} className="flex gap-2">
          <input
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="Názov novej kategórie"
            className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!newCatName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold
                       transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: '#4cbfb3', color: '#0a2d2a' }}
          >
            <IconPlus size={16} stroke={2.5} />
            Pridať
          </button>
        </form>
      )}

      {searching ? (
        <div className="space-y-3">
          {shownCats.length === 0 && (
            <p className="text-sm text-gray-500 py-4 text-center">Nič sa nenašlo.</p>
          )}
          {shownCats.map(cat => (
            <div key={cat.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {categoryCard(cat, null)}
            </div>
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCategoryDragEnd}>
          <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {categories.map(cat => (
                <SortableRow
                  key={cat.id}
                  id={cat.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                >
                  {handleProps => <Fragment>{categoryCard(cat, handleProps)}</Fragment>}
                </SortableRow>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Export pre receptúry — podklad, z ktorého Claude pripraví receptúry */}
      {!embedded && (
      <div className="pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-bold
                     transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: '#4cbfb3', color: '#0a2d2a' }}
        >
          {exporting
            ? <IconLoader2 size={17} className="animate-spin" />
            : <IconFileSpreadsheet size={17} />}
          {exporting ? 'Pripravujem…' : 'Export pre receptúry'}
        </button>
        <p className="mt-1.5 text-[11px] text-gray-400">
          Excel s jedlami z menu a surovinami (aj s ID) — podklad na doplnenie receptúr.
        </p>
        {exportErr && <p className="mt-2 text-xs text-red-500">{exportErr}</p>}
      </div>
      )}
    </div>
  )
}
