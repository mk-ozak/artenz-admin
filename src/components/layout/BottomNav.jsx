import { useLocation, useNavigate } from 'react-router-dom'
import { IconHome, IconCalendar, IconMail, IconUsers, IconSettings } from '@tabler/icons-react'
import { useNewInquiriesCount } from '../../hooks/useNewInquiriesCount'

const ITEMS = [
  { path: '/',          label: 'Domov',     Icon: IconHome },
  { path: '/diary',     label: 'Diár',      Icon: IconCalendar },
  { path: '/dopyty',    label: 'Dopyty',    Icon: IconMail, badge: true },
  { path: '/customers', label: 'Zákazníci', Icon: IconUsers, disabled: true },
  { path: '/settings',  label: 'Nastavenia',Icon: IconSettings },
]

// newCount: stránka Dopyty si počet drží v lokálnom stave, aby odznak
// zhasol hneď po prečítaní dopytu; inde sa načíta z databázy.
export default function BottomNav({ newCount }) {
  const location = useLocation()
  const navigate = useNavigate()
  const fetched  = useNewInquiriesCount()
  const badgeCount = newCount ?? fetched

  return (
    <nav className="bg-white border-t border-[#e8eef2] flex justify-around px-3 pt-2.5 pb-5">
      {ITEMS.map(({ path, label, Icon, disabled, badge }) => {
        const active = location.pathname === path
        const color  = active ? '#3db8ad' : '#b0c4cc'
        return (
          <button
            key={path}
            onClick={() => !disabled && navigate(path)}
            disabled={disabled}
            className="flex flex-col items-center gap-0.5 disabled:cursor-default relative"
          >
            <Icon size={22} style={{ color }} />
            {badge && badgeCount > 0 && (
              <span className="absolute -top-1 right-0 min-w-[16px] h-4 px-1 rounded-full
                               bg-inq-new-ink text-white text-[10px] font-bold
                               flex items-center justify-center">
                {badgeCount}
              </span>
            )}
            <span className="text-[10px]" style={{ color }}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
