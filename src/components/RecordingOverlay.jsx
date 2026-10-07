import { createPortal } from 'react-dom'
import { IconPlayerStopFilled } from '@tabler/icons-react'

// Sekundy → „m:ss"
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// Nahrávanie cez celú obrazovku: časovač, veľké tlačidlo Zastaviť (na mobile
// cez pol obrazovky, od sm menšie) a Zrušiť. Ukáže sa len počas štartu
// mikrofónu a nahrávania (fázy z useVoiceRecorder), nad všetkými modálmi.
// children: voliteľný návod pod tlačidlom (napr. príklad diktovania menu).
// onCancel: zahodenie nahrávky bez spracovania.
export default function RecordingOverlay({ voice, onCancel, children }) {
  const { phase, seconds, maxSeconds } = voice
  if (phase !== 'starting' && phase !== 'recording') return null
  const starting = phase === 'starting'

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#1a2830]">
      <div className="min-h-full flex flex-col items-center justify-center gap-6 px-6 py-8 text-center">
        <div>
          <p className="flex items-center justify-center gap-2 text-xs font-bold uppercase
                        tracking-[.18em] text-[#ddeef6]">
            <span className={`w-2.5 h-2.5 rounded-full
                              ${starting ? 'bg-[#8aaabb]' : 'bg-red-500 animate-pulse'}`} />
            {starting ? 'Spúšťam mikrofón…' : 'Nahrávam'}
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-white">
            {fmtTime(seconds)}
            <span className="text-lg font-medium text-[#8aaabb]"> / {fmtTime(maxSeconds)}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={voice.toggle}
          disabled={starting}
          aria-label="Zastaviť nahrávanie"
          className="relative w-[min(80vw,48dvh)] sm:w-48 aspect-square shrink-0 rounded-full
                     bg-red-500 shadow-2xl flex flex-col items-center justify-center gap-[5%]
                     transition-transform active:scale-95 disabled:opacity-60"
        >
          {!starting && (
            <span aria-hidden className="absolute -inset-3 rounded-full bg-red-500/25 animate-pulse" />
          )}
          <IconPlayerStopFilled className="relative w-[30%] h-[30%] text-white" />
          <span className="relative text-lg sm:text-sm font-bold uppercase tracking-[.2em] text-white">
            Zastaviť
          </span>
        </button>

        {children}

        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-lg border border-white/25 text-sm font-medium
                     text-[#ddeef6] hover:bg-white/10 transition-colors"
        >
          Zrušiť nahrávanie
        </button>
      </div>
    </div>,
    document.body,
  )
}
