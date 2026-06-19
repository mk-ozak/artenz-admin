import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { EVENT_LABEL } from '../lib/eventTypes'

const HALL_MAP = {
  artenzPlus: 'ARTENZ_PLUS',
  artenz: 'ARTENZ',
  luna: 'LUNA',
  catering: 'CATERING',
}
const HALL_REVERSE = Object.fromEntries(Object.entries(HALL_MAP).map(([k, v]) => [v, k]))

function pad(n) { return String(n).padStart(2, '0') }

function toFrontend(row) {
  return {
    id:             row.id,
    customerName:   row.customer_name,
    date:           row.date,
    venue:          HALL_REVERSE[row.hall] ?? row.hall.toLowerCase(),
    type:           row.event_type ?? 'svadba',
    deposit:        row.deposit_amount != null ? Number(row.deposit_amount) : '',
    decoration:     row.decoration ?? '',
    guestCount:     row.guest_count ?? 0,
    guestsAdults:     row.guests_adults ?? '',
    guestsSpecials:   row.guests_specials ?? '',
    guestsKidsMeal:   row.guests_kids_meal ?? '',
    guestsKidsNoMeal: row.guests_kids_no_meal ?? '',
    decoration:     row.decoration ?? '',
    notes:          row.notes ?? '',
    googleEventId:  row.google_calendar_event_id ?? null,
    status:         row.status ?? 'dopyt',
    phone:          row.customer_phone ?? null,
    time:           row.start_time ? row.start_time.slice(0, 5) : '',
    expectedGuests: row.expected_guests != null ? row.expected_guests : '',
    estimatedPrice: row.estimated_price != null ? Number(row.estimated_price) : '',
  }
}

async function syncCalendar(method, body) {
  try {
    const res = await fetch('/api/calendar', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())
    return await res.json()
  } catch (e) {
    console.warn('[bookings] Google Calendar sync failed:', e.message)
    return null
  }
}

const HALL_LABEL = {
  ARTENZ_PLUS: 'ARTENZ PLUS',
  ARTENZ:      'ARTENZ',
  LUNA:        'LUNA',
  CATERING:    'CATERING',
}

// Názov udalosti v kalendári: „SÁLA – meno – typ"
function calendarTitle(formData) {
  const hall  = HALL_MAP[formData.venue] ?? formData.venue?.toUpperCase()
  const label = HALL_LABEL[hall] ?? hall
  const type  = EVENT_LABEL[formData.type] ?? formData.type ?? 'Akcia'
  return `${label} – ${formData.customerName} – ${type}`
}

function toBackend(b) {
  return {
    customer_name: b.customerName,
    date: b.date,
    hall: HALL_MAP[b.venue] ?? b.venue.toUpperCase(),
    event_type: b.type || null,
    deposit_amount: b.deposit !== '' && b.deposit != null ? Number(b.deposit) : null,
    decoration: b.decoration || null,
    // Pozn.: počty hostí (guests_*) a notes vlastní sekcia Menu (auto-uloženie),
    // modál ich zámerne nezapisuje, aby ich neprepísal.
    status: b.status ?? 'dopyt',
    customer_phone: b.phone?.trim() || null,
    start_time: b.time || null,
    // Prázdne (nezadané) → NULL; inak číslo
    expected_guests: b.expectedGuests !== '' && b.expectedGuests != null ? Number(b.expectedGuests) : null,
    estimated_price: b.estimatedPrice !== '' && b.estimatedPrice != null ? Number(b.estimatedPrice) : null,
  }
}

