import { getMonthWeeks, toISO } from './diaryWeeks'

// Export roka do PDF: každý mesiac na pol strany A4, 2 mesiace na stranu →
// 12 mesiacov na 6 strán. Vizuál mesiaca kopíruje diár (týždňový layout,
// farebné stĺpce sál, statusové farby rezervácií). Tvorí sa HTML dokument
// a otvorí sa systémový tlačový dialóg (Uložiť ako PDF).

const SK_MONTHS = [
  'Január','Február','Marec','Apríl','Máj','Jún',
  'Júl','August','September','Október','November','December',
]

const HALLS = ['ARTENZ_PLUS', 'ARTENZ', 'LUNA', 'CATERING']

const HALL_LABEL = {
  ARTENZ_PLUS: 'ARTENZ+',
  ARTENZ:      'ARTENZ',
  LUNA:        'LUNA',
  CATERING:    'CATERING',
}

// Farby zhodné s diárom (DiaryEventBlock)
const HALL_STRIP = {
  ARTENZ_PLUS: '#4cbfb3',
  ARTENZ:      '#d4a036',
  LUNA:        '#b55db8',
  CATERING:    '#7aaaca',
}

const STATUS_BG = {
  dopyt:     '#f0f2f4',
  zaloha:    '#fff5e6',
  potvrdene: '#eaf7f0',
}

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Blok rezervácie — pásik vo farbe sály, výplň podľa statusu;
// meno + (ak je) telefónne číslo na druhom riadku
function eventBlock(b) {
  const bg = STATUS_BG[b.status] ?? STATUS_BG.dopyt
  const phone = b.customer_phone?.trim()
    ? `<span class="ph">${esc(b.customer_phone)}</span>` : ''
  return `<div class="ev" style="border-left-color:${HALL_STRIP[b.hall] ?? '#9ab0ba'};background:${bg}"><span class="nm">${esc(b.customer_name)}</span>${phone}</div>`
}

function evCell(events) {
  return events.map(eventBlock).join('')
}

