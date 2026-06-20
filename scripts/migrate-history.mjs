// Jednorazová migrácia histórie denného menu z info/FOOD_LUNA.xlsx do daily_menus.
// Hárky: MENU_old (A=dátum, B=jedlo; 2 riadky/deň = main1, main2), Polievky (A=dátum, B=polievka).
// Pre každý týždeň s dátami doplní po–pia; chýbajúce hodnoty = "NO DATA".
// Náhľad:  node scripts/migrate-history.mjs
// Zápis:   SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-history.mjs --write
import ExcelJS from 'exceljs'

const FILE = process.env.XLSX_PATH || 'info/FOOD_LUNA.xlsx'
const WRITE = process.argv.includes('--write')
const NO = 'NO DATA'

// --- helpers (všetko v UTC, aby dátum z Excelu nepadol o deň) ---
const pad = (n) => String(n).padStart(2, '0')
const isoUTC = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
function cellDate(v) {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d) ? null : d
}
function cellText(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('').trim()
    if (typeof v.text === 'string') return v.text.trim()
    if (v.result != null) return String(v.result).trim()
  }
  return String(v).trim()
}
function mondayUTC(d) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7))
  return x
}
const addDaysUTC = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x }

// --- načítaj Excel ---
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(FILE)

const mealsByDate = new Map() // iso -> [main1, main2, ...]
const wsM = wb.getWorksheet('MENU_old')
for (let r = 2; r <= wsM.rowCount; r++) {
  const d = cellDate(wsM.getRow(r).getCell(1).value)
  if (!d) continue
  const iso = isoUTC(d)
  if (!mealsByDate.has(iso)) mealsByDate.set(iso, [])
  mealsByDate.get(iso).push(cellText(wsM.getRow(r).getCell(2).value))
}

const soupByDate = new Map() // iso -> polievka
const wsP = wb.getWorksheet('Polievky')
for (let r = 2; r <= wsP.rowCount; r++) {
  const d = cellDate(wsP.getRow(r).getCell(1).value)
  if (!d) continue
  soupByDate.set(isoUTC(d), cellText(wsP.getRow(r).getCell(2).value))
}

// --- aktívne týždne (len minulé) ---
const currentMonIso = isoUTC(mondayUTC(new Date()))
const activeMondays = new Set()
for (const iso of new Set([...mealsByDate.keys(), ...soupByDate.keys()])) {
  const monIso = isoUTC(mondayUTC(new Date(iso + 'T00:00:00Z')))
  if (monIso < currentMonIso) activeMondays.add(monIso)
}

// --- postav riadky po–pia ---
const rows = []
let noDataDays = 0
for (const monIso of [...activeMondays].sort()) {
  const mon = new Date(monIso + 'T00:00:00Z')
  for (let i = 0; i < 5; i++) {
    const iso = isoUTC(addDaysUTC(mon, i))
    const meals = mealsByDate.get(iso) || []
    const soup = soupByDate.get(iso) || ''
    const main1 = meals[0] || NO
    const main2 = meals[1] || NO
    const soup1 = soup || NO
    if (main1 === NO && main2 === NO && soup1 === NO) noDataDays++
    rows.push({ menu_date: iso, status: 'open', soup1_name: soup1, main1_name: main1, main2_name: main2 })
  }
}

// --- súhrn ---
const dates = rows.map((r) => r.menu_date).sort()
console.log('Súbor:           ', FILE)
console.log('Týždňov (minulé):', activeMondays.size)
console.log('Dní (po–pia):    ', rows.length, `(z toho úplne prázdnych "NO DATA": ${noDataDays})`)
console.log('Rozsah:          ', dates[0], '→', dates[dates.length - 1])
console.log('Cutoff (pondelok tohto týždňa, nevkladá sa od):', currentMonIso)
console.log('\nUkážka prvého týždňa:')
for (const r of rows.slice(0, 5)) {
  console.log(`  ${r.menu_date}  P: ${r.soup1_name}  |  1: ${r.main1_name}  |  2: ${r.main2_name}`)
}

if (!WRITE) {
  console.log('\n[NÁHĽAD] Nič sa nezapísalo. Pre zápis spusti s  --write  a SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(0)
}

// --- zápis ---
const { createClient } = await import('@supabase/supabase-js')
const URL = process.env.SUPABASE_URL || 'https://fmkralairvdhjnsfhcxo.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('\nCHÝBA SUPABASE_SERVICE_ROLE_KEY — bez neho RLS zápis nepovolí.'); process.exit(1) }
const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

let written = 0
for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500)
  const { error } = await supabase
    .from('daily_menus')
    .upsert(chunk, { onConflict: 'menu_date', ignoreDuplicates: true }) // existujúce dni neprepíše
  if (error) { console.error('Chyba pri zápise:', error.message); process.exit(1) }
  written += chunk.length
  console.log(`Zapísané ${written}/${rows.length}…`)
}
console.log('Hotovo. (Existujúce dni ostali nedotknuté.)')
