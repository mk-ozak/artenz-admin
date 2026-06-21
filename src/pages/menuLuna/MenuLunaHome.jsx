import { useNavigate } from 'react-router-dom'
import { IconFileImport, IconCalendarWeek, IconToolsKitchen2, IconSettings } from '@tabler/icons-react'
import MenuLunaHeader from '../../components/menuLuna/MenuLunaHeader'
import NavButton from '../../components/dashboard/NavButton'
import CurrentMenuPreview from '../../components/menuLuna/CurrentMenuPreview'

// Domovská obrazovka menuLuna – 4 veľké karty v rovnakom štýle ako dashboard.
export default function MenuLunaHome() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <MenuLunaHeader title="MENU LUNA" />

      <div className="w-full max-w-2xl xl:max-w-5xl mx-auto flex-1 flex flex-col">
        <p className="px-[18px] pt-3 text-[13px]" style={{ color: '#8aaabb' }}>
          Správa obedového menu pre web lunacadca.sk
        </p>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 px-4 py-3.5">
          <NavButton
            icon={<IconFileImport size={28} />}
            label="Importuj menu"
            sub="Na nový týždeň"
            bgColor="#3db8ad"
            textDark={false}
            onClick={() => navigate('/menu/import')}
          />
          <NavButton
            icon={<IconCalendarWeek size={28} />}
            label="Denné menu"
            sub="Tento týždeň + história"
            bgColor="#b55db8"
            textDark={false}
            onClick={() => navigate('/menu/denne')}
          />
          <NavButton
            icon={<IconToolsKitchen2 size={28} />}
            label="Trvalé menu"
            sub="Minútky (6 položiek)"
            bgColor="#d4a036"
            textDark={false}
            onClick={() => navigate('/menu/trvale')}
          />
          <NavButton
            icon={<IconSettings size={28} />}
            label="Nastavenia"
            sub="Gramáže a ceny"
            bgColor="#f0f4f7"
            textDark
            onClick={() => navigate('/menu/nastavenia')}
          />
        </div>

        <CurrentMenuPreview />

        <div className="flex-1" />
      </div>
    </div>
  )
}
