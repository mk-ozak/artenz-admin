// Lístky pre termotlačiareň (papier 80 mm, 576 bodov na riadok): do kuchyne
// a zhrnutie pre zákazníka. Model sa skladá z tých istých sekcií a výpočtov ako
// „Kalkulácia pre kuchyňu" (MenuEditor + lib/menuCalc), takže čísla sedia
// s adminom. Lístok sa kreslí
// cez Canvas 2D a do tlačiarne ide ako obrázok (utils/escpos) — textový režim
// tlačiarne má čínsku znakovú sadu a slovenskú diakritiku by rozsypal.
import {
  SOUP_CATEGORY, SPECIAL_SOUP_CATEGORY, calcCount, calcLine, fmtQty, sectionHeadCount,
} from '../lib/menuCalc'
import { selLabel } from '../lib/menuVariants'
import { RAUT_BLOCKS } from '../lib/menuSummary'
import { DAYS_LONG, DAYS_SHORT } from './format'
import { VO_KITCHEN_NAME } from '../lib/vo'

// Skratka sály — veľký nápis v hlavičke tlače do kuchyne
export const HALL_SHORT = {
  ARTENZ_PLUS: 'PLUS',
  ARTENZ:      'ARTENZ',
  LUNA:        'LUNA',
  CATERING:    'CATERING',
}

// Skratka sály pre riadok bookings — objednávka VO má v hlavičke „ČIERNE"
export const hallShortOf = row => (row?.is_vo ? VO_KITCHEN_NAME : (HALL_SHORT[row?.hall] ?? row?.hall))

// ── Rozpoznanie v katalógu ───────────────────────────────────────────────
// Kategórie podľa ID (menu_categories.id) — na názve kategórie ani položky
// nezáleží. Prípitky sa netlačia v sekciách, ale pod názvom akcie bez množstva.
const TOAST_CATEGORIES = [
  { id: 'e9d6904c-5fa5-464a-ab00-5fea29f52b49', label: 'Prípitok' },      // Prípitok
  { id: 'ca3b1eec-d8eb-4323-a227-d8171750d9aa', label: 'Prípitok deti' }, // Detský prípitok
]

// Polievka (SOUP_CATEGORY) — na lístku ide zo sekcií (dospelí + automaticky
// deti) do bloku 0 navrchu ako súčet, pripočíta sa k nej aj Polievka špeciál
// (SPECIAL_SOUP_CATEGORY, výnimka v lib/menuCalc); každá jej položka dostane zložky.
// Kto polievku v sekcii je — pre rozpis súčtu („dospelí 33 L + deti 3,63 L")
const SOUP_WHO = { 1: 'dospelí', 2: 'deti', 3: 'špeciály' }

// Zložky polievky v gramoch na osobu — len na lístku, nie na obrazovke ani v DB
const SOUP_PARTS = [
  { name: 'rezance',         grams: 20 },
  { name: 'mäso a zelenina', grams: 30 },
]

// Sekcie podľa čísla bloku (menu_categories.block; bloky nemajú ID ani názov)
const SPECIAL_BLOCK = 3 // Hlavné jedlo špeciál — rámček + požiadavky ku strave
const COLD_BLOCK    = 6 // Studená kuchyňa — aj samostatný lístok za rezom

// ── Model lístka ─────────────────────────────────────────────────────────

// Zložky polievky pre počet osôb: celé gramy (bez chýb desatinných
// čísel v JS) → kg zaokrúhlené na 1 desatinné miesto
function soupParts(count) {
  return SOUP_PARTS.map(p => ({
    name:    p.name,
    portion: `${(p.grams / 1000).toFixed(3).replace('.', ',')} kg`,
    total:   `${(Math.round((count * p.grams) / 100) / 10).toFixed(1).replace('.', ',')} kg`,
  }))
}

// Kľúč položky pre súčty cez viac akcií (rovnaká položka katalógu + variant)
const itemKey = sel => `${sel.item_id ?? selLabel(sel)}|${sel.variant_id ?? ''}`

// Pre kalkuláciu surovín (lib/ingredientCalc): položka katalógu, variant
// a množstvo jedla ako v menu bez výnimky surovej ryže (served z calcLine);
// kreslenie to nečíta
const dishOf = (sel, served) => ({ itemId: sel.item_id ?? null, variantId: sel.variant_id ?? null, served })

// Názov sekcie ako v kalkulácii; nový blok bez názvu → názvy jeho kategórií
function sectionTitle(sec, summary) {
  return summary.titles?.[sec.block]
    ?? [...new Set(sec.items.filter(i => i.cat.block === sec.block).map(i => i.cat.name))].join(', ')
}

