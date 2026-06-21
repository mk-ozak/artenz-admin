import { useState } from 'react'
import { IconDownload, IconLoader2, IconChevronDown } from '@tabler/icons-react'
import { toISO, mondayOf, addDays, weekRangeLabel } from '../../utils/menuDates'

// Tlačidlo „Stiahnuť PDF" – po kliknutí ponúkne výber týždňa.
// `monday` (Date) = predvolený/aktívny týždeň (zvýraznený v zozname).
export default function DownloadPdfButton({ monday }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const thisMonday = mondayOf(new Date())
  const activeIso = monday ? toISO(monday) : null
  // ponuka: minulý → +4 týždne
  const options = Array.from({ length: 6 }, (_, i) => ({
    monday: addDays(thisMonday, (i - 1) * 7),
    offset: i - 1,
  }))

  // 3 dokumenty na jedno kliknutie: denné menu, stolové 2× a celotýždňový prehľad.
  const DOCS = [
    { doc: 'menu', name: 'LUNA_menu' },
    { doc: 'stoly', name: 'LUNA_stoly' },
    { doc: 'prehlad', name: 'LUNA_prehlad' },
  ]

  async function stiahni(m) {
    setOpen(false)
    setErr('')
    setBusy(true)
    const iso = toISO(m)
    const prefix = iso.replaceAll('-', '') // RRRRMMDD podľa pondelka týždňa
    try {
      // postupne – prehliadač tak spustí všetky tri sťahovania
      for (const { doc, name } of DOCS) {
        const res = await fetch(`/api/generate-pdf?week=${iso}&doc=${doc}`)
        if (!res.ok) {
          const detail = await res.text().catch(() => '')
          throw new Error(detail || `HTTP ${res.status}`)
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${prefix}_${name}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.warn('[pdf] download failed:', e.message)
      setErr('PDF sa nepodarilo vygenerovať: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold
                   bg-[#354d5d] text-white hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {busy ? <IconLoader2 size={17} className="animate-spin" /> : <IconDownload size={17} />}
        Stiahnuť PDF
        <IconChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-64 rounded-card border border-[#e2e8ed]
                          bg-white shadow-[0_8px_30px_rgba(53,77,93,.18)] py-1">
            <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-[#8aaabb]">Vyber týždeň</p>
            {options.map(({ monday: m, offset }) => {
              const iso = toISO(m)
              const tag = offset === 0 ? 'tento' : offset === 1 ? 'nasledujúci' : offset === -1 ? 'minulý' : null
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => stiahni(m)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[#f0f4f7] flex items-center
                              justify-between gap-2 ${iso === activeIso ? 'font-bold text-[#2b3f4c]' : 'text-[#4a5a64]'}`}
                >
                  <span>{weekRangeLabel(m)}</span>
                  {tag && <span className="text-[11px] text-[#8aaabb] shrink-0">{tag}</span>}
                </button>
              )
            })}
          </div>
        </>
      )}

      {err && <span className="text-xs text-red-500 text-right max-w-xs">{err}</span>}
    </div>
  )
}
