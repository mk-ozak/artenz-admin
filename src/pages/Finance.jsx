import { useNavigate } from 'react-router-dom'
import { IconHome, IconAlertTriangle } from '@tabler/icons-react'
import { useFinanceTimeline, HALL_COLOR } from '../hooks/useFinanceTimeline'

// Formátovanie čísel po slovensky (medzera ako oddeľovač tisícov)
const nf0 = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 2 })
const eur   = v => `${nf0.format(Math.round(v))} €`
const pxp   = (g, p) => `${g}×${nf2.format(p)}`   // napr. 30×55

const DOW = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So']
function dayParts(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const wd = d.getDay()
  return { dow: DOW[wd], num: d.getDate(), weekend: wd === 0 || wd === 6 }
}

// Skloňovanie: 1 akcia / 2–4 akcie / 5+ akcií
function akciePlural(n) {
  if (n === 1) return 'akcia'
  if (n >= 2 && n <= 4) return 'akcie'
  return 'akcií'
}

const HALLS = [
  ['ARTENZ_PLUS', 'ARTENZ PLUS'],
  ['ARTENZ', 'ARTENZ'],
  ['LUNA', 'LUNA'],
  ['CATERING', 'CATERING'],
]

// Farebný blok akcie s vypočítanou tržbou — šírka úmerná tržbe (flexGrow)
function FilledBlock({ ev }) {
  return (
    <div
      className="flex-1 min-w-[92px] rounded-lg px-2.5 py-1.5 flex flex-col justify-center"
      style={{ background: ev.color, flexGrow: ev.revenue }}
      title={`${ev.guests} hostí × ${nf2.format(ev.price)} €`}
    >
      <span className="text-[11px] leading-none text-white/85"
            style={{ textShadow: '0 1px 1px rgba(0,0,0,.22)' }}>
        {pxp(ev.guests, ev.price)}
      </span>
      <span className="text-[13px] font-bold leading-tight text-white"
            style={{ textShadow: '0 1px 1px rgba(0,0,0,.22)' }}>
        {eur(ev.revenue)}
      </span>
    </div>
  )
}

