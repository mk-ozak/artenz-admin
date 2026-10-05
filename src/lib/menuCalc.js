// Kalkulácia pre kuchyňu — výpočet a formát jedného riadku.
// Spoločné pre obrazovku (MenuEditor) aj lístok do kuchyne (kitchenTicket),
// aby čísla na lístku vždy sedeli s adminom.

// Množstvo: 0.5 → „0,5"
export const fmtQty = q => String(Number(q)).replace('.', ',')

// Výnimka natvrdo: Ryža — porcia na osobu je v uvarenom stave, kuchyňa však
// potrebuje surovú ryžu, teda polovicu množstva. Podľa ID položky
// (menu_items.id) v jej kategórii (menu_categories.id), na názve nezáleží.
const COOKED_RICE = [
  { category: '9eea1fd0-f5e5-4436-9814-40517455e498', item: '0bea09e2-2761-41dd-827d-9ed61b754f06' }, // Príloha → Ryža
  { category: '7efaedf5-96c3-4086-aef8-762bba9e8318', item: '1f2ab805-08d2-4e09-adee-e16cfc95bd96' }, // Jedlo deti → Ryža
]
const isCookedRice = (sel, cat) => COOKED_RICE.some(r => r.category === cat.id && r.item === sel.item_id)

// Prípitok dospelých pijú aj špeciáli — násobí sa dospelými + špeciálmi
const TOAST_CATEGORY = 'e9d6904c-5fa5-464a-ab00-5fea29f52b49' // Prípitok

// Počet osôb, ktorým sa v kalkulácii násobí porcia položky kategórie cat
// v bloku (null = blok sa nenásobí, berie sa naklikané množstvo)
export function calcCount(summary, block, cat) {
  const count = summary.calc?.countByBlock?.[block] ?? null
  if (count != null && cat.id === TOAST_CATEGORY) return count + (summary.calc?.specials ?? 0)
  return count
}

// Počet osôb v nadpise sekcie (kalkulácia aj zhrnutie pre zákazníka): počet,
// ktorým sa sekcia násobí, inak počet špeciálov alebo pevný počet bloku (raut)
export function sectionHeadCount(summary, block) {
  return summary.calc?.countByBlock?.[block]
    ?? (block === summary.checkBlock ? summary.checkTarget : summary.fixedQty?.[block])
}

// Riadok kalkulácie pre vybratú položku.
// catSels: všetky výbery v kategórii položky (podiel porcie 1/2, 1/3…)
// count:   počet osôb, ktorým sa jednotkové množstvo násobí;
//          null = sekcia sa nenásobí → naklikané množstvo, ak ho kategória má
// Vracia: split (počet položiek pri podiele, inak null), jedn (porcia na osobu),
// jednNote (doplnok k porcii, napr. „v hotovom stave"), mnozstvo (spolu) —
// sformátované texty, null = nie je čo ukázať; amount = číslo
export function calcLine(sel, cat, catSels, count) {
  const split = cat.split_portions && catSels.length > 1 ? catSels.length : null
  const rice = isCookedRice(sel, cat)
  const unitSuffix = cat.default_unit ? ` ${cat.default_unit}` : ''
  const jednAmount = cat.default_amount != null
    ? Math.round((Number(cat.default_amount) / (split ?? 1)) * 1000) / 1000
    : null
  let amount = null
  let mnozstvo = null
  if (count != null && jednAmount != null) {
    amount = Math.round(jednAmount * count * (rice ? 50 : 100)) / 100
    mnozstvo = `${fmtQty(amount)}${unitSuffix}`
  } else if (count == null && cat.qty_step != null) {
    amount = Number(sel.quantity)
    mnozstvo = `${fmtQty(sel.quantity)}${cat.qty_unit ? ` ${cat.qty_unit}` : ''}`
  }
  return {
    split,
    jedn: jednAmount != null ? `${fmtQty(jednAmount)}${unitSuffix}` : null,
    jednNote: rice && jednAmount != null ? 'v hotovom stave' : null,
    amount,
    mnozstvo,
  }
}
