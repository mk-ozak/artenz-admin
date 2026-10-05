// Lístky pre termotlačiareň (papier 80 mm, 576 bodov na riadok): do kuchyne
// a zhrnutie pre zákazníka. Model sa skladá z tých istých sekcií a výpočtov ako
// „Kalkulácia pre kuchyňu" (MenuEditor + lib/menuCalc), takže čísla sedia
// s adminom. Lístok sa kreslí
// cez Canvas 2D a do tlačiarne ide ako obrázok (utils/escpos) — textový režim
// tlačiarne má čínsku znakovú sadu a slovenskú diakritiku by rozsypal.
import { calcLine, fmtQty, sectionHeadCount } from '../lib/menuCalc'
import { selLabel } from '../lib/menuVariants'
import { DAYS_LONG } from './format'

// ── Rozpoznanie v katalógu ───────────────────────────────────────────────
// Kategórie podľa ID (menu_categories.id) — na názve kategórie ani položky
// nezáleží. Prípitky sa netlačia v sekciách, ale pod názvom akcie bez množstva.
const TOAST_CATEGORIES = [
  { id: 'e9d6904c-5fa5-464a-ab00-5fea29f52b49', label: 'Prípitok' },      // Prípitok
  { id: 'ca3b1eec-d8eb-4323-a227-d8171750d9aa', label: 'Prípitok deti' }, // Detský prípitok
]

// Polievka — na lístku ide zo sekcií (dospelí + automaticky deti) do bloku 0
// navrchu ako súčet; každá jej položka dostane zložky
const SOUP_CATEGORY = '3d7811c8-e75e-4e6e-a216-ae524365ad2c'
// Kto polievku v sekcii je — pre rozpis súčtu („dospelí 33 L + deti 3,63 L")
const SOUP_WHO = { 1: 'dospelí', 2: 'deti' }

// Zložky polievky v gramoch na osobu — len na lístku, nie na obrazovke ani v DB
const SOUP_PARTS = [
  { name: 'rezance',         grams: 20 },
  { name: 'mäso a zelenina', grams: 30 },
]

