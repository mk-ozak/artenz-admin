import { toISO } from './diaryWeeks'

export { toISO }

const DAY_NAMES = ['pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota', 'nedeľa']

// Pondelok týždňa, v ktorom leží `date` (lokálne, bez UTC posunu).
export function mondayOf(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // 0 = pondelok
  return d
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// pondelok–piatok ako Date[] pre daný pondelok
export function workWeek(monday) {
  return Array.from({ length: 5 }, (_, i) => addDays(monday, i))
}

export function dayNameSk(date) {
  return DAY_NAMES[(date.getDay() + 6) % 7]
}

export function fmtDatumSk(date) {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`
}

// „23.6. – 27.6.2026"
export function weekRangeLabel(monday) {
  const friday = addDays(monday, 4)
  return `${monday.getDate()}.${monday.getMonth() + 1}. – ${friday.getDate()}.${friday.getMonth() + 1}.${friday.getFullYear()}`
}

// Date z ISO 'YYYY-MM-DD' (lokálny polnočný čas, aby nepadlo o deň pri TZ)
export function fromISO(iso) {
  return new Date(iso + 'T00:00:00')
}
