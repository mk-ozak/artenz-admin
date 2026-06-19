import ExcelJS from 'exceljs'
import { supabase } from '../lib/supabase'
import { EVENT_LABEL } from '../lib/eventTypes'
import { SETTLEMENT_DOCUMENT_LABEL, SETTLEMENT_METHOD_LABEL } from '../lib/settlement'

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

const HALL_LABEL = Object.fromEntries(HALL_COLS.map(h => [h.key, h.label]))

const STATUS_FILL = {
  dopyt:     'FFF0F2F4',
  zaloha:    'FFFFF5E6',
  potvrdene: 'FFEAF7F0',
}

const STATUS_LABEL = {
  dopyt:     'Nezáväzný dopyt',
  zaloha:    'Čakajúca záloha',
  potvrdene: 'Potvrdené',
}

const GRID = { style: 'thin', color: { argb: 'FFE0E8EC' } }

function pad(n) { return String(n).padStart(2, '0') }

function solid(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

// Dnešok ako RRRRMMDD (prefix názvu súboru)
function todayStamp() {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

async function downloadWorkbook(wb, filename) {
  const buf  = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Export roka: mriežka ako diár ───────────────────────────
// Bunka = meno + telefón + sála, výplň podľa statusu,
// hrubý ľavý okraj vo farbe sály (ako event bloky v diári).
export async function exportDiaryYear(year, bookings) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`Diár ${year}`, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = [{ width: 10 }, ...HALL_COLS.map(() => ({ width: 28 }))]

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
          (byDate[iso]?.[h.key] ?? [])
            .map(b => [b.customer_name, b.customer_phone, HALL_LABEL[b.hall] ?? b.hall]
              .filter(Boolean).join('\n'))
            .join('\n\n')
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
        cell.alignment = { vertical: 'middle', wrapText: true }
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

  await downloadWorkbook(wb, `${todayStamp()}_diar_${year}.xlsx`)
}

// ── Export všetkých rezervácií: riadok = rezervácia ─────────
export async function exportAllBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .is('deleted_at', null)
    .order('date')
  if (error) throw new Error(error.message)

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Všetky rezervácie', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = [
    { header: 'Dátum',                 key: 'date',           width: 12 },
    { header: 'Čas',                   key: 'time',           width: 8  },
    { header: 'Sála',                  key: 'hall',           width: 14 },
    { header: 'Typ akcie',             key: 'type',           width: 14 },
    { header: 'Zákazník',              key: 'name',           width: 26 },
    { header: 'Telefón',               key: 'phone',          width: 16 },
    { header: 'Stav',                  key: 'status',         width: 16 },
    { header: 'Očakávaný počet osôb',  key: 'expectedGuests', width: 12 },
    { header: 'Predbežná cena (€)',    key: 'estimatedPrice', width: 12 },
    { header: 'Počet hostí',           key: 'guestCount',     width: 12 },
    { header: 'Záloha (€)',            key: 'deposit',        width: 10 },
    { header: 'Vyúčtovanie – doklad',  key: 'settlementDoc',    width: 16 },
    { header: 'Vyúčtovanie – spôsob',  key: 'settlementMethod', width: 14 },
    { header: 'Poznámky',              key: 'notes',          width: 40 },
    { header: 'Vytvorené',             key: 'createdAt',      width: 18 },
  ]

  // Hlavička
  const head = ws.getRow(1)
  head.height = 20
  head.eachCell(cell => {
    cell.fill = solid('FF2B3F4E')
    cell.font = { bold: true, size: 10, color: { argb: 'FFC0D8E8' } }
    cell.alignment = { vertical: 'middle' }
  })

  for (const b of data ?? []) {
    const row = ws.addRow({
      date:           b.date,
      time:           b.start_time ? b.start_time.slice(0, 5) : '',
      hall:           HALL_LABEL[b.hall] ?? b.hall,
      type:           EVENT_LABEL[b.event_type] ?? b.event_type ?? '',
      name:           b.customer_name,
      phone:          b.customer_phone ?? '',
      status:         STATUS_LABEL[b.status] ?? b.status ?? '',
      expectedGuests: b.expected_guests ?? 0,
      estimatedPrice: b.estimated_price != null ? Number(b.estimated_price) : 0,
      guestCount:     b.guest_count ?? '',
      deposit:        b.deposit_amount != null ? Number(b.deposit_amount) : '',
      settlementDoc:    SETTLEMENT_DOCUMENT_LABEL[b.settlement_document] ?? '',
      settlementMethod: SETTLEMENT_METHOD_LABEL[b.settlement_method] ?? '',
      notes:          b.notes ?? '',
      createdAt:      b.created_at ? b.created_at.slice(0, 16).replace('T', ' ') : '',
    })
    row.font = { size: 10 }
    // jemné podfarbenie podľa stavu
    const fill = STATUS_FILL[b.status]
    if (fill) row.getCell('status').fill = solid(fill)
  }

  await downloadWorkbook(wb, `${todayStamp()}_diar_vsetko.xlsx`)
}
