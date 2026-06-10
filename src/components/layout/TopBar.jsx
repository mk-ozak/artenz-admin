import { IconUser } from '@tabler/icons-react'
import { useAuthStore } from '../../store/auth'

export default function TopBar() {
  const { fullName, signOut } = useAuthStore()

  const initials = fullName
    ? fullName.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
    : '?'

  return (
    <header className="px-6 py-3.5 flex justify-between items-center"
            style={{ background: '#354d5d' }}>
      <div>
        <p className="text-[10px] tracking-[.16em] uppercase"
           style={{ color: 'rgba(255,255,255,.4)' }}>ARTENZ</p>
        <p className="text-[20px] font-bold leading-tight" style={{ color: '#ddeef6' }}>ADMIN</p>
      </div>
      <button
        onClick={signOut}
        title="Odhlásiť sa"
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: 'rgba(255,255,255,.1)' }}
      >
        {fullName ? (
          <span style={{ color: '#7a9aac' }}>{initials}</span>
        ) : (
          <IconUser size={16} style={{ color: '#7a9aac' }} />
        )}
      </button>
    </header>
  )
}
