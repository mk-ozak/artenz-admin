// Objednávky VO (veľkoobchod) — odberateľ, ktorý si berie jedlo do svojej sály.
// Objednávka je riadok v bookings s is_vo = true (číslo vo_order_no, stav vo_status).

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
// detail rezervácie (VO ho vo svojom rozhraní nevidí, tam je „Objednávka č. 12")
export const VO_KITCHEN_NAME = 'ČIERNE'

// „ČIERNE č. 12"
export const voLabel = row => `${VO_KITCHEN_NAME} č. ${row.vo_order_no ?? row.voOrderNo ?? '?'}`

// Stav VO objednávky z riadku (null = bežná rezervácia)
export const voStatusOf = row => (row?.is_vo ? (row.vo_status ?? 'koncept') : null)

// Polia objednávky, ktorých zmeny vidí VO v histórii — naše interné údaje
// (cena, záloha, vyúčtovanie, poznámky, stav rezervácie…) mu neukazujeme
export const VO_VISIBLE_FIELDS = [
  'customer_name', 'date', 'start_time', 'vo_status',
  'guests_adults', 'guests_adults_no_meal', 'guests_specials',
  'guests_kids_meal', 'guests_kids_no_meal',
  'raut_enabled', 'raut_extra', 'raut_grams', 'notes', 'menu_created',
]

// Bloky menu, v ktorých VO nemení množstvá (kg rautu a príloh pre raut)
export const VO_LOCKED_QTY_BLOCKS = [4, 5]
