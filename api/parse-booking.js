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
  "start_time": string | null,
  "guest_count": number | null,
  "estimated_price": number | null,
  "deposit": number | null,
  "deposit_paid": boolean | null
}

Pravidlá:
- Reč je v slovenčine. Čokoľvek, čo nezaznelo, daj null. Nikdy si nič nevymýšľaj.
- customer_name je meno alebo názov rezervácie (napr. "Kováčovci", "firma XYZ").
  Toto je najdôležitejšie pole — sústreď sa na správne počutie priezviska.
- phone normalizuj na súvislé číslice bez medzier ("0905 123 456" -> "0905123456").
  Ak číslo zaznie po čísliciach, spoj ho. Slovenské čísla majú zvyčajne 10 číslic
  a začínajú na 09.
- event_type je krátky názov typu akcie (svadba, oslava, kar, firemná akcia, stužková...).
- status namapuj na jednu z hodnôt statusov používaných v systéme; ak nezaznel, daj null.
- start_time je čas začiatku akcie vo formáte HH:MM (24-hodinový), napr.
  "o tretej poobede" -> "15:00", "o pol siedmej večer" -> "18:30". Ak nezaznel, null.
- guest_count je počet hostí ako číslo ("asi sto ľudí" -> 100).
- estimated_price je cena NA JEDNU OSOBU v eurách, NIE celková cena. Býva obvykle
  20 až 100 € na osobu. NIKDY ju nenásob počtom hostí — zapíš sumu za jednu osobu
  presne tak, ako zaznela ("päťdesiatpäť eur na osobu" -> 55, NIE 5500). Ak ti vyjde
  viac ako pár stoviek, takmer isto si zle rozumel — vráť reálnu sumu na osobu.
- deposit je záloha v eurách ako číslo. Býva obvykle do 200 €.
- deposit_paid je true, ak zaznelo, že záloha je už zaplatená/uhradená; false, ak
  zaznelo, že ešte nie je zaplatená; ak sa o zaplatení zálohy nehovorilo, daj null.`

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
      start_time:      parsed.start_time ?? null,
      guest_count:     parsed.guest_count ?? null,
      estimated_price: parsed.estimated_price ?? null,
      deposit:         parsed.deposit ?? null,
      deposit_paid:    typeof parsed.deposit_paid === 'boolean' ? parsed.deposit_paid : null,
    })
  } catch (err) {
    console.error('[parse-booking]', err.message)
    return res.status(500).json({ error: 'Nepodarilo sa rozpoznať, skús to znova.' })
  }
}
