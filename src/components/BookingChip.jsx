import { EVENT_LABEL } from '../lib/eventTypes'

const TYPE_STYLES = {
  oslava:    'bg-teal-500 hover:bg-teal-600 text-white',
  svadba:    'bg-purple-500 hover:bg-purple-600 text-white',
  posedenie: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  kar:       'bg-slate-500 hover:bg-slate-600 text-white',
  stuzkova:  'bg-amber-500 hover:bg-amber-600 text-white',
  firemka:   'bg-blue-500 hover:bg-blue-600 text-white',
}

export default function BookingChip({ booking, onClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(booking) }}
      title={`${booking.customerName} – ${EVENT_LABEL[booking.type] ?? booking.type}`}
      className={`
        w-full text-left px-2 py-1 rounded text-xs font-medium truncate
        transition-colors cursor-pointer
        ${TYPE_STYLES[booking.type] || 'bg-gray-400 hover:bg-gray-500 text-white'}
      `}
    >
      {booking.customerName}
    </button>
  )
}
