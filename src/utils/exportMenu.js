import ExcelJS from 'exceljs'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/ingredients'
import { calcQtyOf, fmtQty } from '../lib/menuCalc'

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

// ── Export katalógu menu (kategórie + položky) do Excelu ──
// Riadok = jedna položka, zoradené podľa bloku, kategórie a poradia.
// Prázdne kategórie majú vlastný riadok (bez položky). Len nearchivované.
// Varianty položky (napr. Náplň) idú do dvoch posledných stĺpcov.
export async function exportMenuCatalog() {
  const [c, i, v] = await Promise.all([
    supabase.from('menu_categories').select('*').is('archived_at', null).order('block').order('position'),
    supabase.from('menu_items').select('*').is('archived_at', null).order('position'),
    supabase.from('menu_item_variants').select('*').is('archived_at', null).order('position'),
  ])
  if (c.error) throw new Error(c.error.message)
  if (i.error) throw new Error(i.error.message)
  if (v.error) throw new Error(v.error.message)
  const cats  = c.data ?? []
  const items = i.data ?? []
  const variantsByItem = {}
  for (const row of v.data ?? []) (variantsByItem[row.item_id] ??= []).push(row)

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Menu katalóg', { views: [{ state: 'frozen', ySplit: 1 }] })

  ws.columns = [
    { header: 'Blok',             key: 'block', width: 7 },
    { header: 'Kategória',        key: 'cat',   width: 26 },
    { header: 'Položka',          key: 'item',  width: 64 },
    { header: 'Farba',            key: 'color', width: 12 },
    { header: 'Skupina variantov', key: 'vgrp', width: 18 },
    { header: 'Možnosti',         key: 'vopts', width: 64 },
  ]

  const head = ws.getRow(1)
  head.height = 20
  head.eachCell((cell) => {
    cell.fill = solid('FF2B3F4E')
    cell.font = { bold: true, size: 10, color: { argb: 'FFC0D8E8' } }
    cell.alignment = { vertical: 'middle' }
  })

  let count = 0
  for (const cat of cats) {
    const catItems = items.filter((it) => it.category_id === cat.id)
    if (catItems.length === 0) {
      ws.addRow({ block: cat.block, cat: cat.name, item: '', color: '' }).font = { size: 10 }
      continue
    }
    for (const it of catItems) {
      const opts = it.has_variants ? (variantsByItem[it.id] ?? []) : []
      const row = ws.addRow({
        block: cat.block,
        cat:   cat.name,
        item:  it.name,
        color: it.color ?? '',
        vgrp:  it.has_variants ? (it.variant_group_name ?? '') : '',
        vopts: opts.map(o => o.name).join(', '),
      })
      row.font = { size: 10 }
      if (it.color) {
        row.getCell('color').fill = solid('FF' + String(it.color).replace('#', '').toUpperCase())
      }
      count++
    }
  }

  await downloadWorkbook(wb, `${todayStamp()}_menu_katalog.xlsx`)
  return count
}

// Hárok s ukotvenou a ofarbenou hlavičkou
function addSheet(wb, name, columns) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = columns
  const head = ws.getRow(1)
  head.height = 20
  head.eachCell((cell) => {
    cell.fill = solid('FF2B3F4E')
    cell.font = { bold: true, size: 10, color: { argb: 'FFC0D8E8' } }
    cell.alignment = { vertical: 'middle' }
  })
  return ws
}

