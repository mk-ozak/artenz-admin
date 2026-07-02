import { useState } from 'react'
import { IconPlus, IconX } from '@tabler/icons-react'
import { formatDateSkYear } from '../utils/format'
import { toISO } from '../utils/diaryWeeks'

// Evidencia zaplatených záloh: zoznam platieb { date: 'YYYY-MM-DD', amount }.
// Zoznam vlastní rodič (BookingModal) — onChange(next) dostane celé nové pole;
// súčet do poľa Záloha a uloženie rieši rodič. Suma prvej platby sa
// predvyplní z poľa Záloha, pri ďalších ju treba zadať.
export default function DepositsModal({ payments = [], defaultAmount = '', onChange, onClose }) {
  const [adding, setAdding] = useState(false)
  const [date, setDate]     = useState(toISO(new Date()))
  const [amount, setAmount] = useState('')

  const sum = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const n   = Number(amount)
  const canAdd = Boolean(date) && Number.isInteger(n) && n > 0

  function startAdd() {
    setDate(toISO(new Date()))
    setAmount(payments.length === 0 && defaultAmount !== '' && defaultAmount != null
      ? String(defaultAmount)
      : '')
    setAdding(true)
  }

  function confirmAdd() {
    if (!canAdd) return
    const next = [...payments, { date, amount: n }]
      .sort((a, b) => a.date.localeCompare(b.date))
    onChange(next)
    setAdding(false)
  }

  function remove(i) {
    onChange(payments.filter((_, idx) => idx !== i))
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4" style={{ background: '#354d5d' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#ddeef6' }}>Zaplatené zálohy</h2>
        </div>

        <div className="p-5 space-y-4">
          {payments.length === 0 && !adding && (
            <p className="text-sm text-gray-500">
              Zatiaľ nie je evidovaná žiadna zaplatená záloha.
            </p>
          )}

          {payments.length > 0 && (
            <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {payments.map((p, i) => (
                <li key={`${p.date}-${i}`} className="flex items-center gap-2 px-3 py-2">
                  <span className="flex-1 text-sm text-gray-700">{formatDateSkYear(p.date)}</span>
                  <span className="text-sm font-semibold text-gray-900">{Number(p.amount)} €</span>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    title="Odstrániť zálohu"
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50
                      transition-colors"
                  >
                    <IconX size={16} />
                  </button>
                </li>
              ))}
              <li className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-b-lg">
                <span className="text-xs font-medium text-gray-500">Spolu zaplatené</span>
                <span className="text-sm font-bold text-gray-900">{sum} €</span>
              </li>
            </ul>
          )}

          {adding ? (
            <div className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Dátum zaplatenia
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white
                      focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="w-24 shrink-0">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Suma (€)</label>
                  <input
                    autoFocus
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    min="1"
                    step="1"
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white
                      focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-xs
                    font-medium rounded-lg hover:bg-white transition-colors"
                >
                  Zrušiť
                </button>
                <button
                  type="button"
                  disabled={!canAdd}
                  onClick={confirmAdd}
                  className="flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-opacity
                    hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#4cbfb3', color: '#0a2d2a' }}
                >
                  Pridať
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={startAdd}
              className="w-full px-4 py-2.5 border border-gray-300 text-gray-700 text-sm
                font-medium rounded-lg hover:bg-gray-50 transition-colors
                flex items-center justify-center gap-1.5"
            >
              <IconPlus size={16} />
              Pridať zálohu
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-bold rounded-lg transition-opacity
              hover:opacity-90"
            style={{ background: '#4cbfb3', color: '#0a2d2a' }}
          >
            Zavrieť
          </button>
        </div>
      </div>
    </div>
  )
}
