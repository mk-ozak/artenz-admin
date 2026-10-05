import { Fragment, useEffect, useState } from 'react'
import { IconDownload, IconPrinter, IconScissors, IconX } from '@tabler/icons-react'
import { buildEscPos, canvasToRaster, rasterToCanvas, rawbtUrl } from '../../utils/escpos'

// RawBT je Android aplikácia — inde sa dá lístok len stiahnuť ako PNG
const IS_ANDROID = /Android/i.test(navigator.userAgent)

// Medzera s naznačeným rezom medzi lístkami v stiahnutom PNG
const CUT_GAP = 48

// Náhľad lístkov pre termotlačiareň (do kuchyne, zhrnutie pre zákazníka).
// render(ticket) → plátna lístkov; file = názov stiahnutého PNG za dátumom.
// Lístky aj dáta pre tlačiareň sa pripravia hneď po otvorení, aby „Tlačiť"
// otvorilo RawBT synchrónne priamo z ťuknutia — Chrome intent po await nepustí.
export default function TicketPreview({ title, ticket, render, file, onClose }) {
  const [out, setOut]     = useState(null)  // { images, previews, url }
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    render(ticket)
      .then(canvases => {
        if (!alive) return
        const rasters = canvases.map(canvasToRaster)
        // Náhľad z 1-bit rastra = presne to, čo vytlačí tlačiareň
        const previews = rasters.map(rasterToCanvas)
        setOut({
          images: previews.map(c => c.toDataURL('image/png')),
          previews,
          url: rawbtUrl(buildEscPos(rasters)),
        })
      })
      .catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [ticket, render])

  function print() {
    window.location.href = out.url
  }

  // Lístky pod sebou do jedného PNG (s naznačeným rezom) — test bez tlačiarne
  function downloadPng() {
    const { previews } = out
    const canvas = document.createElement('canvas')
    canvas.width = previews[0].width
    canvas.height = previews.reduce((h, c) => h + c.height, 0) + (previews.length - 1) * CUT_GAP
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000'
    let y = 0
    previews.forEach((c, i) => {
      if (i > 0) {
        for (let x = 0; x < canvas.width; x += 16) ctx.fillRect(x, y + CUT_GAP / 2 - 1, 8, 2)
        y += CUT_GAP
      }
      ctx.drawImage(c, 0, y)
      y += c.height
    })
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${ticket.date}_${file}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[640px] mx-4 overflow-hidden
                      flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 flex items-center justify-between shrink-0"
             style={{ background: '#354d5d' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#ddeef6' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavrieť"
            className="w-8 h-8 rounded-full flex items-center justify-center
                       bg-white/10 hover:bg-white/20 transition-colors"
          >
            <IconX size={16} style={{ color: '#ddeef6' }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 bg-[#eef3f6] px-4 py-4">
          {!out && !error && (
            <p className="text-sm text-[#8aaabb] italic">Pripravujem lístok…</p>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
          {out?.images.map((src, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <div className="flex items-center gap-2 my-3 text-[11px] font-bold uppercase
                                tracking-wider text-[#5d7d8e]">
                  <IconScissors size={15} className="shrink-0" />
                  <span className="flex-1 border-t-2 border-dashed border-[#9ab0ba]" />
                  rez
                  <span className="flex-1 border-t-2 border-dashed border-[#9ab0ba]" />
                </div>
              )}
              <img
                src={src}
                alt={`${title} – lístok ${i + 1}`}
                className="block w-full bg-white shadow-sm"
              />
            </Fragment>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex gap-2">
          <button
            type="button"
            onClick={downloadPng}
            disabled={!out}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 border border-gray-300
                       text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors
                       disabled:opacity-50"
          >
            <IconDownload size={16} />
            Stiahnuť PNG
          </button>
          {IS_ANDROID && (
            <button
              type="button"
              onClick={print}
              disabled={!out}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-bold
                         rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: '#4cbfb3', color: '#0a2d2a' }}
            >
              <IconPrinter size={16} />
              Tlačiť
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
