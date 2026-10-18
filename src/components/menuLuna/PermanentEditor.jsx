import { useState, useEffect, useRef, useCallback } from 'react'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { supabase } from '../../lib/supabase'
import { DragHandle, SortableRow } from '../settings/Sortable'
import { inputCls, Label, PortionSelect, AllergenField } from './menuFields'

// Rezne = pozície 1 a 2. Sú pevné (nedajú sa zmazať ani presunúť) – PDF ich tlačí
// ako jeden riadok „Vyprážaný rezeň (bravčový alebo kurací)" s cenou bravčového.
const REZNE = { 1: 'Rezeň – bravčový', 2: 'Rezeň – kurací' }
const isRezen = (item) => REZNE[item.position] != null
const hasName = (item) => (item.name ?? '').trim() !== ''

// Denné menu (A4) má miesto na 5 riadkov minútok, pri viac sa ich písmo zmenší.
const A4_RIADKY = 5

function ItemCard({ number, item, portionOptions, onPatch, handle, actions }) {
  return (
    <div className="rounded-card border border-[#e8eef2] bg-white p-3.5">
      <div className="flex items-center gap-2 mb-2.5 min-h-7">
        {handle}
        <span className="w-6 h-6 rounded-full bg-[#f0f4f7] text-[#6a8898] text-[12px] font-bold
                         flex items-center justify-center shrink-0">{number}</span>
        {isRezen(item) && (
          <span className="text-[12px] text-[#8aaabb]">{REZNE[item.position]}</span>
        )}
        {!hasName(item) && (
          <span className="text-[12px] text-[#c0806a]">
            {isRezen(item) ? 'bez názvu – na webe sa neukáže' : 'bez názvu – v PDF ani na webe sa neukáže'}
          </span>
        )}
        {actions && <div className="ml-auto">{actions}</div>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px_95px_70px] gap-2">
        <div>
          <Label>Názov jedla</Label>
          <input className={inputCls} value={item.name ?? ''} placeholder="Názov položky"
                 onChange={(e) => onPatch({ name: e.target.value })} />
        </div>
        <div>
          <Label>Alergény</Label>
          <AllergenField compact value={item.allergens}
                         onChange={(v) => onPatch({ allergens: v })} />
        </div>
        <div>
          <Label>Gramáž</Label>
          <PortionSelect value={item.portion} options={portionOptions}
                         onChange={(v) => onPatch({ portion: v })} />
        </div>
        <div>
          <Label>Cena €</Label>
          <input type="number" inputMode="decimal" step="0.10" min="0" className={inputCls}
                 value={item.price ?? ''}
                 onChange={(e) => onPatch({ price: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
      </div>
    </div>
  )
}

// Editor trvalého menu / minútok – rezne navrchu, ostatné položky sa dajú
// pridávať, mazať a presúvať ťahaním. Polia sa ukladajú ako vo WeekEditore (auto-save).
export default function PermanentEditor({ portionOptions = [], defaultPrice = null, onCount }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [stav, setStav] = useState('')
  const [newName, setNewName] = useState('')
  // Prvý klik na kôš = potvrdenie (~4 s), druhý = zmazanie
  const [confirmId, setConfirmId] = useState(null)
  const confirmTimer = useRef(null)
  const timers = useRef({})
  const pending = useRef(new Set())
  const busy = useRef(false) // mazanie / presun – realtime vtedy nenačítava

  // Ťahanie sa spustí až po pohybe o pár px — klik na úchytku nič nepresúva
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const nacitaj = useCallback(async () => {
    const { data, error } = await supabase.from('permanent_menu').select('*').order('position')
    if (error) setStav('Chyba pri načítaní')
    else {
      setItems((prev) => (data ?? []).map((r) =>
        pending.current.has(r.id) ? (prev.find((p) => p.id === r.id) ?? r) : r))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    nacitaj()
  }, [nacitaj])

  useEffect(() => {
    const ch = supabase
      .channel('permanent_menu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permanent_menu' }, (payload) => {
        const id = payload.new?.id ?? payload.old?.id
        if (busy.current || (id != null && pending.current.has(id))) return
        nacitaj()
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [nacitaj])

  useEffect(() => {
    if (!loading) onCount?.(items.length)
  }, [items.length, loading, onCount])

  const rezne = items.filter(isRezen)
  const ostatne = items.filter((i) => !isRezen(i))
  const riadkyPdf = (rezne.length ? 1 : 0) + ostatne.filter(hasName).length

  function ulozPolozku(item, patch) {
    setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, ...patch } : p))) // hneď v UI
    pending.current.add(item.id)
    clearTimeout(timers.current[item.id])
    setStav('Ukladám…')
    timers.current[item.id] = setTimeout(async () => {
      const { name, allergens, portion, price } = { ...item, ...patch }
      const { error } = await supabase
        .from('permanent_menu')
        .update({ name: name ?? '', allergens, portion, price })
        .eq('id', item.id)
      pending.current.delete(item.id)
      setStav(error ? 'Chyba pri ukladaní' : 'Uložené ✓')
    }, 700)
  }

  async function pridaj(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const position = Math.max(2, ...items.map((i) => i.position)) + 1
    const { data, error } = await supabase
      .from('permanent_menu')
      .insert({ name, position, price: defaultPrice ?? null })
      .select()
      .single()
    if (error) { setStav('Chyba pri ukladaní'); return }
    setItems((is) => (is.some((i) => i.id === data.id) ? is : [...is, data])) // realtime ju mohol načítať skôr
    setNewName('')
    setStav('Uložené ✓')
  }

  // Ostatné položky dostanú pozície 3, 4, … v poradí `next`; uložia sa len zmenené
  async function ulozPoradie(next) {
    const pos = new Map(next.map((it, i) => [it.id, i + 3]))
    setItems((cur) => cur
      .map((it) => (pos.has(it.id) ? { ...it, position: pos.get(it.id) } : it))
      .sort((a, b) => a.position - b.position))
    const changed = next.filter((it) => it.position !== pos.get(it.id))
    const results = await Promise.all(changed.map((it) =>
      supabase.from('permanent_menu').update({ position: pos.get(it.id) }).eq('id', it.id)))
    return !results.some((r) => r.error)
  }

  async function zmaz(item) {
    if (confirmId !== item.id) {
      setConfirmId(item.id)
      clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirmId(null), 4000)
      return
    }
    clearTimeout(confirmTimer.current)
    setConfirmId(null)
    clearTimeout(timers.current[item.id])
    pending.current.delete(item.id)
    busy.current = true
    const { error } = await supabase.from('permanent_menu').delete().eq('id', item.id)
    if (!error) setItems((cur) => cur.filter((i) => i.id !== item.id))
    const ok = !error && await ulozPoradie(ostatne.filter((i) => i.id !== item.id))
    busy.current = false
    setStav(ok ? 'Uložené ✓' : 'Chyba pri mazaní')
    if (!ok) nacitaj()
  }

  async function onDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIdx = ostatne.findIndex((i) => i.id === active.id)
    const newIdx = ostatne.findIndex((i) => i.id === over.id)
    busy.current = true
    const ok = await ulozPoradie(arrayMove(ostatne, oldIdx, newIdx))
    busy.current = false
    setStav(ok ? 'Uložené ✓' : 'Chyba pri ukladaní')
    if (!ok) nacitaj()
  }

  if (loading) {
    return <div className="text-sm text-[#8aaabb] px-1 py-6">Načítavam…</div>
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3 min-h-5 mb-1.5">
        <p className="text-[12px] text-[#8aaabb] px-1">
          {rezne.length > 0 &&
            'Rezne sú pevné – v PDF sú spolu v jednom riadku s cenou, alergénmi a gramážou bravčového.'}
        </p>
        <span className={`text-xs shrink-0 ${stav.startsWith('Chyba') ? 'text-red-500' : 'text-[#8aaabb]'}`}>{stav}</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {rezne.map((item, i) => (
          <ItemCard
            key={item.id}
            number={i + 1}
            item={item}
            portionOptions={portionOptions}
            onPatch={(patch) => ulozPolozku(item, patch)}
          />
        ))}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ostatne.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {ostatne.map((item, i) => (
              <SortableRow key={item.id} id={item.id} className="rounded-card">
                {(handleProps) => (
                  <ItemCard
                    number={rezne.length + i + 1}
                    item={item}
                    portionOptions={portionOptions}
                    onPatch={(patch) => ulozPolozku(item, patch)}
                    handle={<DragHandle {...handleProps} />}
                    actions={
                      <button
                        type="button"
                        onClick={() => zmaz(item)}
                        title="Zmazať položku"
                        aria-label="Zmazať položku"
                        className={`px-2 py-1.5 rounded-md text-xs font-bold border transition-colors
                                    inline-flex items-center gap-1 shrink-0
                                    ${confirmId === item.id
                                      ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                                      : 'border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50'}`}
                      >
                        <IconTrash size={14} />
                        {confirmId === item.id && 'Naozaj?'}
                      </button>
                    }
                  />
                )}
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Nová položka – pridá sa na koniec, poradie sa dá zmeniť ťahaním */}
      <form onSubmit={pridaj} className="flex gap-2 mt-2.5">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Názov novej položky"
          className={inputCls + ' flex-1 min-w-0'}
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0
                     transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: '#4cbfb3', color: '#0a2d2a' }}
        >
          <IconPlus size={14} stroke={2.5} />
          Pridať
        </button>
      </form>

      {riadkyPdf > A4_RIADKY && (
        <p className="text-[12px] text-[#8aaabb] px-1 mt-2">
          Denné menu (PDF) má miesto na {A4_RIADKY} riadkov minútok – pri {riadkyPdf} riadkoch sa ich písmo zmenší.
        </p>
      )}
    </div>
  )
}
