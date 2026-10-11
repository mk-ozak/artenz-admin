import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconCalendar, IconPencil, IconTrash } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/auth'
import { formatDateSk, formatDateSkYear } from '../../utils/format'
import { toISO } from '../../utils/diaryWeeks'
import { hallShortOf } from '../../utils/kitchenTicket'
import { VO_COLOR, voLabel } from '../../lib/vo'
import VoHeader from '../../components/vo/VoHeader'
import VoStatusToggle from '../../components/vo/VoStatusToggle'
import BookingMenu from '../../components/booking/BookingMenu'
import BookingHistory from '../../components/booking/BookingHistory'

const EMPTY_FORM = { date: '', name: '', notes: '' }

const inputCls = `w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white
  focus:outline-none focus:ring-2 focus:ring-[#4cbfb3]`

// Detail objednávky VO (aj nová objednávka na /vo/objednavka/nova).
// Navrchu základné údaje + Koncept/FINAL, pod tým menu ako v detaile rezervácie,
// naspodu tlač sumáru (A4) a história objednávky.
// VO upravuje len objednávku v stave Koncept, ktorá ešte neprebehla; admin
// aj vo FINAL (doladenie kg rautu), minulé objednávky nikto.
export default function VoOrderDetail() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const role = useAuthStore(s => s.role)
  const isAdmin  = role === 'admin'
  const isVoUser = role === 'vo'

  const [order, setOrder]     = useState(isNew ? null : undefined)  // undefined = načítava
  const [editing, setEditing] = useState(isNew)
  const [form, setForm]       = useState(EMPTY_FORM)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteTimer = useRef(null)
  // Miesto na spodku pre blok „Sumár objednávky" (vykresľuje ho menu)
  const [printSlot, setPrintSlot] = useState(null)

  useEffect(() => {
    if (isNew) {
      setOrder(null)
      setEditing(true)
      setForm(EMPTY_FORM)
      return
    }
    supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('is_vo', true)
      .single()
      .then(({ data, error: err }) => {
        if (err) { console.error('[VoOrderDetail] fetch error:', err.message); setOrder(null); return }
        setOrder(data)
      })
  }, [id, isNew])

  const today    = toISO(new Date())
  const status   = order?.vo_status ?? 'koncept'
  const isPast   = !!order && order.date < today
  const canEdit  = !!order && !isPast && (isAdmin || (isVoUser && status === 'koncept'))
  const canToggle = !!order && !isPast && (isAdmin || isVoUser)

  function startEdit() {
    setForm({
      date: order.date,
      name: order.customer_name ?? '',
      notes: order.decoration ?? '',
    })
    setError('')
    setEditing(true)
  }

  function cancelEdit() {
    if (isNew) { navigate('/vo'); return }
    setEditing(false)
    setError('')
  }

  async function save(e) {
    e.preventDefault()
    if (!form.date) { setError('Vyberte dátum objednávky.'); return }
    if (form.date < today && (isNew || form.date !== order.date)) {
      setError('Dátum nemôže byť v minulosti.')
      return
    }
    setSaving(true)
    setError('')
    // čas podávania sa zadáva v menu (Hlavné jedlo / Raut);
    // Poznámky = spoločné pole s adminom (v diári „Poznámky")
    const fields = { date: form.date, decoration: form.notes.trim() || null }
    const { data, error: err } = isNew
      ? await supabase
          .from('bookings')
          .insert({
            ...fields,
            // prázdny názov doplní databáza na „Objednávka č. N"
            customer_name: form.name.trim(),
            is_vo:         true,
            vo_status:     'koncept',
            hall:          'CATERING',
            event_type:    'catering',
            status:        'potvrdene',
            deposit_amount: 0,   // objednávka VO je vždy bez zálohy
          })
          .select()
          .single()
      : await supabase
          .from('bookings')
          .update({ ...fields, customer_name: form.name.trim() || `Objednávka č. ${order.vo_order_no}` })
          .eq('id', order.id)
          .select()
          .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    setOrder(data)
    setEditing(false)
    if (isNew) navigate(`/vo/objednavka/${data.id}`, { replace: true })
  }

  // Prvý klik = potvrdenie (~4 s), druhý = vymazanie (soft delete — admin ju
  // vidí v „Zmazané rezervácie" a vie ju obnoviť)
  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      clearTimeout(deleteTimer.current)
      deleteTimer.current = setTimeout(() => setConfirmDelete(false), 4000)
      return
    }
    clearTimeout(deleteTimer.current)
    setConfirmDelete(false)
    setSaving(true)
    const { error: err } = await supabase
      .from('bookings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', order.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    navigate('/vo', { replace: true })
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <VoHeader title={isNew ? 'Nová objednávka' : 'Objednávka'} backTo="/vo" />

      <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col gap-3 px-4 py-4">
        {order === undefined && (
          <p className="text-sm text-[#8aaabb] italic">Načítavam…</p>
        )}
        {order === null && !isNew && (
          <p className="text-sm text-red-600">Objednávka sa nenašla.</p>
        )}

        {/* Základné údaje — formulár (nová / úprava) */}
        {editing && (isNew || order) && (
          <form onSubmit={save}
                className="relative rounded-card bg-white border border-[#e0e8ec] px-4 py-3 pl-5 overflow-hidden space-y-3">
            <div className="absolute left-0 inset-y-0 w-1" style={{ background: VO_COLOR }} />
            <p className="text-[10px] text-[#8aaabb] tracking-widest uppercase">
              {isNew ? 'Nová objednávka' : `Upraviť objednávku č. ${order.vo_order_no}`}
            </p>
            <div className="sm:w-1/2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Dátum <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                min={today}
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Názov objednávky (meno zákazníka)
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={isNew ? 'Nepovinné' : `Objednávka č. ${order.vo_order_no}`}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Poznámky</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Dohody, špecifiká…"
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-bold rounded-lg transition-opacity
                           hover:opacity-90 disabled:opacity-50"
                style={{ background: '#4cbfb3', color: '#0a2d2a' }}
              >
                {saving ? 'Ukladám…' : isNew ? 'Vytvoriť objednávku' : 'Uložiť'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium
                           rounded-lg hover:bg-gray-50 transition-colors"
              >
                Zrušiť
              </button>
            </div>
          </form>
        )}

        {order && (
          <>
            {/* Základné údaje — prehľad */}
            {!editing && (
              <div className="relative rounded-card bg-white border border-[#e0e8ec] px-4 py-3 pl-5 overflow-hidden">
                <div className="absolute left-0 inset-y-0 w-1" style={{ background: VO_COLOR }} />
                <p className="text-[17px] font-semibold text-[#1a2830]">
                  {order.customer_name}
                  <span className="ml-2 text-[12px] font-normal uppercase tracking-wider text-[#9ab0ba]">
                    Objednávka č. {order.vo_order_no}
                  </span>
                </p>
                <div className="flex gap-4 mt-2 items-center flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-[#6a8898]">
                    <IconCalendar size={14} />
                    {formatDateSkYear(order.date)}
                  </span>
                </div>

                {/* Poznámky — spoločné s adminom (v diári „Poznámky") */}
                {order.decoration?.trim() && (
                  <p className="mt-2 text-sm text-[#3a5160] whitespace-pre-wrap">
                    <span className="font-semibold text-[#6a8898]">Poznámky: </span>
                    {order.decoration}
                  </p>
                )}

                <div className="mt-3 pt-3 border-t border-[#eef3f6] flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="sm:w-72">
                    <VoStatusToggle
                      bookingId={order.id}
                      value={status}
                      disabled={!canToggle}
                      onChange={next => setOrder(o => ({ ...o, vo_status: next }))}
                    />
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 sm:ml-auto">
                      <button
                        onClick={startEdit}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold
                                   transition-opacity hover:opacity-90"
                        style={{ background: '#4cbfb3', color: '#0a2d2a' }}
                      >
                        <IconPencil size={14} stroke={2.2} /> Upraviť
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={saving}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border
                                    transition-colors disabled:opacity-50
                                    ${confirmDelete
                                      ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                                      : 'border-red-300 text-red-600 bg-white hover:bg-red-50'}`}
                      >
                        <IconTrash size={14} stroke={2.2} />
                        {confirmDelete ? 'Naozaj vymazať?' : 'Vymazať'}
                      </button>
                    </div>
                  )}
                </div>
                {error && (
                  <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                    {error}
                  </p>
                )}
              </div>
            )}

            {isPast ? (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
                Objednávka sa už uskutočnila — nedá sa upravovať ani vymazať.
              </p>
            ) : isVoUser && status === 'final' && (
              <p className="text-xs text-[#7a3a22] bg-[#fdf3ef] border border-[#f3c6b6] px-3 py-2 rounded-lg">
                Objednávka je FINAL a je zamknutá. Na úpravy ju prepnite späť na Koncept.
              </p>
            )}

            {/* Menu — rovnaké ako v detaile rezervácie; VO má len tlač sumáru A4 */}
            <BookingMenu
              key={order.id}
              bookingId={order.id}
              editable={canEdit && !editing}
              vo={isVoUser}
              printSubtitle={`Objednávka č. ${order.vo_order_no} – ${order.customer_name}, ${formatDateSk(order.date)}`}
              ticketInfo={isVoUser ? undefined : {
                title:     `${voLabel(order)} – ${order.customer_name}`,
                date:      order.date,
                hall:      hallShortOf(order),
                hallShort: hallShortOf(order),
                notes:     order.decoration ?? '',
              }}
              customerPrintTarget={printSlot}
            />

            {/* Sumár objednávky (tlač A4) — obsah dodá menu */}
            <div ref={setPrintSlot} className="empty:hidden" />

            {/* História objednávky (logy) — VO vidí len zmeny polí objednávky */}
            <BookingHistory bookingId={order.id} booking={order} access={null} vo restricted={isVoUser} />
          </>
        )}

        <div className="flex-1" />
      </div>
    </div>
  )
}
