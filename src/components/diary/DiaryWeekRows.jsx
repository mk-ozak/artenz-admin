import { useState } from 'react'
import DiaryEventBlock from './DiaryEventBlock'
import { toISO } from '../../utils/diaryWeeks'

const HALLS = ['ARTENZ_PLUS', 'ARTENZ', 'LUNA', 'CATERING']

function getEvent(bookings, date, hall) {
  const iso = toISO(date)
  return bookings.find(b => b.date === iso && b.hall === hall) ?? null
}

function getEvents(bookings, date, hall) {
  const iso = toISO(date)
  return bookings.filter(b => b.date === iso && b.hall === hall)
}

function isOutside(date, year, month) {
  return date.getMonth() !== month || date.getFullYear() !== year
}

// Unified CATERING cell content — works for all row types
function CateringContent({ evts, size, onBookingClick, onAddClick, className = '' }) {
  const [expanded, setExpanded] = useState(false)
  const [first, ...rest] = evts

  if (!first) {
    return (
      <button onClick={onAddClick}
              className={`w-full h-full min-h-[28px] hover:bg-indigo-50/60 transition-colors rounded ${className}`} />
    )
  }

  return (
    <div className={`flex flex-col gap-px h-full ${className}`} style={{ padding: '2px' }}>
      <DiaryEventBlock title={first.customer_name} hall="CATERING"
                       status={first.status ?? 'dopyt'} size={size}
                       onClick={() => onBookingClick(first)} />
      {rest.length > 0 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
            className="px-1 py-px bg-[#dde6ea] rounded text-[9px] text-[#4a6878]
                       cursor-pointer hover:bg-[#cdd8de] leading-tight text-left shrink-0">
            {expanded ? '▲ skryť' : `+${rest.length} ďalšia ▾`}
          </button>
          {expanded && rest.map((e, i) => (
            <DiaryEventBlock key={i} title={e.customer_name} hall="CATERING"
                             status={e.status ?? 'dopyt'} size={size}
                             onClick={() => onBookingClick(e)} />
          ))}
        </>
      )}
      {/* Remaining space is clickable to add another booking */}
      <div className="flex-1 min-h-[6px] cursor-pointer hover:bg-indigo-50/60 transition-colors rounded"
           onClick={e => { e.stopPropagation(); onAddClick() }} />
    </div>
  )
}

