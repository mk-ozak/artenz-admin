import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Kontrola novej verzie každých 10 minút
const CHECK_INTERVAL = 10 * 60 * 1000

// Lišta „K dispozícii je nová verzia" – zobrazí sa, keď je nasadený
// nový build. Kontroluje sa periodicky a pri návrate do appky.
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return
      setInterval(() => registration.update(), CHECK_INTERVAL)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update()
      })
    },
  })

  useEffect(() => {
    if (needRefresh) console.info('Nová verzia aplikácie je k dispozícii')
  }, [needRefresh])

  if (!needRefresh) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3
                    rounded-lg shadow-2xl px-4 py-3 text-sm text-white"
         style={{ background: '#354d5d' }}>
      <span className="font-medium">K dispozícii je nová verzia aplikácie</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="font-bold px-3 py-1 rounded-md transition-opacity hover:opacity-90"
        style={{ background: '#4cbfb3', color: '#0a2d2a' }}
      >
        Obnoviť
      </button>
    </div>
  )
}
