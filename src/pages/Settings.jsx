import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { usersApi } from '../lib/usersApi'
import { useAuthStore } from '../store/auth'
import ActivityLogs from '../components/settings/ActivityLogs'

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

const EMPTY_NEW_USER = { fullName: '', email: '', password: '', role: 'read_only' }

export default function Settings() {
  const navigate   = useNavigate()
  const { user: currentUser, role: currentUserRole } = useAuthStore()

  const [profiles,  setProfiles]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [saving,    setSaving]    = useState({})   // { [id]: boolean }
  const [rowError,  setRowError]  = useState({})   // { [id]: string }

  const [showAdd,   setShowAdd]   = useState(false)
  const [newUser,   setNewUser]   = useState(EMPTY_NEW_USER)
  const [adding,    setAdding]    = useState(false)
  const [addError,  setAddError]  = useState(null)

  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const confirmTimer = useRef(null)

  const [tab, setTab] = useState('users')   // 'users' | 'logs'

  const isAdmin = currentUserRole === 'admin'

  async function handleAddUser(e) {
    e.preventDefault()
    if (!newUser.email.trim() || !newUser.password.trim()) {
      setAddError('Email a heslo sú povinné.')
      return
    }
    setAdding(true)
    setAddError(null)
    const { error } = await usersApi({
      action:   'create',
      email:    newUser.email.trim(),
      password: newUser.password,
      fullName: newUser.fullName.trim(),
      role:     newUser.role,
    })
    setAdding(false)
    if (error) { setAddError(error); return }
    setNewUser(EMPTY_NEW_USER)
    setShowAdd(false)
    fetchProfiles()
  }

  // Prvý klik = potvrdenie (~4 s), druhý = zmazanie používateľa
  async function handleDeleteUser(id) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirmDeleteId(null), 4000)
      return
    }
    clearTimeout(confirmTimer.current)
    setConfirmDeleteId(null)
    setSaving(s => ({ ...s, [id]: true }))
    setRowError(s => ({ ...s, [id]: null }))
    const { error } = await usersApi({ action: 'revoke', userId: id })
    setSaving(s => ({ ...s, [id]: false }))
    if (error) { setRowError(s => ({ ...s, [id]: error })); return }
    setProfiles(ps => ps.filter(p => p.id !== id))
  }

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    fetchProfiles()
  }, [isAdmin])

  async function fetchProfiles() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
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
            {[['users', 'Používatelia'], ['logs', 'Logy']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2.5 text-sm font-medium -mb-px transition-colors
                            ${tab === key
                              ? 'text-indigo-700 border-b-2 border-indigo-600'
                              : 'text-gray-500 hover:text-gray-800'}`}
              >
                {label}
              </button>
            ))}
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
        ) : tab === 'logs' ? (
          <ActivityLogs />
        ) : loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <>
          {/* Pridanie používateľa */}
          <div className="mb-4">
            {!showAdd ? (
              <button
                onClick={() => { setShowAdd(true); setAddError(null) }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold
                           transition-opacity hover:opacity-90"
                style={{ background: '#4cbfb3', color: '#0a2d2a' }}
              >
                <IconPlus size={16} stroke={2.5} />
                Pridať používateľa
              </button>
            ) : (
              <form onSubmit={handleAddUser}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                <p className="text-sm font-bold text-gray-900">Nový používateľ</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Meno</label>
                    <input
                      type="text"
                      value={newUser.fullName}
                      onChange={e => setNewUser(u => ({ ...u, fullName: e.target.value }))}
                      placeholder="Meno a priezvisko"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))}
                      placeholder="meno@artenz.sk"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Heslo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newUser.password}
                      onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                      placeholder="Minimálne 6 znakov"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Rola</label>
                    <select
                      value={newUser.role}
                      onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white
                        focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {addError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                    {addError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowAdd(false); setNewUser(EMPTY_NEW_USER) }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium
                      rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Zrušiť
                  </button>
                  <button
                    type="submit"
                    disabled={adding}
                    className="px-4 py-2 text-sm font-bold rounded-lg transition-opacity
                      hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#4cbfb3', color: '#0a2d2a' }}
                  >
                    {adding ? 'Vytváram…' : 'Vytvoriť'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {profiles.length === 0 ? (
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
                    {/* Avatar + name + email */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {initials(p.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {p.full_name?.trim() || <span className="text-gray-400 font-normal">Bez mena</span>}
                          </p>
                          {p.email && (
                            <p className="text-xs text-gray-400 truncate">{p.email}</p>
                          )}
                        </div>
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

                    {/* Delete + saving indicator */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {saving[p.id] ? (
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin inline-block" />
                      ) : p.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDeleteUser(p.id)}
                          title="Zmazať používateľa"
                          aria-label="Zmazať používateľa"
                          className={`px-2 py-1.5 rounded-md text-xs font-bold border transition-colors
                                      inline-flex items-center gap-1
                                      ${confirmDeleteId === p.id
                                        ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                                        : 'border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 hover:bg-red-50'}`}
                        >
                          <IconTrash size={14} />
                          {confirmDeleteId === p.id && 'Naozaj?'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          </>
        )}
      </main>
    </div>
  )
}
