import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'

const ROLES = [
  { value: 'admin',     label: 'Admin' },
  { value: 'read_only', label: 'Len čítanie' },
  { value: 'customer',  label: 'Zákazník' },
]

const ROLE_BADGE = {
  admin:     'bg-indigo-100 text-indigo-700',
  read_only: 'bg-gray-100 text-gray-600',
  customer:  'bg-emerald-100 text-emerald-700',
}

function initials(name) {
  if (!name?.trim()) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

export default function Settings() {
  const navigate   = useNavigate()
  const { role: currentUserRole } = useAuthStore()

  const [profiles,  setProfiles]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [saving,    setSaving]    = useState({})   // { [id]: boolean }
  const [rowError,  setRowError]  = useState({})   // { [id]: string }

  const isAdmin = currentUserRole === 'admin'

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    fetchProfiles()
  }, [isAdmin])

  async function fetchProfiles() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .order('created_at')
    if (error) setError(error.message)
    else setProfiles(data ?? [])
    setLoading(false)
  }

  async function updateRole(id, newRole) {
    const prev = profiles.find(p => p.id === id)?.role
    setProfiles(ps => ps.map(p => p.id === id ? { ...p, role: newRole } : p))
    setSaving(s  => ({ ...s, [id]: true  }))
    setRowError(s => ({ ...s, [id]: null }))

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', id)

    if (error) {
      setProfiles(ps => ps.map(p => p.id === id ? { ...p, role: prev } : p))
      setRowError(s => ({ ...s, [id]: error.message }))
    }
    setSaving(s => ({ ...s, [id]: false }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Artenz Admin</h1>
        </div>
        <nav className="flex items-center gap-1">
          <button
            onClick={() => navigate('/')}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            Prehľad
          </button>
          <button
            onClick={() => navigate('/diary')}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            Diár
          </button>
          <button className="px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-md">
            Nastavenia
          </button>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-gray-900 mb-6">Nastavenia</h2>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-1">
            <button className="px-4 py-2.5 text-sm font-medium text-indigo-700 border-b-2 border-indigo-600 -mb-px">
              Používatelia
            </button>
          </div>
        </div>

        {/* Tab content */}
        {!isAdmin ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">Prístup zamietnutý</p>
            <p className="text-xs text-gray-500 mt-1">Túto sekciu môže zobraziť len administrátor.</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-12">Žiadni používatelia.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Používateľ
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Rola
                  </th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    {/* Avatar + name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {initials(p.full_name)}
                        </div>
                        <span className="font-medium text-gray-900 truncate">
                          {p.full_name?.trim() || <span className="text-gray-400 font-normal">Bez mena</span>}
                        </span>
                      </div>
                    </td>

                    {/* Role dropdown */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[p.role] ?? 'bg-gray-100 text-gray-600'}`}>
                          {ROLES.find(r => r.value === p.role)?.label ?? p.role}
                        </span>
                        <select
                          value={p.role}
                          disabled={saving[p.id]}
                          onChange={(e) => updateRole(p.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white
                                     text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500
                                     disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        {rowError[p.id] && (
                          <span className="text-xs text-red-600" title={rowError[p.id]}>Chyba</span>
                        )}
                      </div>
                    </td>

                    {/* Saving indicator */}
                    <td className="px-4 py-3 text-right">
                      {saving[p.id] && (
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin inline-block" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
