// Hlasové zadanie menu akcie: audio + katalóg menu → Gemini → JSON s počtami
// hostí a položkami z katalógu. Rovnaký vzor ako parse-booking.js: REST
// volanie, GEMINI_API_KEY drží Vercel env a na frontend sa nikdy nedostane.
// Katalóg posiela klient s krátkymi kódmi (p1, v1…) namiesto UUID — menej
// tokenov a model ich neskomolí. Späť na položky ich mapuje a overuje klient
// (src/lib/voiceMenu.js), takže tu sa kontrolujú len typy.
// Model 3.x: temperature sa nenastavuje (odporúčaný default).

const GEMINI_MODEL = 'gemini-3.5-flash'
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const GENERIC_ERROR = 'Nepodarilo sa rozpoznať, skús to znova.'

const MAX_CATEGORIES = 300
const MAX_ITEMS      = 3000
const MAX_VARIANTS   = 50     // na jednu položku
const REF = /^[pv]\d{1,5}$/

const PROMPT = `Si asistent reštaurácie, ktorý zostavuje menu pre akcie (svadby, oslavy,
kary, firemné akcie…). Dostaneš zvukovú nahrávku, na ktorej človek po slovensky
nadiktoval menu akcie — celé alebo len jeho časť — a KATALÓG jedál reštaurácie.
Prepíš reč, nájdi nadiktované jedlá v katalógu a vytiahni počty hostí.
Vráť IBA validný JSON, bez markdownu, bez \`\`\`, bez textu navyše.

Schéma:
{
  "transcript": string,
  "guests_adults": number | null,
  "guests_adults_no_meal": number | null,
  "guests_specials": number | null,
  "guests_kids_meal": number | null,
  "guests_kids_no_meal": number | null,
  "notes": string | null,
  "raut_enabled": boolean | null,
  "raut_extra": number | null,
  "raut_grams": number | null,
  "items": [
    { "heard": string, "ref": string, "variant": string | null, "quantity": number | null }
  ],
  "unmatched": [string]
}

Pravidlá:
- transcript je doslovný prepis toho, čo zaznelo (po slovensky, s diakritikou).

Jedlá:
- Každé nadiktované jedlo nájdi v katalógu. heard = jedlo tak, ako zaznelo,
  ref = kód položky z katalógu (napr. "p12").
- Zhoda nemusí byť doslovná: iný pád, skrátený alebo hovorový názov je v poriadku
  („sviečkovú" = „Sviečková na smotane", „trojobal" = „Rezeň trojobal").
- Ak jedlo v katalógu nie je, NEVYBERAJ namiesto neho iné, len podobné jedlo.
  Zapíš ho do unmatched v základnom tvare (napr. "tiramisu"). Radšej jedlo
  preskočiť, ako pridať nesprávne.
- Rovnaké jedlo býva vo viacerých kategóriách (napr. ryža v prílohách pre
  dospelých, v jedle pre deti aj v prílohách pre raut). Vyber položku z bloku,
  o ktorom človek práve hovorí: „pre deti…" → blok pre deti; „vege, bezlepkové,
  špeciál…" → blok špeciálov; „na raut…" → raut a prílohy pre raut; „studená
  kuchyňa, chlebíčky…" → studená kuchyňa. Kým nepovie inak, ide o hlavné jedlo
  dospelých. Jedlo s množstvom v kilách patrí takmer isto na raut.
- Položka s variantmi má možnosti v hranatých zátvorkách (napr. náplň, obal).
  Ak zaznel variant, daj do variant jeho kód (napr. "v3"), inak null. Kód
  variantu ber len z možností tej istej položky.
- quantity vyplň len pri kategóriách s množstvom (v katalógu „množstvo v kg",
  „množstvo v ks"…) a len ak množstvo zaznelo: „päť kíl" → 5, „pol kila" → 0.5,
  „dva a pol" → 2.5, „desať kusov" → 10. Inak null.
- Každú položku uveď v items najviac raz.

Počty hostí (čo nezaznelo, daj null; nikdy si nič nevymýšľaj):
- guests_adults = dospelí, ktorí dostanú hlavné menu — BEZ špeciálov a BEZ
  dospelých bez jedla. „Osemdesiat dospelých, z toho päť vege" → guests_adults 75
  a guests_specials 5. „Osemdesiat dospelých a päť vege" → 80 a 5.
  „Sto dospelých, z toho desať bez jedla" → guests_adults 90 a guests_adults_no_meal 10.
- guests_adults_no_meal = dospelí, ktorí jedlo nedostanú („bez jedla", „nejedia").
- guests_specials = hostia so špeciálnym jedlom (vegetariánske, bezlepkové,
  bezlaktózové, diétne…).
- guests_kids_meal = deti s jedlom, guests_kids_no_meal = deti bez jedla
  (napr. malé deti). „Pätnásť detí, z toho päť bez jedla" → 10 a 5.
- notes = špeciálne požiadavky ku strave (alergie, diéty, napr. „2× bezlepkové,
  alergia na orechy"), stručne po slovensky. Inak null.
- raut_enabled = false, ak zaznie, že akcia je bez rautu; true, ak výslovne
  zaznie, že raut bude; inak null.
- raut_extra = o koľko ľudí viac (kladné číslo) alebo menej (záporné) má byť
  rautu, ak to zaznie („raut o desať ľudí navyše" → 10).
- raut_grams = gramáž rautu na osobu v gramoch („tristo gramov na osobu" → 300).

KATALÓG (kód = názov položky):`

const str = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

