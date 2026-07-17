import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconCopy, IconHome, IconKey, IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { usersApi } from '../lib/usersApi'
import { useAuthStore } from '../store/auth'
import ActivityLogs from '../components/settings/ActivityLogs'
import ChangePassword from '../components/settings/ChangePassword'
import MenuSettings from '../components/settings/MenuSettings'
import MenuTemplates from '../components/settings/MenuTemplates'
import VersionInfo from '../components/settings/VersionInfo'

const ROLES = [
  { value: 'admin',     label: 'Admin' },
  { value: 'read_only', label: 'Len čítanie' },
  { value: 'customer',  label: 'Zákazník' },
]

const ROLE_BADGE = {
  admin:     'bg-[#eaf7f5] text-[#2a8d83]',
  read_only: 'bg-gray-100 text-gray-600',
  customer:  'bg-[#fff5e6] text-[#a87d20]',
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

  const [confirmResetId, setConfirmResetId] = useState(null)
  const resetTimer = useRef(null)
  const [newPassword, setNewPassword] = useState({})   // { [id]: string }
  const [copiedId, setCopiedId] = useState(null)

  const [tab, setTab] = useState('users')   // 'users' | 'menu' | 'templates' | 'logs'

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

  // Prvý klik = potvrdenie (~4 s), druhý = vygenerovanie nového hesla
  async function handleResetPassword(id) {
    if (confirmResetId !== id) {
      setConfirmResetId(id)
      clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setConfirmResetId(null), 4000)
      return
    }
    clearTimeout(resetTimer.current)
    setConfirmResetId(null)
    setSaving(s => ({ ...s, [id]: true }))
    setRowError(s => ({ ...s, [id]: null }))
    const { data, error } = await usersApi({ action: 'reset_password', userId: id })
    setSaving(s => ({ ...s, [id]: false }))
    if (error) { setRowError(s => ({ ...s, [id]: error })); return }
    setNewPassword(s => ({ ...s, [id]: data.password }))
  }

  function copyPassword(id) {
    navigator.clipboard.writeText(newPassword[id]).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
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
      <header className="px-4 py-3 flex items-center justify-between" style={{ background: '#354d5d' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            aria-label="Domov"
            className="w-10 h-10 xl:w-8 xl:h-8 rounded flex items-center justify-center
                       transition-opacity opacity-60 hover:opacity-100"
            style={{ color: '#ddeef6' }}
          >
            <IconHome className="w-7 h-7 xl:w-5 xl:h-5" stroke={2} />
          </button>
          <div>
            <p className="text-[10px] tracking-[.16em] uppercase"
               style={{ color: 'rgba(255,255,255,.4)' }}>ARTENZ</p>
            <p className="text-[18px] font-bold leading-tight" style={{ color: '#ddeef6' }}>
              Nastavenia
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <button
            onClick={() => navigate('/')}
            className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:bg-white/10"
            style={{ color: 'rgba(221,238,246,.6)' }}
          >
            Prehľad
          </button>
          <button
            onClick={() => navigate('/diary')}
            className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:bg-white/10"
            style={{ color: 'rgba(221,238,246,.6)' }}
          >
            Diár
          </button>
          <button
            className="px-3 py-1.5 text-sm font-medium rounded-md"
            style={{ background: 'rgba(255,255,255,.12)', color: '#ddeef6' }}
          >
            Nastavenia
          </button>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="border-b border-[#dde8ec] mb-6">
          <div className="flex gap-1">
            {[['users', 'Používatelia'], ['menu', 'Menu'], ['templates', 'Šablóny'], ['logs', 'Logy'], ['version', 'Aktuálna verzia']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2.5 text-sm font-bold -mb-px transition-colors
                            ${tab === key
                              ? 'text-[#2a8d83] border-b-2 border-[#4cbfb3]'
                              : 'text-[#7a99a8] hover:text-[#354d5d]'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content — verzia je dostupná aj pre ne-adminov */}
        {tab === 'version' ? (
          <VersionInfo />
        ) : !isAdmin && tab === 'users' && currentUserRole === 'read_only' ? (
          <ChangePassword />
        ) : !isAdmin ? (
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
        ) : tab === 'menu' ? (
          <MenuSettings />
        ) : tab === 'templates' ? (
          <MenuTemplates />
        ) : loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#4cbfb3] border-t-transparent rounded-full animate-spin" />
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
                  <Fragment key={p.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    {/* Avatar + name + email */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#ddeef6] text-[#354d5d] flex items-center justify-center text-xs font-bold shrink-0">
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

                    {/* Reset hesla + delete + saving indicator */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {saving[p.id] ? (
                        <div className="w-4 h-4 border-2 border-[#4cbfb3] border-t-transparent rounded-full animate-spin inline-block" />
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleResetPassword(p.id)}
                            title="Resetovať heslo"
                            aria-label="Resetovať heslo"
                            className={`px-2 py-1.5 rounded-md text-xs font-bold border transition-colors
                                        inline-flex items-center gap-1
                                        ${confirmResetId === p.id
                                          ? 'bg-[#4cbfb3] border-[#4cbfb3] text-[#0a2d2a] hover:opacity-90'
                                          : 'border-gray-200 text-gray-400 hover:text-[#2a8d83] hover:border-[#9fdcd5] hover:bg-[#eaf7f5]'}`}
                          >
                            <IconKey size={14} />
                            {confirmResetId === p.id && 'Nové heslo?'}
                          </button>
                          {p.id !== currentUser?.id && (
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
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Nové heslo — zobrazí sa len hneď po resete */}
                  {newPassword[p.id] && (
                    <tr className="bg-amber-50">
                      <td colSpan={3} className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-amber-700 font-medium">Nové heslo:</span>
                          <span className="bg-white border border-amber-200 rounded-lg px-3 py-1.5
                                           text-sm font-mono font-bold tracking-widest text-amber-800">
                            {newPassword[p.id]}
                          </span>
                          <button
                            onClick={() => copyPassword(p.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300
                                       text-gray-700 bg-white hover:bg-gray-50 transition-colors
                                       inline-flex items-center gap-1"
                          >
                            <IconCopy size={14} />
                            {copiedId === p.id ? 'Skopírované ✓' : 'Kopírovať'}
                          </button>
                          <span className="text-xs text-amber-600">
                            Pošli ho používateľovi — po opustení stránky sa už nezobrazí.
                          </span>
                          <button
                            onClick={() => setNewPassword(s => { const n = { ...s }; delete n[p.id]; return n })}
                            title="Skryť"
                            aria-label="Skryť"
                            className="ml-auto p-1.5 rounded-md text-amber-500 hover:text-amber-700
                                       hover:bg-amber-100 transition-colors"
                          >
                            <IconX size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {/* Zmena vlastného hesla */}
          <div className="mt-4">
            <ChangePassword />
          </div>
          </>
        )}
      </main>
    </div>
  )
}