export function exportDiaryYearPdf(year, bookings) {
  // mapa: date → hall → [bookings]
  const byDate = {}
  for (const b of bookings) {
    ;((byDate[b.date] ??= {})[b.hall] ??= []).push(b)
  }
  const ev = (iso, hall) => byDate[iso]?.[hall] ?? []

  const inMonth = (d, month) => d.getMonth() === month && d.getFullYear() === year

  // Dátumová bunka jedného dňa (číslo + skratka dňa)
  function dateCell(d, month, label, cls) {
    if (!inMonth(d, month)) return `<td class="dcell out"></td>`
    return `<td class="dcell ${cls}"><b>${d.getDate()}</b><i>${label}</i></td>`
  }

  // Bunka sály pre jeden deň
  function hallCell(d, month, hall, cls) {
    if (!inMonth(d, month)) return `<td class="hcell out"></td>`
    return `<td class="hcell ${cls}">${evCell(ev(toISO(d), hall))}</td>`
  }

  // Mon–Thu: dátum aj sály sú 2×2 podmriežka (poradie ako v diári: po,st / ut,štv)
  function sub2x2Date(week, month) {
    const cells = [
      [week.mon, 'po'], [week.wed, 'st'],
      [week.tue, 'ut'], [week.thu, 'štv'],
    ]
    const inner = cells.map(([d, label]) =>
      inMonth(d, month)
        ? `<div class="sd"><b>${d.getDate()}</b><i>${label}</i></div>`
        : `<div class="sd out"></div>`
    ).join('')
    return `<td class="dcell wday"><div class="g2">${inner}</div></td>`
  }

  function sub2x2Hall(week, month, hall) {
    const days = [week.mon, week.wed, week.tue, week.thu]
    const inner = days.map(d =>
      inMonth(d, month)
        ? `<div class="sh">${evCell(ev(toISO(d), hall))}</div>`
        : `<div class="sh out"></div>`
    ).join('')
    return `<td class="hcell wday"><div class="g2">${inner}</div></td>`
  }

  function weekRows(week, month) {
    const rows = []

    // Nedeľa
    if (inMonth(week.sun, month)) {
      rows.push(`<tr class="r-sun">${dateCell(week.sun, month, 'ned', 'sun')}` +
        HALLS.map(h => hallCell(week.sun, month, h, 'sun')).join('') + `</tr>`)
    }

    // Pon–Štv (2×2)
    const wdayIn = [week.mon, week.tue, week.wed, week.thu].some(d => inMonth(d, month))
    if (wdayIn) {
      rows.push(`<tr class="r-wday">${sub2x2Date(week, month)}` +
        HALLS.map(h => sub2x2Hall(week, month, h)).join('') + `</tr>`)
    }

    // Piatok
    if (inMonth(week.fri, month)) {
      rows.push(`<tr class="r-fri">${dateCell(week.fri, month, 'pia', 'fri')}` +
        HALLS.map(h => hallCell(week.fri, month, h, 'fri')).join('') + `</tr>`)
    }

    // Sobota (väčšia)
    if (inMonth(week.sat, month)) {
      rows.push(`<tr class="r-sat">${dateCell(week.sat, month, 'sob', 'sat')}` +
        HALLS.map(h => hallCell(week.sat, month, h, 'sat')).join('') + `</tr>`)
    }

    return rows.join('')
  }

  function monthBlock(month) {
    const weeks = getMonthWeeks(year, month)
    const head = `<tr class="head"><th class="dcol"></th>` +
      HALLS.map(h => `<th style="box-shadow:inset 0 3px 0 ${HALL_STRIP[h]}">${HALL_LABEL[h]}</th>`).join('') +
      `</tr>`
    const body = weeks.map(w => weekRows(w, month)).join('')
    return `<section class="month">
      <div class="mtitle">${SK_MONTHS[month]} ${year}</div>
      <table class="mgrid"><thead>${head}</thead><tbody>${body}</tbody></table>
    </section>`
  }

  // Strany po 2 mesiacoch
  const pages = []
  for (let p = 0; p < 6; p++) {
    pages.push(`<div class="sheet">${monthBlock(p * 2)}${monthBlock(p * 2 + 1)}</div>`)
  }

  const html = `<!doctype html>
<html lang="sk"><head><meta charset="utf-8"><title>Diár ${year}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4 landscape; margin: 7mm; }
  body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; margin: 0; color: #1a2830; }

  /* 2 mesiace vedľa seba — užšie a vyššie kalendáre */
  .sheet { display: flex; gap: 8mm; page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }

  .month { flex: 1; width: 50%; height: 196mm; overflow: hidden; page-break-inside: avoid; }
  .mtitle { font-size: 13px; font-weight: 800; color: #354d5d; padding: 2px 4px 5px; }

  .mgrid { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .mgrid th, .mgrid td { border: 0.5px solid #e0e8ec; vertical-align: top; }
  .dcol { width: 11%; }
  .mgrid th { width: 22.25%; }

  tr.head th {
    background: #2b3f4e; color: #c0d8e8; font-size: 8.5px; font-weight: 700;
    letter-spacing: .04em; text-align: left; padding: 4px 4px; border-color: #354d5d;
  }

  .dcell { background: #f8fafb; text-align: center; padding: 1px 0; }
  .dcell b { font-size: 9px; font-weight: 800; color: #354d5d; display: block; line-height: 1.1; }
  .dcell i { font-size: 6.5px; font-style: normal; color: #8aaabb; display: block; line-height: 1; }
  .dcell.sun b, .dcell.sun i { color: #c84040; }
  .dcell.out, .hcell.out { background: #fff; }

  .hcell { padding: 1px; }

  .ev {
    border-left: 3px solid #9ab0ba; background: #f0f2f4;
    font-size: 7px; line-height: 1.2;
    padding: 1.5px 2px 1.5px 3px; margin: 0.5px 0; border-radius: 2px;
    overflow: hidden;
  }
  .ev .nm { display: block; font-weight: 600; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .ev .ph { display: block; font-size: 6px; font-weight: 400; color: #5a7280; line-height: 1.1; }

  /* Pon–Štv 2×2 podmriežka */
  .g2 { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 1fr; min-height: 26px; }
  .g2 .sd, .g2 .sh { border: 0.5px dashed #e3ebef; min-height: 13px; }
  .g2 .sd { text-align: center; padding: 1px 0; }
  .g2 .sd b { font-size: 8px; font-weight: 800; color: #354d5d; display: block; line-height: 1; }
  .g2 .sd i { font-size: 5.5px; font-style: normal; color: #8aaabb; display: block; }
  .g2 .sh { padding: 0.5px; }
  .g2 .sd.out, .g2 .sh.out { background: #fff; border-color: transparent; }

  /* Výšky riadkov — viac priestoru na výšku; sobota najväčšia */
  tr.r-sat .hcell, tr.r-sat .dcell { height: 36px; }
  tr.r-fri .hcell, tr.r-fri .dcell { height: 24px; }
  tr.r-sun .hcell, tr.r-sun .dcell { height: 20px; }
</style></head>
<body onload="window.print()">
${pages.join('\n')}
</body></html>`

  const win = window.open('', '_blank')
  if (!win) throw new Error('Prehliadač zablokoval okno tlače.')
  win.document.write(html)
  win.document.close()
}