// Katalóg od klienta → len známe polia s rozumnou dĺžkou (endpoint je verejný)
function cleanCatalog(raw) {
  if (!Array.isArray(raw)) return null
  let count = 0
  const cats = []
  for (const c of raw.slice(0, MAX_CATEGORIES)) {
    if (!c || !Array.isArray(c.items)) continue
    const items = []
    for (const it of c.items) {
      if (!it || !REF.test(it.ref) || ++count > MAX_ITEMS) continue
      const variants = (Array.isArray(it.variants) ? it.variants : [])
        .filter(v => v && REF.test(v.ref))
        .slice(0, MAX_VARIANTS)
        .map(v => ({ ref: v.ref, name: str(v.name, 120) }))
      items.push({
        ref: it.ref,
        name: str(it.name, 300),
        group: variants.length ? (str(it.group, 60) || 'variant') : null,
        variants,
      })
    }
    if (!items.length) continue
    cats.push({
      block:      Number.isInteger(c.block) ? c.block : null,
      blockTitle: str(c.blockTitle, 80),
      name:       str(c.name, 120),
      qty:        c.qty === true,
      unit:       str(c.unit, 12),
      items,
    })
  }
  return cats.length ? cats : null
}

// Katalóg ako text do promptu: bloky → kategórie → „p12 = Názov [náplň: v3 = …]"
function catalogText(cats) {
  const lines = []
  let block
  for (const cat of cats) {
    if (cat.block !== block) {
      block = cat.block
      lines.push('', `=== Blok ${cat.block ?? '?'}${cat.blockTitle ? `: ${cat.blockTitle}` : ''} ===`)
    }
    const qty = cat.qty ? ` (množstvo${cat.unit ? ` v ${cat.unit}` : ''})` : ''
    lines.push(`Kategória: ${cat.name}${qty}`)
    for (const it of cat.items) {
      const opts = it.variants.length
        ? ` [${it.group}: ${it.variants.map(v => `${v.ref} = ${v.name}`).join('; ')}]`
        : ''
      lines.push(`  ${it.ref} = ${it.name}${opts}`)
    }
  }
  return lines.join('\n')
}

// Číslo z odpovede modelu (aj „2,5" ako text); inak null
function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.trim().replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

const text = v => (typeof v === 'string' && v.trim() ? v.trim() : null)

export default async function handler(req, res) {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Voice API not configured' })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { audioBase64, mimeType, catalog } = req.body ?? {}
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: 'Chýba nahrávka' })
  }
  const cats = cleanCatalog(catalog)
  if (!cats) {
    return res.status(400).json({ error: 'Katalóg menu je prázdny — najprv pridaj položky v Nastaveniach → Menu.' })
  }
  // Gemini chce mime type bez parametra ;codecs
  const mime = String(mimeType || 'audio/webm').split(';')[0].trim()

  try {
    const r = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `${PROMPT}\n${catalogText(cats)}` },
            { inline_data: { mime_type: mime, data: audioBase64 } },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          // limit platí pre „thinking" aj výstup spolu — rezerva proti odseknutiu JSON-u
          maxOutputTokens: 16384,
          // trochu „premýšľania" pomáha zaradiť jedlá do správnej časti menu
          // (ryža pre dospelých / deti / na raut) a prepočítať počty hostí
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
    })
    if (!r.ok) {
      const detail = await r.text()
      console.error('[parse-menu] Gemini error:', r.status, detail.slice(0, 500))
      // 429 = vyčerpaný limit free tier, 503 = preťažený model
      if (r.status === 429 || r.status === 503) {
        return res.status(503).json({ error: 'Hlasové spracovanie je teraz vyťažené. Skús to o minútu znova.' })
      }
      return res.status(502).json({ error: GENERIC_ERROR })
    }

    const data = await r.json()
    const candidate = data.candidates?.[0]
    const raw = (candidate?.content?.parts ?? [])
      .filter(p => !p.thought)
      .map(p => p.text ?? '')
      .join('')
      .trim()
      // model občas obalí odpoveď do ``` fences napriek zákazu
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      console.error('[parse-menu] invalid JSON from Gemini:', candidate?.finishReason, raw.slice(0, 500))
      if (candidate?.finishReason === 'MAX_TOKENS') {
        return res.status(502).json({ error: 'Diktovanie je príliš dlhé — rozdeľ ho na viac častí.' })
      }
      return res.status(502).json({ error: GENERIC_ERROR })
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return res.status(502).json({ error: GENERIC_ERROR })
    }

    // Jedlo bez kódu z katalógu patrí medzi nenájdené
    const unmatched = (Array.isArray(parsed.unmatched) ? parsed.unmatched : []).map(text).filter(Boolean)
    const items = []
    for (const it of Array.isArray(parsed.items) ? parsed.items : []) {
      if (!it || typeof it !== 'object') continue
      const ref = text(it.ref)
      if (!ref) {
        if (text(it.heard)) unmatched.push(text(it.heard))
        continue
      }
      items.push({
        ref,
        variant:  text(it.variant),
        quantity: num(it.quantity),
        heard:    text(it.heard),
      })
    }

    return res.json({
      transcript:            text(parsed.transcript) ?? '',
      guests_adults:         num(parsed.guests_adults),
      guests_adults_no_meal: num(parsed.guests_adults_no_meal),
      guests_specials:       num(parsed.guests_specials),
      guests_kids_meal:      num(parsed.guests_kids_meal),
      guests_kids_no_meal:   num(parsed.guests_kids_no_meal),
      notes:                 text(parsed.notes),
      raut_enabled:          typeof parsed.raut_enabled === 'boolean' ? parsed.raut_enabled : null,
      raut_extra:            num(parsed.raut_extra),
      raut_grams:            num(parsed.raut_grams),
      items:                 items.slice(0, 300),
      unmatched:             unmatched.slice(0, 100),
    })
  } catch (err) {
    console.error('[parse-menu]', err.message)
    return res.status(500).json({ error: GENERIC_ERROR })
  }
}