export const useBookingsStore = create((set, get) => ({
  bookings: [],
  loading: false,
  error: null,
  selectedBooking: null,
  modalState: null,   // { mode: 'add'|'edit', date?, venue?, booking? }
  toast: null,        // { message, bookingId? } | null
  _channel: null,
  currentYear: null,
  currentMonth: null,

  fetchBookings: async (year, month) => {
    console.log('[bookings] fetchBookings', year, month)
    set({ loading: true, error: null, currentYear: year, currentMonth: month })
    const start = `${year}-${pad(month + 1)}-01`
    const end   = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`

    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .is('deleted_at', null)
      .gte('date', start)
      .lte('date', end)
      .order('date')

    if (error) {
      console.error('[bookings] fetchBookings error:', error)
      const msg = error.code === 'PGRST205'
        ? 'Tabuľka bookings neexistuje. Spusti SQL v Supabase SQL Editore (súbor supabase/setup.sql).'
        : error.message
      set({ error: msg, loading: false })
      return
    }

    console.log('[bookings] fetched', data?.length, 'rows')
    const fresh = (data ?? []).map(toFrontend)
    const { selectedBooking } = get()
    set({
      bookings: fresh,
      loading: false,
      selectedBooking: selectedBooking
        ? (fresh.find(b => b.id === selectedBooking.id) ?? null)
        : null,
    })
  },

  subscribeToMonth: (year, month) => {
    const { _channel } = get()
    if (_channel) supabase.removeChannel(_channel)

    const channel = supabase
      .channel(`bookings-${year}-${month}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        const { currentYear, currentMonth } = get()
        if (currentYear !== null) get().fetchBookings(currentYear, currentMonth)
      })
      .subscribe()

    set({ _channel: channel })
  },

  unsubscribe: () => {
    const { _channel } = get()
    if (_channel) { supabase.removeChannel(_channel); set({ _channel: null }) }
  },

  selectBooking: (booking) => set({ selectedBooking: booking }),
  clearSelection: () => set({ selectedBooking: null }),

  showToast: (toast) => set({ toast }),
  hideToast: () => set({ toast: null }),

  openAddModal: (date, venue) => {
    console.log('[bookings] openAddModal', date, venue)
    set({ modalState: { mode: 'add', date, venue }, selectedBooking: null })
  },
  openEditModal: (booking) => {
    console.log('[bookings] openEditModal', booking.id)
    set({ modalState: { mode: 'edit', booking }, selectedBooking: null })
  },
  closeModal: () => set({ modalState: null }),

  addBooking: async (formData) => {
    const payload = toBackend(formData)
    console.log('[bookings] addBooking payload:', payload)
    const { data, error } = await supabase
      .from('bookings')
      .insert(payload)
      .select()
    if (error) {
      console.error('[bookings] addBooking error:', error)
      return error.message
    }
    const newRow = data[0]
    const result = await syncCalendar('POST', {
      title: calendarTitle(formData),
      hall:  HALL_MAP[formData.venue] ?? formData.venue.toUpperCase(),
      date:  formData.date,
    })
    if (result?.eventId) {
      await supabase
        .from('bookings')
        .update({ google_calendar_event_id: result.eventId })
        .eq('id', newRow.id)
    }
    console.log('[bookings] addBooking success:', newRow.id)
    set({ modalState: null })
    return null
  },

  updateBooking: async (id, formData, googleEventId) => {
    const payload = toBackend(formData)
    console.log('[bookings] updateBooking', id, payload)
    const { error } = await supabase.from('bookings').update(payload).eq('id', id)
    if (error) {
      console.error('[bookings] updateBooking error:', error)
      return error.message
    }
    if (googleEventId) {
      await syncCalendar('PATCH', {
        eventId: googleEventId,
        title:   calendarTitle(formData),
        hall:    HALL_MAP[formData.venue] ?? formData.venue.toUpperCase(),
        date:    formData.date,
      })
    }
    set({ modalState: null, selectedBooking: null })
    return null
  },

  // Soft delete – riadok sa fyzicky nemaže, len sa nastaví deleted_at.
  // Google Calendar event sa zmaže (pri obnove sa vytvorí nanovo).
  deleteBooking: async (id, googleEventId) => {
    console.log('[bookings] deleteBooking (soft)', id)
    if (googleEventId) {
      await syncCalendar('DELETE', { eventId: googleEventId })
    }
    const { error } = await supabase
      .from('bookings')
      .update({ deleted_at: new Date().toISOString(), google_calendar_event_id: null })
      .eq('id', id)
    if (error) {
      console.error('[bookings] deleteBooking error:', error)
      return error.message
    }
    set({ selectedBooking: null })
    return null
  },

  // Obnova soft-deleted rezervácie – deleted_at späť na null
  // + opätovné vytvorenie Google Calendar eventu.
  restoreBooking: async (id) => {
    console.log('[bookings] restoreBooking', id)
    const { data: row, error: fetchErr } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr) {
      console.error('[bookings] restoreBooking fetch error:', fetchErr)
      return fetchErr.message
    }

    const { error } = await supabase
      .from('bookings')
      .update({ deleted_at: null })
      .eq('id', id)
    if (error) {
      console.error('[bookings] restoreBooking error:', error)
      return error.message
    }

    // Event sa pri mazaní zmazal → vytvor ho nanovo a ulož nové ID.
    if (row && !row.google_calendar_event_id) {
      const result = await syncCalendar('POST', {
        title: `${HALL_LABEL[row.hall] ?? row.hall} – ${row.customer_name} – ${EVENT_LABEL[row.event_type] ?? row.event_type ?? 'Akcia'}`,
        hall:  row.hall,
        date:  row.date,
      })
      if (result?.eventId) {
        await supabase
          .from('bookings')
          .update({ google_calendar_event_id: result.eventId })
          .eq('id', id)
      }
    }
    return null
  },
}))
