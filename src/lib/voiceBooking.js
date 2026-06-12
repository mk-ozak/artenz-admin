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

  const guests = Number(parsed.guest_count)
  if (Number.isFinite(guests) && guests > 0) out.expectedGuests = Math.round(guests)

  const price = Number(parsed.estimated_price)
  if (Number.isFinite(price) && price > 0) out.estimatedPrice = price

  return out
}
