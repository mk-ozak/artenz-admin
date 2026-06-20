import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Predvolené hodnoty (kým sa načítajú z app_settings / keby DB zlyhala).
const FALLBACK = {
  portionOptions: ['160/200 g', '360 g'],
  defaultPriceDaily: 6.9,
  defaultPricePermanent: 8.5,
}

// Načíta nastavenia menuLuna z tabuľky app_settings (key-value, jsonb).
export function useMenuSettings() {
  const [settings, setSettings] = useState(FALLBACK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['portion_options', 'default_price_daily', 'default_price_permanent'])
      .then(({ data }) => {
        if (!alive) return
        const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
        setSettings({
          portionOptions: Array.isArray(map.portion_options) ? map.portion_options : FALLBACK.portionOptions,
          defaultPriceDaily:
            map.default_price_daily != null ? Number(map.default_price_daily) : FALLBACK.defaultPriceDaily,
          defaultPricePermanent:
            map.default_price_permanent != null ? Number(map.default_price_permanent) : FALLBACK.defaultPricePermanent,
        })
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  return { ...settings, loading }
}
