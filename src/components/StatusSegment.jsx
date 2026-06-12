import { useState } from 'react'
import { formatDateSk } from '../utils/format'

const STATUSES = [
  { value: 'dopyt',     label: 'Nezáväzný dopyt' },
  { value: 'zaloha',    label: 'Čakajúca záloha' },
  { value: 'potvrdene', label: 'Potvrdené' },
]

// Platobné údaje do SMS — IBAN doplň podľa reality
const PAYMENT_IBAN = 'SK00 0000 0000 0000 0000 0000'

// Variabilný symbol: dátum akcie ako RRRRMMDD
function paymentSms(phone, { typeLabel, dateISO, amount }) {
  const vs   = (dateISO ?? '').replaceAll('-', '')
  const text =
    `Dobrý deň, k Vašej rezervácii v Artenz (${typeLabel}, ${formatDateSk(dateISO)}) ` +
    `prosíme o úhradu zálohy ${amount} €. IBAN: ${PAYMENT_IBAN}, VS: ${vs}. Ďakujeme.`
  return `sms:${phone}?body=${encodeURIComponent(text)}`
}

// Prepínač stavu rezervácie s ochranou potvrdeného stavu:
//  - potvrdene → zobrazené len jedno tlačidlo; zmena stavu vyžaduje prepis mena
//    zákazníka a vráti stav na "zaloha"
//  - dopyt → zaloha ponúkne prípravu SMS s platobnými údajmi
//  - onChange(next) volá rodič — ten stav aj okamžite uloží (ak rezervácia existuje)
export default function StatusSegment({
  value,
  onChange,
  customerName = '',
  phone = '',
  typeLabel = '',
  dateISO = '',
  amount = 0,
}) {
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [unlockText, setUnlockText] = useState('')
  const [smsOpen, setSmsOpen]       = useState(false)

  const smsPhone  = phone?.replace(/\s+/g, '') ?? ''
  const canUnlock =
    unlockText.trim() !== '' &&
    unlockText.trim().toLowerCase() === (customerName ?? '').trim().toLowerCase()

  function select(next) {
    if (next === value) return
    const prev = value
    onChange(next)
    if (prev === 'dopyt' && next === 'zaloha') setSmsOpen(true)
  }

  function confirmUnlock() {
    setUnlockOpen(false)
    setUnlockText('')
    onChange('zaloha')
  }

  return (
    <>
      {value === 'potvrdene' ? (
        // Potvrdená rezervácia: jediné tlačidlo, zmena len cez ochranu
        <button
          type="button"
          onClick={() => { setUnlockText(''); setUnlockOpen(true) }}
          className="w-full px-4 py-2 rounded-full text-xs font-semibold
                     shadow-[0_2px_10px_rgba(53,77,93,.10)] transition-opacity hover:opacity-90
                     disabled:opacity-60"
          style={{ background: '#4cbfb3', color: '#0a2d2a' }}
        >
          Potvrdené
        </button>
      ) : (
        <div className="grid grid-cols-3 rounded-full bg-white border border-gray-200 p-1
                        shadow-[0_2px_10px_rgba(53,77,93,.10)]">
          {STATUSES.map(s => {
            const active = value === s.value
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => select(s.value)}
                className={`px-1 py-2 rounded-full text-xs font-semibold truncate transition-colors
                            disabled:opacity-60
                            ${active ? '' : 'text-gray-600 hover:text-gray-900'}`}
                style={active ? { background: '#4cbfb3', color: '#0a2d2a' } : undefined}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Ochrana zmeny potvrdeného stavu */}
      {unlockOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4" style={{ background: '#354d5d' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#ddeef6' }}>Zmena stavu</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-700">
                Rezervácia už bola označená ako potvrdená. Ak chceš meniť stav,
                prepíš názov rezervácie:{' '}
                <span className="font-semibold text-gray-900">{customerName}</span>
              </p>
              <input
                autoFocus
                type="text"
                value={unlockText}
                onChange={e => setUnlockText(e.target.value)}
                placeholder="Názov rezervácie"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setUnlockOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm
                    font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Zrušiť
                </button>
                <button
                  type="button"
                  disabled={!canUnlock}
                  onClick={confirmUnlock}
                  className="flex-1 px-4 py-2.5 text-sm font-bold rounded-lg transition-opacity
                    hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#4cbfb3', color: '#0a2d2a' }}
                >
                  Zmeniť stav
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ponuka SMS s platobnými údajmi (dopyt → čakajúca záloha) */}
      {smsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4" style={{ background: '#354d5d' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#ddeef6' }}>Platobné údaje</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-700">Chceš odoslať SMS s platobnými údajmi?</p>
              {!smsPhone && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                  Rezervácia nemá telefónne číslo — SMS sa nedá pripraviť.
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSmsOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm
                    font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Nie
                </button>
                {smsPhone && (
                  <a
                    href={paymentSms(smsPhone, { typeLabel, dateISO, amount })}
                    onClick={() => setSmsOpen(false)}
                    className="flex-1 px-4 py-2.5 text-sm font-bold rounded-lg text-center
                      transition-opacity hover:opacity-90"
                    style={{ background: '#4cbfb3', color: '#0a2d2a' }}
                  >
                    Áno, pripraviť SMS
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
