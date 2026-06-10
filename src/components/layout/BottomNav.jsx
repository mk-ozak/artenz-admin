import { useLocation, useNavigate } from 'react-router-dom'
import { IconHome, IconCalendar, IconUsers, IconSettings } from '@tabler/icons-react'

const ITEMS = [
  { path: '/',          label: 'Domov',     Icon: IconHome },
  { path: '/diary',     label: 'Diár',      Icon: IconCalendar },
  { path: '/customers', label: 'Zákazníci', Icon: IconUsers, disabled: true },
  { path: '/settings',  label: 'Nastavenia',Icon: IconSettings },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="bg-white border-t border-[#e8eef2] flex justify-around px-5 pt-2.5 pb-5">
      {ITEMS.map(({ path, label, Icon, disabled }) => {
        const active = location.pathname === path
        const color  = active ? '#3db8ad' : '#b0c4cc'
        return (
          <button
            key={path}
            onClick={() => !disabled && navigate(path)}
            disabled={disabled}
            className="flex flex-col items-center gap-0.5 disabled:cursor-default"
          >
            <Icon size={22} style={{ color }} />
            <span className="text-[10px]" style={{ color }}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
