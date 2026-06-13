// Mapovanie JSON-u z /api/parse-booking na polia formulára novej rezervácie.
// Gemini vracia voľný text (napr. "firemná akcia", "potvrdená") — tu sa
// normalizuje na hodnoty používané v systéme. Čo sa nenamapuje, ostáva
// nedotknuté, aby sa neprepísali predvolené hodnoty formulára.

function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// voľný text → value z EVENT_TYPES
function mapEventType(raw) {
  if (typeof raw !== 'string') return null
  const t = stripDiacritics(raw.toLowerCase())
  if (t.includes('svadb'))                       return 'svadba'
  if (t.includes('oslav') || t.includes('narodenin')) return 'oslava'
  if (t.includes('posed'))                       return 'posedenie'
  if (t.includes('stuzk'))                       return 'stuzkova'
  if (t.includes('kar'))                         return 'kar'
  if (t.includes('firem'))                       return 'firemka'
  if (t.includes('cater'))                       return 'catering'
  return null
}

// voľný text → value zo STATUSES (dopyt | zaloha | potvrdene)
function mapStatus(raw) {
  if (typeof raw !== 'string') return null
  const t = stripDiacritics(raw.toLowerCase())
  if (t.includes('potvrd'))                      return 'potvrdene'
  if (t.includes('zaloh'))                       return 'zaloha'
  if (t.includes('dopyt') || t.includes('nezavaz')) return 'dopyt'
  return null
}

// "HH:MM" (24 h) → zarovnané na 15 min; len v rozsahu formulára (09–19 h),
// inak null (select v modáli ponúka iba tieto hodiny/minúty)
function mapTime(raw) {
  if (typeof raw !== 'string') return null
  const m = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  let h = Number(m[1])
  let min = Math.round(Number(m[2]) / 15) * 15
  if (min === 60) { min = 0; h += 1 }
  if (!Number.isFinite(h) || h < 9 || h > 19) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

// Vráti len polia, ktoré sa podarilo vytiahnuť — partial na setForm merge.
export function voiceResultToForm(parsed) {
  const out = {}

  if (typeof parsed.customer_name === 'string' && parsed.customer_name.trim()) {
    out.customerName = parsed.customer_name.trim()
  }
  if (typeof parsed.phone === 'string' && parsed.phone.trim()) {
    out.phone = parsed.phone.replace(/[^\d+]/g, '')
  }

  const type = mapEventType(parsed.event_type)
  if (type) out.type = type

  const status = mapStatus(parsed.status)
  if (status) out.status = status

  const time = mapTime(parsed.start_time)
  if (time) out.time = time

  const guests = Number(parsed.guest_count)
  if (Number.isFinite(guests) && guests > 0) out.expectedGuests = Math.round(guests)

  const price = Number(parsed.estimated_price)
  if (Number.isFinite(price) && price > 0) out.estimatedPrice = price

  const deposit = Number(parsed.deposit)
  if (Number.isFinite(deposit) && deposit > 0) out.deposit = deposit

  if (typeof parsed.deposit_paid === 'boolean') out.depositPaid = parsed.deposit_paid

  return out
}
