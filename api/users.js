import { createClient } from '@supabase/supabase-js'

const ROLES = ['admin', 'read_only', 'customer']

function serviceClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// 8 znakov bez ľahko zameniteľných (0/O, 1/l/I)
function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

export default async function handler(req, res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Users API not configured' })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sb = serviceClient()

  // Overenie: volajúci musí byť prihlásený admin
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Missing token' })

  const { data: { user: caller } = {}, error: authErr } = await sb.auth.getUser(token)
  if (authErr || !caller) return res.status(401).json({ error: 'Invalid token' })

  const { data: callerProfile } = await sb
    .from('profiles').select('role').eq('id', caller.id).single()
  if (callerProfile?.role !== 'admin') {
    return res.status(403).json({ error: 'Len administrátor môže spravovať používateľov' })
  }

  const { action } = req.body ?? {}

  // Zápis do logov (service role obchádza RLS)
  async function logActivity(act, entityId, details) {
    await sb.from('activity_logs').insert({
      user_id:    caller.id,
      user_email: caller.email,
      action:     act,
      entity:     'user',
      entity_id:  entityId,
      details,
    })
  }

  try {
    // ── Nový používateľ (admin / read_only) ──────────────────
    if (action === 'create') {
      const { email, password, fullName, role } = req.body
      if (!email || !password || !ROLES.includes(role)) {
        return res.status(400).json({ error: 'Chýba email, heslo alebo rola' })
      }
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName ?? '' },
      })
      if (error) throw error

      await sb.from('profiles').upsert({
        id: data.user.id,
        role,
        full_name: fullName ?? '',
        email,
      })
      await logActivity('user_create', data.user.id, { email, role, full_name: fullName ?? '' })
      return res.json({ userId: data.user.id })
    }

    // ── Prístup zákazníka k rezervácii ───────────────────────
    if (action === 'create_customer') {
      const { bookingId } = req.body
      if (!bookingId) return res.status(400).json({ error: 'Chýba bookingId' })

      const { data: booking, error: bErr } = await sb
        .from('bookings')
        .select('id, customer_name, user_id')
        .eq('id', bookingId)
        .single()
      if (bErr || !booking) return res.status(404).json({ error: 'Rezervácia sa nenašla' })
      if (booking.user_id) return res.status(400).json({ error: 'Rezervácia už má zákaznícky prístup' })

      const email = `zakaznik-${bookingId.slice(0, 8)}@artenz.guest`
      const password = generatePassword()

      const { data, error } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: booking.customer_name },
      })
      if (error) throw error

      await sb.from('profiles').upsert({
        id: data.user.id,
        role: 'customer',
        full_name: booking.customer_name,
        email,
      })
      await sb.from('bookings').update({ user_id: data.user.id }).eq('id', bookingId)

      await logActivity('customer_access_create', data.user.id, {
        email,
        customer_name: booking.customer_name,
        booking_id: bookingId,
      })
      return res.json({ userId: data.user.id, email, password })
    }

    // ── Zmazanie používateľa / odobratie prístupu ────────────
    if (action === 'revoke') {
      const { userId } = req.body
      if (!userId) return res.status(400).json({ error: 'Chýba userId' })
      if (userId === caller.id) return res.status(400).json({ error: 'Nemôžeš zmazať sám seba' })

      const { data: target } = await sb
        .from('profiles').select('email, role, full_name').eq('id', userId).single()

      const { error } = await sb.auth.admin.deleteUser(userId)
      if (error) throw error
      // bookings.user_id sa vynuluje cez FK on delete set null,
      // profiles riadok zmizne cez on delete cascade
      await logActivity('user_delete', userId, target ?? {})
      return res.json({ ok: true })
    }

    return res.status(400).json({ error: 'Neznáma akcia' })
  } catch (err) {
    console.error('[users]', err.message)
    return res.status(500).json({ error: err.message })
  }
}