// Model lístka z dát kalkulácie.
// sections:  sekcie kalkulácie z MenuEditor (bloky s výberom v poradí, so zrkadlenou polievkou)
// selsByCat: výbery podľa kategórie
// summary:   konfigurácia z BookingMenu (titles, calc, ticket = údaje akcie a počty osôb)
export function buildKitchenTicket({ sections, selsByCat, summary }) {
  const t = summary.ticket
  const toastIds = new Set(TOAST_CATEGORIES.map(c => c.id))

  // Text pod položkami sekcie: požiadavky ku strave pri špeciáloch, poznámky
  // blokov Hlavné jedlo (sekcia 1) a Raut (sekcia 4)
  const notesByBlock = { ...t.blockNotes, [SPECIAL_BLOCK]: t.specialNotes }
  const notesOf = block => (notesByBlock[block] ?? '').trim()

  // Vyplnené požiadavky a poznámky sa tlačia vždy — aj keď sekcia nemá položky
  const missing = Object.keys(notesByBlock).map(Number)
    .filter(block => notesOf(block) && !sections.some(s => s.block === block))
  const secs = missing.length
    ? [...sections, ...missing.map(block => ({ block, items: [] }))].sort((a, b) => a.block - b.block)
    : sections

  const out = []
  const soups = new Map()  // polievka → riadky kalkulácie zo sekcií (dospelí, deti)
  const specialSoups = []  // Polievka špeciál — objem ide aj do bloku 0
  const toastLines = []    // prípitky s množstvom (pre sumár jedál)
  for (const sec of secs) {
    // Počet v pruhu sekcie; násobí sa tým istým počtom ako na obrazovke
    const count = t.sectionCount?.[sec.block] ?? null
    const blockCount = summary.calc?.countByBlock?.[sec.block] ?? null
    const items = count === 0 ? [] : sec.items.flatMap(({ sel, cat }) => {
      const line = calcLine(sel, cat, selsByCat[cat.id] ?? [], calcCount(summary, sec.block, cat))
      if (toastIds.has(cat.id)) {
        toastLines.push({
          category: cat.id, key: itemKey(sel), name: selLabel(sel), amount: line.amount, unit: line.unit,
          ...dishOf(sel, line.served),
        })
        return []
      }
      if (cat.id === SOUP_CATEGORY) {
        if (!soups.has(sel.id)) soups.set(sel.id, { sel, cat, from: [] })
        soups.get(sel.id).from.push({ block: sec.block, title: sectionTitle(sec, summary), count: blockCount, line })
        return []
      }
      // na lístku ostáva aj v sekcii špeciálov (ktorá polievka, koľko ks)
      if (cat.id === SPECIAL_SOUP_CATEGORY) specialSoups.push({ sel, cat })
      if (line.amount === 0) return []
      return [{
        name:    selLabel(sel),
        split:   line.split,     // podiel porcie (2 = ½), null = celá
        portion: line.jedn,      // porcia na osobu
        portionNote: line.jednNote,  // napr. „v hotovom stave" (ryža)
        total:   line.mnozstvo,  // množstvo spolu
        parts:   [],
        key:     itemKey(sel),   // pre sumár jedál: kľúč, číslo a jednotka
        amount:  line.amount,
        unit:    line.unit,
        ...dishOf(sel, line.served),
      }]
    })
    const notes = notesOf(sec.block)
    if (!items.length && !notes) continue
    out.push({
      block:   sec.block,
      title:   sectionTitle(sec, summary),
      count,
      special: sec.block === SPECIAL_BLOCK,
      notes,
      items,
    })
  }

  // Blok 0 — polievka navrchu: súčet množstiev zo sekcií tak, ako ich ukazuje
  // admin (dospelí + deti), k prvej polievke aj Polievka špeciál (ks × porcia,
  // bez ohľadu na to, ktorá je vybratá); zložky pre súčet osôb
  let soupPeople = null
  const soupItems = [...soups.values()].flatMap(({ sel, cat, from: sectionFrom }, i) => {
    let from = sectionFrom
    if (i === 0 && specialSoups.length) {
      const count = specialSoups.reduce((n, x) => n + (Number(x.sel.quantity) || 0), 0)
      const amount = Math.round(specialSoups.reduce((a, x) =>
        a + (Number(x.sel.quantity) || 0) * Number(x.cat.default_amount ?? cat.default_amount ?? 0), 0) * 100) / 100
      const unit = cat.default_unit ? ` ${cat.default_unit}` : ''
      if (count > 0) {
        from = [...from, { block: SPECIAL_BLOCK, count, line: { amount, mnozstvo: `${fmtQty(amount)}${unit}` } }]
      }
    }
    const people = from.reduce((n, f) => n + (f.count ?? 0), 0)
    const amounts = from.map(f => f.line.amount).filter(a => a != null)
    const amount = amounts.length ? Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100 : null
    if (amount === 0) return []
    soupPeople = Math.max(soupPeople ?? 0, people)
    return [{
      name:      selLabel(sel),
      split:     from[0].line.split,
      portion:   from[0].line.jedn,
      total:     amount != null ? `${fmtQty(amount)}${cat.default_unit ? ` ${cat.default_unit}` : ''}` : null,
      breakdown: from.length > 1
        ? from.map(f => `${SOUP_WHO[f.block] ?? f.title} ${f.line.mnozstvo ?? ''} (${f.count} os.)`).join(' + ')
        : null,
      parts:     people > 0 ? soupParts(people) : [],
      key:       itemKey(sel),
      amount,
      unit:      cat.default_unit ?? null,
      people,
      ...dishOf(sel, amount),
    }]
  })
  if (soupItems.length) {
    out.unshift({ block: 0, title: 'Polievka', count: soupPeople || null, special: false, notes: '', items: soupItems })
  }

  return {
    title:  t.title ?? '',
    date:   t.date,
    time:   t.time ?? '',
    hall:   t.hall ?? '',
    hallShort: t.hallShort ?? '',  // veľký nápis sály v hlavičke (PLUS, ARTENZ, LUNA)
    notes:  (t.notes ?? '').trim(),
    counts: t.counts,
    // Raut nemusí byť vždy — rámček RAUT len keď je v jeho blokoch niečo vybraté
    hasRaut: sections.some(s => RAUT_BLOCKS.includes(s.block) && s.items.length),
    toasts: TOAST_CATEGORIES
      .map(c => ({
        label: c.label,
        names: (selsByCat[c.id] ?? []).map(selLabel),
        lines: toastLines.filter(l => l.category === c.id),  // s množstvom (sumár jedál)
      }))
      .filter(c => c.names.length),
    sections: out,
    cold:     out.find(s => s.block === COLD_BLOCK && s.items.length) ?? null,
    printedAt: new Date(),
  }
}

// Model zhrnutia pre zákazníka: sekcie ako v kalkulácii, len názvy položiek
// bez porcií a množstiev pre kuchyňu (studená kuchyňa s objednanými ks)
export function buildSummaryTicket({ sections, selsByCat, summary }) {
  const t = summary.ticket
  return {
    title: t.title ?? '',
    date:  t.date,
    time:  t.time ?? '',
    hall:  t.hall ?? '',
    sections: sections.map(sec => ({
      block:   sec.block,
      title:   sectionTitle(sec, summary),
      count:   sectionHeadCount(summary, sec.block) ?? null,
      special: false,
      notes:   '',
      items: sec.items.map(({ sel, cat }) => {
        const catSels = selsByCat[cat.id] ?? []
        const showQty = summary.qtyBlocks?.includes(sec.block) && cat.qty_step != null
        return {
          name:    selLabel(sel),
          split:   cat.split_portions && catSels.length > 1 ? catSels.length : null,
          portion: null,
          total:   showQty ? `${fmtQty(sel.quantity)}${cat.qty_unit ? ` ${cat.qty_unit}` : ''}` : null,
          parts:   [],
        }
      }),
    })),
    printedAt: new Date(),
  }
}

// ── Kreslenie ────────────────────────────────────────────────────────────
// Rozmery v px na plátne 576 px (1 px = 1 bod tlačiarne = 0,125 mm). Kreslí
// sa do „stĺpca" b = { x, w } — na termo lístku je to celá šírka, na A5
// celá šírka alebo polovica.
const W  = 576      // tlačová šírka 72 mm
const M  = 8        // okraj vľavo a vpravo
const CW = W - 2 * M
const THERMAL = { x: M, w: CW }
const lineH = size => Math.ceil(size * 1.25)

// Lístok sa najprv rozloží (zoznam kresliacich príkazov + výška), potom sa
// nakreslí na plátno presnej výšky. Len čierna na bielom.
class Sheet {
  constructor(family) {
    this.family = family
    this.ctx = document.createElement('canvas').getContext('2d') // len na meranie
    this.ops = []
    this.y = 0
    this.caps = {}
  }

  font(size, weight) {
    return `${weight} ${size}px ${this.family}`
  }

