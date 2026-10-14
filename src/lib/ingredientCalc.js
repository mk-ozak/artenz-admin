// Kalkulácia surovín na objednávanie — z lístkov do kuchyne vybratých akcií
// (buildKitchenTicket, tie isté množstvá ako sumár jedál) a receptúr položiek
// menu (Nastavenia → Menu → čiapka). Množstvo jedla v hotovom stave (served)
// / dávka receptúry × riadky receptúry; položky „sama surovinou" idú do skupiny
// Z MENU s množstvom z lístka. Čo sa spočítať nedá, ide do BEZ RECEPTÚRY alebo
// SKONTROLUJ — kuchyňa nesmie o nič prísť.

import { fmtQty } from './menuCalc'
import { dishUnitFactor, lineFactor } from './ingredients'

// Jedlá lístka akcie v poradí lístka: prípitky, potom položky sekcií (aj
// polievka v bloku 0)
const dishesOf = model => [
  ...model.toasts.flatMap(t => t.lines),
  ...model.sections.flatMap(s => s.items),
]

const round2 = n => Math.round(n * 100) / 100

// Množstvo jedla z lístka: „12,5 kg", bez množstva null
const dishQty = (amount, unit) => (amount != null ? `${fmtQty(round2(amount))}${unit ? ` ${unit}` : ''}` : null)

// Súčet suroviny v jej jednotke: pod 1 kg / 1 L v g / ml, ks nahor na celé
export function fmtIngredient(value, unit) {
  if (unit === 'ks') return `${Math.ceil(Math.round(value * 1000) / 1000)} ks`
  const milli = Math.round(value * 1000)
  if (milli < 1000) return `${Math.max(1, milli)} ${unit === 'L' ? 'ml' : 'g'}`
  return `${fmtQty(round2(value))} ${unit}`
}

// dates:  vybraté dni (ISO)
// events: [{ hallShort, date, time, title, model }] — model = lístok do kuchyne
//         akcie (buildKitchenTicket), null = akcia bez menu (nepočíta sa)
// recipes / lines / ingredients / categories: menu_item_recipes,
//         menu_item_recipe_lines, ingredients, ingredient_categories (aj vymazané)
export function buildIngredientSummary({ dates, events, recipes, lines, ingredients, categories }) {
  const recipeOf = new Map(recipes.map(r => [r.item_id, r]))
  const linesOf  = new Map()
  for (const l of lines) (linesOf.get(l.item_id) ?? linesOf.set(l.item_id, []).get(l.item_id)).push(l)
  const ingById  = new Map(ingredients.map(i => [i.id, i]))

  const totals   = new Map()  // ingredient_id → súčet v jednotke suroviny
  const fromMenu = new Map()  // položky „sama surovinou": kľúč → { name, amount, unit }
  const missing  = new Map()  // bez receptúry: kľúč → { name, amount, unit }
  const check    = new Map()  // skontroluj: kľúč → { name, reason }

  const addQty = (map, key, name, amount, unit) => {
    const k = `${key}|${unit ?? ''}`
    const a = map.get(k) ?? { name, amount: null, unit }
    if (amount != null) a.amount = (a.amount ?? 0) + amount
    map.set(k, a)
  }
  const addCheck = (name, reason) => check.set(`${name}|${reason}`, { name, reason })

  for (const e of events.filter(x => x.model)) {
    for (const d of dishesOf(e.model)) {
      const rec = d.itemId ? recipeOf.get(d.itemId) : null
      if (rec?.is_ingredient) {
        addQty(fromMenu, d.key, d.name, d.amount, d.unit)
        continue
      }
      const all = d.itemId ? linesOf.get(d.itemId) ?? [] : []
      const own = all.filter(l => !l.variant_id || l.variant_id === d.variantId)
      if (!own.length) {
        addQty(missing, d.key, d.itemId ? d.name : `${d.name} (vlastná)`, d.amount, d.unit)
        continue
      }
      if (d.served == null) {
        addCheck(d.name, 'v kalkulácii pre kuchyňu nemá množstvo')
        continue
      }
      // Množstvo jedla v jednotke dávky receptúry (g↔kg a ml↔L sa prepočíta)
      const yieldUnit = rec ? rec.yield_unit : d.unit
      const toYield = dishUnitFactor(d.unit, yieldUnit)
      if (toYield == null) {
        addCheck(d.name, `kalkulácia počíta v ${d.unit ?? 'kusoch bez jednotky'}, receptúra je na ${yieldUnit ?? 'bez jednotky'} — nezapočítané`)
        continue
      }
      const factor = (d.served * toYield) / Number(rec?.yield_amount ?? 1)
      for (const l of own) {
        const ing = ingById.get(l.ingredient_id)
        const lf = ing ? lineFactor(l.unit, ing.unit) : null
        if (lf == null) {
          addCheck(d.name, `${ing?.name ?? 'surovina'}: jednotka ${l.unit} nesedí so surovinou${ing ? ` (${ing.unit})` : ''} — nezapočítané`)
          continue
        }
        totals.set(ing.id, (totals.get(ing.id) ?? 0) + Number(l.amount) * lf * factor)
      }
      if (!d.variantId && all.some(l => l.variant_id)) {
        addCheck(d.name, 'nie je vybratý variant — započítaný len základ')
      }
    }
  }

  // Suroviny po kategóriách v poradí z Nastavení (vymazané kategórie na koniec)
  const catOrder = [...categories].sort((a, b) =>
    (a.archived_at ? 1 : 0) - (b.archived_at ? 1 : 0) || a.position - b.position)
  const groups = catOrder
    .map(c => ({
      name: c.name,
      rows: ingredients
        .filter(i => i.category_id === c.id && totals.get(i.id) > 0)
        .sort((a, b) => a.position - b.position)
        .map(i => ({ name: i.name, total: fmtIngredient(totals.get(i.id), i.unit) })),
    }))
    .filter(g => g.rows.length)

  return {
    days: [...dates].sort(),
    events: events.map(e => ({
      date: e.date, hallShort: e.hallShort, time: e.time, title: e.title,
      hasMenu: !!e.model, hasRaut: !!e.model?.hasRaut, counts: e.model?.counts ?? null,
    })),
    groups,
    fromMenu: [...fromMenu.values()].map(a => ({ name: a.name, total: dishQty(a.amount, a.unit) })),
    missing:  [...missing.values()].map(a => ({ name: a.name, total: dishQty(a.amount, a.unit) })),
    check:    [...check.values()],
    printedAt: new Date(),
  }
}
