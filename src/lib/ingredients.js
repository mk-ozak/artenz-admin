// Suroviny a receptúry — spoločné pre Nastavenia (Suroviny, receptúra položky
// menu), export pre receptúry a kalkuláciu surovín

// Jednotky suroviny — v nich sa objednáva a sčítava
export const INGREDIENT_UNITS = ['kg', 'L', 'ks']

// Jednotky, v ktorých sa surovina zapisuje do receptúry (prvá = predvolená):
// surovina v kg → g alebo kg, v L → ml alebo L, v ks → ks
export const LINE_UNITS = { kg: ['g', 'kg'], L: ['ml', 'L'], ks: ['ks'] }

// Koľko jednotiek suroviny je jedna jednotka riadku receptúry (500 g → 0,5 kg);
// null = jednotka riadku k surovine nesedí (napr. g pri surovine v ks)
const TO_BASE = { g: ['kg', 0.001], kg: ['kg', 1], ml: ['L', 0.001], L: ['L', 1], ks: ['ks', 1] }
export function lineFactor(lineUnit, ingredientUnit) {
  const t = TO_BASE[lineUnit]
  return t && t[0] === ingredientUnit ? t[1] : null
}

// Prepočet množstva jedla z jednotky from na jednotku to (kalkulácia vs. dávka
// receptúry): rovnaká jednotka → 1, g↔kg a ml↔L; null = nedá sa prepočítať.
// Jednotky kategórií menu sú voľný text, preto bez ohľadu na veľké písmená.
const DISH_SCALE = { g: ['kg', 0.001], kg: ['kg', 1], ml: ['l', 0.001], l: ['l', 1] }
export function dishUnitFactor(from, to) {
  const f = String(from ?? '').trim().toLowerCase()
  const t = String(to ?? '').trim().toLowerCase()
  if (f === t) return 1
  const a = DISH_SCALE[f]
  const b = DISH_SCALE[t]
  return a && b && a[0] === b[0] ? a[1] / b[1] : null
}

// Číslo z poľa formulára — berie aj desatinnú čiarku; null = prázdne/neplatné
export function parseAmount(v) {
  const s = String(v ?? '').trim().replace(',', '.')
  const n = Number(s)
  return s !== '' && Number.isFinite(n) ? n : null
}

// Text na vyhľadávanie bez diakritiky a veľkých písmen („kur" nájde „Kuracie")
export const normText = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Všetky riadky dotazu po stránkach — Supabase vráti naraz najviac 1000 riadkov
// a riadkov receptúr môže byť viac. build(from, to) = dotaz s .range(from, to)
// (so stabilným zoradením). Vracia { data, error } ako bežný dotaz.
export async function fetchAllRows(build) {
  const PAGE = 1000
  const all = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) return { data: null, error }
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) return { data: all, error: null }
  }
}
