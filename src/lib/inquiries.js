// Dopyty z webu — číselníky a formátovanie.
// Sekcia je zámerne oddelená od rezervácií: žiadne prepojenie na bookings,
// vlastné stavy aj vlastný zoznam typov akcií.

import { formatDateSkYear, formatTimestampSkYear } from '../utils/format'

// Triedy sú vypísané celé, nie skladané z premenných — Tailwind hľadá
// v zdrojáku úplné názvy tried.
export const INQUIRY_STATUSES = [
  { value: 'new',      label: 'Nové',      bg: 'bg-inq-new',      ink: 'text-inq-new-ink',      dot: 'bg-inq-new-ink' },
  { value: 'read',     label: 'Prečítané', bg: 'bg-inq-read',     ink: 'text-inq-read-ink',     dot: 'bg-inq-read-ink' },
  { value: 'answered', label: 'Vybavené',  bg: 'bg-inq-answered', ink: 'text-inq-answered-ink', dot: 'bg-inq-answered-ink' },
  { value: 'archived', label: 'Archív',    bg: 'bg-inq-archived', ink: 'text-inq-archived-ink', dot: 'bg-inq-archived-ink' },
  { value: 'spam',     label: 'Spam',      bg: 'bg-inq-spam',     ink: 'text-inq-spam-ink',     dot: 'bg-inq-spam-ink' },
]

export const STATUS_BY_VALUE = Object.fromEntries(INQUIRY_STATUSES.map(s => [s.value, s]))

// Typy akcií z webového formulára — vlastný zoznam, nesúvisí s typmi rezervácií
export const INQUIRY_TYPE_LABEL = {
  svadba:    'Svadba',
  oslava:    'Oslava',
  stuzkova:  'Stužková',
  kar:       'Kar',
  firemna:   'Firemná akcia',
  posedenie: 'Posedenie',
  ine:       'Iné',
}

export function typeLabel(value) {
  return INQUIRY_TYPE_LABEL[value] ?? 'Iné'
}

// Dátum akcie; prázdny = dopyt ho neuviedol
export function eventDateLabel(dateStr) {
  return dateStr ? formatDateSkYear(dateStr) : 'bez dátumu'
}

// Kedy dopyt prišiel — dátum aj čas
export function arrivedLabel(ts) {
  if (!ts) return ''
  const time = new Date(ts).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })
  return `${formatTimestampSkYear(ts)}, ${time}`
}

// Odkazy na kontakt — e-mail s predvyplneným predmetom
export function telHref(phone) {
  return `tel:${(phone ?? '').replace(/\s+/g, '')}`
}

export function mailtoHref(inq) {
  const subject = `ARTENZ — Váš dopyt (${typeLabel(inq.event_type)}, ${eventDateLabel(inq.event_date)})`
  return `mailto:${inq.email}?subject=${encodeURIComponent(subject)}`
}
