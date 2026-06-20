import { useMemo } from 'react'
import MenuLunaHeader from '../../components/menuLuna/MenuLunaHeader'
import WeekEditor from '../../components/menuLuna/WeekEditor'
import MenuHistory from '../../components/menuLuna/MenuHistory'
import DownloadPdfButton from '../../components/menuLuna/DownloadPdfButton'
import { useMenuSettings } from '../../hooks/useMenuSettings'
import { mondayOf, weekRangeLabel } from '../../utils/menuDates'

export default function DailyMenu() {
  const { portionOptions, defaultPriceDaily } = useMenuSettings()
  const monday = useMemo(() => mondayOf(new Date()), [])

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <MenuLunaHeader title="Denné menu" backTo="/menu" />

      <div className="w-full max-w-2xl xl:max-w-5xl mx-auto flex-1 w-full px-4 py-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] text-[#8aaabb]">Aktuálny týždeň</p>
            <p className="text-[18px] font-bold text-[#2b3f4c]">{weekRangeLabel(monday)}</p>
          </div>
          <DownloadPdfButton monday={monday} />
        </div>

        <WeekEditor monday={monday} portionOptions={portionOptions} defaultPrice={defaultPriceDaily} />

        <MenuHistory beforeMonday={monday} />
      </div>
    </div>
  )
}
