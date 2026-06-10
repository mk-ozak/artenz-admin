import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export default function LoginPage() {
  const { user, isLoading, signIn } = useAuthStore()
  const navigate = useNavigate()

  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#354d5d' }}>
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
             style={{ borderColor: '#4cbfb3', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const err = await signIn(email, password)
    if (err) {
      setError(err)
      setSubmitting(false)
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center px-6 pt-16"
         style={{ background: '#354d5d' }}>
      <div className="w-full max-w-[320px]">

        {/* Brand */}
        <div className="text-center mb-12">
          <img
            src="/artenz_logo.png"
            alt="Artenz"
            style={{
              width: 200,
              marginBottom: 10,
              display: 'block',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />
          <p style={{ fontSize: 34, fontWeight: 700, color: '#ddeef6', letterSpacing: '-0.02em', lineHeight: 1 }}>
            ADMIN
          </p>
          <p style={{ fontSize: 13, color: 'rgba(221,238,246,.32)', marginTop: 6 }}>
            Rezervačný systém
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col" style={{ gap: 14 }}>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'rgba(221,238,246,.48)', marginBottom: 7 }}>
              Meno / E-mail
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="meno@artenz.sk"
              style={{
                width: '100%', background: '#fff', border: 'none', borderRadius: 12,
                padding: '14px 16px', fontSize: 15, color: '#1a2830', outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'rgba(221,238,246,.48)', marginBottom: 7 }}>
              Heslo
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', background: '#fff', border: 'none', borderRadius: 12,
                padding: '14px 16px', fontSize: 15, color: '#1a2830', outline: 'none',
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: '#ffb3b3', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', background: submitting ? '#3aa89d' : '#4cbfb3',
              border: 'none', borderRadius: 14, padding: 16,
              fontSize: 16, fontWeight: 700, color: '#0a2d2a',
              cursor: submitting ? 'not-allowed' : 'pointer',
              marginTop: 6, transition: 'background .15s',
            }}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: '#0a2d2a', borderTopColor: 'transparent' }} />
                Prihlasujem…
              </span>
            ) : (
              'Prihlásiť sa'
            )}
          </button>

        </form>
      </div>
    </div>
  )
}
