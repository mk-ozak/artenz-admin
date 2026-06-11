import { supabase } from './supabase'

// Volanie /api/users s tokenom prihláseného admina.
// Vracia { data, error } — error je text chyby alebo null.
export async function usersApi(body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { data: null, error: 'Nie si prihlásený' }

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { data: null, error: json.error ?? `Chyba ${res.status}` }
    return { data: json, error: null }
  } catch (e) {
    return { data: null, error: e.message }
  }
}
