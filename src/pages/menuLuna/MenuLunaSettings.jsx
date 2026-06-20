import { useState, useEffect, useRef } from 'react'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import MenuLunaHeader from '../../components/menuLuna/MenuLunaHeader'
import { inputCls, Label } from '../../components/menuLuna/menuFields'

export default function MenuLunaSettings() {
  const [portions, setPortions] = useState([])
  const [priceDaily, setPriceDaily] = useState('')
  const [pricePermanent, setPricePermanent] = useState('')
  const [loading, setLoading] = useState(true)
  const [stav, setStav] = useState('')
  const timers = useRef({})

  useEffect(() => {
    let alive = true
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['portion_options', 'default_price_daily', 'default_price_permanent'])
      .then(({ data }) => {
        if (!alive) return
        const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
        setPortions(Array.isArray(map.portion_options) ? map.portion_options : [])
        setPriceDaily(map.default_price_daily != null ? String(map.default_price_daily) : '')
        setPricePermanent(map.default_price_permanent != null ? String(map.default_price_permanent) : '')
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  function saveSetting(key, value, { immediate = false } = {}) {
    setStav('Ukladám…')
    clearTimeout(timers.current[key])
    const run = async () => {
      const { error } = await supabase.from('app_settings').upsert({ key, value }, { onConflict: 'key' })
      setStav(error ? 'Chyba pri ukladaní' : 'Uložené ✓')
    }
    if (immediate) run()
    else timers.current[key] = setTimeout(run, 600)
  }

  // do DB uložíme len neprázdne, orezané a bez duplicít (poradie zachované)
  function persistPortions(arr) {
    const uniq = [...new Set(arr.map((s) => s.trim()).filter(Boolean))]
    saveSetting('portion_options', uniq)
  }

  function setPortion(i, val) {
    const next = portions.map((p, idx) => (idx === i ? val : p))
    setPortions(next)
    persistPortions(next)
  }
  function addPortion() {
    setPortions([...portions, ''])
  }
  function removePortion(i) {
    const next = portions.filter((_, idx) => idx !== i)
    setPortions(next)
    persistPortions(next)
  }

  function setPrice(key, setter, val) {
    setter(val)
    if (val !== '' && !Number.isNaN(Number(val))) saveSetting(key, Number(val))
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <MenuLunaHeader title="Nastavenia menu" backTo="/menu" />

      <div className="w-full max-w-2xl xl:max-w-5xl mx-auto flex-1 w-full px-4 py-5">
        <div className="flex justify-end h-5 mb-1">
          <span className={`text-xs ${stav.startsWith('Chyba') ? 'text-red-500' : 'text-[#8aaabb]'}`}>{stav}</span>
        </div>

        {loading ? (
          <div className="text-sm text-[#8aaabb] px-1 py-6">Načítavam…</div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Gramáže */}
            <section className="rounded-card border border-[#e8eef2] bg-white p-4">
              <h2 className="text-[15px] font-bold text-[#2b3f4c] mb-1">Gramáže</h2>
              <p className="text-[12px] text-[#8aaabb] mb-3">
                Ponuka v rozbaľovacom zozname „Gramáž" pri dennom aj trvalom menu.
              </p>

              <div className="flex flex-col gap-2">
                {portions.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      value={p}
                      placeholder="napr. 160/200 g"
                      onChange={(e) => setPortion(i, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removePortion(i)}
                      title="Odobrať"
                      aria-label="Odobrať gramáž"
                      className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center
                                 text-[#b0626a] hover:bg-[#fbeaec] transition-colors"
                    >
                      <IconTrash size={18} />
                    </button>
                  </div>
                ))}
                {portions.length === 0 && (
                  <p className="text-[13px] text-[#b0c4cc]">Žiadne gramáže — pridaj prvú nižšie.</p>
                )}
              </div>

              <button
                type="button"
                onClick={addPortion}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#3db8ad]
                           hover:text-[#2f9489] transition-colors"
              >
                <IconPlus size={18} /> Pridať gramáž
              </button>
            </section>

            {/* Default ceny */}
            <section className="rounded-card border border-[#e8eef2] bg-white p-4">
              <h2 className="text-[15px] font-bold text-[#2b3f4c] mb-1">Predvolené ceny</h2>
              <p className="text-[12px] text-[#8aaabb] mb-3">
                Predvyplnia sa pri novom jedle. Existujúce položky to nezmení.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Denné menu €</Label>
                  <input
                    type="number" inputMode="decimal" step="0.10" min="0" className={inputCls}
                    value={priceDaily}
                    onChange={(e) => setPrice('default_price_daily', setPriceDaily, e.target.value)}
                  />
                </div>
                <div>
                  <Label>Trvalé menu €</Label>
                  <input
                    type="number" inputMode="decimal" step="0.10" min="0" className={inputCls}
                    value={pricePermanent}
                    onChange={(e) => setPrice('default_price_permanent', setPricePermanent, e.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
