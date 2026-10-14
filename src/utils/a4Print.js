// Tlač na A4 z dashboardu (systémové okno tlače / PDF): SUMÁR JEDÁL
// z modelu buildDaySummary (utils/kitchenTicket) a KALKULÁCIA SUROVÍN
// z modelu buildIngredientSummary (lib/ingredientCalc). Spoločná hlavička,
// zoznam akcií, sekcie v dvoch stĺpcoch a „Vytlačené".
import { DAYS_LONG, DAYS_SHORT } from './format'

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const dayOf = iso => new Date(`${iso}T00:00:00`)
// „Sob 17. 10."
const shortDate = iso => { const d = dayOf(iso); return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.` }

// Vybraté dni: jeden celý („Sobota 17. 10. 2026"), viac skrátene s rokom
function daysText(days) {
  if (!days.length) return ''
  if (days.length === 1) {
    const d = dayOf(days[0])
    return `${DAYS_LONG[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`
  }
  return `${days.map(shortDate).join(', ')} ${dayOf(days[0]).getFullYear()}`
}

// Počty osôb akcie (riadok pod názvom akcie)
function countsText(ev) {
  if (!ev.hasMenu) return 'bez menu — nepočíta sa'
  const c = ev.counts
  return [
    `dospelí ${c.adults}${c.adultsNoMeal ? ` (+${c.adultsNoMeal} bez jedla)` : ''}`,
    `deti ${c.kidsMeal}${c.kidsNoMeal ? ` (+${c.kidsNoMeal} bez jedla)` : ''}`,
    c.specials ? `špeciály ${c.specials}` : '',
    ev.hasRaut ? `raut ${c.raut}` : '',
  ].filter(Boolean).join(' · ')
}

function printedText(at) {
  const p = n => String(n).padStart(2, '0')
  return `Vytlačené: ${at.getDate()}. ${at.getMonth() + 1}. ${at.getFullYear()} ${p(at.getHours())}:${p(at.getMinutes())}`
}

// Zoznam akcií: označenie | názov a pod ním počty
const eventsTable = rows => `<table class="events">${rows.map(r => `<tr>
    <td class="ev">${esc(r.label)}</td>
    <td>${esc(r.title)}<br><span class="cnt">${esc(countsText(r))}</span></td>
  </tr>`).join('')}</table>`

const BASE_CSS = `
  @page { size: A4; margin: 12mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #1a2830; margin: 0; padding: 16px; font-size: 12px; }
  @media print { body { padding: 0; } }
  h1 { font-size: 20px; letter-spacing: .12em; margin: 0 0 2px; }
  .sub { color: #3a5160; font-size: 14px; font-weight: 700; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  .events { margin-bottom: 10px; }
  .events td { padding: 3px 0; border-bottom: 1px solid #e0e8ec; vertical-align: top; }
  .events .ev { font-weight: 700; white-space: nowrap; padding-right: 10px; width: 1%; }
  .cnt { color: #5d7d8e; font-size: 11px; }
  .cols { column-count: 2; column-gap: 10mm; }
  .printed { margin-top: 10px; color: #9ab0ba; font-size: 10px; text-align: right; }
`

function a4Page(title, css, body, printedAt) {
  return `<!doctype html><html lang="sk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${BASE_CSS}${css}</style></head><body>
${body}
<p class="printed">${esc(printedText(printedAt))}</p>
</body></html>`
}

// ── SUMÁR JEDÁL ─────────────────────────────────────────────────────────

const SUMMARY_CSS = `
  .counts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 0 0 8px; }
  .count { border: 1.5px solid #1a2830; border-radius: 4px; text-align: center; padding: 3px 2px 4px; }
  .count .l { font-size: 10px; font-weight: 700; letter-spacing: .08em; }
  .count .n { font-size: 22px; font-weight: 800; line-height: 1.15; }
  .count .s { font-size: 10px; color: #3a5160; }
  .toasts { margin: 0 0 10px; font-size: 13px; }
  .toasts p { margin: 2px 0; }
  .sec { break-inside: avoid; margin-bottom: 10px; }
  .sec.special { border: 2px solid #1a2830; padding: 0 6px 4px; }
  .sec.special .bar { margin: 0 -6px; }
  .bar { display: flex; justify-content: space-between; gap: 8px; background: #1a2830; color: #fff;
         font-weight: 700; font-size: 12px; letter-spacing: .05em; text-transform: uppercase; padding: 3px 8px; }
  .bar .c { white-space: nowrap; }
  .item { padding: 4px 0; border-bottom: 1px solid #d5e2e9; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .name { font-weight: 600; font-size: 13px; }
  .tot { font-weight: 800; font-size: 14px; white-space: nowrap; }
  .bd { color: #5d7d8e; font-size: 11px; }
  .part { display: flex; justify-content: space-between; gap: 8px; padding-left: 14px; font-size: 11px; }
  .part b { white-space: nowrap; }
  .notes { padding: 4px 0 2px; }
  .notes .l { color: #5d7d8e; font-size: 11px; }
  .notes .t { font-weight: 700; font-size: 13px; white-space: pre-line; }
`

// Rámčeky počtov ako na lístku do kuchyne (raut len pri akcii s rautom)
function countsBoxes(c, hasRaut) {
  const extra = n => (n > 0 ? `z toho +${n} navyše` : `z toho −${-n} menej`)
  const boxes = [
    { label: 'DOSPELÍ',  n: c.adults,   sub: c.adultsNoMeal > 0 ? `+${c.adultsNoMeal} bez jedla` : '' },
    { label: 'DETI',     n: c.kidsMeal, sub: c.kidsNoMeal > 0 ? `+${c.kidsNoMeal} bez jedla` : '' },
    { label: 'ŠPECIÁLY', n: c.specials, sub: '' },
    ...(hasRaut ? [{ label: 'RAUT', n: c.raut, sub: c.rautExtra ? extra(c.rautExtra) : '' }] : []),
  ]
  return `<div class="counts">${boxes.map(b => `<div class="count">
    <div class="l">${b.label}</div><div class="n">${b.n}</div>${b.sub ? `<div class="s">${esc(b.sub)}</div>` : ''}
  </div>`).join('')}</div>`
}

// Sekcia ako na lístku: pruh „1. HLAVNÉ JEDLO - DOSPELÍ … 40 os.", položky so
// súčtom a rozpisom po akciách, zložky polievky, poznámky / požiadavky
function sectionHtml(sec) {
  const title = `${sec.block}. ${sec.title}`
  const bar = `<div class="bar"><span>${esc(sec.special ? `! ${title} !` : title)}</span>${
    sec.count != null ? `<span class="c">${sec.count} os.</span>` : ''}</div>`
  const items = sec.items.map(it => `<div class="item">
    <div class="row"><span class="name">${esc(it.name)}</span>${it.total ? `<span class="tot">${esc(it.total)}</span>` : ''}</div>
    ${it.breakdown ? `<div class="bd">${esc(it.breakdown)}</div>` : ''}
    ${it.parts.map(p => `<div class="part"><span>– ${esc(p.name)} (${esc(p.portion)} / os.)</span><b>${esc(p.total)}</b></div>`).join('')}
  </div>`).join('')
  const notes = sec.notes
    ? `<div class="notes"><div class="l">${sec.special ? 'Požiadavky:' : 'Poznámky:'}</div><div class="t">${esc(sec.notes)}</div></div>`
    : ''
  return `<div class="sec${sec.special ? ' special' : ''}">${bar}${items}${notes}</div>`
}

export function daySummaryA4Html(model) {
  const hasMenu = model.events.some(e => e.hasMenu)
  const body = `
<h1>SUMÁR JEDÁL</h1>
<p class="sub">${esc(daysText(model.days))}</p>
${eventsTable(model.events)}
${hasMenu ? countsBoxes(model.counts, model.hasRaut) : ''}
${model.toasts.length ? `<div class="toasts">${model.toasts.map(t => `<p>${esc(t.label)}: <b>${esc(t.text)}</b></p>`).join('')}</div>` : ''}
${model.sections.length ? `<div class="cols">${model.sections.map(sectionHtml).join('')}</div>` : ''}
${hasMenu ? '' : '<p class="cnt">Vo vybratých dňoch nie je žiadna akcia s menu.</p>'}`
  return a4Page('Sumár jedál', SUMMARY_CSS, body, model.printedAt)
}

// ── KALKULÁCIA SUROVÍN ──────────────────────────────────────────────────

const INGREDIENTS_CSS = `
  section { break-inside: avoid; margin-bottom: 10px; }
  h2 { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #5d7d8e;
       border-bottom: 1.5px solid #8fa6b2; padding-bottom: 2px; margin: 0 0 2px; }
  td { padding: 2px 0; border-bottom: 1px dotted #d5e2e9; vertical-align: top; }
  td.q { text-align: right; font-weight: 700; white-space: nowrap; padding-left: 8px; }
  td.why { color: #5d7d8e; padding-left: 8px; }
  .box { border: 1.5px solid #c0393d; border-radius: 6px; padding: 6px 10px; margin-top: 10px; break-inside: avoid; }
  .box h2 { color: #c0393d; border: 0; }
  .box.warn { border-color: #e0a43a; }
  .box.warn h2 { color: #a87d20; }
`

const rowsHtml = rows => rows
  .map(r => `<tr><td>${esc(r.name)}</td><td class="q">${esc(r.total ?? 'bez množstva')}</td></tr>`)
  .join('')

export function ingredientsA4Html(model) {
  const events = model.events.map(ev => ({
    ...ev,
    label: `${shortDate(ev.date)} · ${ev.hallShort}${ev.time ? ` · ${ev.time}` : ''}`,
  }))
  const groups = [
    ...model.groups.map(g => `<section><h2>${esc(g.name)}</h2><table>${rowsHtml(g.rows)}</table></section>`),
    ...(model.fromMenu.length
      ? [`<section><h2>Hotovky</h2><table>${rowsHtml(model.fromMenu)}</table></section>`]
      : []),
  ].join('')
  const missing = model.missing.length
    ? `<div class="box"><h2>Bez receptúry — nezapočítané</h2><table>${rowsHtml(model.missing)}</table></div>`
    : ''
  const check = model.check.length
    ? `<div class="box warn"><h2>Skontroluj</h2><table>${model.check
        .map(c => `<tr><td>${esc(c.name)}</td><td class="why">${esc(c.reason)}</td></tr>`).join('')}</table></div>`
    : ''
  const empty = !groups && !missing && !check
    ? '<p class="cnt">Vo vybratých dňoch nie je žiadna akcia s menu — nie je čo počítať.</p>'
    : ''
  const body = `
<h1>KALKULÁCIA SUROVÍN</h1>
<p class="sub">${esc(daysText(model.days))}</p>
${eventsTable(events)}
${groups ? `<div class="cols">${groups}</div>` : ''}
${missing}${check}${empty}`
  return a4Page('Kalkulácia surovín', INGREDIENTS_CSS, body, model.printedAt)
}
