import DiaryWeekRows from './DiaryWeekRows'
import { getMonthWeeks } from '../../utils/diaryWeeks'

const SK_MONTHS = [
  'Január','Február','Marec','Apríl','Máj','Jún',
  'Júl','August','September','Október','November','December',
]

export default function DiaryMonth({ year, month, isOdd, dimmed, todayISO, bookings, onCellClick, onBookingClick }) {
  const weeks = getMonthWeeks(year, month)
  const bg    = isOdd ? 'bg-[#f4f7f9]' : 'bg-white'

  // Titulok mesiaca je sticky pod hlavičkou so sálami (top ≈ výška thead).
  // Pozadie musí byť nepriehľadné, inak by cez ukotvený titulok presvitali riadky
  // (pre staré mesiace je to plná obdoba šedého prekrytia ~10 %).
  const titleBg = dimmed ? '#eceff1' : (isOdd ? '#f4f7f9' : '#ffffff')

  return (
    <tbody className={bg}>
      <tr className="mth-row">
        <td colSpan={5}
            className="sticky z-[5] px-4 py-2.5 text-[15px] font-bold text-[#354d5d]
                       border-b-2 border-[#e0e8ec]"
            style={{
              top: 37,
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
