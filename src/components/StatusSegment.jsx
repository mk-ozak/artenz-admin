import { useState } from 'react'
import { formatDateSkYear } from '../utils/format'

const STATUSES = [
  { value: 'dopyt',     label: 'Nezáväzný dopyt' },
  { value: 'zaloha',    label: 'Čakajúca záloha' },
  { value: 'potvrdene', label: 'Potvrdené' },
]

// Platobné údaje do SMS — IBAN bez medzier (ľahšie kopírovanie do bankovej appky)
const PAYMENT_ACCOUNT = 'MARTENZ, s.r.o., IBAN: SK0909000000005144434708'

// Variabilný symbol: dátum akcie ako RRRRMMDD
function paymentSms(phone, { typeLabel, dateISO, amount, hallLabel }) {
  const vs   = (dateISO ?? '').replaceAll('-', '')
  const text =
    `Dobrý deň, k Vašej rezervácii v ${hallLabel || 'Artenz'} (${typeLabel}, ${formatDateSkYear(dateISO)}) ` +
    `prosíme o úhradu zálohy ${amount} €. ${PAYMENT_ACCOUNT}, VS: ${vs}. Ďakujeme.`
  return `sms:${phone}?body=${encodeURIComponent(text)}`
}

// Prepínač stavu rezervácie s ochranou potvrdeného stavu a logikou zálohy:
//  - potvrdene → zobrazené len jedno tlačidlo; zmena stavu vyžaduje prepis mena
//  - dopyt/zaloha → kliknutie na „Čakajúca záloha" vyhodnotí pole Záloha:
//      prázdne → dialóg „Nechať bez zálohy?" (Áno = záloha 0 + Potvrdené, Nie = focus)
//      0       → bez SMS, rovno Potvrdené
//      > 0     → ponuka SMS s platobnými údajmi, stav ostáva Čakajúca záloha
//  - priame „Potvrdené" → len nastaví stav (žiadna SMS, žiadny dialóg)
//  - onChange(next) / onSetDeposit(v) volá rodič — ten okamžite uloží (ak edit)
export default function StatusSegment({
  value,
  onChange,
  deposit = '',
  onSetDeposit = () => {},
  onFocusDeposit = () => {},
  customerName = '',
  phone = '',
  typeLabel = '',
  dateISO = '',
  amount = 0,
  hallLabel = '',
}) {
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [unlockText, setUnlockText] = useState('')
  const [smsOpen, setSmsOpen]       = useState(false)
  // Dialóg prázdnej zálohy — drží otázku (null = zatvorený). Áno = záloha 0
  // + Potvrdené; Nie = vráti na zadanie sumy (focus). Cieľový stav po Áno
  // je vždy „Potvrdené" (priame potvrdenie aj prepnutie na čakajúcu zálohu).
  const [askZero, setAskZero] = useState(null)

  const smsPhone  = phone?.replace(/\s+/g, '') ?? ''
  const canUnlock =
    unlockText.trim() !== '' &&
    unlockText.trim().toLowerCase() === (customerName ?? '').trim().toLowerCase()

  function select(next) {
    if (next === value) return
    const empty = deposit === '' || deposit == null
    if (next === 'zaloha') {
      if (empty) { setAskZero('Nechať bez zálohy?'); return }      // spýtaj sa
      if (Number(deposit) === 0) { onChange('potvrdene'); return } // vedome bez zálohy → Potvrdené
      onChange('zaloha')                                          // > 0 → SMS, stav Čakajúca záloha
      setSmsOpen(true)
      return
    }
    if (next === 'potvrdene') {
      if (empty) { setAskZero('Záloha je nulová?'); return }       // spýtaj sa pri priamom potvrdení
      onChange('potvrdene')                                       // záloha zadaná → len potvrď
      return
    }
    onChange(next)   // „Nezáväzný dopyt"
  }

  // Áno = záloha 0 + Potvrdené
  function confirmZero() {
    setAskZero(null)
    onSetDeposit(0)
    onChange('potvrdene')
  }
  // Nie = zruš prepnutie (stav ostáva), vráť na zadanie výšky zálohy (focus)
  function cancelZero() {
    setAskZero(null)
    onFocusDeposit()
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
          className="w-full px-4 py-2 rounded-lg text-xs font-semibold
                     shadow-[0_2px_10px_rgba(53,77,93,.10)] transition-opacity hover:opacity-90
                     disabled:opacity-60"
          style={{ background: '#4cbfb3', color: '#0a2d2a' }}
        >
          Potvrdené
        </button>
      ) : (
        <div className="grid grid-cols-3 rounded-lg bg-white border border-gray-200 p-1
                        shadow-[0_2px_10px_rgba(53,77,93,.10)]">
          {STATUSES.map(s => {
            const active = value === s.value
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => select(s.value)}
                className={`px-1 py-2 rounded-md text-xs font-semibold truncate transition-colors
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
                    href={paymentSms(smsPhone, { typeLabel, dateISO, amount, hallLabel })}
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

      {/* Prázdna záloha pri prepnutí na „Čakajúca záloha" / „Potvrdené" */}
      {askZero && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4" style={{ background: '#354d5d' }}>
              <h2 className="font-semibold text-sm" style={{ color: '#ddeef6' }}>{askZero}</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-700">
                Záloha nie je zadaná. Ak potvrdíš, zapíše sa záloha 0 €.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={cancelZero}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 text-sm
                    font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Nie, zadám zálohu
                </button>
                <button
                  type="button"
                  onClick={confirmZero}
                  className="flex-1 px-4 py-2.5 text-sm font-bold rounded-lg text-center
                    transition-opacity hover:opacity-90"
                  style={{ background: '#4cbfb3', color: '#0a2d2a' }}
                >
                  Áno
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
