import { useState, useMemo } from 'react'
import { IconCopy, IconCamera, IconFileUpload, IconPencil, IconLoader2, IconArrowLeft } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import MenuLunaHeader from '../../components/menuLuna/MenuLunaHeader'
import WeekEditor from '../../components/menuLuna/WeekEditor'
import { useMenuSettings } from '../../hooks/useMenuSettings'
import { toISO, mondayOf, addDays, fromISO, weekRangeLabel } from '../../utils/menuDates'
import { zmensiObrazok } from '../../utils/imageResize'

const DAY_INDEX = { pondelok: 0, utorok: 1, streda: 2, 'štvrtok': 3, piatok: 4 }

// Súbor → base64 (bez kompresie) – pre PDF.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result).split(',')[1])
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(file)
  })
}

// Polia, ktoré sa kopírujú z minulého týždňa ako východisko.
const COPY_FIELDS = [
  'soup1_name', 'soup1_allergens', 'soup2_name', 'soup2_allergens',
  'main1_name', 'main1_allergens', 'main1_portion', 'main1_price',
  'main2_name', 'main2_allergens', 'main2_portion', 'main2_price',
]

export default function ImportMenu() {
  const { portionOptions, defaultPriceDaily } = useMenuSettings()

  const thisMonday = useMemo(() => mondayOf(new Date()), [])
  // ponuka týždňov: 2 dozadu … 8 dopredu, default = nasledujúci týždeň
  const weekOptions = useMemo(
    () => Array.from({ length: 11 }, (_, i) => addDays(thisMonday, (i - 2) * 7)),
    [thisMonday],
  )
  const [selectedIso, setSelectedIso] = useState(() => toISO(addDays(thisMonday, 7)))
  const selectedMonday = fromISO(selectedIso)

  const [mode, setMode] = useState('choose') // 'choose' | 'edit'
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  function novyRiadok(menu_date) {
    return {
      menu_date, status: 'open',
      soup2_name: 'Vývar s rezancami/cestovinou', soup2_allergens: '1,3,9',
      main1_price: defaultPriceDaily, main2_price: defaultPriceDaily,
    }
  }

  async function targetHasData() {
    const { data } = await supabase
      .from('daily_menus')
      .select('menu_date')
      .gte('menu_date', selectedIso)
      .lte('menu_date', toISO(addDays(selectedMonday, 4)))
      .limit(1)
    return (data?.length ?? 0) > 0
  }

  async function confirmIfData() {
    if (await targetHasData()) {
      return window.confirm('Zvolený týždeň už obsahuje záznamy. Naozaj ich prepísať importom?')
    }
    return true
  }

  // (a) ručne – predvyplň z minulého týždňa
  async function prefillFromLastWeek() {
    setError('')
    if (!(await confirmIfData())) return
    setBusy('Kopírujem minulý týždeň…')
    try {
      const prevMonday = addDays(selectedMonday, -7)
      const { data } = await supabase
        .from('daily_menus')
        .select('*')
        .gte('menu_date', toISO(prevMonday))
        .lte('menu_date', toISO(addDays(prevMonday, 4)))
      const byWeekday = {}
      for (const r of data ?? []) byWeekday[(fromISO(r.menu_date).getDay() + 6) % 7] = r

      const rows = []
      for (let i = 0; i < 5; i++) {
        const menu_date = toISO(addDays(selectedMonday, i))
        const src = byWeekday[i]
        const row = novyRiadok(menu_date)
        if (src) for (const f of COPY_FIELDS) row[f] = src[f]
        rows.push(row)
      }
      const { error: e } = await supabase.from('daily_menus').upsert(rows, { onConflict: 'menu_date' })
      if (e) throw e
      setMode('edit')
    } catch (e) {
      console.warn('[import] prefill failed:', e.message)
      setError('Predvyplnenie z minulého týždňa zlyhalo.')
    } finally {
      setBusy('')
    }
  }

  // (b) foto / sken / PDF → OCR cez Gemini.
  // Obrázok komprimujeme cez canvas; PDF (aj skenované/obrázkové) posielame
  // ako celok – OCR nad obrázkom vnútri PDF spraví Gemini.
  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    if (!(await confirmIfData())) return
    setBusy('Spracúvam menu…')
    try {
      let fileBase64, mimeType
      if (file.type === 'application/pdf') {
        fileBase64 = await fileToBase64(file)
        mimeType = 'application/pdf'
      } else {
        const dataUrl = await zmensiObrazok(file, 1600, 0.8)
        fileBase64 = dataUrl.split(',')[1]
        mimeType = 'image/jpeg'
      }
      const res = await fetch('/api/menu-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64, mimeType }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data || data.error) {
        throw new Error(data?.detail || data?.error || `HTTP ${res.status}`)
      }
      await applyOcrDays(data.days ?? [])
      setMode('edit')
    } catch (err) {
      console.warn('[import] ocr failed:', err.message)
      setError('Prepis menu zlyhal: ' + err.message)
    } finally {
      setBusy('')
    }
  }

  async function applyOcrDays(days) {
    // zachovaj existujúce polia cieľového týždňa, OCR doplní len názvy
    const { data: existing } = await supabase
      .from('daily_menus')
      .select('*')
      .gte('menu_date', selectedIso)
      .lte('menu_date', toISO(addDays(selectedMonday, 4)))
    const byDate = {}
    for (const r of existing ?? []) byDate[r.menu_date] = r

    const upserts = []
    for (const d of days) {
      const idx = DAY_INDEX[(d.day || '').toLowerCase()]
      if (idx == null) continue
      const menu_date = toISO(addDays(selectedMonday, idx))
      const base = byDate[menu_date] ?? novyRiadok(menu_date)
      upserts.push({
        ...base,
        menu_date,
        status: 'open',
        soup1_name: d.soup1_name ?? base.soup1_name ?? '',
        main1_name: d.main1_name ?? base.main1_name ?? '',
        main2_name: d.main2_name ?? base.main2_name ?? '',
      })
    }
    if (upserts.length) {
      const { error: e } = await supabase.from('daily_menus').upsert(upserts, { onConflict: 'menu_date' })
      if (e) throw e
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <MenuLunaHeader title="Import menu" backTo="/menu" />

      <div className="w-full max-w-2xl xl:max-w-5xl mx-auto flex-1 w-full px-4 py-5">
        {/* Výber týždňa */}
        <div className="mb-4">
          <label className="text-[11px] uppercase tracking-wide text-[#8aaabb] block mb-1">Týždeň</label>
          <select
            value={selectedIso}
            disabled={mode === 'edit'}
            onChange={(e) => setSelectedIso(e.target.value)}
            className="w-full sm:w-auto border border-[#e2e8ed] rounded-lg px-3 py-2 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-[#4cbfb3]/40 disabled:opacity-60"
          >
            {weekOptions.map((m) => {
              const iso = toISO(m)
              return (
                <option key={iso} value={iso}>
                  {weekRangeLabel(m)}{iso === toISO(addDays(thisMonday, 7)) ? ' · budúci týždeň' : ''}
                </option>
              )
            })}
          </select>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-[#fbeaec] text-[#b0626a] text-sm px-3 py-2">{error}</div>
        )}

        {mode === 'choose' ? (
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={!!busy}
              onClick={prefillFromLastWeek}
              className="rounded-card border border-[#e8eef2] bg-white p-4 flex items-center gap-3
                         text-left hover:border-[#3db8ad] transition-colors disabled:opacity-60"
            >
              <span className="w-11 h-11 rounded-xl bg-[#eaf6f4] text-[#2f9489] flex items-center justify-center shrink-0">
                <IconCopy size={22} />
              </span>
              <span>
                <span className="block font-bold text-[15px] text-[#2b3f4c]">Predvyplniť z minulého týždňa</span>
                <span className="block text-[13px] text-[#8aaabb]">Skopíruje polievky a hlavné jedlá ako východisko</span>
              </span>
            </button>

            <label
              className={`rounded-card border border-[#e8eef2] bg-white p-4 flex items-center gap-3
                          text-left transition-colors cursor-pointer
                          ${busy ? 'opacity-60 pointer-events-none' : 'hover:border-[#b55db8]'}`}
            >
              <span className="w-11 h-11 rounded-xl bg-[#f6eaf6] text-[#9b4a9e] flex items-center justify-center shrink-0">
                <IconCamera size={22} />
              </span>
              <span>
                <span className="block font-bold text-[15px] text-[#2b3f4c]">Odfotiť menu</span>
                <span className="block text-[13px] text-[#8aaabb]">Fotka z kamery → OCR predvyplní týždeň</span>
              </span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
            </label>

            <label
              className={`rounded-card border border-[#e8eef2] bg-white p-4 flex items-center gap-3
                          text-left transition-colors cursor-pointer
                          ${busy ? 'opacity-60 pointer-events-none' : 'hover:border-[#b55db8]'}`}
            >
              <span className="w-11 h-11 rounded-xl bg-[#f6eaf6] text-[#9b4a9e] flex items-center justify-center shrink-0">
                <IconFileUpload size={22} />
              </span>
              <span>
                <span className="block font-bold text-[15px] text-[#2b3f4c]">Nahrať PDF alebo obrázok</span>
                <span className="block text-[13px] text-[#8aaabb]">Aj skenované PDF s fotkou menu</span>
              </span>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
            </label>

            <button
              type="button"
              disabled={!!busy}
              onClick={() => setMode('edit')}
              className="rounded-card border border-dashed border-[#cdd9e0] bg-white p-3.5 flex items-center gap-3
                         text-left hover:border-[#8aaabb] transition-colors disabled:opacity-60"
            >
              <span className="w-9 h-9 rounded-lg bg-[#f0f4f7] text-[#6a8898] flex items-center justify-center shrink-0">
                <IconPencil size={18} />
              </span>
              <span className="text-[14px] text-[#6a8898]">Upraviť prázdny týždeň ručne</span>
            </button>

            {busy && (
              <div className="flex items-center gap-2 text-sm text-[#8aaabb] px-1 pt-1">
                <IconLoader2 size={16} className="animate-spin" /> {busy}
              </div>
            )}
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setMode('choose')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6a8898] hover:text-[#2b3f4c] mb-3"
            >
              <IconArrowLeft size={16} /> Zmeniť týždeň / spôsob
            </button>
            <p className="text-[13px] text-[#8aaabb] mb-2">
              Skontroluj a uprav — zmeny sa ukladajú automaticky.
            </p>
            <WeekEditor monday={selectedMonday} portionOptions={portionOptions} defaultPrice={defaultPriceDaily} />
          </div>
        )}
      </div>
    </div>
  )
}
