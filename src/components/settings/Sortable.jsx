import { IconGripVertical } from '@tabler/icons-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Riadok preusporiadateľný ťahaním; children dostanú props pre úchytku
export function SortableRow({ id, className = '', children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${className} ${isDragging ? 'relative z-10 opacity-80 shadow-lg' : ''}`}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  )
}

// Úchytka na ťahanie — touch-none, aby ťahanie prstom nescrollovalo stránku
export function DragHandle(props) {
  return (
    <button
      type="button"
      aria-label="Presunúť ťahaním"
      className="w-7 h-7 shrink-0 rounded flex items-center justify-center text-gray-300
                 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
      {...props}
    >
      <IconGripVertical size={16} />
    </button>
  )
}
