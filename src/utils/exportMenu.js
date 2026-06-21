import ExcelJS from 'exceljs'
import { supabase } from '../lib/supabase'

const DNI_SK = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota']
const STATUS_LABEL = { open: 'Otvorené', closed: 'Zatvorené' }

function pad(n) {
  return String(n).padStart(2, '0')
}

function solid(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

// Dnešok ako RRRRMMDD (prefix názvu súboru)
function todayStamp() {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

async function downloadWorkbook(wb, filename) {
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Načíta CELÚ tabuľku daily_menus (po stránkach 1000) od najstaršieho.
async function fetchAllDailyMenus() {
  const PAGE = 1000
  const all = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('daily_menus')
      .select('*')
      .order('menu_date', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return all
}

function denSk(iso) {
  const d = new Date(iso + 'T00:00:00')
  return DNI_SK[d.getDay()] ?? ''
}

// ── Export celej databázy denných menu (meničiek) do Excelu ──
// Riadok = jeden deň, zoradené od najstaršieho po najnovšie.
export async function exportDailyMenus() {
  const rows = await fetchAllDailyMenus()

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Denné menu', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = [
    { header: 'Dátum',          key: 'date',     width: 12 },
    { header: 'Deň',            key: 'day',      width: 11 },
    { header: 'Stav',           key: 'status',   width: 11 },
    { header: 'Polievka 1',     key: 's1',       width: 30 },
    { header: 'Alergény P1',    key: 's1a',      width: 11 },
    { header: 'Polievka 2',     key: 's2',       width: 30 },
    { header: 'Alergény P2',    key: 's2a',      width: 11 },
    { header: 'Hlavné jedlo 1', key: 'm1',       width: 40 },
    { header: 'Alergény 1',     key: 'm1a',      width: 11 },
    { header: 'Gramáž 1',       key: 'm1p',      width: 12 },
    { header: 'Cena 1 (€)',     key: 'm1pr',     width: 10 },
    { header: 'Hlavné jedlo 2', key: 'm2',       width: 40 },
    { header: 'Alergény 2',     key: 'm2a',      width: 11 },
    { header: 'Gramáž 2',       key: 'm2p',      width: 12 },
    { header: 'Cena 2 (€)',     key: 'm2pr',     width: 10 },
    { header: 'Poznámka',       key: 'note',     width: 30 },
  ]

  const head = ws.getRow(1)
  head.height = 20
  head.eachCell((cell) => {
    cell.fill = solid('FF2B3F4E')
    cell.font = { bold: true, size: 10, color: { argb: 'FFC0D8E8' } }
    cell.alignment = { vertical: 'middle' }
  })

  for (const r of rows) {
    const row = ws.addRow({
      date:   r.menu_date,
      day:    denSk(r.menu_date),
      status: STATUS_LABEL[r.status] ?? r.status ?? '',
      s1:     r.soup1_name ?? '',
      s1a:    r.soup1_allergens ?? '',
      s2:     r.soup2_name ?? '',
      s2a:    r.soup2_allergens ?? '',
      m1:     r.main1_name ?? '',
      m1a:    r.main1_allergens ?? '',
      m1p:    r.main1_portion ?? '',
      m1pr:   r.main1_price != null ? Number(r.main1_price) : '',
      m2:     r.main2_name ?? '',
      m2a:    r.main2_allergens ?? '',
      m2p:    r.main2_portion ?? '',
      m2pr:   r.main2_price != null ? Number(r.main2_price) : '',
      note:   r.note ?? '',
    })
    row.font = { size: 10 }
    if (r.status === 'closed') row.getCell('status').fill = solid('FFFBEAEC')
  }

  await downloadWorkbook(wb, `${todayStamp()}_LUNA_menicky.xlsx`)
  return rows.length
}