// Sekcie podľa čísla bloku (menu_categories.block; bloky nemajú ID ani názov)
const SPECIAL_BLOCK = 3 // Hlavné jedlo špeciál — rámček + požiadavky ku strave
const COLD_BLOCK    = 6 // Studená kuchyňa — aj samostatný lístok za rezom
const RAUT_BLOCKS   = [4, 5] // Raut + Prílohy pre raut — bez výberu sa rámček RAUT netlačí

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
  const specialNotes = (t.specialNotes ?? '').trim()
  const toastIds = new Set(TOAST_CATEGORIES.map(c => c.id))

  // Vyplnené požiadavky ku strave sa tlačia vždy — aj keď špeciály nemajú položky
  const secs = specialNotes && !sections.some(s => s.block === SPECIAL_BLOCK)
    ? [...sections, { block: SPECIAL_BLOCK, items: [] }].sort((a, b) => a.block - b.block)
    : sections

  const out = []
  const soups = new Map()  // polievka → riadky kalkulácie zo sekcií (dospelí, deti)
  for (const sec of secs) {
    // Počet v pruhu sekcie; násobí sa tým istým počtom ako na obrazovke
    const count = t.sectionCount?.[sec.block] ?? null
    const calcCount = summary.calc?.countByBlock?.[sec.block] ?? null
    const items = count === 0 ? [] : sec.items.flatMap(({ sel, cat }) => {
      if (toastIds.has(cat.id)) return []
      const line = calcLine(sel, cat, selsByCat[cat.id] ?? [], calcCount)
      if (cat.id === SOUP_CATEGORY) {
        if (!soups.has(sel.id)) soups.set(sel.id, { sel, cat, from: [] })
        soups.get(sel.id).from.push({ block: sec.block, title: sectionTitle(sec, summary), count: calcCount, line })
        return []
      }
      if (line.amount === 0) return []
      return [{
        name:    selLabel(sel),
        split:   line.split,     // podiel porcie (2 = ½), null = celá
        portion: line.jedn,      // porcia na osobu
        portionNote: line.jednNote,  // napr. „v hotovom stave" (ryža)
        total:   line.mnozstvo,  // množstvo spolu
        parts:   [],
      }]
    })
    const notes = sec.block === SPECIAL_BLOCK ? specialNotes : ''
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
  // admin (dospelí + deti), zložky pre súčet osôb
  let soupPeople = null
  const soupItems = [...soups.values()].flatMap(({ sel, cat, from }) => {
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
    notes:  (t.notes ?? '').trim(),
    counts: t.counts,
    // Raut nemusí byť vždy — rámček RAUT len keď je v jeho blokoch niečo vybraté
    hasRaut: sections.some(s => RAUT_BLOCKS.includes(s.block) && s.items.length),
    toasts: TOAST_CATEGORIES
      .map(c => ({ label: c.label, names: (selsByCat[c.id] ?? []).map(selLabel) }))
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
// Rozmery v px na plátne 576 px (1 px = 1 bod tlačiarne = 0,125 mm)
const W  = 576      // tlačová šírka 72 mm
const M  = 8        // okraj vľavo a vpravo
const CW = W - 2 * M
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
    this.ops.push({ op: 'text', text, x: Math.round(x), y, font: this.font(size, weight), color, align })
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

  // Plátno presnej výšky s nakreslenými príkazmi
  paint() {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = Math.ceil(this.y)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, W, canvas.height)
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

// Hlavička: čierny pruh, vľavo deň + dátum, vpravo biele okienko s časom
// (bez času ostane prázdne — dopíše sa ručne; timeBox: false = bez okienka)
function drawHeader(s, model, { timeBox = true } = {}) {
  const top = s.y
  const H = 124
  s.rect(M, top, CW, H)
  const bw = 230
  const bx = W - M - 12 - bw
  const by = top + 12
  const bh = H - 24
  if (model.time || timeBox) s.rect(bx, by, bw, bh, '#fff')
  if (model.time) {
    s.text(model.time, bx + bw / 2, s.base(by, bh, 72, 700), 72, 700, { align: 'center' })
  }
  if (model.date) {
    const d = new Date(`${model.date}T00:00:00`)
    const h1 = lineH(30)
    const h2 = lineH(40)
    const t1 = top + Math.round((H - h1 - h2) / 2)
    const white = { color: '#fff' }
    s.text(DAYS_LONG[d.getDay()].toLocaleUpperCase('sk'), M + 16, s.base(t1, h1, 30, 700), 30, 700, white)
    s.text(`${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`,
      M + 16, s.base(t1 + h1, h2, 40, 700), 40, 700, white)
  }
  s.y = top + H
}

function drawTitle(s, model) {
  if (!model.title) return
  s.y += 14
  s.para([{ text: model.title, weight: 700 }], M, CW, 46)
}

// „Prípitok: Prosecco" — popis regular, hodnota bold
function drawLabeled(s, label, value, size) {
  s.para([{ text: `${label}:`, weight: 400 }, { text: value, weight: 700 }], M, CW, size)
}

// Počty osôb: mriežka 2 × 2 rámčekov, zobrazujú sa vždy (aj s nulou);
// RAUT len pri akcii s rautom (hasRaut), inak ostane jeho miesto prázdne
function drawCounts(s, c, hasRaut) {
  const gap = 8
  const bw = (CW - gap) / 2
  const extra = n => (n > 0 ? `z toho +${n} navyše` : `z toho −${-n} menej`)
  const rows = [
    [
      { label: 'DOSPELÍ', n: c.adults,   sub: c.adultsNoMeal > 0 ? `+${c.adultsNoMeal} bez jedla` : '' },
      { label: 'DETI',    n: c.kidsMeal, sub: c.kidsNoMeal > 0 ? `+${c.kidsNoMeal} bez jedla` : '' },
    ],
    [
      { label: 'ŠPECIÁLY', n: c.specials, sub: '' },
      ...(hasRaut ? [{ label: 'RAUT', n: c.raut, sub: c.rautExtra ? extra(c.rautExtra) : '' }] : []),
    ],
  ]
  rows.forEach((row, ri) => {
    if (ri > 0) s.y += gap
    const top = s.y
    const h = 10 + lineH(22) + lineH(56) + (row.some(b => b.sub) ? lineH(22) : 0) + 12
    row.forEach((b, i) => {
      const x = M + i * (bw + gap)
      const center = { align: 'center' }
      s.frame(x, top, bw, h, 3)
      s.y = top + 10
      s.line(b.label, x + bw / 2, 22, 700, center)
      s.line(String(b.n), x + bw / 2, 56, 700, center)
      if (b.sub) s.line(b.sub, x + bw / 2, 22, 400, center)
    })
    s.y = top + h
  })
}

// Pruh sekcie: biely nadpis na čiernom, vpravo počet osôb. Keď sa názov
// a počet nezmestia na jeden riadok, počet ide na ďalší riadok (písmo sa nezmenšuje).
function drawSectionBar(s, sec, numbered) {
  const top = s.y
  const padX = 12
  const inner = CW - 2 * padX
  const h = lineH(30)
  let title = `${numbered ? `${sec.block}. ` : ''}${sec.title}`.toLocaleUpperCase('sk')
  if (sec.special) title = `! ${title} !`
  const count = sec.count != null ? `${sec.count} os.` : ''
  const countW = count ? s.width(count, 30, 700) : 0
  const lines = s.wrap([{ text: title, weight: 700 }], inner, 30)
  const sameLine = lines.length === 1 && (!count || lines[0].w + 16 + countW <= inner)
  const rows = lines.length + (count && !sameLine ? 1 : 0)
  const white = { color: '#fff' }
  s.rect(M, top, CW, rows * h + 10)
  lines.forEach((ln, i) => {
    const b = s.base(top + 5 + i * h, h, 30, 700)
    for (const wd of ln.words) s.text(wd.text, M + padX + wd.x, b, 30, 700, white)
  })
  if (count) {
    const row = sameLine ? 0 : lines.length
    s.text(count, W - M - padX, s.base(top + 5 + row * h, h, 30, 700), 30, 700, { ...white, align: 'right' })
  }
  s.y = top + rows * h + 10
}

// Položka: vľavo názov (zalamuje sa, nezasahuje do stĺpca množstva), vpravo
// množstvo spolu; pod názvom porcia na osobu a pri polievke jej zložky
function drawItem(s, it, L, R) {
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
  lines.forEach((ln, i) => {
    const b = i === 0 ? b1 : s.base(top + row1 + (i - 1) * nameH, nameH, 32, 600)
    s.text(ln.words.map(wd => wd.text).join(' '), x, b, 32, 600)
  })
  if (it.total) s.text(it.total, R, b1, 38, 700, { align: 'right' })
  if (badge) {
    const by = Math.round(b1 - s.cap(32, 600) / 2 - 18)
    s.rect(L, by, badgeW, 36)
    s.text(badge, L + badgeW / 2, s.inkBase(by, 36, badge, badgeSize, 700), badgeSize, 700,
      { color: '#fff', align: 'center' })
  }
  s.y = top + row1 + (lines.length - 1) * nameH

  if (it.portion) {
    const note = it.portionNote ? ` (${it.portionNote})` : ''
    s.para([{ text: `${it.portion} / os.${note}`, weight: 400 }], x, R - x, 24)
  }
  // Rozpis súčtu polievky (dospelí + deti) tak, ako ho ukazuje admin
  if (it.breakdown) s.para([{ text: it.breakdown, weight: 400 }], x, R - x, 24)

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
// 4 px a pod položkami majú požiadavky ku strave.
function drawSection(s, sec, numbered) {
  const top = s.y
  const pad = sec.special ? 14 : 0
  const L = M + pad
  const R = W - M - pad
  drawSectionBar(s, sec, numbered)
  sec.items.forEach((it, i) => {
    if (i > 0) { s.rect(L, s.y, R - L, 2); s.y += 2 }
    drawItem(s, it, L, R)
  })
  if (sec.notes) {
    if (sec.items.length) { s.rect(L, s.y, R - L, 2); s.y += 2 }
    s.y += 8
    s.line('Požiadavky:', L, 24, 400)
    s.para([{ text: sec.notes, weight: 700 }], L, R - L, 30)
    s.y += 6
  }
  if (sec.special) {
    s.y += 8
    s.frame(M, top, CW, s.y - top, 4)
  }
}

function drawPrinted(s, at) {
  const p = n => String(n).padStart(2, '0')
  const stamp = `${at.getDate()}. ${at.getMonth() + 1}. ${at.getFullYear()} ${p(at.getHours())}:${p(at.getMinutes())}`
  s.line(`Vytlačené: ${stamp}`, W - M, 22, 400, { align: 'right' })
}

// Box POZNÁMKY — vždy na konci lístka 1: poznámky k akcii + bodkované riadky
// na ručné dopisovanie (bodky 3 px s medzerou 6 px, riadky po 64 px = 8 mm)
function drawNotes(s, notes) {
  const top = s.y
  const L = M + 16
  const R = W - M - 16
  s.y += 12
  s.line('POZNÁMKY', L, 26, 700)
  if (notes) s.para([{ text: notes, weight: 700 }], L, R - L, 28)
  for (let i = 0; i < 4; i++) {
    s.y += 64
    for (let x = L; x + 3 <= R; x += 9) s.rect(x, s.y - 1, 3, 3)
  }
  s.y += 24
  s.frame(M, top, CW, s.y - top, 4)
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
  drawHeader(s, model)
  drawTitle(s, model)
  s.y += 4
  for (const t of model.toasts) drawLabeled(s, t.label, t.names.join(', '), 30)
  if (model.hall) drawLabeled(s, 'Sála', model.hall, 26)
  s.y += 16
  drawCounts(s, model.counts, model.hasRaut)
  s.y += 24
  for (const sec of model.sections) {
    drawSection(s, sec, true)
    s.y += 20
  }
  drawPrinted(s, model.printedAt)
  s.y += 12
  drawNotes(s, model.notes)
  s.y += 40
  const tickets = [s.paint()]

  // Lístok 2 — studená kuchyňa za rezom (len keď má položky)
  if (model.cold) {
    const c = new Sheet(family)
    drawHeader(c, model)
    drawTitle(c, model)
    c.y += 16
    drawSection(c, model.cold, false)
    c.y += 20
    drawPrinted(c, model.printedAt)
    c.y += 40
    tickets.push(c.paint())
  }
  return tickets
}

// Vykreslí zhrnutie pre zákazníka: [lístok] (okienko na čas len pri vyplnenom čase)
export async function renderSummaryTicket(model) {
  const s = new Sheet(await ticketFont())
  drawHeader(s, model, { timeBox: false })
  drawTitle(s, model)
  s.y += 4
  if (model.hall) drawLabeled(s, 'Sála', model.hall, 26)
  s.y += 20
  for (const sec of model.sections) {
    drawSection(s, sec, true)
    s.y += 20
  }
  drawPrinted(s, model.printedAt)
  s.y += 40
  return [s.paint()]
}
