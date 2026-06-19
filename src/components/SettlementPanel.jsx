import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Segmented from './Segmented'
import { SETTLEMENT_DOCUMENTS, SETTLEMENT_METHODS } from '../lib/settlement'

// Panel vyúčtovania pre minulú rezerváciu — vždy editovateľný (aj keď je už
// vyúčtovaná). Sám si načíta a ukladá hodnoty; zmeny sa cez Supabase real-time
// prejavia v diári (prefarbenie/zošednutie). „Je vyúčtované?" = doklad != null.
export default function SettlementPanel({ bookingId }) {
  const [doc, setDoc]       = useState(null)
  const [method, setMethod] = useState(null)
  const [error, setError]   = useState('')

  useEffect(() => {
    supabase
      .from('bookings')
      .select('settlement_document, settlement_method')
      .eq('id', bookingId)
      .single()
      .then(({ data }) => {
        setDoc(data?.settlement_document ?? null)
        setMethod(data?.settlement_method ?? null)
      })
  }, [bookingId])

  async function save(column, value, setLocal) {
    setLocal(value)
    const { error } = await supabase
      .from('bookings')
      .update({ [column]: value })
      .eq('id', bookingId)
    if (error) setError(error.message)
  }

  return (
    <div className="rounded-card bg-white border border-[#e0e8ec] overflow-hidden">
      <p className="text-[10px] text-[#8aaabb] tracking-widest uppercase px-4 pt-3 pb-1">
        Vyúčtovanie
      </p>
      <div className="px-4 pb-4 space-y-3">
        <div className="flex gap-3">
          <div className="min-w-0" style={{ flex: '3 1 0' }}>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Doklad</label>
            <Segmented
              options={SETTLEMENT_DOCUMENTS}
              value={doc}
              onChange={v => save('settlement_document', v, setDoc)}
            />
          </div>
          <div className="min-w-0" style={{ flex: '2 1 0' }}>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Spôsob platby</label>
            <Segmented
              options={SETTLEMENT_METHODS}
              value={method}
              onChange={v => save('settlement_method', v, setMethod)}
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
