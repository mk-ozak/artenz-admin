import { supabase } from './supabase'
import { EVENT_LABEL } from './eventTypes'
import { SETTLEMENT_DOCUMENT_LABEL, SETTLEMENT_METHOD_LABEL } from './settlement'

// Spoločné popisy logov činností (stránka Logy + História rezervácie v detaile)

export const ACTION_LABEL = {
  booking_create:         'Vytvoril rezerváciu',
  booking_update:         'Upravil rezerváciu',
  booking_soft_delete:    'Vymazal rezerváciu',
  booking_restore:        'Obnovil rezerváciu',
  booking_delete:         'Natrvalo vymazal rezerváciu',
  user_create:            'Vytvoril používateľa',
  customer_access_create: 'Vytvoril zákaznícky prístup',
  user_delete:            'Zmazal používateľa',
  user_password_reset:    'Resetoval heslo',
}

export const HALL_LABEL = {
  ARTENZ_PLUS: 'ARTENZ PLUS',
  ARTENZ:      'ARTENZ',
  LUNA:        'LUNA',
  CATERING:    'CATERING',
}

const STATUS_LABEL = {
  dopyt:     'Nezáväzný dopyt',
  zaloha:    'Čakajúca záloha',
  potvrdene: 'Potvrdené',
}

// Slovenské názvy stĺpcov pre riadky zmien
export const FIELD_LABEL = {
  customer_name:   'Názov',
  customer_phone:  'Telefón',
  date:            'Dátum',
  start_time:      'Čas',
  hall:            'Sála',
  event_type:      'Typ akcie',
  status:          'Stav',
  expected_guests: 'Očakávaný počet osôb',
  estimated_price: 'Cena na osobu',
  guest_count:     'Počet hostí',
  deposit_amount:  'Záloha',
  deposit_payments: 'Zaplatené zálohy',
  settlement_document: 'Vyúčtovanie – doklad',
  settlement_method:   'Vyúčtovanie – spôsob',
  // decoration = všeobecné poznámky z formulára; notes = požiadavky ku strave (Menu)
  decoration:      'Poznámky',
  notes:           'Požiadavky ku strave',
  // Sekcia Menu v detaile rezervácie
  guests_adults:         'Dospelí',
  guests_adults_no_meal: 'Dospelí bez jedla',
  guests_specials:       'Špeciály',
  guests_kids_meal:      'Deti s jedlom',
  guests_kids_no_meal:   'Deti bez jedla',
  raut_enabled:    'Raut',
  raut_extra:      'Raut navyše/menej',
  raut_grams:      'Gramáž rautu (g)',
  menu_created:    'Menu vytvorené',
}

export function formatValue(field, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'áno' : 'nie'
  if (field === 'status')     return STATUS_LABEL[value] ?? value
  if (field === 'hall')       return HALL_LABEL[value] ?? value
  if (field === 'event_type') return EVENT_LABEL[value] ?? value
  if (field === 'settlement_document') return SETTLEMENT_DOCUMENT_LABEL[value] ?? value
  if (field === 'settlement_method')   return SETTLEMENT_METHOD_LABEL[value] ?? value
  if (field === 'start_time')   return String(value).slice(0, 5)
  if (field === 'deposit_payments') {
    const arr = Array.isArray(value) ? value : []
    return arr.length ? arr.map(p => `${p.amount} € (${p.date})`).join(', ') : '—'
  }
  const s = String(value)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}

export function formatTime(ts) {
  return new Date(ts).toLocaleString('sk', {
    day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Mená používateľov pre logy: { user_id: meno } (bez mena → e-mail z profilu).
// Profily všetkých používateľov číta cez RLS len admin — rovnako ako logy.
export async function fetchUserNames() {
  const { data, error } = await supabase.from('profiles').select('id, full_name, email')
  if (error) { console.error('[activityLog] profiles:', error.message); return {} }
  return Object.fromEntries((data ?? []).map(p => [p.id, p.full_name?.trim() || p.email]))
}

// Kto akciu urobil: meno → e-mail z logu (zmazaný používateľ) → systém
export function userLabel(log, names) {
  return names[log.user_id] ?? log.user_email ?? 'systém'
}
