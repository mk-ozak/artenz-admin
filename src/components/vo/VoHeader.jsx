import { IconArrowLeft, IconLayoutDashboard, IconLogout, IconSettings } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

// Hlavička rozhrania VO – vizuál ako MenuLunaHeader. Vpravo hore:
// VO → nastavenia (heslo) + odhlásenie; admin → návrat do administrácie
// + nastavenia (záložka VO). Na podstránkach šípka „späť" (backTo).
export default function VoHeader({ title = 'Objednávky', backTo, greeting = false }) {
  const { role, fullName, signOut } = useAuthStore()
  const navigate = useNavigate()
  const isAdmin = role === 'admin'

  const roundBtn =
    'w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-80'
  const roundStyle = { background: 'rgba(255,255,255,.1)' }
  const iconStyle  = { color: '#7a9aac' }

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
              style={roundStyle}
            >
              <IconArrowLeft size={19} style={iconStyle} />
            </button>
          )}
          <div className="min-w-0">
            <p className="text-[10px] tracking-[.16em] uppercase"
               style={{ color: 'rgba(255,255,255,.4)' }}>ARTENZ · VO</p>
            {/* Na podstránkach (so šípkou späť) menší nadpis — zmestí sa aj na mobil */}
            <p className={`${backTo ? 'text-[18px]' : 'text-[22px]'} font-bold leading-tight truncate`}
               style={{ color: '#ddeef6' }}>{title}</p>
            {greeting && fullName?.trim() && (
              <p className="text-[13px] mt-1 truncate" style={{ color: '#8aaabb' }}>
                Dobrý deň, <span className="font-semibold" style={{ color: '#b0ccd8' }}>{fullName.trim()}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAdmin ? (
            <>
              <button
                onClick={() => navigate('/')}
                title="Späť do administrácie"
                aria-label="Späť do administrácie"
                className={roundBtn}
                style={roundStyle}
              >
                <IconLayoutDashboard size={19} style={iconStyle} />
              </button>
              <button
                onClick={() => navigate('/settings?tab=vo')}
                title="Nastavenia"
                aria-label="Nastavenia"
                className={roundBtn}
                style={roundStyle}
              >
                <IconSettings size={19} style={iconStyle} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/vo/nastavenia')}
                title="Nastavenia"
                aria-label="Nastavenia"
                className={roundBtn}
                style={roundStyle}
              >
                <IconSettings size={19} style={iconStyle} />
              </button>
              <button
                onClick={signOut}
                title="Odhlásiť sa"
                aria-label="Odhlásiť sa"
                className={roundBtn}
                style={roundStyle}
              >
                <IconLogout size={19} style={iconStyle} />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
