// KALKULÁCIA SUROVÍN — strana na tlač A4 (systémové okno tlače / PDF) z modelu
// buildIngredientSummary (lib/ingredientCalc). Suroviny po kategóriách v dvoch
// stĺpcoch, skupina Z MENU, potom BEZ RECEPTÚRY a SKONTROLUJ.
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

// Počty osôb akcie ako v sumári jedál
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

const rowsHtml = rows => rows
  .map(r => `<tr><td>${esc(r.name)}</td><td class="q">${esc(r.total ?? 'bez množstva')}</td></tr>`)
  .join('')

export function ingredientsA4Html(model) {
  const events = model.events.map(ev => `<tr>
      <td class="ev">${esc(shortDate(ev.date))} · ${esc(ev.hallShort)}${ev.time ? ` · ${esc(ev.time)}` : ''}</td>
      <td>${esc(ev.title)}<br><span class="cnt">${esc(countsText(ev))}</span></td>
    </tr>`).join('')

  const groups = [
    ...model.groups.map(g => `<section><h2>${esc(g.name)}</h2><table>${rowsHtml(g.rows)}</table></section>`),
    ...(model.fromMenu.length
      ? [`<section><h2>Z menu</h2><table>${rowsHtml(model.fromMenu)}</table></section>`]
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

  return `<!doctype html><html lang="sk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kalkulácia surovín</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #1a2830; margin: 0; padding: 16px; font-size: 12px; }
  @media print { body { padding: 0; } }
  h1 { font-size: 20px; letter-spacing: .12em; margin: 0 0 2px; }
  .sub { color: #3a5160; font-size: 14px; font-weight: 700; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  .events { margin-bottom: 12px; }
  .events td { padding: 3px 0; border-bottom: 1px solid #e0e8ec; vertical-align: top; }
  .events .ev { font-weight: 700; white-space: nowrap; padding-right: 10px; width: 1%; }
  .cnt { color: #5d7d8e; font-size: 11px; }
  .cols { column-count: 2; column-gap: 10mm; }
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
  .printed { margin-top: 10px; color: #9ab0ba; font-size: 10px; text-align: right; }
</style></head><body>
<h1>KALKULÁCIA SUROVÍN</h1>
<p class="sub">${esc(daysText(model.days))}</p>
<table class="events">${events}</table>
${groups ? `<div class="cols">${groups}</div>` : ''}
${missing}${check}${empty}
<p class="printed">${esc(printedText(model.printedAt))}</p>
</body></html>`
}
