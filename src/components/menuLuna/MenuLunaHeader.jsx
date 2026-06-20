import { IconLogout, IconArrowLeft, IconLayoutDashboard } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

// Hlavička menuLuna admina – rovnaký vizuál ako MobileHeader hlavnej
// administrácie. Vpravo hore tlačidlo na návrat do hlavnej administrácie
// + Odhlásiť. Na podstránkach voliteľne šípka „späť" (backTo).
export default function MenuLunaHeader({ title = 'MENU LUNA', backTo }) {
  const { signOut } = useAuthStore()
  const navigate = useNavigate()

  const roundBtn =
    'w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80'

  return (
    <header className="px-5 pt-4 pb-4" style={{ background: '#354d5d' }}>
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {backTo && (
            <button
              onClick={() => navigate(backTo)}
              title="Späť"
              aria-label="Späť"
              className={roundBtn}
              style={{ background: 'rgba(255,255,255,.1)' }}
            >
              <IconArrowLeft size={19} style={{ color: '#7a9aac' }} />
            </button>
          )}
          <div className="min-w-0">
            <p className="text-[10px] tracking-[.16em] uppercase"
               style={{ color: 'rgba(255,255,255,.4)' }}>LUNA</p>
            <p className="text-[22px] font-bold leading-tight truncate"
               style={{ color: '#ddeef6' }}>{title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/')}
            title="Späť do administrácie"
            aria-label="Späť do administrácie"
            className={roundBtn}
            style={{ background: 'rgba(255,255,255,.1)' }}
          >
            <IconLayoutDashboard size={19} style={{ color: '#7a9aac' }} />
          </button>
          <button
            onClick={signOut}
            title="Odhlásiť sa"
            aria-label="Odhlásiť sa"
            className={roundBtn}
            style={{ background: 'rgba(255,255,255,.1)' }}
          >
            <IconLogout size={19} style={{ color: '#7a9aac' }} />
          </button>
        </div>
      </div>
    </header>
  )
}