  width(text, size, weight) {
    this.ctx.font = this.font(size, weight)
    return this.ctx.measureText(text).width
  }

  // Výška veľkého písmena — podľa nej sa text centruje zvislo
  cap(size, weight) {
    const key = `${size}/${weight}`
    if (!(key in this.caps)) {
      this.ctx.font = this.font(size, weight)
      this.caps[key] = this.ctx.measureText('H').actualBoundingBoxAscent || size * 0.71
    }
    return this.caps[key]
  }

  // Účiarie textu v riadku výšky h, ktorý začína na top
  base(top, h, size, weight) {
    return Math.round(top + (h + this.cap(size, weight)) / 2)
  }

  // Účiarie, pri ktorom je skutočný tvar textu zvislo v strede výšky h
  inkBase(top, h, text, size, weight) {
    this.ctx.font = this.font(size, weight)
    const m = this.ctx.measureText(text)
    return Math.round(top + (h + m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2)
  }

  rect(x, y, w, h, color = '#000') {
    this.ops.push({ op: 'rect', x, y, w, h, color })
  }

  // Rámček s okrajom lw dovnútra — štyri plné obdĺžniky (ostré hrany)
  frame(x, y, w, h, lw) {
    this.rect(x, y, w, lw)
    this.rect(x, y + h - lw, w, lw)
    this.rect(x, y, lw, h)
    this.rect(x + w - lw, y, lw, h)
  }

  text(text, x, y, size, weight, { color = '#000', align = 'left' } = {}) {
    this.ops.push({ op: 'text', text, x: Math.round(x), y, size, font: this.font(size, weight), color, align })
  }

  // Príkazy iného hárku posunuté o dy (skladanie strán A5 z riadkov)
  put(other, dy) {
    for (const o of other.ops) this.ops.push({ ...o, y: o.y + dy })
  }

  // Jeden riadok textu od this.y; posunie y o výšku riadku
  line(text, x, size, weight, opts) {
    const h = lineH(size)
    this.text(text, x, this.base(this.y, h, size, weight), size, weight, opts)
    this.y += h
  }

  // Zalomenie do šírky maxW. runs: [{ text, weight }] jednej veľkosti písma
  // (napr. „Prípitok:" regular + názov bold). Nový riadok v texte = nový odsek,
  // slovo dlhšie ako riadok sa delí po znakoch.
  // Vracia riadky [{ words: [{ text, weight, x }], w }].
  wrap(runs, maxW, size) {
    const lines = []
    let words = []
    let w = 0
    const flush = () => { lines.push({ words, w }); words = []; w = 0 }
    const put = (text, weight) => {
      const ww = this.width(text, size, weight)
      const sp = words.length ? this.width(' ', size, weight) : 0
      if (words.length && w + sp + ww > maxW) { flush(); put(text, weight); return }
      if (!words.length && ww > maxW && text.length > 1) {
        let i = 1
        while (i < text.length - 1 && this.width(text.slice(0, i + 1), size, weight) <= maxW) i++
        put(text.slice(0, i), weight)
        flush()
        put(text.slice(i), weight)
        return
      }
      words.push({ text, weight, x: w + sp })
      w += sp + ww
    }
    for (const run of runs) {
      String(run.text ?? '').split('\n').forEach((para, i) => {
        if (i > 0) flush()
        for (const word of para.split(/\s+/).filter(Boolean)) put(word, run.weight)
      })
    }
    if (words.length || !lines.length) flush()
    return lines
  }

  // Zalomený odsek od this.y; posunie y
  para(runs, x, maxW, size, opts) {
    const h = lineH(size)
    for (const ln of this.wrap(runs, maxW, size)) {
      const b = this.base(this.y, h, size, 700)
      for (const wd of ln.words) this.text(wd.text, x + wd.x, b, size, wd.weight, opts)
      this.y += h
    }
  }

  // Plátno s nakreslenými príkazmi: predvolene termo šírka a presná výška,
  // pre A5 pevná veľkosť strany, mierka a okraj (rozloženie je v bodoch termo lístka)
  paint({ width = W, height = Math.ceil(this.y), scale = 1, origin = 0 } = {}) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.scale(scale, scale)
    ctx.translate(origin, origin)
    for (const o of this.ops) {
      ctx.fillStyle = o.color
      if (o.op === 'rect') {
        ctx.fillRect(o.x, o.y, o.w, o.h)
      } else {
        ctx.font = o.font
        ctx.textAlign = o.align
        ctx.fillText(o.text, o.x, o.y)
      }
    }
    return canvas
  }
}

// Najväčšia veľkosť písma (od size nadol), pri ktorej sa text zmestí do maxW
function fitSize(s, text, size, weight, maxW) {
  while (size > 12 && s.width(text, size, weight) > maxW) size--
  return size
}

// „16. 10. 2026"
const dmy = d => `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`

// Hlavička: čierny pruh, vľavo dátum, vpravo biele okienko s časom (bez času
// ostane prázdne — dopíše sa ručne; timeBox: false = bez okienka).
// hall = veľký nápis sály: termo nad dátumom (vyšší pruh, dátum v jednom
// riadku), A5 (inline) vľavo od dátumu
function drawHeader(s, model, b, { timeBox = true, hall = '', inline = false } = {}) {
  const top = s.y
  const stacked = !!hall && !inline
  const H = stacked ? 150 : 124
  s.rect(b.x, top, b.w, H)
  const bw = 230
  const bx = b.x + b.w - 12 - bw
  const by = top + 12
  const bh = H - 24
  if (model.time || timeBox) s.rect(bx, by, bw, bh, '#fff')
  if (model.time) {
    s.text(model.time, bx + bw / 2, s.base(by, bh, 72, 700), 72, 700, { align: 'center' })
  }
  const white = { color: '#fff' }
  const d = model.date ? new Date(`${model.date}T00:00:00`) : null
  const day = d ? DAYS_LONG[d.getDay()].toLocaleUpperCase('sk') : ''
  const date = d ? dmy(d) : ''
  let x = b.x + 16
  if (stacked) {
    // Sála a pod ňou dátum v jednom riadku — do šírky vľavo od okienka
    const maxW = bx - 16 - x
    const h1 = lineH(64)
    const h2 = lineH(30)
    const t1 = top + Math.round((H - h1 - h2) / 2)
    const hs = fitSize(s, hall, 64, 700, maxW)
    s.text(hall, x, s.base(t1, h1, hs, 700), hs, 700, white)
    if (d) {
      const ds = fitSize(s, `${day} ${date}`, 30, 700, maxW)
      s.text(`${day} ${date}`, x, s.base(t1 + h1, h2, ds, 700), ds, 700, white)
    }
  } else {
    if (hall) {
      s.text(hall, x, s.base(top, H, 72, 700), 72, 700, white)
      x += s.width(hall, 72, 700) + 32
    }
    if (d) {
      const h1 = lineH(30)
      const h2 = lineH(40)
      const t1 = top + Math.round((H - h1 - h2) / 2)
      s.text(day, x, s.base(t1, h1, 30, 700), 30, 700, white)
      s.text(date, x, s.base(t1 + h1, h2, 40, 700), 40, 700, white)
    }
  }
  s.y = top + H
}

