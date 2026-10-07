// Hlasové zadanie menu — katalóg pre /api/parse-menu a plán zmien z odpovede.
// Katalóg ide na server s krátkymi kódmi (p1, v1…) namiesto UUID; späť na
// položky a varianty ich mapuje byRef (neznámy kód = jedlo sa nenašlo).
// Diktovanie len dopĺňa: nič nemaže a položku, ktorá už v menu je, nechá
// tak — doplní jej len nadiktované množstvo alebo chýbajúci variant.

import { BLOCK_TITLES, RAUT_BLOCKS } from './menuSummary'
import { fmtQty } from './menuCalc'
import { groupVariantsByItem, selCatId } from './menuVariants'

// Počty hostí: pole z /api/parse-menu = stĺpec v bookings → popis do zhrnutia
const GUEST_FIELDS = {
  guests_adults:         'Dospelí',
  guests_adults_no_meal: 'Dospelí bez jedla',
  guests_specials:       'Špeciály',
  guests_kids_meal:      'Deti s jedlom',
  guests_kids_no_meal:   'Deti bez jedla',
}

// „Položka – variant" (rovnaká pomlčka ako selLabel)
const label = (name, variantName) => (variantName ? `${name} – ${variantName}` : name)

// Predvolené množstvo pri pridaní položky — rovnako ako v MenuEditor
function defaultQty(cat) {
  if (cat.qty_step == null) return 1
  return Math.min(Math.max(1, Number(cat.qty_min)), Number(cat.qty_max))
}

// Nadiktované množstvo → krok a rozsah kategórie (ako ručné zadanie v MenuEditor)
function normalizeQty(cat, raw) {
  const step = Number(cat.qty_step)
  const min  = Number(cat.qty_min) > 0 ? Number(cat.qty_min) : step
  const max  = cat.qty_max != null ? Number(cat.qty_max) : Infinity
  const n = Math.min(Math.max(Math.round(raw / step) * step, min), max)
  return Math.round(n * 100) / 100
}

const qtyText = (cat, q) => `${fmtQty(q)}${cat.qty_unit ? ` ${cat.qty_unit}` : ''}`

// Katalóg pre /api/parse-menu (aktívne kategórie s položkami, v poradí menu)
// + byRef: kód → { item, cat, variantGroup } alebo { variant }
export function buildVoiceCatalog(categories, items, variants) {
  const variantsByItem = groupVariantsByItem(variants)
  const byRef = {}
  let p = 0
  let v = 0
  const catalog = []
  for (const cat of categories) {
    if (cat.archived_at) continue
    const catItems = items.filter(i => i.category_id === cat.id)
    if (!catItems.length) continue
    catalog.push({
      block:      cat.block,
      blockTitle: BLOCK_TITLES[cat.block] ?? null,
      name:       cat.name,
      qty:        cat.qty_step != null,
      unit:       cat.qty_unit || null,
      items: catItems.map(item => {
        const ref = `p${++p}`
        // Položka so zapnutými variantmi, ale bez možností variant nevyžaduje (needsVariant)
        const opts = item.has_variants ? (variantsByItem[item.id] ?? []) : []
        const group = opts.length ? (item.variant_group_name?.trim() || 'variant') : null
        byRef[ref] = { item, cat, variantGroup: group }
        return {
          ref,
          name: item.name,
          group,
          variants: opts.map(opt => {
            const vref = `v${++v}`
            byRef[vref] = { variant: opt }
            return { ref: vref, name: opt.name }
          }),
        }
      }),
    })
  }
  return { catalog, byRef }
}

