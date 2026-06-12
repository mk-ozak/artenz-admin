import { useEffect, useRef, useState } from 'react'
import DiaryWeekRows from './DiaryWeekRows'
import { getMonthWeeks } from '../../utils/diaryWeeks'

const SK_MONTHS = [
  'Január','Február','Marec','Apríl','Máj','Jún',
  'Júl','August','September','Október','November','December',
]

// Výška sticky hlavičky so sálami — titulok mesiaca sa kotví pod ňu
const STICKY_TOP = 37

export default function DiaryMonth({ year, month, dimmed, todayISO, bookings, onCellClick, onBookingClick }) {
  const weeks = getMonthWeeks(year, month)

  // Titulok mesiaca je šedý pásik; keď sa pri rolovaní prilepí pod hlavičku
  // so sálami, zmení sa na biely. Prilepenie sa počíta zo scroll pozície
  // sentinel riadku (IntersectionObserver pri rýchlom rolovaní preskakoval).
  const [stuck, setStuck] = useState(false)
  const sentinelRef = useRef(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const root = el.closest('[data-diary-scroll]')
    if (!root) return

    let raf = null
    const check = () => {
      raf = null
      const rootTop = root.getBoundingClientRect().top
      // +1 px tolerancia: prvý mesiac sedí na hranici už pri otvorení diára
      setStuck(el.getBoundingClientRect().top <= rootTop + STICKY_TOP + 1)
    }
    const onScroll = () => { if (raf == null) raf = requestAnimationFrame(check) }

    check()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      if (raf != null) cancelAnimationFrame(raf)
    }
  }, [])

  const titleBg = stuck ? '#ffffff' : '#eceff1'

  return (
    <tbody className="bg-white">
      {/* Sentinel pre detekciu prilepenia titulku */}
      <tr aria-hidden="true">
        <td ref={sentinelRef} colSpan={5} style={{ padding: 0, border: 'none', height: 0 }} />
      </tr>
      <tr className="mth-row">
        <td colSpan={5}
            className="sticky z-[5] px-4 py-2.5 text-[15px] font-bold text-[#354d5d]
                       border-b-2 border-[#e0e8ec] transition-colors"
            style={{
              top: STICKY_TOP,
              background: titleBg,
              ...(dimmed ? { borderColor: '#ffffff' } : {}),
            }}>
          {SK_MONTHS[month]} {year}
        </td>
      </tr>
      {weeks.map((week, i) => (
        <DiaryWeekRows
          key={i}
          week={week}
          year={year}
          month={month}
          todayISO={todayISO}
          bookings={bookings}
          onCellClick={onCellClick}
          onBookingClick={onBookingClick}
        />
      ))}
    </tbody>
  )
}