function drawTitle(s, model, b) {
  if (!model.title) return
  s.y += 14
  s.para([{ text: model.title, weight: 700 }], b.x, b.w, 46)
}

// „Prípitok: Prosecco" — popis regular, hodnota bold
function drawLabeled(s, label, value, size, b) {
  s.para([{ text: `${label}:`, weight: 400 }, { text: value, weight: 700 }], b.x, b.w, size)
}

// Počty osôb: rámčeky po perRow v riadku (termo 2 × 2, A5 všetky vedľa seba),
// zobrazujú sa vždy (aj s nulou); RAUT len pri akcii s rautom (hasRaut),
// inak ostane jeho miesto prázdne
function drawCounts(s, c, hasRaut, b, perRow = 2) {
  const gap = 8
  const bw = (b.w - (perRow - 1) * gap) / perRow
  const extra = n => (n > 0 ? `z toho +${n} navyše` : `z toho −${-n} menej`)
  const boxes = [
    { label: 'DOSPELÍ', n: c.adults,   sub: c.adultsNoMeal > 0 ? `+${c.adultsNoMeal} bez jedla` : '' },
    { label: 'DETI',    n: c.kidsMeal, sub: c.kidsNoMeal > 0 ? `+${c.kidsNoMeal} bez jedla` : '' },
    { label: 'ŠPECIÁLY', n: c.specials, sub: '' },
    ...(hasRaut ? [{ label: 'RAUT', n: c.raut, sub: c.rautExtra ? extra(c.rautExtra) : '' }] : []),
  ]
  const rows = []
  for (let i = 0; i < boxes.length; i += perRow) rows.push(boxes.slice(i, i + perRow))
  rows.forEach((row, ri) => {
    if (ri > 0) s.y += gap
    const top = s.y
    const h = 10 + lineH(22) + lineH(56) + (row.some(x => x.sub) ? lineH(22) : 0) + 12
    row.forEach((box, i) => {
      const x = b.x + i * (bw + gap)
      const center = { align: 'center' }
      s.frame(x, top, bw, h, 3)
      s.y = top + 10
      s.line(box.label, x + bw / 2, 22, 700, center)
      s.line(String(box.n), x + bw / 2, 56, 700, center)
      if (box.sub) s.line(box.sub, x + bw / 2, 22, 400, center)
    })
    s.y = top + h
  })
}

// Pruh sekcie: biely nadpis na čiernom, vpravo počet osôb. Keď sa názov
// a počet nezmestia na jeden riadok, počet ide na ďalší riadok (písmo sa nezmenšuje).
function drawSectionBar(s, sec, numbered, b) {
  const top = s.y
  const padX = 12
  const inner = b.w - 2 * padX
  const h = lineH(30)
  let title = `${numbered ? `${sec.block}. ` : ''}${sec.title}`.toLocaleUpperCase('sk')
  if (sec.special) title = `! ${title} !`
  const count = sec.count != null ? `${sec.count} os.` : ''
  const countW = count ? s.width(count, 30, 700) : 0
  const lines = s.wrap([{ text: title, weight: 700 }], inner, 30)
  const sameLine = lines.length === 1 && (!count || lines[0].w + 16 + countW <= inner)
  const rows = lines.length + (count && !sameLine ? 1 : 0)
  const white = { color: '#fff' }
  s.rect(b.x, top, b.w, rows * h + 10)
  lines.forEach((ln, i) => {
    const bl = s.base(top + 5 + i * h, h, 30, 700)
    for (const wd of ln.words) s.text(wd.text, b.x + padX + wd.x, bl, 30, 700, white)
  })
  if (count) {
    const row = sameLine ? 0 : lines.length
    s.text(count, b.x + b.w - padX, s.base(top + 5 + row * h, h, 30, 700), 30, 700, { ...white, align: 'right' })
  }
  s.y = top + rows * h + 10
}

// Položka: vľavo názov (zalamuje sa, nezasahuje do stĺpca množstva), vpravo
// množstvo spolu; pod názvom porcia na osobu a pri polievke jej zložky.
// inlineMeta: porcia a rozpis súčtu hneď za názvom (keď sa tam zmestia)
function drawItem(s, it, L, R, { inlineMeta = false } = {}) {
  s.y += 10
  const top = s.y
  const qtyW = it.total ? Math.ceil(s.width(it.total, 38, 700)) : 0
  // Podiel porcie: čierny štvorček s bielym „½" (pri 3+ položkách „1/3"…);
  // znak ½ má v písme drobné číslice, preto väčšie písmo
  const badge = it.split ? (it.split === 2 ? '½' : `1/${it.split}`) : ''
  const badgeSize = it.split === 2 ? 34 : 24
  const badgeW = badge ? Math.max(36, Math.ceil(s.width(badge, badgeSize, 700)) + 10) : 0
  const x = L + (badge ? badgeW + 10 : 0)
  const nameH = lineH(32)
  const lines = s.wrap([{ text: it.name, weight: 600 }], R - x - (qtyW ? qtyW + 16 : 0), 32)
  // Prvý riadok: názov a množstvo na spoločnom účiarí
  const row1 = it.total ? Math.max(nameH, lineH(38)) : nameH
  const b1 = it.total ? s.base(top, row1, 38, 700) : s.base(top, row1, 32, 600)
  let lastBase = b1
  lines.forEach((ln, i) => {
    const b = i === 0 ? b1 : s.base(top + row1 + (i - 1) * nameH, nameH, 32, 600)
    s.text(ln.words.map(wd => wd.text).join(' '), x, b, 32, 600)
    lastBase = b
  })
  if (it.total) s.text(it.total, R, b1, 38, 700, { align: 'right' })
  if (badge) {
    const by = Math.round(b1 - s.cap(32, 600) / 2 - 18)
    s.rect(L, by, badgeW, 36)
    s.text(badge, L + badgeW / 2, s.inkBase(by, 36, badge, badgeSize, 700), badgeSize, 700,
      { color: '#fff', align: 'center' })
  }
  s.y = top + row1 + (lines.length - 1) * nameH

  const portion = it.portion ? `${it.portion} / os.${it.portionNote ? ` (${it.portionNote})` : ''}` : ''
  // Za názvom: „0,33 L / os.  |  dospelí 14,19 L (43 os.) + deti 1,32 L (4 os.)"
  // na účiarí posledného riadku názvu (prvý riadok končí pred množstvom)
  let inline = false
  const meta = [portion, it.breakdown].filter(Boolean)
  if (inlineMeta && meta.length) {
    const last = lines[lines.length - 1]
    const gap = 16
    const sepW = gap + s.width('|', 24, 400) + gap
    const widths = meta.map(t => s.width(t, 24, 400))
    const metaW = widths.reduce((a, b) => a + b, 0) + (meta.length - 1) * sepW
    let mx = x + Math.ceil(last.w) + 24
    const maxX = lines.length === 1 && qtyW ? R - qtyW - 16 : R
    if (mx + metaW <= maxX) {
      inline = true
      meta.forEach((t, i) => {
        if (i > 0) {
          s.text('|', mx + gap, lastBase, 24, 400)
          mx += sepW
        }
        s.text(t, mx, lastBase, 24, 400)
        mx += widths[i]
      })
    }
  }
  if (!inline) {
    if (portion) s.para([{ text: portion, weight: 400 }], x, R - x, 24)
    // Rozpis súčtu polievky (dospelí + deti) tak, ako ho ukazuje admin
    if (it.breakdown) s.para([{ text: it.breakdown, weight: 400 }], x, R - x, 24)
  }

  // Zložky polievky: odsadené, vľavo názov s porciou, vpravo súčet
  for (const p of it.parts) {
    const px = x + 24
    const totalW = Math.ceil(s.width(p.total, 26, 700))
    const plines = s.wrap([{ text: `– ${p.name} (${p.portion} / os.)`, weight: 400 }], R - px - totalW - 16, 24)
    const h = Math.max(lineH(24), lineH(26))
    const b = s.base(s.y, h, 26, 700)
    s.text(p.total, R, b, 26, 700, { align: 'right' })
    plines.forEach((ln, i) => {
      const lb = i === 0 ? b : s.base(s.y + h + (i - 1) * lineH(24), lineH(24), 24, 400)
      s.text(ln.words.map(wd => wd.text).join(' '), px, lb, 24, 400)
    })
    s.y += h + (plines.length - 1) * lineH(24)
  }
  s.y += 10
}

