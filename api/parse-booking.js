// Hlasové zadanie rezervácie: audio → Gemini → JSON s poliami rezervácie.
// GEMINI_API_KEY drží Vercel env, na frontend sa nikdy nedostane.

const GEMINI_MODEL = 'gemini-2.5-flash-lite'
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const PROMPT = `Si parser rezervácií. Dostaneš zvukovú nahrávku, na ktorej človek po slovensky
nadiktoval údaje o novej rezervácii spoločenskej sály. Prepíš si reč a vytiahni
z nej údaje. Vráť IBA validný JSON, bez markdownu, bez \`\`\`, bez textu navyše.

Schéma:
{
  "customer_name": string | null,
  "phone": string | null,
  "event_type": string | null,
  "status": string | null,
  "guest_count": number | null,
  "estimated_price": number | null
}

Pravidlá:
- Reč je v slovenčine. Čokoľvek, čo nezaznelo, daj null. Nikdy si nič nevymýšľaj.
- customer_name je meno alebo názov rezervácie (napr. "Kováčovci", "firma XYZ").
  Toto je najdôležitejšie pole — sústreď sa na správne počutie priezviska.
- phone normalizuj na súvislé číslice bez medzier ("0905 123 456" -> "0905123456").
  Ak číslo zaznie po čísliciach, spoj ho. Slovenské čísla majú zvyčajne 10 číslic
  a začínajú na 09.
- guest_count a estimated_price vráť ako čísla ("asi sto ľudí" -> 100,
  "okolo dvetisíc eur" -> 2000).
- event_type je krátky názov typu akcie (svadba, oslava, kar, firemná akcia, stužková...).
- status namapuj na jednu z hodnôt statusov používaných v systéme; ak nezaznel, daj null.`

export default async function handler(req, res) {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Voice API not configured' })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { audioBase64, mimeType } = req.body ?? {}
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: 'Chýba nahrávka' })
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
            { text: PROMPT },
            { inline_data: { mime_type: mime, data: audioBase64 } },
          ],
        }],
        generationConfig: { temperature: 0 },
      }),
    })
    if (!r.ok) {
      const detail = await r.text()
      console.error('[parse-booking] Gemini error:', r.status, detail.slice(0, 500))
      return res.status(502).json({ error: 'Nepodarilo sa rozpoznať, skús to znova.' })
    }

    const data = await r.json()
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map(p => p.text ?? '')
      .join('')
      .trim()
      // model občas obalí odpoveď do ``` fences napriek zákazu
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      console.error('[parse-booking] invalid JSON from Gemini:', text.slice(0, 500))
      return res.status(502).json({ error: 'Nepodarilo sa rozpoznať, skús to znova.' })
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return res.status(502).json({ error: 'Nepodarilo sa rozpoznať, skús to znova.' })
    }

    return res.json({
      customer_name:   parsed.customer_name ?? null,
      phone:           parsed.phone ?? null,
      event_type:      parsed.event_type ?? null,
      status:          parsed.status ?? null,
      guest_count:     parsed.guest_count ?? null,
      estimated_price: parsed.estimated_price ?? null,
    })
  } catch (err) {
    console.error('[parse-booking]', err.message)
    return res.status(500).json({ error: 'Nepodarilo sa rozpoznať, skús to znova.' })
  }
}
