// ============================================================
// Edge Function `dopyt` — príjem dopytov z webu artenz.sk
//
// Čistý JavaScript bez typových anotácií; prípona .ts je len preto,
// že Supabase očakáva entrypoint index.ts.
//
// Zapisuje do tabuľky `inquiries` servisným kľúčom (obchádza RLS),
// takže vo zdrojovom kóde webu nie je žiadny Supabase kľúč.
// Nasadzuje sa BEZ overovania JWT — web volá funkciu bez kľúča.
//
// Premenné prostredia (Supabase → Edge Functions → Secrets):
//   TURNSTILE_SECRET – tajný kľúč Cloudflare Turnstile.
//                      Ak nie je nastavený, overenie sa preskočí
//                      (chráni len honeypot a časový test).
//   RESEND_API_KEY   – nepovinné; bez neho sa notifikácia neposiela
//   RESEND_FROM      – nepovinné; odosielateľ notifikácie
//   NOTIFY_EMAIL     – nepovinné; prijímateľ (predvolene info@artenz.sk)
//   ADMIN_URL        – nepovinné; odkaz do administrácie v e-maile
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY – dopĺňa Supabase sám
// ============================================================

const ALLOWED_ORIGINS = ['https://artenz.sk', 'https://www.artenz.sk']

// Časový test vyplnenia formulára
const MIN_FILL_MS = 3 * 1000
const MAX_FILL_MS = 2 * 60 * 60 * 1000

// Limity dĺžky — musia sedieť s CHECK constraintmi v migrácii
const LIMITS = { name: 120, phone: 40, email: 200, message: 2000 }

const EVENT_LABEL = {
  svadba:    'Svadba',
  oslava:    'Oslava',
  stuzkova:  'Stužková',
  kar:       'Kar',
  firemna:   'Firemná akcia',
  posedenie: 'Posedenie',
  ine:       'Iné',
}

// Neznámy typ akcie dopyt nezahodí — uloží sa ako „ine".
const EVENT_ALIASES = {
  svadba: 'svadba',
  oslava: 'oslava', narodeniny: 'oslava', jubileum: 'oslava',
  stuzkova: 'stuzkova', stuzka: 'stuzkova', 'stuzkova slavnost': 'stuzkova',
  kar: 'kar', karu: 'kar', pohreb: 'kar',
  firemna: 'firemna', firemka: 'firemna', 'firemna akcia': 'firemna', firma: 'firemna',
  posedenie: 'posedenie',
  ine: 'ine', ina: 'ine', iny: 'ine', ostatne: 'ine',
}

// ------------------------------------------------------------
// Pomocné funkcie
// ------------------------------------------------------------

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age':       '86400',
    'Vary':                         'Origin',
  }
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(origin ? corsHeaders(origin) : {}),
    },
  })
}

// Bez diakritiky, malé písmená, zjednotené medzery — na porovnanie typu akcie
function slug(v) {
  return String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// Orezanie a zahodenie riadiacich znakov
function clean(v) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim()
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}

// Dátum musí byť skutočný deň v tvare RRRR-MM-DD
function isDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(v + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

function dateLabel(v) {
  if (!v) return 'bez dátumu'
  const [y, m, d] = v.split('-')
  return `${Number(d)}. ${Number(m)}. ${y}`
}

// loaded_at: milisekundy (číslo) alebo ISO reťazec; null = nedá sa vyhodnotiť
function loadedMs(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    if (/^\d+$/.test(v.trim())) return Number(v.trim())
    const t = Date.parse(v)
    if (!Number.isNaN(t)) return t
  }
  return null
}

// true = overené, false = zamietnuté, 'skipped' = nie je nastavený kľúč
async function verifyTurnstile(token, ip) {
  const secret = Deno.env.get('TURNSTILE_SECRET')
  if (!secret) {
    console.warn('[dopyt] TURNSTILE_SECRET nie je nastavený — overenie sa preskakuje')
    return 'skipped'
  }
  if (!token) return false
  try {
    const form = new FormData()
    form.append('secret', secret)
    form.append('response', token)
    if (ip) form.append('remoteip', ip)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    })
    const out = await res.json()
    if (!out.success) console.warn('[dopyt] Turnstile zamietol:', out['error-codes'])
    return out.success === true
  } catch (err) {
    console.error('[dopyt] Turnstile nedostupný:', err.message)
    return false
  }
}

// Notifikácia je nepovinná — zlyhanie nesmie zhodiť funkciu
async function notify(row) {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return
  const to       = Deno.env.get('NOTIFY_EMAIL') ?? 'info@artenz.sk'
  const from     = Deno.env.get('RESEND_FROM')  ?? 'ARTENZ dopyty <onboarding@resend.dev>'
  const adminUrl = Deno.env.get('ADMIN_URL')    ?? 'https://admin.artenz.sk'
  const typeLabel = EVENT_LABEL[row.event_type] ?? 'Iné'
  const link = `${adminUrl.replace(/\/+$/, '')}/dopyty`

  const text = [
    `Meno: ${row.name}`,
    `Telefón: ${row.phone}`,
    `E-mail: ${row.email}`,
    `Typ akcie: ${typeLabel}`,
    `Dátum akcie: ${dateLabel(row.event_date)}`,
    `Počet hostí: ${row.guests ?? '—'}`,
    '',
    row.message ? `Správa:\n${row.message}` : 'Správa: —',
    '',
    `Otvoriť v administrácii: ${link}`,
  ].join('\n')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: row.email,
        subject: `Dopyt z webu — ${typeLabel}, ${dateLabel(row.event_date)}`,
        text,
      }),
    })
    if (!res.ok) console.error('[dopyt] Resend zlyhal:', res.status)
  } catch (err) {
    console.error('[dopyt] Resend nedostupný:', err.message)
  }
}

