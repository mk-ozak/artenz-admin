import { useNavigate } from 'react-router-dom'
import { IconCalendar, IconMail, IconChartBar, IconSettings } from '@tabler/icons-react'
import { useNewInquiriesCount } from '../../hooks/useNewInquiriesCount'
import NavButton from './NavButton'

// 1 nový dopyt / 2–4 nové dopyty / 5+ nových dopytov
function dopytyPlural(n) {
  if (n === 1) return '1 nový dopyt'
  if (n >= 2 && n <= 4) return `${n} nové dopyty`
  return `${n} nových dopytov`
}

export default function NavGrid({ stats }) {
  const navigate = useNavigate()
  const total    = stats ? stats.ap + stats.a + stats.luna : 0
  const newCount = useNewInquiriesCount()

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 px-4 py-3.5">
      <NavButton
        icon={<IconCalendar size={28} />}
        label="Diár"
        sub={total ? `${total} akcie tento mesiac` : 'Mesačný prehľad'}
        bgColor="#3db8ad"
        onClick={() => navigate('/diary')}
      />
      <NavButton
        icon={<IconMail size={28} />}
        label="Dopyty"
        sub={newCount ? dopytyPlural(newCount) : 'Z webu'}
        bgColor="#5b9bd1"
        badge={newCount}
        onClick={() => navigate('/dopyty')}
      />
      <NavButton
        icon={<IconChartBar size={28} />}
        label="Financie"
        sub="Očakávaná tržba"
        bgColor="#d4a036"
        onClick={() => navigate('/finance')}
      />
      <NavButton
        icon={<IconSettings size={28} />}
        label="Nastavenia"
        sub="Profil a sály"
        bgColor="#f0f4f7"
        textDark
        onClick={() => navigate('/settings')}
      />
    </div>
  )
}
