import { useNavigate } from 'react-router-dom'
import { IconCalendar, IconUsers, IconChartBar, IconSettings } from '@tabler/icons-react'
import NavButton from './NavButton'

export default function NavGrid({ stats }) {
  const navigate = useNavigate()
  const total    = stats ? stats.ap + stats.a + stats.luna : 0

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
        icon={<IconUsers size={28} />}
        label="Zákazníci"
        sub="Kontakty"
        bgColor="#b55db8"
        disabled
      />
      <NavButton
        icon={<IconChartBar size={28} />}
        label="Financie"
        sub="Prehľad platieb"
        bgColor="#d4a036"
        disabled
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