// Sekcia: pruh + položky oddelené čiarou 2 px. Špeciály sú celé v rámčeku
// 4 px a pod položkami majú požiadavky ku strave, hlavné jedlo a raut poznámky.
// itemOpts: voľby pre drawItem (napr. inlineMeta)
function drawSection(s, sec, numbered, b, itemOpts) {
  const top = s.y
  const pad = sec.special ? 14 : 0
  const L = b.x + pad
  const R = b.x + b.w - pad
  drawSectionBar(s, sec, numbered, b)
  sec.items.forEach((it, i) => {
    if (i > 0) { s.rect(L, s.y, R - L, 2); s.y += 2 }
    drawItem(s, it, L, R, itemOpts)
  })
  if (sec.notes) {
    if (sec.items.length) { s.rect(L, s.y, R - L, 2); s.y += 2 }
    s.y += 8
    s.line(sec.special ? 'Požiadavky:' : 'Poznámky:', L, 24, 400)
    s.para([{ text: sec.notes, weight: 700 }], L, R - L, 30)
    s.y += 6
  }
  if (sec.special) {
    s.y += 8
    s.frame(b.x, top, b.w, s.y - top, 4)
  }
}

// „Vytlačené: d. m. rrrr hh:mm"
function printedText(at) {
  const p = n => String(n).padStart(2, '0')
  return `Vytlačené: ${at.getDate()}. ${at.getMonth() + 1}. ${at.getFullYear()} ${p(at.getHours())}:${p(at.getMinutes())}`
}

function drawPrinted(s, at, b) {
  s.line(printedText(at), b.x + b.w, 22, 400, { align: 'right' })
}

// Box POZNÁMKY — vždy na konci termo lístka 1: poznámky k akcii + bodkované
// riadky na ručné dopisovanie (bodky 3 px s medzerou 6 px, riadky po 64 px = 8 mm)
// printedAt = „Vytlačené" vpravo hore v rámčeku, na riadku s nadpisom
function drawNotes(s, notes, b, lines, printedAt) {
  const top = s.y
  const L = b.x + 16
  const R = b.x + b.w - 16
  s.y += 12
  if (printedAt) s.text(printedText(printedAt), R, s.base(s.y, lineH(26), 26, 700), 22, 400, { align: 'right' })
  s.line('POZNÁMKY', L, 26, 700)
  if (notes) s.para([{ text: notes, weight: 700 }], L, R - L, 28)
  for (let i = 0; i < lines; i++) {
    s.y += 64
    for (let x = L; x + 3 <= R; x += 9) s.rect(x, s.y - 1, 3, 3)
  }
  s.y += 24
  s.frame(b.x, top, b.w, s.y - top, 4)
}

// Písmo adminu (na Androide Roboto), až keď je načítané
async function ticketFont() {
  await document.fonts.ready
  const body = getComputedStyle(document.body).fontFamily
  return `${body ? `${body}, ` : ''}Roboto, sans-serif`
}

// Vykreslí lístky: [kuchyňa] alebo [kuchyňa, studená kuchyňa]
export async function renderKitchenTickets(model) {
  const family = await ticketFont()

  // Lístok 1 — kuchyňa
  const s = new Sheet(family)
  drawHeader(s, model, THERMAL, { hall: model.hallShort })
  drawTitle(s, model, THERMAL)
  s.y += 4
  for (const t of model.toasts) drawLabeled(s, t.label, t.names.join(', '), 30, THERMAL)
  s.y += 16
  drawCounts(s, model.counts, model.hasRaut, THERMAL)
  s.y += 24
  for (const sec of model.sections) {
    drawSection(s, sec, true, THERMAL)
    s.y += 20
  }
  drawNotes(s, model.notes, THERMAL, 1, model.printedAt)
  s.y += 40
  const tickets = [s.paint()]

  // Lístok 2 — studená kuchyňa za rezom (len keď má položky)
  if (model.cold) {
    const c = new Sheet(family)
    drawHeader(c, model, THERMAL, { hall: model.hallShort })
    drawTitle(c, model, THERMAL)
    c.y += 16
    drawSection(c, model.cold, false, THERMAL)
    c.y += 20
    drawPrinted(c, model.printedAt, THERMAL)
    c.y += 40
    tickets.push(c.paint())
  }
  return tickets
}

// Vykreslí zhrnutie pre zákazníka: [lístok] (okienko na čas len pri vyplnenom čase)
export async function renderSummaryTicket(model) {
  const s = new Sheet(await ticketFont())
  drawHeader(s, model, THERMAL, { timeBox: false })
  drawTitle(s, model, THERMAL)
  s.y += 4
  if (model.hall) drawLabeled(s, 'Sála', model.hall, 26, THERMAL)
  s.y += 20
  for (const sec of model.sections) {
    drawSection(s, sec, true, THERMAL)
    s.y += 20
  }
  drawPrinted(s, model.printedAt, THERMAL)
  s.y += 40
  return [s.paint()]
}

