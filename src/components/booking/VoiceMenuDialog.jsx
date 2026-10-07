import { IconLoader2, IconMicrophone, IconX } from '@tabler/icons-react'
import RecordingOverlay from '../RecordingOverlay'

// Príklad diktovania — počas nahrávania aj v okne
const EXAMPLE = '„Osemdesiat dospelých, z toho päť vege, desať detí s jedlom. Prípitok prosecco, ' +
  'polievka hovädzí vývar, mäso krkovička a panenka plnená slivkou, príloha opekané ' +
  'zemiaky. Pre deti rezeň s hranolkami. Na raut vyprážané rezne päť kíl…“'

// Hlasové zadanie menu. Nahrávanie aj spracovanie riadi BookingMenu
// (useVoiceRecorder). Počas nahrávania je celá obrazovka veľké tlačidlo
// Zastaviť (RecordingOverlay); okno ukazuje spracovanie, chybu a opakovanie.
// Počas spracovania sa okno zavrieť nedá (zápis do menu ešte beží).
export default function VoiceMenuDialog({ voice, onClose }) {
  const { phase, error } = voice
  const processing = phase === 'processing'

  if (phase === 'starting' || phase === 'recording') {
    return (
      <RecordingOverlay voice={voice} onCancel={onClose}>
        <div className="w-full max-w-sm rounded-lg bg-white/10 px-4 py-3 text-left text-xs text-[#ddeef6]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#8aaabb] mb-1">
            Napríklad
          </p>
          <p className="italic leading-relaxed">{EXAMPLE}</p>
        </div>
      </RecordingOverlay>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden
                      flex flex-col max-h-[85vh]">
        <div className="px-5 py-4 flex items-center justify-between shrink-0"
             style={{ background: '#354d5d' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#ddeef6' }}>
            Nadiktovať menu
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            aria-label="Zavrieť"
            className="w-8 h-8 rounded-full flex items-center justify-center
                       bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-40"
          >
            <IconX size={16} style={{ color: '#ddeef6' }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5">
          <div className="flex flex-col items-center text-center">
            <button
              type="button"
              onClick={voice.toggle}
              disabled={processing}
              aria-label="Začať nahrávať"
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors
                ${processing ? 'bg-[#eef3f6]' : 'bg-[#4cbfb3] hover:opacity-90'}`}
            >
              {processing
                ? <IconLoader2 size={34} className="animate-spin text-[#5d7d8e]" />
                : <IconMicrophone size={34} className="text-[#0a2d2a]" />}
            </button>
            <p className="mt-3 text-sm font-semibold text-[#1a2830]">
              {processing ? 'Spracúvam…' : 'Ťukni na mikrofón a hovor'}
            </p>
            {processing && (
              <p className="mt-0.5 text-xs text-[#5d7d8e]">
                Hľadám jedlá v katalógu — môže to trvať aj pol minúty.
              </p>
            )}
          </div>

          {error && (
            <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="mt-5 rounded-lg bg-[#f0f6f9] px-4 py-3 text-xs text-[#3a5160]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#5d7d8e] mb-1">
              Napríklad
            </p>
            <p className="italic leading-relaxed">{EXAMPLE}</p>
            <ul className="mt-2 space-y-1 list-disc pl-4">
              <li>Celé menu naraz alebo len časť — diktovanie len pridáva, nič nemaže.</li>
              <li>Jedlá, ktoré nie sú v katalógu, sa preskočia — uvidíš ich v zhrnutí.</li>
            </ul>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 text-sm
                       font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Zrušiť
          </button>
        </div>
      </div>
    </div>
  )
}