// Nevyplnená akcia (nulová tržba) — červené, na konci riadku
function MissingBlock({ ev }) {
  const why = ev.missingGuests && ev.missingPrice
    ? 'Chýba počet hostí aj cena na osobu'
    : ev.missingGuests ? 'Chýba počet hostí' : 'Chýba cena na osobu'
  return (
    <div
      className="min-w-[86px] rounded-lg px-2.5 py-1.5 flex items-center gap-1.5
                 border border-[#e5484d] bg-[#fdecec]"
      title={why}
    >
      <IconAlertTriangle size={14} className="text-[#e5484d] shrink-0" />
      <div className="min-w-0 leading-none">
        <span className="block text-[11px] text-[#c53a3f]">{pxp(ev.guests, ev.price)}</span>
        <span className="block text-[12px] font-bold text-[#e5484d] mt-0.5">chýba</span>
      </div>
    </div>
  )
}

// Jeden deň na časovej osi = uzol + dátum + rad farebných blokov
function DayRow({ day }) {
  const { dow, num, weekend } = dayParts(day.date)
  const empty = day.total === 0
  return (
    <li className="relative pl-5 sm:pl-7 pb-5">
      {/* uzol na osi */}
      <span
        className="absolute left-0 top-1.5 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
        style={{ background: empty ? '#e5484d' : '#3db8ad' }}
      />
      {/* hlavička riadka: dátum + denný súčet */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-1.5">
          <span className={`text-[15px] font-bold ${weekend ? 'text-[#c2410c]' : 'text-[#1a2830]'}`}>
            {num}.
          </span>
          <span className="text-[11px] uppercase tracking-wide text-[#8aaabb]">{dow}</span>
        </span>
        <span className={`text-[15px] font-bold ${empty ? 'text-[#e5484d]' : 'text-[#1a2830]'}`}>
          {eur(day.total)}
        </span>
      </div>
      {/* graf dňa: farebné bloky akcií */}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {day.events.map(ev =>
          ev.missing ? <MissingBlock key={ev.id} ev={ev} /> : <FilledBlock key={ev.id} ev={ev} />
        )}
      </div>
    </li>
  )
}

function MonthSection({ month }) {
  return (
    <section className="mb-7">
      <div className="flex items-baseline justify-between mb-3 pb-1.5 border-b border-[#dde8ec]">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-[#5d7d8e]">{month.label}</h2>
        <span className="text-sm font-bold text-[#3a5160]">{eur(month.total)}</span>
      </div>
      <ol className="relative border-l-2 border-[#e0e8ec] ml-1.5">
        {month.days.map(d => <DayRow key={d.date} day={d} />)}
      </ol>
    </section>
  )
}

const headerLink = 'px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:bg-white/10'

export default function Finance() {
  const navigate = useNavigate()
  const { months, grandTotal, missingCount, loading } = useFinanceTimeline()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hlavička — rovnaký vzor ako Nastavenia */}
      <header className="px-4 py-3 flex items-center justify-between" style={{ background: '#354d5d' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            aria-label="Domov"
            className="w-10 h-10 xl:w-8 xl:h-8 rounded flex items-center justify-center
                       transition-opacity opacity-60 hover:opacity-100"
            style={{ color: '#ddeef6' }}
          >
            <IconHome className="w-7 h-7 xl:w-5 xl:h-5" stroke={2} />
          </button>
          <div>
            <p className="text-[10px] tracking-[.16em] uppercase" style={{ color: 'rgba(255,255,255,.4)' }}>
              ARTENZ
            </p>
            <p className="text-[18px] font-bold leading-tight" style={{ color: '#ddeef6' }}>Financie</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <button onClick={() => navigate('/')} className={headerLink} style={{ color: 'rgba(221,238,246,.6)' }}>
            Prehľad
          </button>
          <button onClick={() => navigate('/diary')} className={headerLink} style={{ color: 'rgba(221,238,246,.6)' }}>
            Diár
          </button>
          <button className="px-3 py-1.5 text-sm font-medium rounded-md"
                  style={{ background: 'rgba(255,255,255,.12)', color: '#ddeef6' }}>
            Financie
          </button>
        </nav>
      </header>

      <main className="max-w-3xl xl:max-w-5xl mx-auto px-3 sm:px-4 py-5 pb-16">
        {/* Súhrn: očakávaná tržba + počet nevyplnených */}
        <div className="rounded-card bg-white border border-[#e0e8ec] px-4 py-3 mb-4
                        flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#8aaabb]">Očakávaná tržba · od dnes</p>
            <p className="text-2xl font-bold text-[#1a2830]">{eur(grandTotal)}</p>
          </div>
          {missingCount > 0 && (
            <div className="text-right shrink-0">
              <p className="text-[11px] uppercase tracking-wider text-[#e5484d]">Nevyplnené</p>
              <p className="text-sm font-bold text-[#e5484d]">
                {missingCount} {akciePlural(missingCount)}
              </p>
            </div>
          )}
        </div>

        {/* Legenda sál */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-5 px-1">
          {HALLS.map(([k, label]) => (
            <span key={k} className="flex items-center gap-1.5 text-[11px] text-[#6a8898]">
              <span className="w-3 h-3 rounded-sm" style={{ background: HALL_COLOR[k] }} />
              {label}
            </span>
          ))}
        </div>

        {loading ? (
          <p className="px-1 py-10 text-sm text-[#8aaabb] italic">Načítavam…</p>
        ) : months.length === 0 ? (
          <p className="px-1 py-10 text-sm text-[#8aaabb] italic">Žiadne budúce akcie.</p>
        ) : (
          months.map(m => <MonthSection key={m.key} month={m} />)
        )}
      </main>
    </div>
  )
}
