const TYPE_STYLES = {
  svadba: 'bg-purple-500 hover:bg-purple-600 text-white',
  oslava: 'bg-teal-500 hover:bg-teal-600 text-white',
  firmovna: 'bg-blue-500 hover:bg-blue-600 text-white',
}

const TYPE_LABELS = {
  svadba: 'Svadba',
  oslava: 'Oslava',
  firmovna: 'Firemná',
}

export default function BookingChip({ booking, onClick }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(booking) }}
      title={`${booking.customerName} – ${TYPE_LABELS[booking.type]}`}
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
