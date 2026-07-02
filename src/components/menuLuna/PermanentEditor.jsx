import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { inputCls, Label, PortionSelect, AllergenField } from './menuFields'

const POSITIONS = [1, 2, 3, 4, 5, 6]

// Nápoveda k pozíciám – 1 a 2 sú rezne (bravčový, kurací), 3–6 ostatné.
const HINT = {
  1: 'Rezeň – bravčový',
  2: 'Rezeň – kurací',
}

function emptyItem(position, defaultPrice) {
  return { position, name: '', allergens: '', portion: '', price: defaultPrice ?? null }
}

function ItemCard({ position, item, portionOptions, onPatch }) {
  return (
    <div className="rounded-card border border-[#e8eef2] bg-white p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-6 h-6 rounded-full bg-[#f0f4f7] text-[#6a8898] text-[12px] font-bold
                         flex items-center justify-center shrink-0">{position}</span>
        {HINT[position] && (
          <span className="text-[12px] text-[#8aaabb]">{HINT[position]}</span>
        )}
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

// Editor trvalého menu / minútok – 6 položiek, rovnaký auto-save ako WeekEditor.
export default function PermanentEditor({ portionOptions = [], defaultPrice = null }) {
  const [items, setItems] = useState({})
  const [loading, setLoading] = useState(true)
  const [stav, setStav] = useState('')
  const timers = useRef({})
  const pending = useRef(new Set())

  const nacitaj = useCallback(async () => {
    const { data } = await supabase.from('permanent_menu').select('*').order('position')
    setItems((prev) => {
      const map = {}
      for (const r of data ?? []) map[r.position] = r
      for (const p of pending.current) if (prev[p]) map[p] = prev[p]
      return map
    })
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
        const pos = payload.new?.position ?? payload.old?.position
        if (pos != null && pending.current.has(pos)) return
        nacitaj()
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [nacitaj])

  function ulozPolozku(position, item) {
    setItems((prev) => ({ ...prev, [position]: item })) // hneď v UI
    pending.current.add(position)
    clearTimeout(timers.current[position])
    setStav('Ukladám…')
    timers.current[position] = setTimeout(async () => {
      const { error } = await supabase
        .from('permanent_menu')
        .upsert({ ...item, position, name: item.name ?? '' }, { onConflict: 'position' })
      pending.current.delete(position)
      setStav(error ? 'Chyba pri ukladaní' : 'Uložené ✓')
    }, 700)
  }

  if (loading) {
    return <div className="text-sm text-[#8aaabb] px-1 py-6">Načítavam…</div>
  }

  return (
    <div>
      <div className="flex justify-end h-5 mb-1">
        <span className={`text-xs ${stav.startsWith('Chyba') ? 'text-red-500' : 'text-[#8aaabb]'}`}>{stav}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {POSITIONS.map((position) => {
          const item = items[position] ?? emptyItem(position, defaultPrice)
          return (
            <ItemCard
              key={position}
              position={position}
              item={item}
              portionOptions={portionOptions}
              onPatch={(patch) => ulozPolozku(position, { ...item, ...patch })}
            />
          )
        })}
      </div>
    </div>
  )
}
