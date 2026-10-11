import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { VO_COLOR, VO_STATUS_LABEL } from '../../lib/vo'

// Prepínač stavu objednávky VO: Koncept | FINAL. Prepnutie na FINAL sa potvrdzuje
// (objednávka sa pre VO zamkne), späť na Koncept ide hneď. Každé prepnutie
// zachytí log (trigger na bookings → zmena „Stav objednávky").
export default function VoStatusToggle({ bookingId, value, onChange, disabled = false }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')

  async function save(next) {
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('bookings').update({ vo_status: next }).eq('id', bookingId)
    setBusy(false)
    if (err) { setError(err.message); return }
    setConfirm(false)
    onChange(next)
  }

  function pick(next) {
    if (next === value) return
    if (next === 'final') { setConfirm(true); return }
    save(next)
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 rounded-lg bg-white border border-gray-200 p-1
                      shadow-[0_2px_10px_rgba(53,77,93,.10)]">
        {['koncept', 'final'].map(v => {
          const active = value === v
          return (
            <button
              key={v}
              type="button"
              disabled={disabled || busy}
              onClick={() => pick(v)}
              className={`px-2 py-2 rounded-md text-xs font-bold tracking-wide transition-colors
                          disabled:opacity-60
                          ${active ? '' : 'text-gray-500 hover:text-gray-900'}`}
              style={active
                ? (v === 'final'
                    ? { background: VO_COLOR, color: '#fff' }
                    : { background: '#dfe7ec', color: '#1a2830' })
                : undefined}
            >
              {VO_STATUS_LABEL[v]}
            </button>
          )
        })}
      </div>

      {confirm && (
        <div className="mt-2 rounded-lg border border-[#f3c6b6] bg-[#fdf3ef] px-3 py-2.5">
          <p className="text-sm text-[#7a3a22]">
            Po prepnutí na FINAL sa objednávka zamkne. Na ďalšie úpravy ju bude treba
            prepnúť späť na Koncept.
          </p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => save('final')}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity
                         hover:opacity-90 disabled:opacity-50"
              style={{ background: VO_COLOR }}
            >
              {busy ? 'Ukladám…' : 'Prepnúť na FINAL'}
            </button>
            <button
              type="button"
              onClick={() => setConfirm(false)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-700
                         bg-white hover:bg-gray-50 transition-colors"
            >
              Zrušiť
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
    </div>
  )
}
