import { useStatsThisMonth } from '../hooks/useStatsThisMonth'
import { formatTodaySk } from '../utils/format'
import { getNameDay } from '../utils/meniny'
import MobileHeader from '../components/layout/MobileHeader'
import BottomNav from '../components/layout/BottomNav'
import NavGrid from '../components/dashboard/NavGrid'
import UpcomingEvents from '../components/dashboard/UpcomingEvents'
import ExpectedDeposits from '../components/dashboard/ExpectedDeposits'
import DeletedBookings from '../components/dashboard/DeletedBookings'
import RecentlyAdded from '../components/dashboard/RecentlyAdded'

// Jednotný dashboard pre mobil, tablet aj desktop – bez bočného menu,
// obsah v jednom stĺpci so 4 veľkými farebnými tlačidlami.
export default function Dashboard() {
  const { data: stats } = useStatsThisMonth()
  const meniny = getNameDay()

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <MobileHeader />

      <div className="w-full max-w-2xl xl:max-w-5xl mx-auto flex-1 flex flex-col">
        {/* 1. Dátum */}
        <p className="px-[18px] pt-3 text-[13px] capitalize" style={{ color: '#8aaabb' }}>
          {formatTodaySk()}
        </p>

        {/* 2. Meniny */}
        {meniny && (
          <p className="px-[18px] pt-0.5 pb-1 text-[12px]" style={{ color: '#b0c4cc' }}>
            Dnes má meniny{' '}
            <span className="font-semibold" style={{ color: '#6a8898' }}>{meniny}</span>
          </p>
        )}

        {/* 3. Veľké tlačidlá */}
        <NavGrid stats={stats} />

        {/* 4.–7. Desktop: vľavo akcie; vpravo zálohy, posledné pridané a úplne dole
            posledné vymazané. Mobil/tablet: to isté pod sebou v jednom stĺpci. */}
        <div className="px-4 pb-2 grid grid-cols-1 xl:grid-cols-2 gap-2 items-start">
          <div className="min-w-0">
            <UpcomingEvents />
          </div>
          <div className="min-w-0 flex flex-col gap-2">
            <ExpectedDeposits />
            <RecentlyAdded />
            <DeletedBookings />
          </div>
        </div>

        <div className="flex-1" />
      </div>

      {/* Spodná navigácia len na mobile/tablete */}
      <div className="xl:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
