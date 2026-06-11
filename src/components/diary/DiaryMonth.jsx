import DiaryWeekRows from './DiaryWeekRows'
import { getMonthWeeks } from '../../utils/diaryWeeks'

const SK_MONTHS = [
  'Január','Február','Marec','Apríl','Máj','Jún',
  'Júl','August','September','Október','November','December',
]

export default function DiaryMonth({ year, month, isOdd, dimmed, todayISO, bookings, onCellClick, onBookingClick }) {
  const weeks = getMonthWeeks(year, month)
  const bg    = isOdd ? 'bg-[#f4f7f9]' : 'bg-white'

  // Staré (celé minulé) mesiace prekryjeme jemnou priehľadnou šedou aj v titulku.
  const baseBg = isOdd ? 'bg-[#f4f7f9]' : 'bg-white'

  return (
    <tbody className={bg}>
      <tr className="mth-row">
        <td colSpan={5}
            className={`px-4 py-2.5 text-[15px] font-bold text-[#354d5d]
                        border-b-2 border-[#e0e8ec] ${baseBg}`}
            style={dimmed ? { background: 'rgba(99, 116, 133, 0.10)', borderColor: '#ffffff' } : undefined}>
          {SK_MONTHS[month]} {year}
        </td>
      </tr>
      {weeks.map((week, i) => (
        <DiaryWeekRows
          key={i}
          week={week}
          year={year}
          month={month}
          isOdd={isOdd}
          todayISO={todayISO}
          bookings={bookings}
          onCellClick={onCellClick}
          onBookingClick={onBookingClick}
        />
      ))}
    </tbody>
  )
}