// Plán zmien z odpovede /api/parse-menu.
// selections: doterajšie výbery menu (pri vytváraní menu prázdne pole)
// booking:    { notes, raut_enabled } z bookings
// Vracia inserts (riadky booking_menu_items bez booking_id), updates ({ id, patch }),
// bookingPatch (stĺpce bookings), summary (do zhrnutia; položky ako { text, note },
// note = kategória alebo dôvod) a recognized — false = z nahrávky sa nedalo použiť nič.
export function planVoiceMenu(parsed, { byRef, selections, booking }) {
  const inserts = []
  const updates = []
  const bookingPatch = {}
  const summary = {
    added: [], updated: [], already: [], missingVariant: [],
    unmatched: [], overLimit: [], guests: [], notes: null, raut: null,
    transcript: parsed.transcript ?? '',
  }

  const catCount = {}
  for (const sel of selections) catCount[selCatId(sel)] = (catCount[selCatId(sel)] ?? 0) + 1
  const seen = new Set()
  let touchesRaut = false

  for (const it of parsed.items ?? []) {
    const hit = byRef[it.ref]
    if (!hit?.item) {
      if (it.heard) summary.unmatched.push(it.heard)
      continue
    }
    const { item, cat, variantGroup } = hit
    if (seen.has(item.id)) continue
    seen.add(item.id)

    // Variant len z možností tej istej položky
    const opt = it.variant ? byRef[it.variant]?.variant : null
    const variant = opt && opt.item_id === item.id ? opt : null
    const qty = cat.qty_step != null && Number(it.quantity) > 0
      ? normalizeQty(cat, Number(it.quantity))
      : null

    // Už v menu → doplň len množstvo / chýbajúci variant
    const existing = selections.find(s => s.item_id === item.id)
    if (existing) {
      const patch = {}
      if (qty != null && qty !== Number(existing.quantity)) patch.quantity = qty
      if (variant && !existing.variant_id) {
        patch.variant_id   = variant.id
        patch.variant_name = variant.name
      }
      const name = label(item.name, patch.variant_name ?? existing.variant?.name ?? existing.variant_name)
      if (Object.keys(patch).length) {
        updates.push({ id: existing.id, patch })
        summary.updated.push({
          text: patch.quantity != null ? `${name} — ${qtyText(cat, qty)}` : name,
          note: cat.name,
        })
        if (RAUT_BLOCKS.includes(cat.block)) touchesRaut = true
      } else {
        summary.already.push({ text: name, note: cat.name })
      }
      continue
    }

    // Limit kategórie (ako v okne výberu) — čo sa nezmestí, preskočí sa
    if (cat.max_items != null && (catCount[cat.id] ?? 0) >= cat.max_items) {
      summary.overLimit.push({ text: label(item.name, variant?.name), note: `${cat.name}: najviac ${cat.max_items}` })
      continue
    }
    catCount[cat.id] = (catCount[cat.id] ?? 0) + 1

    inserts.push({
      category_id:  cat.id,
      item_id:      item.id,
      item_name:    item.name,
      quantity:     qty ?? defaultQty(cat),
      variant_id:   variant?.id ?? null,
      variant_name: variant?.name ?? null,
    })
    const name = label(item.name, variant?.name)
    summary.added.push({ text: qty != null ? `${name} — ${qtyText(cat, qty)}` : name, note: cat.name })
    if (!variant && variantGroup) {
      summary.missingVariant.push({ text: item.name, note: `chýba ${variantGroup.toLowerCase()}` })
    }
    if (RAUT_BLOCKS.includes(cat.block)) touchesRaut = true
  }

  // Nenájdené jedlá bez duplicít
  const missing = new Map()
  for (const name of [...summary.unmatched, ...(parsed.unmatched ?? [])]) {
    const key = name.trim().toLowerCase()
    if (key && !missing.has(key)) missing.set(key, name.trim())
  }
  summary.unmatched = [...missing.values()]

  // Počty hostí — 0 sa berie ako „nezaznelo" (prázdne a 0 počítajú rovnako
  // a omylom vrátená 0 by prepísala skôr nadiktovaný počet)
  for (const [field, text] of Object.entries(GUEST_FIELDS)) {
    const n = Math.round(Number(parsed[field]))
    if (parsed[field] == null || !Number.isFinite(n) || n <= 0 || n > 5000) continue
    bookingPatch[field] = n
    summary.guests.push(`${text} ${n}`)
  }
  const extra = Math.round(Number(parsed.raut_extra))
  if (parsed.raut_extra != null && Number.isFinite(extra) && extra !== 0 && Math.abs(extra) <= 1000) {
    bookingPatch.raut_extra = extra
    summary.guests.push(`Raut navyše/menej ${extra > 0 ? '+' : ''}${extra}`)
  }
  const grams = Math.round(Number(parsed.raut_grams))
  if (parsed.raut_grams != null && Number.isFinite(grams) && grams > 0 && grams <= 2000) {
    bookingPatch.raut_grams = grams
    summary.guests.push(`Gramáž rautu ${grams} g`)
  }

  // Požiadavky ku strave sa pripájajú k doterajším (diktovanie po častiach)
  const notes = typeof parsed.notes === 'string' ? parsed.notes.trim() : ''
  if (notes) {
    const current = (booking.notes ?? '').trim()
    if (!current.toLowerCase().includes(notes.toLowerCase())) {
      bookingPatch.notes = current ? `${current.replace(/[\s.,;]+$/, '')}, ${notes}` : notes
      summary.notes = notes
    }
  }

  // Raut: výslovné „bez rautu" ho vypne; nadiktované rautové jedlá ho zapnú,
  // inak by sa pri vypnutom raute nezobrazili
  const rautOn = booking.raut_enabled ?? true
  if (parsed.raut_enabled === false) {
    if (rautOn) { bookingPatch.raut_enabled = false; summary.raut = 'off' }
  } else if (!rautOn && (parsed.raut_enabled === true || touchesRaut)) {
    bookingPatch.raut_enabled = true
    summary.raut = 'on'
  }

  const recognized = inserts.length > 0 || updates.length > 0 ||
    Object.keys(bookingPatch).length > 0 || summary.already.length > 0
  return { inserts, updates, bookingPatch, summary, recognized }
}
