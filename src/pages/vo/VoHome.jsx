import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconCalendar, IconPlus, IconToolsKitchen2 } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { formatDateSkYear, formatTodaySk } from '../../utils/format'
import { getNameDay } from '../../utils/meniny'
import { toISO } from '../../utils/diaryWeeks'
import { VO_COLOR, VO_STATUS_LABEL, VO_STATUS_STYLE } from '../../lib/vo'
import VoHeader from '../../components/vo/VoHeader'

// Hlavná stránka VO — objednávky od najnovšieho dátumu po najstarší,
// vizuál ako „Najbližšie akcie" na dashboarde. Klik → detail objednávky.
export default function VoHome() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState(undefined)   // undefined = načítava

  useEffect(() => {
    supabase
      .from('bookings')
      .select('id, date, customer_name, vo_order_no, vo_status, menu_created')
      .eq('is_vo', true)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .order('vo_order_no', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[VoHome] fetch error:', error.message)
        setOrders(data ?? [])
      })
  }, [])

  const today  = toISO(new Date())
  const meniny = getNameDay()

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <VoHeader greeting />

      {/* Na počítači šírka ako dva stĺpce hlavnej obrazovky (Dashboard xl:max-w-5xl)
          a nižšie tlačidlo; mobil/tablet bez zmeny */}
      <div className="w-full max-w-2xl xl:max-w-5xl mx-auto flex-1 flex flex-col gap-3 px-4 pt-3 pb-4">
        {/* Dátum a meniny — ako na hlavnej stránke administrácie */}
        <div className="px-0.5">
          <p className="text-[13px] capitalize" style={{ color: '#8aaabb' }}>
            {formatTodaySk()}
          </p>
          {meniny && (
            <p className="pt-0.5 text-[12px]" style={{ color: '#b0c4cc' }}>
              Dnes má meniny{' '}
              <span className="font-semibold" style={{ color: '#6a8898' }}>{meniny}</span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate('/vo/objednavka/nova')}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-4 xl:py-2.5 rounded-card
                     text-base xl:text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: '#4cbfb3', color: '#0a2d2a' }}
        >
          <IconPlus size={22} stroke={2.5} className="xl:w-[18px] xl:h-[18px]" /> Nová objednávka
        </button>

        <div className="rounded-card bg-white border border-[#e0e8ec] overflow-hidden">
          <p className="text-[10px] text-[#8aaabb] tracking-widest uppercase px-4 pt-3 pb-1">
            Objednávky
          </p>

          {orders === undefined ? (
            <p className="px-4 pb-3 text-sm text-[#8aaabb] italic">Načítavam…</p>
          ) : orders.length === 0 ? (
            <p className="px-4 pb-3 text-sm text-[#8aaabb] italic">Zatiaľ žiadne objednávky</p>
          ) : (
            <ul className="divide-y divide-[#eef3f6]">
              {orders.map(o => {
                const status = o.vo_status ?? 'koncept'
                const past   = o.date < today
                return (
                  <li key={o.id}
                      onClick={() => navigate(`/vo/objednavka/${o.id}`)}
                      className="relative px-4 py-2.5 pl-5 cursor-pointer hover:bg-[#f6f9fb] transition-colors
                                 flex items-center gap-3">
                    <div className="absolute left-0 inset-y-0 w-1"
                         style={{ background: past ? '#9aa7b0' : VO_COLOR }} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[14px] font-semibold truncate ${past ? 'text-[#7a8893]' : 'text-[#1a2830]'}`}>
                        {o.customer_name}
                        <span className="ml-2 text-[11px] font-normal uppercase tracking-wider text-[#9ab0ba]">
                          č. {o.vo_order_no}
                        </span>
                      </p>
                      <div className="flex gap-3 mt-1 items-center">
                        <span className="flex items-center gap-1 text-xs text-[#6a8898]">
                          <IconCalendar size={13} />
                          {formatDateSkYear(o.date)}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={VO_STATUS_STYLE[status]}>
                          {VO_STATUS_LABEL[status]}
                        </span>
                      </div>
                    </div>
                    <div
                      title={o.menu_created ? 'Menu je vytvorené' : 'Menu ešte nie je vytvorené'}
                      className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center
                                  ${o.menu_created
                                    ? 'border-[#a8d9d3] bg-[#cdeae6] text-[#1a2830]'
                                    : 'border-[#d5e2e9] bg-white text-[#3a5160]'}`}
                    >
                      <IconToolsKitchen2 size={16} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
