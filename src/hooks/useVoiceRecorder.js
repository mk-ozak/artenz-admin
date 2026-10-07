import { useEffect, useRef, useState } from 'react'

// Hlasové zadanie: MediaRecorder → base64 → onAudio({ audioBase64, mimeType }).
// Odoslanie a spracovanie nahrávky rieši volajúci (napr. cez postVoice).
// Fázy: idle → starting (čaká na mikrofón) → recording (klik = stop, max maxMs)
// → processing → idle. Chyba vyhodená z onAudio sa ukáže ako error — text
// Error je hláška pre používateľa.
// Používa nová rezervácia (BookingModal) aj menu rezervácie (BookingMenu);
// počas starting/recording obe ukazujú RecordingOverlay.

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

// Na reč stačí nižšia kvalita — menšia nahrávka sa rýchlejšie odošle a aj
// niekoľkominútové diktovanie sa zmestí do limitu Vercelu (4,5 MB na požiadavku)
const AUDIO_BITS_PER_SECOND = 32_000

const GENERIC_ERROR = 'Nepodarilo sa rozpoznať, skús to znova.'

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  return MIME_CANDIDATES.find(t => MediaRecorder.isTypeSupported(t)) ?? null
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function useVoiceRecorder(onAudio, { maxMs = 60_000 } = {}) {
  const [phase, setPhase]     = useState('idle')   // 'idle' | 'starting' | 'recording' | 'processing'
  const [error, setError]     = useState('')
  const [seconds, setSeconds] = useState(0)        // dĺžka práve nahrávaného záznamu
  const recorderRef  = useRef(null)
  const timerRef     = useRef(null)
  const tickRef      = useRef(null)
  const cancelledRef = useRef(false)
  const wakeLockRef  = useRef(null)
  // Číslo pokusu — reset/odmontovanie počas čakania na mikrofón ho zneplatní
  const sessionRef   = useRef(0)
  // Vždy aktuálny callback — nahrávanie končí o niekoľko renderov neskôr
  const onAudioRef = useRef(onAudio)
  onAudioRef.current = onAudio

  function releaseWakeLock() {
    wakeLockRef.current?.release().catch(() => {})
    wakeLockRef.current = null
  }

  // Pri odmontovaní zastav nahrávanie aj mikrofón
  useEffect(() => () => {
    sessionRef.current++
    clearTimeout(timerRef.current)
    clearInterval(tickRef.current)
    releaseWakeLock()
    const rec = recorderRef.current
    if (rec) {
      cancelledRef.current = true
      if (rec.state !== 'inactive') rec.stop()
      rec.stream.getTracks().forEach(t => t.stop())
    }
  }, [])

  async function start() {
    const session = ++sessionRef.current
    setError('')
    setSeconds(0)
    const mimeType = pickMimeType()
    if (!mimeType || !navigator.mediaDevices?.getUserMedia) {
      setError('Tento prehliadač nepodporuje nahrávanie zvuku.')
      return
    }

    setPhase('starting')
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      if (session !== sessionRef.current) return
      console.warn('[voice] getUserMedia failed:', e.message)
      setError('Nepodarilo sa získať prístup k mikrofónu. Povoľ mikrofón v nastaveniach prehliadača a skús to znova.')
      setPhase('idle')
      return
    }
    // Zrušené počas čakania na mikrofón → hneď ho pusti
    if (session !== sessionRef.current) {
      stream.getTracks().forEach(t => t.stop())
      return
    }

    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: AUDIO_BITS_PER_SECOND })
    const chunks = []

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

    recorder.onstop = async () => {
      clearTimeout(timerRef.current)
      clearInterval(tickRef.current)
      releaseWakeLock()
      stream.getTracks().forEach(t => t.stop())
      recorderRef.current = null

      if (cancelledRef.current) {
        cancelledRef.current = false
        setPhase('idle')
        return
      }

      setPhase('processing')
      try {
        const blob = new Blob(chunks, { type: mimeType })
        const audioBase64 = await blobToBase64(blob)
        await onAudioRef.current({ audioBase64, mimeType })
      } catch (e) {
        console.warn('[voice] processing failed:', e.message)
        setError(e.message || GENERIC_ERROR)
      } finally {
        setPhase('idle')
      }
    }

    recorderRef.current = recorder
    recorder.start()
    setPhase('recording')
    // Obrazovka počas diktovania nezhasne (tlačidlo Zastaviť musí byť po ruke);
    // bez podpory Wake Lock sa nič nestane
    navigator.wakeLock?.request('screen')
      .then(lock => {
        if (recorderRef.current === recorder) wakeLockRef.current = lock
        else lock.release().catch(() => {})
      })
      .catch(() => {})
    const startedAt = Date.now()
    tickRef.current = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    timerRef.current = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop()
    }, maxMs)
  }

  function toggle() {
    if (phase === 'recording') {
      recorderRef.current?.stop()
    } else if (phase === 'idle') {
      start()
    }
  }

  // Zahodí rozbehnuté nahrávanie bez spracovania (zatvorenie okna, zrušenie)
  function reset() {
    sessionRef.current++
    setError('')
    const rec = recorderRef.current
    if (rec) {
      cancelledRef.current = true
      clearTimeout(timerRef.current)
      clearInterval(tickRef.current)
      if (rec.state !== 'inactive') rec.stop()
    } else {
      setPhase(p => (p === 'starting' ? 'idle' : p))
    }
  }

  return { phase, error, seconds, maxSeconds: Math.round(maxMs / 1000), toggle, reset }
}

// Odoslanie nahrávky (a ďalších údajov) na /api funkciu → JSON odpoveď.
// Chyba → Error so slovenskou hláškou pre používateľa.
export async function postVoice(url, body) {
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Nepodarilo sa spojiť so serverom. Skontroluj internet a skús to znova.')
  }
  // Limity Vercelu (príliš veľká požiadavka / príliš dlhé spracovanie) — odpoveď nie je JSON
  if (res.status === 413) throw new Error('Nahrávka je príliš dlhá — skús kratšie diktovanie.')
  if (res.status === 504) throw new Error('Spracovanie trvalo príliš dlho — skús kratšie diktovanie.')
  const data = await res.json().catch(() => null)
  if (!res.ok || !data || typeof data !== 'object' || data.error) {
    console.warn('[voice] API error:', res.status, data?.error)
    throw new Error(data?.error || GENERIC_ERROR)
  }
  return data
}
