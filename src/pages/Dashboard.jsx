import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNextEvent } from '../hooks/useNextEvent'
import { useStatsThisMonth } from '../hooks/useStatsThisMonth'
import { formatTodaySk } from '../utils/format'
import MobileHeader from '../components/layout/MobileHeader'
import BottomNav from '../components/layout/BottomNav'
import TopBar from '../components/layout/TopBar'
import Sidebar from '../components/layout/Sidebar'
import NextEventCard from '../components/dashboard/NextEventCard'
import NavGrid from '../components/dashboard/NavGrid'
import StatCards from '../components/dashboard/StatCards'
import HallStatusToday from '../components/dashboard/HallStatusToday'

function useTodayBookings() {
  const [bookings, setBookings] = useState([])
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('bookings')
      .select('id, hall, customer_name, event_type')
      .eq('date', today)
      .then(({ data }) => setBookings(data ?? []))
  }, [])
  return bookings
}

export default function Dashboard() {
  const { data: nextEvent }    = useNextEvent()
  const { data: stats }        = useStatsThisMonth()
  const todayBookings          = useTodayBookings()

  return (
    <>
      {/* ── MOBILE (< md) ── */}
      <div className="flex flex-col min-h-screen bg-white md:hidden">
        <MobileHeader />
        <p className="px-[18px] pt-3 pb-1 text-[13px] capitalize" style={{ color: '#8aaabb' }}>
          {formatTodaySk()}
        </p>
        <div className="px-4 mb-1">
          <NextEventCard event={nextEvent ?? null} />
        </div>
        <NavGrid stats={stats} />
        <div className="px-4 pb-2">
          <HallStatusToday bookings={todayBookings} />
        </div>
        <div className="flex-1" />
        <BottomNav />
      </div>

      {/* ── DESKTOP (≥ md) ── */}
      <div className="hidden md:flex flex-col min-h-screen bg-white">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 p-6 overflow-y-auto" style={{ background: '#f0f4f6' }}>
            <StatCards stats={stats} />
            <div className="grid grid-cols-2 gap-4 mt-4">
              <NextEventCard event={nextEvent ?? null} />
              <HallStatusToday bookings={todayBookings} />
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
