// OCR jedálneho lístka: obrázok alebo PDF → Gemini → JSON s dňami menu.
// Rovnaký vzor ako parse-booking.js: REST volanie, GEMINI_API_KEY drží
// Vercel env a na frontend sa nikdy nedostane. Žiadne SDK navyše.
// Model 3.x: temperature sa nenastavuje (odporúčaný default).
// Pro modely (2.5 Pro, 3.1 Pro) nie sú na free tier dostupné (limit 0/0).
// gemini-3.5-flash je najnovší dostupný Flash (multimodálny, Image aj PDF).

const GEMINI_MODEL = 'gemini-3.5-flash'
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const PROMPT = `Si „MENU maker". Z obrázka alebo PDF rukou písaného alebo natlačeného
jedálneho lístka prepíš obsah do štruktúrovaného JSON.

Pravidlá:
- Doplň chýbajúcu diakritiku a oprav gramatiku, ale nemeň význam slov.
- Rozširuj iba skratky (napr. „t.o." -> „tatárska omáčka", „br." -> „bravčový").
- Používaj výhradne slovenský jazyk.
- Do soup1_name daj len dennú polievku z obrázka. Druhú polievku
  (Vývar s rezancami/cestovinou) nedopĺňaj – doplní sa automaticky.
- Každý pracovný deň (pondelok–piatok) má spravidla 1 polievku a 2 hlavné jedlá.
- Ak je deň sviatok / zatvorené / na obrázku chýba, nezahŕňaj ho do výstupu.
- Vypĺňaj len čo je jasne čitateľné. Nedopĺňaj alergény, gramáže ani ceny,
  ak nie sú napísané.
- V textoch jedál nepoužívaj úvodzovky, citácie ani odkazy na zdroj –
  vráť čistý názov jedla bez akýchkoľvek značiek.

Vráť IBA platný JSON, bez markdownu, bez \`\`\`, bez textu navyše, v tvare:
{ "days": [ { "day": "pondelok|utorok|streda|štvrtok|piatok",
              "soup1_name": string, "main1_name": string, "main2_name": string } ] }`

// Z odseknutej (truncated) odpovede vytiahne kompletné dni – objekty bez
// vnoreného {} – aby aspoň plne prepísané dni neprišli nazmar.
function salvageDays(text) {
  const out = []
  const re = /\{[^{}]*\}/g
  let m
  while ((m = re.exec(text)) !== null) {
    try {
      const o = JSON.parse(m[0])
      if (o && (o.day || o.soup1_name || o.main1_name || o.main2_name)) out.push(o)
    } catch {
      // neúplný objekt – preskoč
    }
  }
  return out
}

export default async function handler(req, res) {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'OCR API not configured' })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { fileBase64, mimeType } = req.body ?? {}
  if (!fileBase64 || typeof fileBase64 !== 'string') {
    return res.status(400).json({ error: 'Chýba súbor' })
  }
  // obrázok (image/*) alebo PDF (application/pdf)
  const mime = String(mimeType || 'image/jpeg').split(';')[0].trim()

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
            { inline_data: { mime_type: mime, data: fileBase64 } },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
          // transkripcia nepotrebuje „thinking" – uvoľní to celý budget na výstup
          // a zabráni odseknutiu (truncation) JSON-u pri 3.x modeloch
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })
    if (!r.ok) {
      const detail = await r.text()
      console.error('[menu-ocr] Gemini error:', r.status, detail.slice(0, 500))
      return res.status(502).json({ error: 'Prepis menu zlyhal, skús to znova.', status: r.status, detail: detail.slice(0, 400) })
    }

    const data = await r.json()
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')

    let days = null
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed?.days)) days = parsed.days
    } catch {
      // odseknutý/nevalidný JSON → zachráň aspoň kompletne prepísané dni
      days = salvageDays(text)
    }

    if (!days || days.length === 0) {
      console.error('[menu-ocr] invalid JSON from Gemini:', text.slice(0, 500))
      return res.status(502).json({ error: 'Prepis menu zlyhal, skús to znova.', detail: 'neplatný JSON: ' + text.slice(0, 200) })
    }

    return res.json({
      days: days.map((d) => ({
        day: typeof d?.day === 'string' ? d.day : null,
        soup1_name: d?.soup1_name ?? null,
        main1_name: d?.main1_name ?? null,
        main2_name: d?.main2_name ?? null,
      })),
    })
  } catch (err) {
    console.error('[menu-ocr]', err.message)
    return res.status(500).json({ error: 'Prepis menu zlyhal, skús to znova.', detail: err.message })
  }
}