// ── Štítky na plechy rautu (termo) ───────────────────────────────────────
// Každá vybratá položka rautu a príloh pre raut = samostatný štítok, medzi
// štítkami rez. Názov kapitálkami, veľkým písmom ako sála v hlavičke; za ním
// množstvo z kalkulácie polovičným písmom.
const LABEL_SIZE   = 64 // ako veľký nápis sály v hlavičke
const LABEL_TOP    = 32 // voľné miesto nad textom
const LABEL_BOTTOM = 8  // pod textom len málo — tlačiareň pred rezom ešte posúva papier

export function buildRautLabels({ sections, selsByCat, summary }) {
  return {
    date: summary.ticket?.date ?? '',
    labels: sections
      .filter(sec => RAUT_BLOCKS.includes(sec.block))
      .flatMap(sec => sec.items.map(({ sel, cat }) => ({
        text: selLabel(sel).toLocaleUpperCase('sk'),
        // rovnaké množstvo ako v kalkulácii (raut: naklikané kg)
        qty: calcLine(sel, cat, selsByCat?.[cat.id] ?? [], calcCount(summary, sec.block, cat)).mnozstvo,
      }))),
  }
}

// Vykreslí štítky: [štítok, štítok, …] — dlhý text sa zalamuje a štítok rastie;
// slovo dlhšie ako riadok sa radšej zmenší, než by sa delilo po písmenách.
// Množstvo ide za posledné slovo, a keď sa tam nezmestí, na samostatný riadok.
export async function renderRautLabels(model) {
  const family = await ticketFont()
  return model.labels.map(({ text, qty }) => {
    const s = new Sheet(family)
    let size = LABEL_SIZE
    while (size > 36 && text.split(/\s+/).some(w => s.width(w, size, 700) > CW)) size -= 2
    const qtySize = Math.round(size / 2)
    const gap = s.width(' ', size, 700)
    const qtyW = qty ? s.width(qty, qtySize, 700) : 0
    const lines = s.wrap([{ text, weight: 700 }], CW, size).map(ln => ({
      text: ln.words.map(wd => wd.text).join(' '),
      w: ln.w,
    }))
    const last = lines[lines.length - 1]
    const qtyInline = qty && last.w + gap + qtyW <= CW
    s.y = LABEL_TOP
    lines.forEach(ln => {
      const base = s.base(s.y, lineH(size), size, 700)
      if (ln === last && qtyInline) {
        // posledný riadok + množstvo spolu vycentrované, na spoločnom účiarí
        const x = W / 2 - (ln.w + gap + qtyW) / 2
        s.text(ln.text, x, base, size, 700)
        s.text(qty, x + ln.w + gap, base, qtySize, 700)
      } else {
        s.text(ln.text, W / 2, base, size, 700, { align: 'center' })
      }
      s.y += lineH(size)
    })
    if (qty && !qtyInline) {
      s.text(qty, W / 2, s.base(s.y, lineH(qtySize), qtySize, 700), qtySize, 700, { align: 'center' })
      s.y += lineH(qtySize)
    }
    s.y += LABEL_BOTTOM
    return s.paint()
  })
}

// ── Sumár jedál za vybraté dni (dashboard) ───────────────────────────────
// Každá akcia sa prepočíta ako jej lístok do kuchyne (buildKitchenTicket);
// rovnaké položky (kľúč = položka katalógu + variant) sa v rámci sekcie sčítajú.
// Akcie bez menu sa len vypíšu a do súčtov sa nerátajú. Tlačí sa na A4
// (daySummaryA4Html v utils/a4Print).

const round2 = n => Math.round(n * 100) / 100
const qtyText = (amount, unit) => `${fmtQty(round2(amount))}${unit ? ` ${unit}` : ''}`

