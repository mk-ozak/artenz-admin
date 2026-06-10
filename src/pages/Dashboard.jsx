import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

const STATS = [
  { label: 'Tento mesiac', value: 18, sub: 'rezervácií' },
  { label: 'Tento týždeň', value: 4, sub: 'rezervácií' },
  { label: 'Dnes', value: 1, sub: 'rezervácia' },
]

const TILES = [
  {
    id: 'diary',
    label: 'Diár',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    route: '/diary',
    active: true,
    color: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  {
    id: 'customers',
    label: 'Zákazníci',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    active: false,
    color: 'bg-gray-100 text-gray-400 cursor-not-allowed',
  },
  {
    id: 'finance',
    label: 'Financie',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    active: false,
    color: 'bg-gray-100 text-gray-400 cursor-not-allowed',
  },
  {
    id: 'settings',
    label: 'Nastavenia',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    route: '/settings',
    active: true,
    color: 'bg-slate-700 hover:bg-slate-800 text-white',
  },
]

export default function Dashboard() {
  const navigate  = useNavigate()
  const signOut   = useAuthStore((s) => s.signOut)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Artenz Admin</h1>
        </div>
        <nav className="flex items-center gap-1">
          <button className="px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-md">
            Prehľad
          </button>
          <button
            onClick={() => navigate('/diary')}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            Diár
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            Nastavenia
          </button>
          <button
            onClick={signOut}
            className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ml-2"
          >
            Odhlásiť
          </button>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{s.value}</p>
              <p className="text-sm text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Section tiles */}
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Sekcie</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {TILES.map((tile) => (
            <button
              key={tile.id}
              onClick={() => tile.active && navigate(tile.route)}
              disabled={!tile.active}
              className={`
                relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl
                border transition-all shadow-sm
                ${tile.active
                  ? `${tile.color} border-transparent shadow-md hover:shadow-lg hover:-translate-y-0.5`
                  : 'bg-gray-50 border-gray-200 text-gray-400'}
              `}
            >
              {tile.icon}
              <span className="text-sm font-semibold">{tile.label}</span>
              {!tile.active && (
                <span className="absolute top-2 right-2 text-[10px] font-medium bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                  Čoskoro
                </span>
              )}
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
