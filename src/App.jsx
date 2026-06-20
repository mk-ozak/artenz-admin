import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import BookingDetail from './pages/BookingDetail'
import MyBooking from './pages/MyBooking'
import Diary from './components/Diary'
import LoginPage from './pages/LoginPage'
import Settings from './pages/Settings'
import MenuLunaHome from './pages/menuLuna/MenuLunaHome'
import ImportMenu from './pages/menuLuna/ImportMenu'
import DailyMenu from './pages/menuLuna/DailyMenu'
import PermanentMenu from './pages/menuLuna/PermanentMenu'
import MenuLunaSettings from './pages/menuLuna/MenuLunaSettings'
import ProtectedRoute from './components/ProtectedRoute'
import Toast from './components/Toast'
import { useAuthStore } from './store/auth'

export default function App() {
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    const cleanup = init()
    return cleanup
  }, [init])

  return (
    <BrowserRouter>
      <Toast />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/booking/:id" element={<BookingDetail />} />
          <Route path="/moja" element={<MyBooking />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/menu" element={<MenuLunaHome />} />
          <Route path="/menu/import" element={<ImportMenu />} />
          <Route path="/menu/denne" element={<DailyMenu />} />
          <Route path="/menu/trvale" element={<PermanentMenu />} />
          <Route path="/menu/nastavenia" element={<MenuLunaSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
