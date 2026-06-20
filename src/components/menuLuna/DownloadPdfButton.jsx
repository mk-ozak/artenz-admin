import { useState } from 'react'
import { IconDownload, IconLoader2 } from '@tabler/icons-react'
import { toISO } from '../../utils/menuDates'

// Stiahne PDF pre daný týždeň (monday = Date) z Python serverless funkcie.
export default function DownloadPdfButton({ monday }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function stiahni() {
    setErr('')
    setBusy(true)
    try {
      const res = await fetch(`/api/generate-pdf?week=${toISO(monday)}`)
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(detail || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Luna_menu.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.warn('[pdf] download failed:', e.message)
      setErr('PDF sa nepodarilo vygenerovať: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={stiahni}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold
                   bg-[#354d5d] text-white hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {busy ? <IconLoader2 size={17} className="animate-spin" /> : <IconDownload size={17} />}
        Stiahnuť PDF
      </button>
      {err && <span className="text-xs text-red-500 text-right max-w-xs">{err}</span>}
    </div>
  )
}
