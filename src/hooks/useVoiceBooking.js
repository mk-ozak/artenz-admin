import { useEffect, useRef, useState } from 'react'

// Hlasové zadanie rezervácie: MediaRecorder → base64 → /api/parse-booking.
// Fázy: idle → recording (klik = stop, max 60 s) → processing → idle.

const MAX_RECORDING_MS = 60_000

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

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

export function useVoiceBooking(onResult) {
  const [phase, setPhase] = useState('idle')   // 'idle' | 'recording' | 'processing'
  const [error, setError] = useState('')
  const recorderRef  = useRef(null)
  const timerRef     = useRef(null)
  const cancelledRef = useRef(false)

  // Pri odmontovaní zastav nahrávanie aj mikrofón
  useEffect(() => () => {
    clearTimeout(timerRef.current)
    const rec = recorderRef.current
    if (rec) {
      cancelledRef.current = true
      if (rec.state !== 'inactive') rec.stop()
      rec.stream.getTracks().forEach(t => t.stop())
    }
  }, [])

  async function start() {
    setError('')
    const mimeType = pickMimeType()
    if (!mimeType || !navigator.mediaDevices?.getUserMedia) {
      setError('Tento prehliadač nepodporuje nahrávanie zvuku.')
      return
    }

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      console.warn('[voice] getUserMedia failed:', e.message)
      setError('Nepodarilo sa získať prístup k mikrofónu. Povoľ mikrofón v nastaveniach prehliadača a skús to znova.')
      return
    }

    const recorder = new MediaRecorder(stream, { mimeType })
    const chunks = []

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

    recorder.onstop = async () => {
      clearTimeout(timerRef.current)
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
        const res = await fetch('/api/parse-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioBase64, mimeType }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data || typeof data !== 'object' || data.error) {
          throw new Error(data?.error ?? `HTTP ${res.status}`)
        }
        onResult(data)
      } catch (e) {
        console.warn('[voice] parse failed:', e.message)
        setError('Nepodarilo sa rozpoznať, skús to znova.')
      } finally {
        setPhase('idle')
      }
    }

    recorderRef.current = recorder
    recorder.start()
    setPhase('recording')
    timerRef.current = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop()
    }, MAX_RECORDING_MS)
  }

  function toggle() {
    if (phase === 'recording') {
      recorderRef.current?.stop()
    } else if (phase === 'idle') {
      start()
    }
  }

  // Reset pri otvorení/zatvorení modálu — zahodí rozbehnuté nahrávanie bez spracovania
  function reset() {
    setError('')
    const rec = recorderRef.current
    if (rec) {
      cancelledRef.current = true
      clearTimeout(timerRef.current)
      if (rec.state !== 'inactive') rec.stop()
    }
  }

  return { phase, error, toggle, reset }
}
