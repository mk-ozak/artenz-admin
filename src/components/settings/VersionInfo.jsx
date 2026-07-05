/* global __BUILD_TIME__ */
import { IconInfoCircle } from '@tabler/icons-react'

// Dátum a čas buildu — dosadzuje ho Vite pri builde (define v vite.config.js)
const builtAt = new Date(__BUILD_TIME__)

const stamp = builtAt.toLocaleString('sk', {
  day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
})

// Záložka „Aktuálna verzia" — kedy bola zostavená verzia, ktorá práve beží.
// Slúži na rýchle overenie, či sa v prehliadači/PWA už aktivoval nový deploy.
export default function VersionInfo() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        Aktuálna verzia aplikácie
      </p>
      <p className="text-2xl font-bold text-gray-900">{stamp}</p>
      <p className="mt-4 text-xs text-gray-500 flex items-start gap-1.5">
        <IconInfoCircle size={16} className="shrink-0 mt-px text-gray-400" />
        <span>
          Dátum a čas zostavenia verzie, ktorá práve beží v tomto okne.
          Nová verzia sa kontroluje každých 5 minút a pri prepnutí do aplikácie —
          keď je k dispozícii, hore sa zobrazí lišta „Obnoviť".
        </span>
      </p>
    </div>
  )
}
