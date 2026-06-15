import { Fragment, useEffect, useRef, useState } from 'react'
import {
  IconChevronDown, IconChevronRight, IconGripVertical, IconPlus, IconTrash,
} from '@tabler/icons-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import BlurInput from './BlurInput'

// Pravidlá množstva kategórie — predvoľby podľa biznis pravidiel.
// „split" = bez množstva, pri 2+ vybratých položkách príznak podielu (1/2…)
const QTY_PRESETS = [
  { key: 'none',     label: 'Bez množstva',                 qty_min: null, qty_max: null, qty_step: null, qty_unit: null, split_portions: false },
  { key: 'split',    label: 'Bez množstva + podiel (1/2…)', qty_min: null, qty_max: null, qty_step: null, qty_unit: null, split_portions: true },
  { key: 'ks_1_20',  label: '1 – 20 ks',                    qty_min: 1,    qty_max: 20,   qty_step: 1,    qty_unit: 'ks', split_portions: false },
  { key: 'ks_1_250', label: '1 – 250 ks',                   qty_min: 1,    qty_max: 250,  qty_step: 1,    qty_unit: 'ks', split_portions: false },
  { key: 'kg_05_20', label: '0,5 – 20 kg (krok 0,5)',       qty_min: 0.5,  qty_max: 20,   qty_step: 0.5,  qty_unit: 'kg', split_portions: false },
]

function presetKey(cat) {
  if (cat.split_portions) return 'split'
  if (cat.qty_step == null) return 'none'
  const p = QTY_PRESETS.find(p =>
    p.qty_step != null &&
    Number(p.qty_min)  === Number(cat.qty_min) &&
    Number(p.qty_max)  === Number(cat.qty_max) &&
    Number(p.qty_step) === Number(cat.qty_step) &&
    p.qty_unit === cat.qty_unit
  )
  return p?.key ?? 'custom'
}

