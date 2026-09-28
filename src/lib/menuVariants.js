// Varianty položiek menu (podkategórie — napr. Náplň / Obal).
// Položka s zapnutým has_variants vyžaduje práve jeden variant; vo všetkých
// výstupoch sa vypisuje na jednom riadku ako „Položka – variant".
// Názov položky aj variantu sa berie živý z katalógu, s fallbackom na
// snapshot vo výbere (item_name / variant_name) — keby sa medzitým
// archivoval alebo natvrdo zmazal.

// Spojovník medzi položkou a variantom (rovnaká pomlčka ako v názvoch akcií)
const DASH = ' – '

// Názov vybratej položky
export const selName = sel => sel.menu_items?.name ?? sel.item_name

// Kategória vybratej položky: aktuálna z katalógu (po prípadnom presune),
// fallback na uložené category_id (keď položka v katalógu už neexistuje)
export const selCatId = sel => sel.menu_items?.category_id ?? sel.category_id

// Názov zvoleného variantu (null = nič nezvolené)
export const selVariantName = sel => sel.variant?.name ?? sel.variant_name ?? null

// Celý text položky do výstupov: „Bravčová panenka plnená – oštiepok"
export function selLabel(sel) {
  const v = selVariantName(sel)
  return v ? `${selName(sel)}${DASH}${v}` : selName(sel)
}

// Názov skupiny variantov pre hlášky („náplň", „obal"); fallback „variant"
export function variantGroupLabel(sel) {
  const g = sel.menu_items?.variant_group_name
  return g?.trim() ? g.trim().toLowerCase() : 'variant'
}

// Chýba vo výbere povinný variant?
// variantsByItem: { [item_id]: [aktívne možnosti] } — povinný parameter.
// Položka so zapnutými variantmi, ktorá zatiaľ nemá ani jednu možnosť,
// nevyžaduje nič — inak by sa výber nedal dokončiť (nebolo by na čo kliknúť).
export function needsVariant(sel, variantsByItem) {
  if (sel.variant_id) return false
  if (!sel.menu_items?.has_variants) return false
  return (variantsByItem?.[sel.item_id] ?? []).length > 0
}

// Zoskupenie možností podľa položky (z už načítaného, nearchivovaného zoznamu)
export function groupVariantsByItem(variants) {
  const by = {}
  for (const v of variants) (by[v.item_id] ??= []).push(v)
  return by
}

// Hláška pri blokovanej tlači / nedokončenom výbere
export function incompleteMessage(sels) {
  const list = sels.map(s => `${selLabel(s)} — chýba ${variantGroupLabel(s)}`).join('; ')
  return `Nedokončený výber, tlač sa nedá spustiť: ${list}`
}