// Krátky dátum „Sob 10. 10."
const shortDate = iso => {
  const d = new Date(`${iso}T00:00:00`)
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`
}

// dates:  vybraté dni (ISO), events: [{ hallShort, date, time, title, model }]
//         — model = lístok do kuchyne akcie, null = akcia bez menu
export function buildDaySummary(dates, events) {
  const days = [...dates].sort()
  const multiDay = days.length > 1
  // Označenie akcie: sála, pri viacerých dňoch aj deň; najkratšie, ktoré akciu
  // ešte jednoznačne určí (deň v týždni → dátum → + čas)
  const dayName = e => DAYS_SHORT[new Date(`${e.date}T00:00:00`).getDay()]
  const variants = [
    e => `${multiDay ? `${dayName(e)} ` : ''}${e.hallShort}`,
    e => `${multiDay ? `${shortDate(e.date)} ` : ''}${e.hallShort}`,
    e => `${multiDay ? `${shortDate(e.date)} ` : ''}${e.hallShort}${e.time ? ` ${e.time}` : ''}`,
  ]
  const label = e => {
    const f = variants.find(v => events.filter(x => v(x) === v(e)).length === 1) ?? variants[2]
    return f(e)
  }
  // V zozname akcií vždy aj dátum (pri viacerých dňoch)
  const fullLabel = e => {
    const f = variants.slice(1).find(v => events.filter(x => v(x) === v(e)).length === 1) ?? variants[2]
    return f(e)
  }

  const withMenu = events.filter(e => e.model)
  const counts = { adults: 0, adultsNoMeal: 0, kidsMeal: 0, kidsNoMeal: 0, specials: 0, raut: 0, rautExtra: 0 }
  for (const e of withMenu) {
    for (const k of Object.keys(counts)) {
      if (k.startsWith('raut') && !e.model.hasRaut) continue
      counts[k] += e.model.counts?.[k] ?? 0
    }
  }

  // Prípitky: súčet ks podľa položky
  const toasts = new Map()  // označenie prípitku → Map(kľúč → { name, amount, unit })
  for (const e of withMenu) {
    for (const t of e.model.toasts) {
      if (!toasts.has(t.label)) toasts.set(t.label, new Map())
      for (const l of t.lines) {
        const m = toasts.get(t.label)
        const a = m.get(l.key) ?? { name: l.name, amount: null, unit: l.unit }
        if (l.amount != null) a.amount = (a.amount ?? 0) + l.amount
        m.set(l.key, a)
      }
    }
  }

  // Sekcie: blok → položky sčítané podľa kľúča
  const blocks = new Map()
  for (const e of withMenu) {
    for (const sec of e.model.sections) {
      let b = blocks.get(sec.block)
      if (!b) {
        b = { block: sec.block, title: sec.title, count: null, special: sec.special, notes: [], items: new Map() }
        blocks.set(sec.block, b)
      }
      if (sec.count != null) b.count = (b.count ?? 0) + sec.count
      if (sec.notes) b.notes.push(`${label(e)}: ${sec.notes}`)
      for (const it of sec.items) {
        const a = b.items.get(it.key) ?? { name: it.name, unit: it.unit, amount: null, people: 0, from: [] }
        if (it.amount != null) a.amount = (a.amount ?? 0) + it.amount
        a.people += it.people ?? 0
        a.from.push(`${label(e)}${it.total ? ` ${it.total}` : ''}`)
        b.items.set(it.key, a)
      }
    }
  }

  return {
    date: days[0] ?? '',
    days,
    events: events.map(e => ({ label: fullLabel(e), time: e.time, title: e.title, counts: e.model?.counts, hasMenu: !!e.model, hasRaut: !!e.model?.hasRaut })),
    counts,
    hasRaut: withMenu.some(e => e.model.hasRaut),
    toasts: [...toasts].map(([lbl, m]) => ({
      label: lbl,
      text: [...m.values()].map(a => `${a.name}${a.amount != null ? ` ${qtyText(a.amount, a.unit)}` : ''}`).join(', '),
    })).filter(t => t.text),
    sections: [...blocks.values()].sort((a, b) => a.block - b.block).map(b => ({
      block:   b.block,
      title:   b.title,
      count:   b.count,
      special: b.special,
      notes:   b.notes.join('\n'),
      items: [...b.items.values()].map(a => ({
        name:      a.name,
        split:     null,
        portion:   null,
        total:     a.amount != null ? qtyText(a.amount, a.unit) : null,
        // z ktorých akcií (pri viacerých akciách)
        breakdown: events.length > 1 ? a.from.join(' + ') : null,
        parts:     b.block === 0 && a.people > 0 ? soupParts(a.people) : [],
      })),
    })),
    printedAt: new Date(),
  }
}

// ── Kuchyňa na A5 (BOLD PNG a LUNA A5) ───────────────────────────────────
// Ten istý lístok do kuchyne na stranu A5 na výšku (LUNA A5 = ľavá polovica
// A4 na šírku). Písmo má vždy rovnakú veľkosť: rozloženie je v bodoch termo
// lístka s pevnou šírkou stĺpca. Čo sa na stranu nezmestí, pokračuje na
// ďalšej strane A5 — písmo sa nikdy nezmenšuje.
const A5_MM      = { w: 148, h: 210 }    // A5 na výšku
const A5_MARGIN  = 5                     // úzke okraje strany v mm
const A5_PX_MM   = 300 / 25.4            // PNG v 300 dpi
const A5_GAP     = 24                    // medzera medzi stĺpcami (body termo lístka)
const A5_COL     = 736                   // šírka stĺpca v bodoch = pevná veľkosť písma (menu z nástenky sa zmestí s rezervou ~12 mm)
const A5_CONTENT = 2 * A5_COL + A5_GAP
const A5_PT_MM   = A5_CONTENT / (A5_MM.w - 2 * A5_MARGIN)  // bodov na mm
// Sekcie v dvoch stĺpcoch (podľa lístka na nástenke): vľavo hlavné jedlo
// dospelí, vpravo deti a pod nimi špeciál; vľavo raut, vpravo prílohy pre
// raut a pod nimi studená kuchyňa. Bez ľavej sekcie ide doľava prvá z pravých.
// Sekcia bez dvojice ide cez celú šírku — okrem špeciálu, ten ostáva v ľavom
// stĺpci. Polievka a nové bloky cez celú šírku.
const A5_COLUMNS = [
  { left: [1], right: [2, SPECIAL_BLOCK] },
  { left: [4], right: [5, COLD_BLOCK] },
]

// POZNÁMKY na A5: jeden riadok bez rámčeka — „Poznámky:" a poznámka akcie
// (dlhá sa zalomí), za ňou bodky na dopísanie, vpravo „Vytlačené"
function drawNotesLine(s, notes, b, printedAt) {
  const L = b.x
  const printed = printedText(printedAt)
  const R = b.x + b.w - Math.ceil(s.width(printed, 22, 400)) - 24  // koniec textu a bodiek
  const h = lineH(26)
  const lines = s.wrap([{ text: 'Poznámky:', weight: 400 }, { text: notes, weight: 700 }], R - L, 26)
  s.y += 20  // miesto na písanie nad bodkami
  lines.forEach((ln, i) => {
    const bl = s.base(s.y, h, 26, 700)
    if (i === 0) s.text(printed, b.x + b.w, bl, 22, 400, { align: 'right' })
    for (const wd of ln.words) s.text(wd.text, L + wd.x, bl, 26, wd.weight)
    // bodky na dopísanie — len keď je na ne za textom aspoň kúsok miesta
    const dots = L + Math.ceil(ln.w) + 16
    if (i === lines.length - 1 && R - dots >= 64) {
      for (let x = dots; x + 3 <= R; x += 9) s.rect(x, bl + 1, 3, 3)
    }
    s.y += h
  })
}

// Prípitky na A5 v jednom riadku: „Prípitok: Prosecco  |  Prípitok deti: …";
// keď sa nezmestia, každý na samostatnom riadku ako na termo lístku
function drawToastsLine(s, toasts, b, size) {
  const gap = 24
  const sepW = gap + s.width('|', size, 400) + gap
  const parts = toasts.map(t => {
    const label = `${t.label}:`
    const value = t.names.join(', ')
    const lw = s.width(label, size, 400) + s.width(' ', size, 700)
    return { label, value, lw, w: lw + s.width(value, size, 700) }
  })
  if (parts.reduce((n, p) => n + p.w, 0) + (parts.length - 1) * sepW > b.w) {
    for (const t of toasts) drawLabeled(s, t.label, t.names.join(', '), size, b)
    return
  }
  const h = lineH(size)
  const bl = s.base(s.y, h, size, 700)
  let x = b.x
  parts.forEach((p, i) => {
    if (i > 0) {
      s.text('|', x + gap, bl, size, 400)
      x += sepW
    }
    s.text(p.label, x, bl, size, 400)
    s.text(p.value, x + p.lw, bl, size, 700)
    x += p.w
  })
  s.y += h
}

// Riadky strany A5, každý vo vlastnom hárku od y = 0: [{ s, gap, bottom }]
// (gap = medzera nad riadkom, na začiatku strany sa vynechá; bottom = pri
// jednej strane úplne dole — POZNÁMKY)
function a5Rows(family, model) {
  const full  = { x: 0, w: A5_CONTENT }
  const left  = { x: 0, w: A5_COL }
  const right = { x: A5_COL + A5_GAP, w: A5_COL }
  const rows = []
  const row = (gap, draw, opts) => {
    const s = new Sheet(family)
    draw(s)
    rows.push({ s, gap, ...opts })
  }
  const column = (s, secs, b) => secs.forEach((sec, i) => {
    if (i > 0) s.y += 20
    drawSection(s, sec, true, b)
  })

  row(0, s => {
    drawHeader(s, model, full, { hall: model.hallShort, inline: true })
    drawTitle(s, model, full)
    s.y += 4
    if (model.toasts.length) drawToastsLine(s, model.toasts, full, 30)
    s.y += 16
    drawCounts(s, model.counts, model.hasRaut, full, 4)
  })

  const byBlock = new Map(model.sections.map(sec => [sec.block, sec]))
  const done = new Set()
  model.sections.forEach((sec, i) => {
    if (done.has(sec.block)) return
    const gap = i === 0 ? 24 : 20
    const group = A5_COLUMNS.find(g => [...g.left, ...g.right].includes(sec.block))
    if (!group) {
      // polievka: porcia a rozpis dospelí + deti hneď za názvom
      row(gap, s => drawSection(s, sec, true, full, { inlineMeta: sec.block === 0 }))
      return
    }
    let l = group.left.map(b => byBlock.get(b)).filter(Boolean)
    let r = group.right.map(b => byBlock.get(b)).filter(Boolean)
    for (const x of [...l, ...r]) done.add(x.block)
    if (!l.length) {
      l = r.slice(0, 1)
      r = r.slice(1)
    }
    if (!r.length) {
      row(gap, s => drawSection(s, l[0], true, l[0].special ? left : full))
      return
    }
    row(gap, s => {
      column(s, l, left)
      const y1 = s.y
      s.y = 0
      column(s, r, right)
      s.y = Math.max(y1, s.y)
    })
  })

  row(20, s => drawNotesLine(s, model.notes, full, model.printedAt), { bottom: true })
  return rows
}

// Najnižšie miesto (≤ maxY), kde sa dá riadok rozdeliť medzi dve strany bez
// prerezania textu či pruhu — zvislé čiary rámčekov sa prerezať môžu.
// 0 = také miesto nie je.
function safeCut(s, maxY) {
  const spans = s.ops
    .filter(o => !(o.op === 'rect' && o.w <= 4 && o.h > 8))
    .map(o => (o.op === 'rect' ? [o.y, o.y + o.h] : [o.y - o.size, o.y + o.size * 0.3]))
  let cut = 0
  for (const [, y] of spans) {
    if (y > cut && y <= maxY && !spans.some(([t, b]) => t < y && y < b)) cut = y
  }
  return cut
}

// Rozdelí hárok na mieste cut: [príkazy nad ním, hárok pod ním od y = 0]
function splitSheet(s, cut) {
  const head = new Sheet(s.family)
  const tail = new Sheet(s.family)
  for (const o of s.ops) {
    const top = o.op === 'rect' ? o.y : o.y - o.size
    if (o.op === 'rect' && o.y < cut && o.y + o.h > cut) {
      head.ops.push({ ...o, h: cut - o.y })
      tail.ops.push({ ...o, y: 0, h: o.y + o.h - cut })
    } else if (top < cut) {
      head.ops.push(o)
    } else {
      tail.ops.push({ ...o, y: o.y - cut })
    }
  }
  tail.y = s.y - cut
  return [head, tail]
}

// Rozloží riadky na strany A5 s výškou obsahu pageH (body). Riadok, ktorý sa
// nezmestí na zvyšok strany, ide celý na ďalšiu; vyšší ako celá strana sa
// rozdelí. pinBottom: riadok s bottom ide úplne dole na stranu (len keď je
// všetko na jednej strane). Strany 2+ začínajú pruhom so sálou, dátumom
// a názvom akcie.
function paginateA5(family, model, rows, pageH, pinBottom) {
  const d = model.date ? new Date(`${model.date}T00:00:00`) : null
  const contTitle = [model.hallShort, d && dmy(d), model.title].filter(Boolean).join(' · ')
  const continued = sheet => {
    drawSectionBar(sheet, { title: contTitle, count: null }, false, { x: 0, w: A5_CONTENT })
    sheet.y += 16
  }
  const probe = new Sheet(family)
  continued(probe)
  const contTop = probe.y  // kde začína obsah strany 2+

  const pages = []
  let page
  let pageTop = 0
  const newPage = () => {
    page = new Sheet(family)
    pages.push(page)
    if (pages.length > 1) continued(page)
    pageTop = page.y
  }
  newPage()
  for (const r of rows) {
    let s = r.s
    let top = page.y > pageTop ? page.y + r.gap : page.y
    if (top + s.y > pageH && page.y > pageTop && s.y <= pageH - contTop) {
      newPage()
      top = page.y
    }
    while (top + s.y > pageH) {
      let cut = safeCut(s, pageH - top)
      if (!cut && page.y > pageTop) {
        newPage()
        top = page.y
        continue
      }
      if (!cut) cut = pageH - top  // nič bezpečné — rez natvrdo
      const [head, tail] = splitSheet(s, cut)
      page.put(head, top)
      newPage()
      s = tail
      top = page.y
    }
    if (r.bottom && pinBottom) top = Math.max(top, pageH - s.y)
    page.put(s, top)
    page.y = top + s.y
  }
  return pages
}

// Strany A5 (hárky v bodoch, obsah od 0 bez okrajov); pri viacerých stranách
// je dole „strana 1/2 – pokračuje →"
function layoutA5(family, model) {
  const rows = a5Rows(family, model)
  const pageH = A5_MM.h * A5_PT_MM - 2 * A5_MARGIN * A5_PT_MM
  let pages = paginateA5(family, model, rows, pageH, true)
  if (pages.length > 1) {
    const footH = lineH(24) + 8
    pages = paginateA5(family, model, rows, pageH - footH, false)
    pages.forEach((p, i) => {
      const text = `strana ${i + 1}/${pages.length}${i < pages.length - 1 ? ' – pokračuje →' : ''}`
      p.text(text, A5_CONTENT, p.base(pageH - lineH(24), lineH(24), 24, 700), 24, 700, { align: 'right' })
    })
  }
  return pages
}

// Vykreslí kuchyňu na strany A5 (PNG 300 dpi, nie 1-bit): [strana, …] —
// väčšinou jedna, dlhé menu pokračuje na ďalšej
export async function renderKitchenA5(model) {
  const family = await ticketFont()
  const width  = Math.round(A5_MM.w * A5_PX_MM)
  const height = Math.round(A5_MM.h * A5_PX_MM)
  const scale  = width / (A5_MM.w * A5_PT_MM)
  return layoutA5(family, model).map(p =>
    p.paint({ width, height, scale, origin: A5_MARGIN * A5_PT_MM }))
}

// Stiahnutie plátna ako PNG
export function downloadPng(canvas, fileName) {
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
