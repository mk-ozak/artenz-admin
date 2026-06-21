import { useMemo, useState, useEffect, useCallback } from 'react'
import { IconInfoCircle } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import MenuLunaHeader from '../../components/menuLuna/MenuLunaHeader'
import WeekEditor from '../../components/menuLuna/WeekEditor'
import MenuHistory from '../../components/menuLuna/MenuHistory'
import DownloadPdfButton from '../../components/menuLuna/DownloadPdfButton'
import { useMenuSettings } from '../../hooks/useMenuSettings'
import { mondayOf, activeMonday, addDays, toISO, weekRangeLabel } from '../../utils/menuDates'

export default function DailyMenu() {
  const { portionOptions, defaultPriceDaily } = useMenuSettings()
  // Aktívny týždeň – od piatka 15:00 sa preklopí na nasledujúci.
  const monday = useMemo(() => activeMonday(new Date()), [])
  const isNextWeek = useMemo(() => toISO(monday) !== toISO(mondayOf(new Date())), [monday])

  const [loaded, setLoaded] = useState(null) // null = zisťujem, true/false = je/nie je nahraté

  const checkLoaded = useCallback(async () => {
    const { data } = await supabase
      .from('daily_menus')
      .select('soup1_name, main1_name, main2_name, status, note')
      .gte('menu_date', toISO(monday))
      .lte('menu_date', toISO(addDays(monday, 4)))
    const has = (data ?? []).some(
      (r) => r.soup1_name || r.main1_name || r.main2_name || r.status === 'closed' || r.note,
    )
    setLoaded(has)
  }, [monday])

  useEffect(() => {
    checkLoaded()
  }, [checkLoaded])

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <MenuLunaHeader title="Denné menu" backTo="/menu" />

      <div className="w-full max-w-2xl xl:max-w-5xl mx-auto flex-1 w-full px-4 py-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] text-[#8aaabb]">{isNextWeek ? 'Nasledujúci týždeň' : 'Aktuálny týždeň'}</p>
            <p className="text-[18px] font-bold text-[#2b3f4c]">{weekRangeLabel(monday)}</p>
          </div>
          <DownloadPdfButton monday={monday} />
        </div>

        {loaded === false && (
          <div className="mb-4 rounded-card border border-[#f0e2c4] bg-[#fff8e8] px-4 py-3 flex items-start gap-2.5">
            <IconInfoCircle size={18} className="text-[#c9a23a] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[#7a6a3a]">
              Menu pre {isNextWeek ? 'nasledujúci' : 'tento'} týždeň ešte nie je nahraté.
              {isNextWeek && ' Nahraj ho cez „Importuj menu na nový týždeň", alebo doplň nižšie.'}
            </p>
          </div>
        )}

        <WeekEditor
          monday={monday}
          portionOptions={portionOptions}
          defaultPrice={defaultPriceDaily}
          onSaved={checkLoaded}
        />

        <MenuHistory beforeMonday={monday} />
      </div>
    </div>
  )
}