// ------------------------------------------------------------
// Obsluha požiadavky
// ------------------------------------------------------------

Deno.serve(async (req) => {
  const origin  = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ''

  // 1. CORS predlet — len povolené pôvody
  if (req.method === 'OPTIONS') {
    if (!allowed) return new Response(null, { status: 403 })
    return new Response(null, { status: 204, headers: corsHeaders(allowed) })
  }

  if (!allowed) return json({ ok: false, error: 'forbidden_origin' }, 403, '')
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, allowed)

  let body
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400, allowed)
  }
  if (!body || typeof body !== 'object') {
    return json({ ok: false, error: 'invalid_json' }, 400, allowed)
  }

  // 2. Honeypot — robot dostane rovnakú odpoveď ako človek
  if (clean(body.website) !== '') {
    console.log('[dopyt] zahodené: honeypot')
    return json({ ok: true }, 200, allowed)
  }

  // 3. Čas vyplnenia. Chýbajúci údaj dopyt NEzahodí — bola by to tichá strata
  //    dopytu pri chybe formulára; robotov filtruje honeypot a Turnstile.
  const loaded = loadedMs(body.loaded_at)
  if (loaded === null) {
    console.warn('[dopyt] loaded_at chýba alebo je nečitateľné — časový test sa preskakuje')
  } else {
    const elapsed = Date.now() - loaded
    if (elapsed < MIN_FILL_MS || elapsed > MAX_FILL_MS) {
      console.log('[dopyt] zahodené: čas vyplnenia', elapsed, 'ms')
      return json({ ok: true }, 200, allowed)
    }
  }

  // 4. Turnstile
  const token = clean(body.turnstile_token) || clean(body['cf-turnstile-response'])
  const ip    = req.headers.get('cf-connecting-ip') ?? ''
  const ts    = await verifyTurnstile(token, ip)
  if (ts === false) return json({ ok: false, error: 'turnstile_failed' }, 400, allowed)

  // 5. Validácia
  const name  = clean(body.name)
  const email = clean(body.email)
  // telefón: preč medzery a bežné oddeľovače, zostanú + a číslice
  const phone  = clean(body.phone).replace(/[\s().\/-]/g, '')
  const digits = phone.replace(/\D/g, '')

  if (!name)  return json({ ok: false, error: 'missing_name',  field: 'name'  }, 400, allowed)
  if (!phone) return json({ ok: false, error: 'missing_phone', field: 'phone' }, 400, allowed)
  if (!email) return json({ ok: false, error: 'missing_email', field: 'email' }, 400, allowed)

  if (name.length  > LIMITS.name)  return json({ ok: false, error: 'too_long', field: 'name'  }, 400, allowed)
  if (phone.length > LIMITS.phone) return json({ ok: false, error: 'too_long', field: 'phone' }, 400, allowed)
  if (email.length > LIMITS.email) return json({ ok: false, error: 'too_long', field: 'email' }, 400, allowed)

  if (!isEmail(email)) return json({ ok: false, error: 'invalid_email', field: 'email' }, 400, allowed)
  if (digits.length < 6 || digits.length > 20) {
    return json({ ok: false, error: 'invalid_phone', field: 'phone' }, 400, allowed)
  }

  const event_type = EVENT_ALIASES[slug(body.event_type)] ?? 'ine'

  let event_date = null
  const rawDate = clean(body.event_date)
  if (rawDate !== '') {
    if (!isDate(rawDate)) {
      return json({ ok: false, error: 'invalid_event_date', field: 'event_date' }, 400, allowed)
    }
    event_date = rawDate
  }

  let guests = null
  const rawGuests = clean(body.guests)
  if (rawGuests !== '') {
    const n = Number(rawGuests)
    if (!Number.isInteger(n) || n < 1 || n > 2000) {
      return json({ ok: false, error: 'invalid_guests', field: 'guests' }, 400, allowed)
    }
    guests = n
  }

  const message = clean(body.message)
  if (message.length > LIMITS.message) {
    return json({ ok: false, error: 'too_long', field: 'message' }, 400, allowed)
  }

  const row = {
    name,
    phone,
    email,
    event_type,
    event_date,
    guests,
    message: message === '' ? null : message,
    source: 'web',
  }

  // 6. Zápis servisným kľúčom (obchádza RLS). Prefer: return=minimal —
  //    databáza nikdy neposiela nič naspäť na web.
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    console.error('[dopyt] chýba SUPABASE_URL alebo SUPABASE_SERVICE_ROLE_KEY')
    return json({ ok: false, error: 'server_error' }, 500, allowed)
  }

  try {
    const res = await fetch(`${url}/rest/v1/inquiries`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    })
    if (!res.ok) {
      console.error('[dopyt] zápis zlyhal:', res.status, await res.text())
      return json({ ok: false, error: 'server_error' }, 500, allowed)
    }
  } catch (err) {
    console.error('[dopyt] databáza nedostupná:', err.message)
    return json({ ok: false, error: 'server_error' }, 500, allowed)
  }

  // 7. Notifikácia (nepovinná)
  await notify(row)

  // 8. Odpoveď — vždy JSON, nikdy obsah databázy
  return json({ ok: true, turnstile: ts === 'skipped' ? 'skipped' : 'ok' }, 200, allowed)
})
