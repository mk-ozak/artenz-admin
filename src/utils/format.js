const DAYS_SHORT  = ['Ned','Pon','Ut','Str','Štv','Pia','Sob']
const DAYS_LONG   = ['Nedeľa','Pondelok','Utorok','Streda','Štvrtok','Piatok','Sobota']
const MONTHS_GEN  = ['januára','februára','marca','apríla','mája','júna',
                     'júla','augusta','septembra','októbra','novembra','decembra']
const MONTHS_SHORT = ['jan','feb','mar','apr','máj','jún','júl','aug','sep','okt','nov','dec']

export function formatDateSk(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`
}

export function formatTodaySk() {
  const d = new Date()
  return `${DAYS_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`
}

export function formatTime() {
  return new Date().toLocaleTimeString('sk', { hour: '2-digit', minute: '2-digit' })
}
