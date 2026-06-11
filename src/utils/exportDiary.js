import ExcelJS from 'exceljs'

const SK_MONTHS = [
  'Január','Február','Marec','Apríl','Máj','Jún',
  'Júl','August','September','Október','November','December',
]
const DAYS = ['ned','pon','ut','str','štv','pia','sob']

// Farby zhodné s diárom (ARGB)
const HALL_COLS = [
  { key: 'ARTENZ_PLUS', label: 'ARTENZ PLUS', color: 'FF4CBFB3' },
  { key: 'ARTENZ',      label: 'ARTENZ',      color: 'FFD4A036' },
  { key: 'LUNA',        label: 'LUNA',        color: 'FFB55DB8' },
  { key: 'CATERING',    label: 'CATERING',    color: 'FF7AAACA' },
]

const STATUS_FILL = {
  dopyt:     'FFF0F2F4',
  zaloha:    'FFFFF5E6',
  potvrdene: 'FFEAF7F0',
}

const GRID = { style: 'thin', color: { argb: 'FFE0E8EC' } }

function pad(n) { return String(n).padStart(2, '0') }

function solid(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

// Vyexportuje celý rok diára do .xlsx — bunka = názov rezervácie (meno zákazníka),
// výplň podľa statusu, hrubý ľavý okraj vo farbe sály (ako event bloky v diári).
export async function exportDiaryYear(year, bookings) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`Diár ${year}`, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = [{ width: 10 }, ...HALL_COLS.map(() => ({ width: 26 }))]

  // mapa: date → hall → [bookings]
  const byDate = {}
  for (const b of bookings) {
    ;((byDate[b.date] ??= {})[b.hall] ??= []).push(b)
  }

  // Hlavička so sálami (farebný pásik hore ako v diári)
  const head = ws.addRow(['', ...HALL_COLS.map(h => h.label)])
  head.height = 22
  head.eachCell((cell, col) => {
    cell.fill = solid('FF2B3F4E')
    cell.font = { bold: true, size: 10, color: { argb: 'FFC0D8E8' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    if (col > 1) {
      cell.border = { top: { style: 'thick', color: { argb: HALL_COLS[col - 2].color } } }
    }
  })

  for (let m = 0; m < 12; m++) {
    // Titulok mesiaca
    const tr = ws.addRow([`${SK_MONTHS[m]} ${year}`])
    ws.mergeCells(tr.number, 1, tr.number, 1 + HALL_COLS.length)
    tr.height = 20
    const tc = tr.getCell(1)
    tc.font = { bold: true, size: 12, color: { argb: 'FF354D5D' } }
    tc.fill = solid('FFF4F7F9')
    tc.border = { bottom: { style: 'medium', color: { argb: 'FFE0E8EC' } } }

    const daysInMonth = new Date(year, m + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const date  = new Date(year, m, d)
      const iso   = `${year}-${pad(m + 1)}-${pad(d)}`
      const isSun = date.getDay() === 0

      const row = ws.addRow([
        `${d}. ${DAYS[date.getDay()]}`,
        ...HALL_COLS.map(h =>
          (byDate[iso]?.[h.key] ?? []).map(b => b.customer_name).join(', ')
        ),
      ])

      // dátumový stĺpec
      const dc = row.getCell(1)
      dc.fill = solid('FFF8FAFB')
      dc.font = { bold: true, size: 9, color: { argb: isSun ? 'FFC84040' : 'FF354D5D' } }
      dc.alignment = { vertical: 'middle' }
      dc.border = { top: GRID, bottom: GRID, left: GRID, right: GRID }

      // bunky sál
      HALL_COLS.forEach((h, i) => {
        const cell = row.getCell(i + 2)
        cell.border = { top: GRID, bottom: GRID, left: GRID, right: GRID }
        cell.alignment = { vertical: 'middle' }
        const evts = byDate[iso]?.[h.key] ?? []
        if (evts.length) {
          const status = evts[0].status ?? 'dopyt'
          cell.fill = solid(STATUS_FILL[status] ?? STATUS_FILL.dopyt)
          cell.font = { bold: true, size: 9, color: { argb: 'FF1A2830' } }
          cell.border.left = { style: 'thick', color: { argb: h.color } }
        }
      })
    }
  }

  const buf  = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url
  a.download = `diar-${year}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
