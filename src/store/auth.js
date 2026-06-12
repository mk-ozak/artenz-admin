import { create } from 'zustand'
import { supabase } from '../lib/supabase'

async function fetchRole(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', userId)
    .single()
  if (error) {
    console.error('[auth] fetchRole error:', error.message)
    return null
  }
  return data
}

export const useAuthStore = create((set) => ({
  user:      null,
  role:      null,
  fullName:  null,
  isLoading: true,

  // Volaj raz pri štarte aplikácie – vracia cleanup funkciu pre useEffect
  init: () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // POZOR: žiadny await priamo v callbacku — callback drží interný
        // auth zámok supabase-js a dotaz na profiles by sa oň zablokoval
        // (deadlock pri obnove tokenu po prebudení PWA → večný spinner).
        // setTimeout(0) odloží prácu mimo zámku.
        setTimeout(async () => {
          if (session?.user) {
            const { user, role } = useAuthStore.getState()
            // Pri obnove tokenu toho istého používateľa rolu nenačítavaj znova
            if (user?.id === session.user.id && role) {
              set({ user: session.user, isLoading: false })
              return
            }
            const profile = await fetchRole(session.user.id)
            set({
              user:      session.user,
              role:      profile?.role ?? null,
              fullName:  profile?.full_name ?? null,
              isLoading: false,
            })
          } else {
            set({ user: null, role: null, fullName: null, isLoading: false })
          }
        }, 0)
      }
    )
    return () => subscription.unsubscribe()
  },

  signIn: async (email, password) => {
    set({ isLoading: true })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      set({ isLoading: false })
      return error.message
    }
    // onAuthStateChange spracuje zvyšok (user + role)
    return null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    // onAuthStateChange nastaví user/role na null
  },
}))
