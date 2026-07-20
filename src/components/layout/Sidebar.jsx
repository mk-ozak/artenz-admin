import { useLocation, useNavigate } from 'react-router-dom'
import { IconHome, IconCalendar, IconUsers, IconChartBar, IconSettings } from '@tabler/icons-react'

const ITEMS = [
  { path: '/',          label: 'Dashboard',  Icon: IconHome },
  { path: '/diary',     label: 'Diár',       Icon: IconCalendar },
  { path: '/customers', label: 'Zákazníci',  Icon: IconUsers,    disabled: true },
  { path: '/finance',   label: 'Financie',   Icon: IconChartBar },
  { path: '/settings',  label: 'Nastavenia', Icon: IconSettings },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className="w-[220px] min-h-full flex flex-col py-4 shrink-0"
           style={{ background: '#354d5d' }}>
      {ITEMS.map(({ path, label, Icon, disabled }) => {
        const active = location.pathname === path
        return (
          <button
            key={path}
            onClick={() => !disabled && navigate(path)}
            disabled={disabled}
            className={`flex items-center gap-3 px-5 py-2.5 text-sm font-medium
                        transition-colors text-left disabled:opacity-50 disabled:cursor-default
                        ${active
                          ? 'bg-white/10 text-[#ddeef6]'
                          : 'text-[#7a9aac] hover:text-[#c0d8e8]'}`}
          >
            <Icon size={18} />
            {label}
          </button>
        )
      })}
    </aside>
  )
}
