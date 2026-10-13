// Objednávky VO (veľkoobchod) — odberateľ, ktorý si berie jedlo do svojej sály.
// Objednávka je riadok v bookings s is_vo = true (poradie vo_order_no, stav vo_status).

// Farba VO — pásik v diári, zoznamoch a detaile
export const VO_COLOR = '#e2643e'

export const VO_STATUS_LABEL = {
  koncept: 'Koncept',
  final:   'FINAL',
}

// Pilulka stavu (zoznam objednávok, detail)
export const VO_STATUS_STYLE = {
  koncept: { background: '#f0f2f4', color: '#5a7a8c' },
  final:   { background: '#fde7df', color: '#b24a28' },
}

// Blok v diári: Koncept biely s čiarkovaným obrysom, FINAL vyplnený
export const VO_DIARY_STYLE = {
  koncept: { background: '#ffffff', outline: `1px dashed ${VO_COLOR}`, outlineOffset: '-1px' },
  final:   { background: '#fde7df' },
}

// Naše označenie objednávok VO — hlavička lístka do kuchyne, Najbližšie akcie,
// detail rezervácie (VO ho vo svojom rozhraní nevidí, tam je „Objednávka č. …")
export const VO_KITCHEN_NAME = 'ČIERNE'

// Číslo objednávky „RRMMDDCCC": dátum objednávky + poradové číslo na 3 miesta
// (17. 10. 2026, poradie 4 → „261017004"). Pri zmene dátumu sa zmení aj číslo.
export function voNumber(row) {
  const no = row?.vo_order_no ?? row?.voOrderNo
  if (no == null) return '?'
  const seq = String(no).padStart(3, '0')
  const [y, m, d] = String(row?.date ?? '').split('-')
  return y && m && d ? `${y.slice(2)}${m}${d.slice(0, 2)}${seq}` : seq
}

// Názov objednávky, keď ho VO nezadá (bez čísla — to sa mení s dátumom)
export const VO_DEFAULT_NAME = 'Objednávka'

// Názov zadaný VO, '' = nezadaný (predvolený „Objednávka" sa nepočíta)
export function voCustomName(row) {
  const name = (row?.customer_name ?? row?.customerName ?? '').trim()
  return name === VO_DEFAULT_NAME ? '' : name
}

// „ČIERNE č. 261017004" — lístok do kuchyne, sumár jedál
export const voLabel = row => `${VO_KITCHEN_NAME} č. ${voNumber(row)}`

// „ČIERNE - 261017004" — názov objednávky VO u nás (diár, Najbližšie akcie, detail);
// názov, ktorý zadal VO, tam netreba
export const voTitle = row => `${VO_KITCHEN_NAME} - ${voNumber(row)}`

// „ČIERNE č. 261017004 – názov od VO" (bez názvu len číslo) — nadpis lístka a sumáru
export const voLabelWithName = row => [voLabel(row), voCustomName(row)].filter(Boolean).join(' – ')

// Názov rezervácie v našich prehľadoch — pri objednávke VO „ČIERNE - 261017004"
export const bookingTitle = row => (row?.is_vo ? voTitle(row) : row?.customer_name)

// Stav VO objednávky z riadku (null = bežná rezervácia)
export const voStatusOf = row => (row?.is_vo ? (row.vo_status ?? 'koncept') : null)

// Polia objednávky, ktorých zmeny vidí VO v histórii — naše interné údaje
// (cena, záloha, vyúčtovanie, stav rezervácie…) mu neukazujeme.
// Poznámky (decoration) sú pri objednávke VO spoločné — píše ich VO aj admin.
export const VO_VISIBLE_FIELDS = [
  'customer_name', 'date', 'start_time', 'vo_status', 'decoration',
  'guests_adults', 'guests_specials', 'guests_kids_meal',
  'main_enabled', 'main_time', 'main_notes', 'raut_enabled', 'raut_time', 'raut_notes',
  'raut_extra', 'raut_grams', 'notes', 'menu_created',
]

// Počty hostí, ktoré VO vo formulári nemá (ani ich nenadiktuje)
export const VO_HIDDEN_GUEST_FIELDS = ['guests_adults_no_meal', 'guests_kids_no_meal']

// Bloky menu, v ktorých VO nemení množstvá (kg rautu a príloh pre raut)
export const VO_LOCKED_QTY_BLOCKS = [4, 5]
