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
  const thisMonday = useMemo(() => mondayOf(new Date()), [])
  const nextMonday = useMemo(() => addDays(thisMonday, 7), [thisMonday])
  // Editovateľné sú oba týždne; predvolená záložka sa od piatka 15:00
  // preklopí na budúci týždeň (rovnako ako verejné menu).
  const [monday, setMonday] = useState(() => activeMonday(new Date()))
  const isNextWeek = toISO(monday) !== toISO(thisMonday)

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
            <div className="inline-grid grid-cols-2 rounded-lg bg-white border border-gray-200 p-1
                            shadow-[0_2px_10px_rgba(53,77,93,.10)] mb-1.5">
              {[
                { m: thisMonday, label: 'Tento týždeň' },
                { m: nextMonday, label: 'Budúci týždeň' },
              ].map(({ m, label }) => {
                const active = toISO(m) === toISO(monday)
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setMonday(m)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold truncate transition-colors
                                ${active ? '' : 'text-gray-600 hover:text-gray-900'}`}
                    style={active ? { background: '#4cbfb3', color: '#0a2d2a' } : undefined}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <p className="text-[18px] font-bold text-[#2b3f4c]">{weekRangeLabel(monday)}</p>
          </div>
          <DownloadPdfButton monday={monday} />
        </div>

        {loaded === false && (
          <div className="mb-4 rounded-card border border-[#f0e2c4] bg-[#fff8e8] px-4 py-3 flex items-start gap-2.5">
            <IconInfoCircle size={18} className="text-[#c9a23a] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[#7a6a3a]">
              Menu pre {isNextWeek ? 'budúci' : 'tento'} týždeň ešte nie je nahraté.
              {isNextWeek && ' Nahraj ho cez „Importuj menu na nový týždeň", alebo doplň nižšie.'}
            </p>
          </div>
        )}

        <WeekEditor
          key={toISO(monday)}
          monday={monday}
          portionOptions={portionOptions}
          defaultPrice={defaultPriceDaily}
          onSaved={checkLoaded}
          lockSoup2
        />

        <MenuHistory beforeMonday={thisMonday} />
      </div>
    </div>
  )
}