function DateCell({ date, year, month, type }) {
  const outside  = isOutside(date, year, month)
  const isSun    = type === 'sun'
  const dayNames = { sun: 'ned', fri: 'pia', sat: 'sob' }
  return (
    <td className="border-r border-b border-[#e0e8ec] border-b-[#e8eef2] px-1 py-1
                   align-top w-14 bg-[#f8fafb]">
      {!outside && (
        <>
          <span className={`text-[13px] font-bold block leading-tight
                            ${isSun ? 'text-[#c84040]' : 'text-[#354d5d]'}`}>
            {date.getDate()}
          </span>
          <span className={`text-[10px] block ${isSun ? 'text-[#c84040]' : 'text-[#8aaabb]'}`}>
            {dayNames[type]}
          </span>
        </>
      )}
    </td>
  )
}

function WeekdayDateCell({ mon, tue, wed, thu, year, month }) {
  const cells = [
    { date: mon, label: 'po' },
    { date: wed, label: 'st' },
    { date: tue, label: 'ut' },
    { date: thu, label: 'štv' },
  ]
  return (
    <td className="border-r border-b border-[#e0e8ec] border-b-[#e8eef2] w-14 bg-[#f8fafb]"
        style={{ padding: 0 }}>
      <div className="grid grid-cols-2 h-full">
        {cells.map((c, i) => {
          const outside = isOutside(c.date, year, month)
          return (
            <div key={i}
                 className={[
                   'flex flex-col items-center justify-center py-0.5',
                   i < 2 ? 'border-b border-dashed border-[#dde8ee]' : '',
                   i % 2 === 0 ? 'border-r border-dashed border-[#dde8ee]' : '',
                 ].join(' ')}>
              {!outside && (
                <>
                  <span className="text-[10px] font-bold text-[#354d5d] leading-none">
                    {c.date.getDate()}
                  </span>
                  <span className="text-[8px] text-[#8aaabb]">{c.label}</span>
                </>
              )}
            </div>
          )
        })}
      </div>
    </td>
  )
}

function WeekdayHallCell({ mon, tue, wed, thu, year, month, hall, bookings, onBookingClick, onEmptyClick }) {
  const days = [mon, wed, tue, thu]
  return (
    <td className="hc border-r last:border-r-0 border-b border-[#e8eef2]" style={{ padding: 0 }}>
      <div className="grid grid-cols-2 h-full">
        {days.map((date, idx) => {
          const outside = isOutside(date, year, month)
          const evt = !outside ? getEvent(bookings, date, hall) : null
          return (
            <div key={idx}
                 className={[
                   'p-0.5 overflow-hidden min-h-[30px]',
                   idx < 2 ? 'border-b border-dashed border-[#e8eef2]' : '',
                   idx % 2 === 0 ? 'border-r border-dashed border-[#e8eef2]' : '',
                   (!outside && !evt) ? 'cursor-pointer hover:bg-indigo-50/60 transition-colors' : '',
                 ].join(' ')}
                 onClick={(!outside && !evt) ? () => onEmptyClick(date, hall) : undefined}
            >
              {evt && (
                <DiaryEventBlock title={evt.customer_name} hall={hall}
                                 status={evt.status ?? 'dopyt'} size="sm"
                                 onClick={() => onBookingClick(evt)} />
              )}
            </div>
          )
        })}
      </div>
    </td>
  )
}

function WeekdayCateringCell({ mon, tue, wed, thu, year, month, bookings, onBookingClick, onEmptyClick }) {
  const days = [mon, wed, tue, thu]
  return (
    <td className="hc border-r-0 border-b border-[#e8eef2]" style={{ padding: 0 }}>
      <div className="grid grid-cols-2 h-full">
        {days.map((date, idx) => {
          const outside = isOutside(date, year, month)
          const evts = !outside ? getEvents(bookings, date, 'CATERING') : []
          const borderClasses = [
            idx < 2 ? 'border-b border-dashed border-[#e8eef2]' : '',
            idx % 2 === 0 ? 'border-r border-dashed border-[#e8eef2]' : '',
          ].join(' ')
          return (
            <div key={idx} className={`overflow-hidden min-h-[30px] ${borderClasses}`}>
              {!outside && (
                <CateringContent evts={evts} size="sm"
                                 onBookingClick={onBookingClick}
                                 onAddClick={() => onEmptyClick(date, 'CATERING')} />
              )}
            </div>
          )
        })}
      </div>
    </td>
  )
}

export default function DiaryWeekRows({ week, year, month, bookings, onCellClick, onBookingClick }) {
  const { sun, mon, tue, wed, thu, fri, sat } = week

  function handleEmpty(date, hall) {
    if (isOutside(date, year, month)) return
    onCellClick?.(toISO(date), hall)
  }

  // Renders a single hall cell for Sun/Fri rows (handles outside days)
  function renderHallCell(date, hall, size, minH) {
    const outside = isOutside(date, year, month)

    if (outside) {
      return (
        <td key={hall} className="hc border-r last:border-r-0 border-b border-[#e8eef2]" />
      )
    }

    if (hall !== 'CATERING') {
      const evt = getEvent(bookings, date, hall)
      return (
        <td key={hall} className="hc border-r last:border-r-0 border-b border-[#e8eef2]"
            style={{ padding: '3px' }}>
          {evt ? (
            <DiaryEventBlock title={evt.customer_name} hall={hall}
                             status={evt.status ?? 'dopyt'} size={size}
                             onClick={() => onBookingClick(evt)} />
          ) : (
            <button onClick={() => handleEmpty(date, hall)}
                    className={`w-full h-full hover:bg-indigo-50/60 transition-colors rounded ${minH}`} />
          )}
        </td>
      )
    }

    // CATERING — supports multiple bookings
    const evts = getEvents(bookings, date, 'CATERING')
    return (
      <td key={hall} className="hc border-r last:border-r-0 border-b border-[#e8eef2]"
          style={{ padding: 0 }}>
        <CateringContent evts={evts} size={size}
                         onBookingClick={onBookingClick}
                         onAddClick={() => handleEmpty(date, 'CATERING')} />
      </td>
    )
  }

  // Renders a single hall cell for Sat row (handles outside days)
  function renderSatHallCell(hall) {
    const outside = isOutside(sat, year, month)

    if (outside) {
      return <td key={hall} className="hc border-r last:border-r-0 border-b border-[#e8eef2]" />
    }

    const evt = getEvent(bookings, sat, hall)
    if (!evt) {
      return (
        <td key={hall} className="hc border-r last:border-r-0 border-b border-[#e8eef2]" style={{ padding: 0 }}>
          <button onClick={() => handleEmpty(sat, hall)}
                  className="w-full h-full min-h-[76px] hover:bg-indigo-50/60 transition-colors rounded" />
        </td>
      )
    }
    return (
      <td key={hall} className="hc border-r last:border-r-0 border-b border-[#e8eef2]"
          style={{ padding: 0 }}>
        <div className="sat-inner">
          <div className="evl">
            <DiaryEventBlock title={evt.customer_name} hall={hall}
                             status={evt.status ?? 'dopyt'} size="lg"
                             onClick={() => onBookingClick(evt)} />
          </div>
        </div>
      </td>
    )
  }

  const sunOut  = isOutside(sun, year, month)
  const wdayOut = [mon, tue, wed, thu].every(d => isOutside(d, year, month))
  const friOut  = isOutside(fri, year, month)
  const satOut  = isOutside(sat, year, month)

  return (
    <>
      {/* Sunday */}
      {!sunOut && (
        <tr className="sun-row">
          <DateCell date={sun} year={year} month={month} type="sun" />
          {HALLS.map(h => renderHallCell(sun, h, 'sm', 'min-h-[28px]'))}
        </tr>
      )}

      {/* Mon–Thu 2×2 */}
      {!wdayOut && (
        <tr className="wday-row">
          <WeekdayDateCell mon={mon} tue={tue} wed={wed} thu={thu} year={year} month={month} />
          {['ARTENZ_PLUS', 'ARTENZ', 'LUNA'].map(h => (
            <WeekdayHallCell key={h} mon={mon} tue={tue} wed={wed} thu={thu}
                             year={year} month={month}
                             hall={h} bookings={bookings} onBookingClick={onBookingClick}
                             onEmptyClick={handleEmpty} />
          ))}
          <WeekdayCateringCell mon={mon} tue={tue} wed={wed} thu={thu}
                               year={year} month={month}
                               bookings={bookings} onBookingClick={onBookingClick}
                               onEmptyClick={handleEmpty} />
        </tr>
      )}

      {/* Friday */}
      {!friOut && (
        <tr className="fri-row">
          <DateCell date={fri} year={year} month={month} type="fri" />
          {HALLS.map(h => renderHallCell(fri, h, 'md', 'min-h-[38px]'))}
        </tr>
      )}

      {/* Saturday */}
      {!satOut && (
        <tr className="sat-row">
          <DateCell date={sat} year={year} month={month} type="sat" />
          {['ARTENZ_PLUS', 'ARTENZ', 'LUNA'].map(h => renderSatHallCell(h))}
          <td className="hc border-b border-[#e8eef2] last:border-r-0" style={{ padding: 0 }}>
            <div className="sat-inner">
              <CateringContent evts={getEvents(bookings, sat, 'CATERING')} size="lg"
                               className="cat-exp"
                               onBookingClick={onBookingClick}
                               onAddClick={() => handleEmpty(sat, 'CATERING')} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
