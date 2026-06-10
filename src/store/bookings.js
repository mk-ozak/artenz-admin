import { create } from 'zustand'
import { supabase } from '../lib/supabase'

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
    deposit:        row.deposit_amount != null ? Number(row.deposit_amount) : 0,
    depositPaid:    row.deposit_paid ?? false,
    guestCount:     row.guest_count ?? 0,
    notes:          row.notes ?? '',
    googleEventId:  row.google_calendar_event_id ?? null,
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

function calendarTitle(formData) {
  return `${formData.type ?? 'Akcia'} – ${formData.customerName}`
}

function toBackend(b) {
  return {
    customer_name: b.customerName,
    date: b.date,
    hall: HALL_MAP[b.venue] ?? b.venue.toUpperCase(),
    event_type: b.type || null,
    deposit_amount: b.deposit !== '' && b.deposit != null ? Number(b.deposit) : null,
    deposit_paid: b.depositPaid ?? false,
    guest_count: b.guestCount !== '' && b.guestCount != null ? Number(b.guestCount) : null,
    notes: b.notes || null,
  }
}

export const useBookingsStore = create((set, get) => ({
  bookings: [],
  loading: false,
  error: null,
  selectedBooking: null,
  modalState: null,   // { mode: 'add'|'edit', date?, venue?, booking? }
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

  deleteBooking: async (id, googleEventId) => {
    console.log('[bookings] deleteBooking', id)
    if (googleEventId) {
      await syncCalendar('DELETE', { eventId: googleEventId })
    }
    const { error } = await supabase.from('bookings').delete().eq('id', id)
    if (error) {
      console.error('[bookings] deleteBooking error:', error)
      return error.message
    }
    set({ selectedBooking: null })
    return null
  },
}))
