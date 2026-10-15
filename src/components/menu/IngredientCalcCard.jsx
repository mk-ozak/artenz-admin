import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconPrinter } from '@tabler/icons-react'
import { buildIngredientSummary } from '../../lib/ingredientCalc'
import { loadRecipeData } from '../../lib/recipeData'
import { ingredientsA4Html } from '../../utils/a4Print'

// Info prúžok pri myši — cez portál do body (karta má overflow-hidden). Pri
// pravom / dolnom okraji okna sa preklopí na druhú stranu myši.
function MouseTip({ x, y, text }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    el.style.left = '0px'
    el.style.top = '0px'
    const { width, height } = el.getBoundingClientRect()
    const flipX = x + 14 + width > window.innerWidth - 8
    const flipY = y + 20 + height > window.innerHeight - 8
    el.style.left = `${flipX ? Math.max(8, x - 14 - width) : x + 14}px`
    el.style.top  = `${flipY ? Math.max(8, y - 10 - height) : y + 20}px`
  }, [x, y, text])
  return createPortal(
    <div
      ref={ref}
      className="fixed z-[200] pointer-events-none max-w-[300px] rounded-md bg-[#1a2830] px-2.5 py-1.5
                 text-[12px] leading-snug text-white shadow-lg"
    >
      {text}
    </div>,
    document.body,
  )
}

// Kalkulácia surovín pre jedno menu (detail rezervácie, pod Sumárom pre
// kuchyňu): tie isté množstvá jedál ako lístok do kuchyne × receptúry.
// ticket = model lístka do kuchyne (buildKitchenTicket) — prepočíta sa pri
// každej zmene menu či počtov; reloadKey = receptúry načítať znova (po úprave
// katalógu alebo receptúry z okna výberu).
export default function IngredientCalcCard({ ticket, reloadKey }) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState('')
  const [tip, setTip]     = useState(null)  // jedlá suroviny pri myši: { x, y, text }

  useEffect(() => {
    let alive = true
    loadRecipeData()
      .then(d => { if (alive) { setData(d); setError('') } })
      .catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [reloadKey])

  // Prúžok má pevnú polohu v okne — pri posúvaní stránky by ostal visieť
  const tipOn = !!tip
  useEffect(() => {
    if (!tipOn) return
    const hide = () => setTip(null)
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [tipOn])

  // Nepočíta sa znova pri každom pohybe myši (prúžok)
  const model = useMemo(() => data && buildIngredientSummary({
    dates: [ticket.date],
    events: [{ hallShort: ticket.hallShort, date: ticket.date, time: ticket.time, title: ticket.title, model: ticket }],
    ...data,
  }), [data, ticket])
  const groups = model?.groups ?? []

  // Tlač na A4 — rovnaká strana ako KALKULÁCIA SUROVÍN na dashboarde
  function printA4() {
    const win = window.open('', '_blank')
    if (!win) { setError('Prehliadač zablokoval okno tlače.'); return }
    win.document.write(ingredientsA4Html(model))
    win.document.close()
    win.focus()
    win.print()
  }

  // Riadok suroviny; pri myši info prúžok s jedlami, z ktorých sa počíta
  const row = r => {
    const dishes = r.dishes?.join(', ')
    return (
      <div
        key={r.name}
        onMouseMove={dishes ? e => setTip({ x: e.clientX, y: e.clientY, text: dishes }) : undefined}
        onMouseLeave={dishes ? () => setTip(null) : undefined}
        className={`flex items-center gap-2 text-[13px] text-[#3a5160] py-px${
          dishes ? ' -mx-1 px-1 rounded hover:bg-[#eaf4f2]' : ''}`}
      >
        <span className="flex-1 min-w-0 truncate">{r.name}</span>
        <span className="text-right font-semibold text-[#1a2830] shrink-0 whitespace-nowrap">{r.total ?? '—'}</span>
      </div>
    )
  }

  return (
    <div className="rounded-card border border-[#e0e8ec] overflow-hidden bg-white">
      <div className="px-4 py-2 bg-[#8fa6b2]">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white">Kalkulácia surovín</p>
      </div>
      <div className="px-4 py-2 bg-[#f4f7f9] border-b border-[#e0e8ec] flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#5d7d8e]">Suroviny pre toto menu</span>
        <button
          type="button"
          onClick={printA4}
          disabled={!model}
          title="Kalkulácia surovín na A4 (tlačiareň alebo PDF)"
          className="h-7 px-2 rounded-lg border flex items-center gap-1 whitespace-nowrap text-[11px] font-bold
                     transition-colors border-[#d5e2e9] bg-white text-[#3a5160] hover:bg-[#eaf4f2] disabled:opacity-50"
        >
          <IconPrinter size={14} />
          A4
        </button>
      </div>

      <div className="px-4 py-2.5 space-y-3">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{error}</p>
        )}
        {!model && !error && <p className="text-[13px] text-[#8aaabb] italic">Počítam suroviny…</p>}

        {model && (
          <>
            {groups.length > 0 ? (
              // Kategórie idú za sebou v dvoch stĺpcoch (ako tlač A4) — mriežka
              // po riadkoch nechávala pod kratšou kategóriou prázdne miesto
              <div className="sm:columns-2 gap-x-6">
                {groups.map(g => (
                  <div key={g.name} className="break-inside-avoid mb-3 last:mb-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#5d7d8e] mb-1">{g.name}</p>
                    {g.rows.map(row)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-[#8aaabb]">Jedlá v tomto menu zatiaľ nemajú receptúry.</p>
            )}

            {model.missing.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#c0393d] mb-1">
                  Bez receptúry — nezapočítané
                </p>
                {model.missing.map(row)}
              </div>
            )}

            {model.check.length > 0 && (
              <div className="rounded-lg border border-[#f0dcb0] bg-[#fdf4e3] px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#a87d20] mb-1">Skontroluj</p>
                {model.check.map(c => (
                  <p key={`${c.name}|${c.reason}`} className="text-[12px] text-[#3a5160] py-px">
                    <span className="font-semibold">{c.name}</span> — {c.reason}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {tip && <MouseTip {...tip} />}
    </div>
  )
}