// ── Export pre receptúry (Nastavenia → Suroviny) ──
// Podklad, z ktorého Claude pripraví receptúry: jedlá katalógu s ID (blok,
// kategória, ako ich počíta kalkulácia pre kuchyňu — v tej jednotke je dávka
// receptúry), varianty, suroviny a už zadané receptúry. Len nearchivované
// položky, varianty a suroviny.
export async function exportRecipeData() {
  const [c, i, v, ic, ing, r, l] = await Promise.all([
    supabase.from('menu_categories').select('*').is('archived_at', null).order('block').order('position'),
    supabase.from('menu_items').select('*').is('archived_at', null).order('position'),
    supabase.from('menu_item_variants').select('*').is('archived_at', null).order('position'),
    supabase.from('ingredient_categories').select('*').order('position'),
    supabase.from('ingredients').select('*').order('position'),
    supabase.from('menu_item_recipes').select('*'),
    fetchAllRows((from, to) =>
      supabase.from('menu_item_recipe_lines').select('*').order('position').order('id').range(from, to)),
  ])
  for (const x of [c, i, v, ic, ing, r, l]) if (x.error) throw new Error(x.error.message)

  const variants  = v.data ?? []
  const ingCatOf  = Object.fromEntries((ic.data ?? []).map(x => [x.id, x]))
  const ingById   = Object.fromEntries((ing.data ?? []).map(x => [x.id, x]))
  const recipeOf  = Object.fromEntries((r.data ?? []).map(x => [x.item_id, x]))
  const variantOf = Object.fromEntries(variants.map(x => [x.id, x]))
  // Položky v poradí katalógu (blok, kategória, poradie)
  const items = (c.data ?? []).flatMap(cat =>
    (i.data ?? []).filter(it => it.category_id === cat.id).map(it => ({ it, cat })))
  const linesOf = {}
  for (const line of l.data) (linesOf[line.item_id] ??= []).push(line)

  const wb = new ExcelJS.Workbook()

  const wsItems = addSheet(wb, 'Jedlá', [
    { header: 'ID položky',        key: 'id',    width: 38 },
    { header: 'Blok',              key: 'block', width: 6 },
    { header: 'Kategória',         key: 'cat',   width: 24 },
    { header: 'Kalkulácia',        key: 'calc',  width: 30 },
    { header: 'Dávka v',           key: 'unit',  width: 8 },
    { header: 'Položka',           key: 'item',  width: 60 },
    { header: 'Varianty',          key: 'vars',  width: 44 },
    { header: 'Surovina',          key: 'ing',   width: 9 },
    { header: 'Receptúra na',      key: 'yield', width: 13 },
    { header: 'Riadkov receptúry', key: 'n',     width: 10 },
  ])
  for (const { it, cat } of items) {
    const qty  = calcQtyOf(cat)
    const rec  = recipeOf[it.id]
    const opts = it.has_variants ? variants.filter(x => x.item_id === it.id) : []
    wsItems.addRow({
      id:    it.id,
      block: cat.block,
      cat:   cat.name,
      calc:  !qty
        ? 'bez množstva'
        : qty.portion != null
          ? `${fmtQty(qty.portion)}${qty.unit ? ` ${qty.unit}` : ''} na osobu${qty.split ? ', delené pri 2+' : ''}`
          : `${qty.unit ?? 'množstvo'} zadávané ručne`,
      unit:  qty?.unit ?? '',
      item:  it.name,
      vars:  opts.length ? `${it.variant_group_name?.trim() || 'Varianty'}: ${opts.map(o => o.name).join(', ')}` : '',
      ing:   rec?.is_ingredient ? 'áno' : '',
      yield: rec ? `${fmtQty(rec.yield_amount)}${rec.yield_unit ? ` ${rec.yield_unit}` : ''}` : '',
      n:     linesOf[it.id]?.length ?? '',
    }).font = { size: 10 }
  }

  const wsVariants = addSheet(wb, 'Varianty', [
    { header: 'ID variantu', key: 'id',    width: 38 },
    { header: 'ID položky',  key: 'item',  width: 38 },
    { header: 'Kategória',   key: 'cat',   width: 24 },
    { header: 'Položka',     key: 'name',  width: 60 },
    { header: 'Skupina',     key: 'group', width: 14 },
    { header: 'Variant',     key: 'var',   width: 30 },
  ])
  for (const { it, cat } of items) {
    if (!it.has_variants) continue
    for (const o of variants.filter(x => x.item_id === it.id)) {
      wsVariants.addRow({
        id: o.id, item: it.id, cat: cat.name, name: it.name,
        group: it.variant_group_name ?? '', var: o.name,
      }).font = { size: 10 }
    }
  }

  const wsIngs = addSheet(wb, 'Suroviny', [
    { header: 'ID suroviny', key: 'id',   width: 38 },
    { header: 'Kategória',   key: 'cat',  width: 28 },
    { header: 'Surovina',    key: 'name', width: 34 },
    { header: 'Jednotka',    key: 'unit', width: 9 },
  ])
  // Nearchivované suroviny nearchivovaných kategórií, v poradí z Nastavení
  const activeIngs = (ing.data ?? [])
    .filter(x => !x.archived_at && ingCatOf[x.category_id] && !ingCatOf[x.category_id].archived_at)
    .sort((a, b) => ingCatOf[a.category_id].position - ingCatOf[b.category_id].position || a.position - b.position)
  for (const x of activeIngs) {
    wsIngs.addRow({ id: x.id, cat: ingCatOf[x.category_id].name, name: x.name, unit: x.unit }).font = { size: 10 }
  }

  const wsLines = addSheet(wb, 'Receptúry', [
    { header: 'ID položky',  key: 'item',   width: 38 },
    { header: 'Položka',     key: 'name',   width: 50 },
    { header: 'Receptúra na', key: 'yield', width: 13 },
    { header: 'ID variantu', key: 'varId',  width: 38 },
    { header: 'Variant',     key: 'var',    width: 24 },
    { header: 'ID suroviny', key: 'ingId',  width: 38 },
    { header: 'Surovina',    key: 'ing',    width: 30 },
    { header: 'Množstvo',    key: 'amount', width: 10 },
    { header: 'Jednotka',    key: 'unit',   width: 9 },
  ])
  for (const { it } of items) {
    const rec = recipeOf[it.id]
    for (const line of linesOf[it.id] ?? []) {
      wsLines.addRow({
        item:   it.id,
        name:   it.name,
        yield:  rec ? `${fmtQty(rec.yield_amount)}${rec.yield_unit ? ` ${rec.yield_unit}` : ''}` : '',
        varId:  line.variant_id ?? '',
        var:    line.variant_id ? (variantOf[line.variant_id]?.name ?? '(vymazaný variant)') : 'základ',
        ingId:  line.ingredient_id,
        ing:    ingById[line.ingredient_id]?.name ?? '?',
        amount: Number(line.amount),
        unit:   line.unit,
      }).font = { size: 10 }
    }
  }

  await downloadWorkbook(wb, `${todayStamp()}_podklady_receptury.xlsx`)
  return items.length
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
