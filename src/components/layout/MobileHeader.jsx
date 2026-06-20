import { IconLogout, IconToolsKitchen2 } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

export default function MobileHeader() {
  const { fullName, signOut } = useAuthStore()
  const navigate = useNavigate()

  return (
    <header className="px-5 pt-4 pb-4" style={{ background: '#354d5d' }}>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-[10px] tracking-[.16em] uppercase"
             style={{ color: 'rgba(255,255,255,.4)' }}>ARTENZ</p>
          <p className="text-[22px] font-bold leading-tight" style={{ color: '#ddeef6' }}>ADMIN</p>
          {fullName?.trim() && (
            <p className="text-[13px] mt-1" style={{ color: '#8aaabb' }}>
              Ahoj <span className="font-semibold" style={{ color: '#b0ccd8' }}>{fullName.trim()}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/menu')}
            title="Menu Luna"
            aria-label="Menu Luna"
            className="w-10 h-10 rounded-full flex items-center justify-center
                       transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,.1)' }}
          >
            <IconToolsKitchen2 size={19} style={{ color: '#7a9aac' }} />
          </button>
          <button
            onClick={signOut}
            title="Odhlásiť sa"
            aria-label="Odhlásiť sa"
            className="w-10 h-10 rounded-full flex items-center justify-center
                       transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,.1)' }}
          >
            <IconLogout size={19} style={{ color: '#7a9aac' }} />
          </button>
        </div>
      </div>
    </header>
  )
}
