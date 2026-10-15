// Kalkulácia surovín na objednávanie — z lístkov do kuchyne vybratých akcií
// (buildKitchenTicket, tie isté množstvá ako sumár jedál) a receptúr položiek
// menu (Nastavenia → Menu → čiapka). Množstvo jedla ako v menu (served — v surovom
// stave, ryža a cestoviny v hotovom)
// / dávka receptúry × riadky receptúry. Položka „sama surovinou" má jeden
// riadok so svojou samo-surovinou (ingredients.menu_item_id) — počíta sa ako
// bežná surovina vo svojej kategórii (Prípitky, Omáčky…). Čo sa spočítať nedá,
// ide do BEZ RECEPTÚRY alebo SKONTROLUJ — kuchyňa nesmie o nič prísť.

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
// Riadok suroviny v groups: { name, total, dishes } — dishes = jedlá, z ktorých
// sa súčet skladá (tlač A4 malým písmom za surovinou, karta v menu pri myši)
export function buildIngredientSummary({ dates, events, recipes, lines, ingredients, categories }) {
  const recipeOf = new Map(recipes.map(r => [r.item_id, r]))
  const linesOf  = new Map()
  for (const l of lines) (linesOf.get(l.item_id) ?? linesOf.set(l.item_id, []).get(l.item_id)).push(l)
  const ingById  = new Map(ingredients.map(i => [i.id, i]))

  const totals   = new Map()  // ingredient_id → súčet v jednotke suroviny
  const usedIn   = new Map()  // ingredient_id → názvy jedál (poradie lístka, bez opakovania)
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
      const self = !!rec?.is_ingredient
      const all = d.itemId ? linesOf.get(d.itemId) ?? [] : []
      // Položka sama surovinou: len riadok so svojou samo-surovinou; bez nej
      // (zakliknutá, ešte bez kategórie surovín) ide do BEZ RECEPTÚRY
      const own = self
        ? all.filter(l => ingById.get(l.ingredient_id)?.menu_item_id === d.itemId)
        : all.filter(l => !l.variant_id || l.variant_id === d.variantId)
      if (!own.length) {
        const name = self ? `${d.name} — surovina bez kategórie` : d.itemId ? d.name : `${d.name} (vlastná)`
        addQty(missing, d.key, name, d.amount, d.unit)
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
        const qty = Number(l.amount) * lf * factor
        totals.set(ing.id, (totals.get(ing.id) ?? 0) + qty)
        if (qty > 0) (usedIn.get(ing.id) ?? usedIn.set(ing.id, new Set()).get(ing.id)).add(d.name)
      }
      if (!self && !d.variantId && all.some(l => l.variant_id)) {
        addCheck(d.name, 'nie je vybratý variant — započítaný len základ')
      }
    }
  }

  // Jedlá suroviny; samo-surovina len zo svojho jedla (rovnaký názov) zoznam
  // nemá — iba by opakoval jej názov
  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase()
  const dishNames = i => {
    const names = [...(usedIn.get(i.id) ?? [])]
    return names.length === 1 && same(names[0], i.name) ? [] : names
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
        .map(i => ({ name: i.name, total: fmtIngredient(totals.get(i.id), i.unit), dishes: dishNames(i) })),
    }))
    .filter(g => g.rows.length)

  return {
    days: [...dates].sort(),
    events: events.map(e => ({
      date: e.date, hallShort: e.hallShort, time: e.time, title: e.title,
      hasMenu: !!e.model, hasRaut: !!e.model?.hasRaut, counts: e.model?.counts ?? null,
    })),
    groups,
    missing:  [...missing.values()].map(a => ({ name: a.name, total: dishQty(a.amount, a.unit) })),
    check:    [...check.values()],
    printedAt: new Date(),
  }
}
