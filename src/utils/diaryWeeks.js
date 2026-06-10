// Returns all weeks for a given month.
// Each week = { sun, mon, tue, wed, thu, fri, sat } — may include days from adjacent months.
export function getMonthWeeks(year, month) {
  const firstDay = new Date(year, month, 1)
  const startSun = new Date(firstDay)
  startSun.setDate(firstDay.getDate() - firstDay.getDay())

  const weeks = []
  const cur = new Date(startSun)

  while (true) {
    const w = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(cur)
      d.setDate(cur.getDate() + i)
      return d
    })
    weeks.push({ sun: w[0], mon: w[1], tue: w[2], wed: w[3], thu: w[4], fri: w[5], sat: w[6] })
    cur.setDate(cur.getDate() + 7)
    if (w[6].getMonth() > month || (month === 11 && w[6].getMonth() === 0)) break
  }
  return weeks
}

export function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