// Riadok preusporiadateľný ťahaním; children dostanú props pre úchytku
function SortableRow({ id, className = '', children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${className} ${isDragging ? 'relative z-10 opacity-80 shadow-lg' : ''}`}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  )
}

// Úchytka na ťahanie — touch-none, aby ťahanie prstom nescrollovalo stránku
function DragHandle(props) {
  return (
    <button
      type="button"
      aria-label="Presunúť ťahaním"
      className="w-7 h-7 shrink-0 rounded flex items-center justify-center text-gray-300
                 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
      {...props}
    >
      <IconGripVertical size={16} />
    </button>
  )
}

// Administrácia MENU: kategórie (poradie ťahaním, premenovanie, max. výber,
// množstvo) a ich položky (poradie ťahaním, premenovanie, presun medzi
// kategóriami). Mazanie = archivácia, takže menu vytvorené v minulosti
// ostávajú nedotknuté.
export default function MenuSettings() {
  const [categories, setCategories] = useState([])
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  const [expandedId, setExpandedId] = useState(null)
  const [newCatName, setNewCatName]   = useState('')
  const [newItemName, setNewItemName] = useState('')

  // Prvý klik = potvrdenie (~4 s), druhý = archivácia
  const [confirmDelete, setConfirmDelete] = useState(null) // 'cat:<id>' | 'item:<id>'
  const confirmTimer = useRef(null)

  // Ťahanie sa spustí až po pohybe o pár px — klik na úchytku nič nepresúva
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    const [c, i] = await Promise.all([
      supabase.from('menu_categories').select('*').is('archived_at', null).order('block').order('position'),
      supabase.from('menu_items').select('*').is('archived_at', null).order('position'),
    ])
    if (c.error || i.error) setError((c.error || i.error).message)
    else {
      setCategories(c.data ?? [])
      setItems(i.data ?? [])
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

  // ---- kategórie ----

  async function addCategory(e) {
    e.preventDefault()
    const name = newCatName.trim()
    if (!name) return
    // Nová kategória ide do posledného bloku
    const block = Math.max(1, ...categories.map(c => c.block))
    const position = Math.max(0, ...categories.filter(c => c.block === block).map(c => c.position)) + 1
    const { data, error } = await supabase
      .from('menu_categories')
      .insert({ name, position, block })
      .select()
      .single()
    if (error) { setError(error.message); return }
    setCategories(cs => [...cs, data])
    setNewCatName('')
  }

  // Preusporiadanie ťahaním — len v rámci jedného bloku
  function onCategoryDragEnd(block, { active, over }) {
    if (!over || active.id === over.id) return
    const blockCats = categories.filter(c => c.block === block)
    const oldIdx = blockCats.findIndex(c => c.id === active.id)
    const newIdx = blockCats.findIndex(c => c.id === over.id)
    const reordered = arrayMove(blockCats, oldIdx, newIdx).map((c, i) => ({ ...c, position: i + 1 }))
    const prev = categories
    setCategories(cs => cs
      .map(c => reordered.find(r => r.id === c.id) ?? c)
      .sort((a, b) => a.block - b.block || a.position - b.position))
    persistOrder('menu_categories', prev, reordered, fetchAll)
  }

  // Presun kategórie do iného bloku — zaradí sa na koniec cieľového bloku
  function moveCategoryToBlock(cat, block) {
    if (block === cat.block) return
    const position = Math.max(0, ...categories.filter(c => c.block === block).map(c => c.position)) + 1
    patch('menu_categories', cat.id, { block, position }, () =>
      setCategories(cs => cs
        .map(c => c.id === cat.id ? { ...c, block, position } : c)
        .sort((a, b) => a.block - b.block || a.position - b.position)))
  }

  function setQtyPreset(cat, key) {
    const p = QTY_PRESETS.find(p => p.key === key)
    if (!p) return
    const fields = {
      qty_min: p.qty_min, qty_max: p.qty_max, qty_step: p.qty_step,
      qty_unit: p.qty_unit, split_portions: p.split_portions,
    }
    patch('menu_categories', cat.id, fields, () =>
      setCategories(cs => cs.map(c => c.id === cat.id ? { ...c, ...fields } : c)))
  }

  async function deleteCategory(cat) {
    if (confirmDelete !== `cat:${cat.id}`) {
      setConfirmDelete(`cat:${cat.id}`)
      clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirmDelete(null), 4000)
      return
    }
    clearTimeout(confirmTimer.current)
    setConfirmDelete(null)
    await patch('menu_categories', cat.id, { archived_at: new Date().toISOString() }, () =>
      setCategories(cs => cs.filter(c => c.id !== cat.id)))
  }

  // ---- položky ----

  async function addItem(e, cat) {
    e.preventDefault()
    const name = newItemName.trim()
    if (!name) return
    const catItems = items.filter(i => i.category_id === cat.id)
    const position = Math.max(0, ...catItems.map(i => i.position)) + 1
    const { data, error } = await supabase
      .from('menu_items')
      .insert({ category_id: cat.id, name, position })
      .select()
      .single()
    if (error) { setError(error.message); return }
    setItems(is => [...is, data])
    setNewItemName('')
  }

  function onItemDragEnd(cat, { active, over }) {
    if (!over || active.id === over.id) return
    const catItems = items.filter(i => i.category_id === cat.id)
    const oldIdx = catItems.findIndex(i => i.id === active.id)
    const newIdx = catItems.findIndex(i => i.id === over.id)
    const reordered = arrayMove(catItems, oldIdx, newIdx).map((it, i) => ({ ...it, position: i + 1 }))
    const prev = items
    setItems(is => is
      .map(i => reordered.find(r => r.id === i.id) ?? i)
      .sort((a, b) => a.position - b.position))
    persistOrder('menu_items', prev, reordered, fetchAll)
  }

  // Presun do inej kategórie — zaradí sa na koniec cieľovej kategórie.
  // V minulosti vytvorené menu ostávajú zoskupené podľa pôvodnej kategórie (snapshot).
  function moveItemToCategory(item, categoryId) {
    if (!categoryId || categoryId === item.category_id) return
    const position = Math.max(0, ...items.filter(i => i.category_id === categoryId).map(i => i.position)) + 1
    patch('menu_items', item.id, { category_id: categoryId, position }, () =>
      setItems(is => is.map(i => i.id === item.id ? { ...i, category_id: categoryId, position } : i)))
  }

  async function deleteItem(item) {
    if (confirmDelete !== `item:${item.id}`) {
      setConfirmDelete(`item:${item.id}`)
      clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirmDelete(null), 4000)
      return
    }
    clearTimeout(confirmTimer.current)
    setConfirmDelete(null)
    await patch('menu_items', item.id, { archived_at: new Date().toISOString() }, () =>
      setItems(is => is.filter(i => i.id !== item.id)))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#4cbfb3] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Bloky kategórií — zoradené čísla blokov; medzi nimi sa kreslí oddeľovač
  const blocks = [...new Set(categories.map(c => c.block))].sort((a, b) => a - b)
  const maxBlock = blocks.length ? blocks[blocks.length - 1] : 1

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* Nová kategória */}
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

      <div className="space-y-3">
        {blocks.map((block, bIdx) => (
          <Fragment key={block}>
            {bIdx > 0 && <div className="h-1.5 bg-[#8fa6b2] rounded-full" />}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => onCategoryDragEnd(block, e)}>
              <SortableContext items={categories.filter(c => c.block === block).map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {categories.filter(c => c.block === block).map(cat => {
              const catItems = items.filter(i => i.category_id === cat.id)
              const expanded = expandedId === cat.id
              const pKey     = presetKey(cat)
              return (
                <SortableRow
                  key={cat.id}
                  id={cat.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                >
                  {handleProps => (
                    <>
                      {/* Hlavička kategórie */}
                      <div className="px-3 py-2 flex items-center gap-1.5 flex-wrap">
                        <DragHandle {...handleProps} />

                        <button
                          onClick={() => { setExpandedId(expanded ? null : cat.id); setNewItemName('') }}
                          aria-label={expanded ? 'Zbaliť' : 'Rozbaliť'}
                          className="w-7 h-7 shrink-0 rounded flex items-center justify-center
                                     text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                        >
                          {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                        </button>

                        <BlurInput
                          value={cat.name}
                          onSave={name => {
                            if (!name.trim()) return
                            patch('menu_categories', cat.id, { name: name.trim() }, () =>
                              setCategories(cs => cs.map(c => c.id === cat.id ? { ...c, name: name.trim() } : c)))
                          }}
                          className="flex-1 min-w-[120px] font-semibold text-gray-900"
                        />

                        <span className="text-xs text-gray-400 shrink-0">{catItems.length} pol.</span>

                        <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0"
                               title="Max. počet položiek pri tvorbe menu">
                          max
                          <BlurInput
                            type="number"
                            min="1"
                            value={cat.max_items ?? ''}
                            placeholder="∞"
                            onSave={v => {
                              const max_items = v === '' ? null : Math.max(1, Number(v))
                              patch('menu_categories', cat.id, { max_items }, () =>
                                setCategories(cs => cs.map(c => c.id === cat.id ? { ...c, max_items } : c)))
                            }}
                            className="w-14 text-center border-gray-200"
                          />
                        </label>

                        <select
                          value={pKey}
                          onChange={e => setQtyPreset(cat, e.target.value)}
                          title="Pravidlá množstva položiek"
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700
                                     shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {QTY_PRESETS.map(p => (
                            <option key={p.key} value={p.key}>{p.label}</option>
                          ))}
                          {pKey === 'custom' && (
                            <option value="custom" disabled>
                              Vlastné ({cat.qty_min}–{cat.qty_max} {cat.qty_unit})
                            </option>
                          )}
                        </select>

                        <select
                          value={cat.block}
                          onChange={e => moveCategoryToBlock(cat, Number(e.target.value))}
                          title="Blok kategórie"
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700
                                     shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {blocks.map(b => <option key={b} value={b}>Blok {b}</option>)}
                          <option value={maxBlock + 1}>+ nový blok</option>
                        </select>

                        <button
                          onClick={() => deleteCategory(cat)}
                          title="Vymazať kategóriu (archivuje sa — staré menu ostanú)"
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

                      {/* Položky kategórie */}
                      {expanded && (
                        <div className="border-t border-gray-100">
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={e => onItemDragEnd(cat, e)}
                          >
                            <SortableContext items={catItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                              {catItems.map(item => (
                                <SortableRow
                                  key={item.id}
                                  id={item.id}
                                  className="px-3 py-1.5 flex items-center gap-1.5 flex-wrap border-b border-gray-50 bg-white"
                                >
                                  {itemHandleProps => (
                                    <>
                                      <DragHandle {...itemHandleProps} />

                                      <BlurInput
                                        value={item.name}
                                        onSave={name => {
                                          if (!name.trim()) return
                                          patch('menu_items', item.id, { name: name.trim() }, () =>
                                            setItems(is => is.map(i => i.id === item.id ? { ...i, name: name.trim() } : i)))
                                        }}
                                        className="flex-1 min-w-[160px] text-gray-800"
                                      />

                                      <select
                                        value={item.category_id}
                                        onChange={e => moveItemToCategory(item, e.target.value)}
                                        title="Presunúť do inej kategórie"
                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white
                                                   text-gray-500 shrink-0 max-w-[140px]
                                                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      >
                                        {categories.map(c => (
                                          <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                      </select>

                                      <button
                                        onClick={() => deleteItem(item)}
                                        title="Vymazať položku (archivuje sa — staré menu ostanú)"
                                        aria-label="Vymazať položku"
                                        className={`px-2 py-1.5 rounded-md text-xs font-bold border transition-colors
                                                    inline-flex items-center gap-1 shrink-0
                                                    ${confirmDelete === `item:${item.id}`
                                                      ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                                                      : 'border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50'}`}
                                      >
                                        <IconTrash size={14} />
                                        {confirmDelete === `item:${item.id}` && 'Naozaj?'}
                                      </button>
                                    </>
                                  )}
                                </SortableRow>
                              ))}
                            </SortableContext>
                          </DndContext>

                          {/* Nová položka */}
                          <form onSubmit={e => addItem(e, cat)} className="px-3 py-2 flex gap-2 bg-gray-50/60">
                            <input
                              value={newItemName}
                              onChange={e => setNewItemName(e.target.value)}
                              placeholder="Názov novej položky"
                              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white
                                         focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                              type="submit"
                              disabled={!newItemName.trim()}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold
                                         transition-opacity hover:opacity-90 disabled:opacity-50"
                              style={{ background: '#4cbfb3', color: '#0a2d2a' }}
                            >
                              <IconPlus size={14} stroke={2.5} />
                              Pridať
                            </button>
                          </form>
                        </div>
                      )}
                    </>
                  )}
                </SortableRow>
              )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
