import { useState } from 'react'
import { IconLock } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'

// Zmena vlastného hesla — staré heslo + 2× nové.
// Staré heslo sa overuje opätovným prihlásením tým istým účtom.
export default function ChangePassword() {
  const { user } = useAuthStore()

  const [oldPass, setOldPass]   = useState('')
  const [newPass, setNewPass]   = useState('')
  const [newPass2, setNewPass2] = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState(null)
  const [done, setDone]         = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setDone(false)

    if (newPass.length < 6)   { setError('Nové heslo musí mať aspoň 6 znakov.'); return }
    if (newPass !== newPass2) { setError('Nové heslá sa nezhodujú.'); return }
    if (newPass === oldPass)  { setError('Nové heslo musí byť iné ako staré.'); return }

    setBusy(true)
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPass,
    })
    if (signErr) {
      setBusy(false)
      setError('Staré heslo nie je správne.')
      return
    }

    const { error: updErr } = await supabase.auth.updateUser({ password: newPass })
    setBusy(false)
    if (updErr) { setError(updErr.message); return }

    setOldPass('')
    setNewPass('')
    setNewPass2('')
    setDone(true)
  }

  const inputCls = `w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
    focus:outline-none focus:ring-2 focus:ring-indigo-500`

  return (
    <form onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
      <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
        <IconLock size={16} className="text-gray-400" />
        Zmena vlastného hesla
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Staré heslo</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={oldPass}
            onChange={e => setOldPass(e.target.value)}
            placeholder="••••••••"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nové heslo</label>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
            placeholder="Minimálne 6 znakov"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nové heslo znova</label>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={newPass2}
            onChange={e => setNewPass2(e.target.value)}
            placeholder="Zopakuj nové heslo"
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}
      {done && (
        <p className="text-sm text-[#2a8d83] bg-[#eaf7f5] border border-[#9fdcd5] px-3 py-2 rounded-lg">
          Heslo bolo zmenené ✓
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="px-4 py-2 text-sm font-bold rounded-lg transition-opacity
          hover:opacity-90 disabled:opacity-50"
        style={{ background: '#4cbfb3', color: '#0a2d2a' }}
      >
        {busy ? 'Mením…' : 'Zmeniť heslo'}
      </button>
    </form>
  )
}
