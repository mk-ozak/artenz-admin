import { useEffect, useState } from 'react'
import { IconUser } from '@tabler/icons-react'
import { useAuthStore } from '../../store/auth'
import { formatTime } from '../../utils/format'

export default function MobileHeader() {
  const { fullName, signOut } = useAuthStore()
  const [time, setTime] = useState(formatTime())

  useEffect(() => {
    const t = setInterval(() => setTime(formatTime()), 30_000)
    return () => clearInterval(t)
  }, [])

  const initials = fullName
    ? fullName.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
    : '?'

  return (
    <header className="px-5 pt-3 pb-4" style={{ background: '#354d5d' }}>
      <div className="flex justify-between pb-1.5">
        <span className="text-xs" style={{ color: '#6a8898' }}>{time}</span>
      </div>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-[10px] tracking-[.16em] uppercase"
             style={{ color: 'rgba(255,255,255,.4)' }}>ARTENZ</p>
          <p className="text-[22px] font-bold leading-tight" style={{ color: '#ddeef6' }}>ADMIN</p>
        </div>
        <button
          onClick={signOut}
          title="Odhlásiť sa"
          className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'rgba(255,255,255,.1)' }}
        >
          {fullName ? (
            <span style={{ color: '#7a9aac' }}>{initials}</span>
          ) : (
            <IconUser size={18} style={{ color: '#7a9aac' }} />
          )}
        </button>
      </div>
    </header>
  )
}
