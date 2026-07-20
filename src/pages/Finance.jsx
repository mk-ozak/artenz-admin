import { Fragment } from 'react'
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
      title={ev.deposit > 0
        ? `${ev.guests} hostí × ${nf2.format(ev.price)} € = ${eur(ev.revenue)} · záloha ${eur(ev.deposit)} · po zálohe ${eur(ev.net)}`
        : `${ev.guests} hostí × ${nf2.format(ev.price)} € = ${eur(ev.revenue)}`}
    >
      <span className="text-[11px] leading-none text-white/85"
            style={{ textShadow: '0 1px 1px rgba(0,0,0,.22)' }}>
        {pxp(ev.guests, ev.price)}
      </span>
      <span className="text-[13px] font-bold leading-tight text-white"
            style={{ textShadow: '0 1px 1px rgba(0,0,0,.22)' }}>
        {eur(ev.revenue)}
      </span>
      {ev.deposit > 0 && (
        <span className="text-[10px] leading-tight text-white/90 mt-0.5"
              style={{ textShadow: '0 1px 1px rgba(0,0,0,.22)' }}>
          −{eur(ev.deposit)} → {eur(ev.net)}
        </span>
      )}
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
      title={ev.deposit > 0 ? `${why} · zaplatená záloha ${eur(ev.deposit)}` : why}
    >
      <IconAlertTriangle size={14} className="text-[#e5484d] shrink-0" />
      <div className="min-w-0 leading-none">
        <span className="block text-[11px] text-[#c53a3f]">{pxp(ev.guests, ev.price)}</span>
        <span className="block text-[12px] font-bold text-[#e5484d] mt-0.5">chýba</span>
        {ev.deposit > 0 && (
          <span className="block text-[10px] text-[#c53a3f] mt-0.5">záloha {eur(ev.deposit)}</span>
        )}
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
      {/* hlavička riadka: dátum + denný súčet (a čistá tržba pod ním) */}
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-baseline gap-1.5">
          <span className={`text-[15px] font-bold ${weekend ? 'text-[#c2410c]' : 'text-[#1a2830]'}`}>
            {num}.
          </span>
          <span className="text-[11px] uppercase tracking-wide text-[#8aaabb]">{dow}</span>
        </span>
        <span className="flex flex-col items-end shrink-0 leading-tight">
          <span className={`text-[15px] font-bold ${empty ? 'text-[#e5484d]' : 'text-[#1a2830]'}`}>
            {eur(day.total)}
          </span>
          {day.deposit > 0 && (
            <span className="text-[10px] text-[#8aaabb]">
              po odpočte záloh <span className="font-semibold text-[#5d7d8e]">{eur(day.net)}</span>
            </span>
          )}
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
      <div className="flex items-start justify-between mb-3 pb-1.5 border-b border-[#dde8ec]">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-[#5d7d8e]">{month.label}</h2>
        <span className="flex flex-col items-end leading-tight">
          <span className="text-sm font-bold text-[#3a5160]">{eur(month.total)}</span>
          {month.deposit > 0 && (
            <span className="text-[10px] text-[#8aaabb]">po odpočte záloh {eur(month.net)}</span>
          )}
        </span>
      </div>
      <ol className="relative border-l-2 border-[#e0e8ec] ml-1.5">
        {month.days.map(d => <DayRow key={d.date} day={d} />)}
      </ol>
    </section>
  )
}

// Sumár za obdobie (zvyšok tohto roka / celý budúci rok).
// prominent = výraznejší (silnejšie pozadie, väčšie tmavé čísla) — pre „do konca roka".
function YearSummary({ label, totals, className = '', prominent = false }) {
  const box     = prominent ? 'bg-[#eaf1f4] border-[#d5e2e9] px-4 py-3' : 'bg-[#f4f7f9] border-[#e6edf1] px-4 py-2.5'
  const size    = prominent ? 'text-[13px]' : 'text-[12px]'
  const valSize = prominent ? 'text-[15px]' : 'text-[12px]'
  const valDark = prominent ? 'text-[#1a2830]' : ''
  return (
    <div className={`rounded-xl border flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${box} ${className}`}>
      <span className={`font-bold uppercase tracking-wider text-[#5d7d8e] ${size}`}>{label}</span>
      <span className={`flex flex-wrap gap-x-4 gap-y-0.5 ${size}`}>
        <span className="text-[#3a5160]">tržba <span className={`font-bold ${valSize} ${valDark}`}>{eur(totals.total)}</span></span>
        <span className="text-[#2a8d83]">zálohy <span className={`font-bold ${valSize}`}>{eur(totals.deposit)}</span></span>
        <span className="text-[#3a5160]">po odpočte <span className={`font-bold ${valSize} ${valDark}`}>{eur(totals.net)}</span></span>
      </span>
    </div>
  )
}

const headerLink = 'px-3 py-1.5 text-sm font-medium rounded-md transition-colors hover:bg-white/10'

export default function Finance() {
  const navigate = useNavigate()
  const { months, grandTotal, grandDeposit, missingCount, loading } = useFinanceTimeline()
  const grandNet = grandTotal - grandDeposit

  // Súčty po rokoch (z mesiacov) — na sumáre „do konca roka" a za budúce roky
  const currentYear = new Date().getFullYear()
  const yearTotals = {}
  for (const m of months) {
    const y = m.key.slice(0, 4)
    if (!yearTotals[y]) yearTotals[y] = { total: 0, deposit: 0, net: 0 }
    yearTotals[y].total   += m.total
    yearTotals[y].deposit += m.deposit
    yearTotals[y].net     += m.net
  }
  const hasFutureYears = Object.keys(yearTotals).some(y => Number(y) > currentYear)

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
        {/* Súhrn: očakávaná tržba, vyzbierané zálohy, tržby mínus zálohy */}
        <div className="rounded-card bg-white border border-[#e0e8ec] px-4 py-3.5 mb-4">
          <div className="flex items-start justify-between gap-3">
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
          <div className="mt-3 pt-3 border-t border-[#eef3f6] grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#8aaabb]">Vyzbierané zálohy</p>
              <p className="text-base font-bold text-[#2a8d83]">{eur(grandDeposit)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#8aaabb]">Tržby mínus zálohy</p>
              <p className="text-base font-bold text-[#1a2830]">{eur(grandNet)}</p>
            </div>
          </div>
        </div>

        {/* Menej výrazný sumár pre zvyšok tohto roka — hneď pod hlavným */}
        {hasFutureYears && yearTotals[currentYear] && (
          <YearSummary
            label={`Od dnes do konca ${currentYear}`}
            totals={yearTotals[currentYear]}
            className="mb-4"
            prominent
          />
        )}

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
          months.map((m, i) => {
            const year = m.key.slice(0, 4)
            const prevYear = i > 0 ? months[i - 1].key.slice(0, 4) : null
            const newFutureYear = Number(year) > currentYear && year !== prevYear
            return (
              <Fragment key={m.key}>
                {newFutureYear && (
                  <YearSummary label={`Rok ${year}`} totals={yearTotals[year]} className="mt-2 mb-4" prominent />
                )}
                <MonthSection month={m} />
              </Fragment>
            )
          })
        )}
      </main>
    </div>
  )
}
