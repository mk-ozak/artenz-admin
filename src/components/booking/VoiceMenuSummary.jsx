import { IconAlertTriangle, IconCheck, IconMicrophone, IconMinus, IconX } from '@tabler/icons-react'

// Tón riadku zhrnutia: ikona + farba nadpisu
const TONES = {
  ok:    { Icon: IconCheck,         cls: 'text-[#2a8d83]' },
  muted: { Icon: IconMinus,         cls: 'text-[#8aaabb]' },
  warn:  { Icon: IconAlertTriangle, cls: 'text-amber-700' },
  error: { Icon: IconAlertTriangle, cls: 'text-[#c0393d]' },
}

// Jeden riadok zhrnutia — nadpis a pod ním zoznam (prázdny zoznam sa nevykreslí).
// Položka je text alebo { text, note } — note (kategória, dôvod) je bledšia.
function Row({ tone, title, items }) {
  if (!items?.length) return null
  const { Icon, cls } = TONES[tone]
  return (
    <div>
      <p className={`flex items-center gap-1.5 text-xs font-bold ${cls}`}>
        <Icon size={14} stroke={2.5} className="shrink-0" />
        {title}
      </p>
      <ul className="mt-0.5 pl-5 space-y-0.5 text-[13px] text-[#3a5160]">
        {items.map((it, i) => (
          <li key={i}>
            {typeof it === 'string' ? it : it.text}
            {it.note && <span className="text-[#8aaabb]"> · {it.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Zhrnutie posledného hlasového zadania menu — čo sa pridalo a upravilo
// a čo sa preskočilo (jedlo nie je v katalógu, kategória je plná).
// Ostáva nad menu, kým ho používateľ nezavrie.
export default function VoiceMenuSummary({ summary, onClose }) {
  const {
    added, updated, already, guests, notes, raut, missingVariant, unmatched, overLimit, transcript,
  } = summary
  const settings = [
    ...guests,
    ...(notes ? [`Požiadavky ku strave: ${notes}`] : []),
    ...(raut === 'on' ? ['Raut s prílohami zapnutý'] : []),
    ...(raut === 'off' ? ['Raut s prílohami vypnutý'] : []),
  ]
  return (
    <div className="mt-3 rounded-card border border-[#e0e8ec] bg-white px-4 pt-2 pb-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[#1a2830]">
          <IconMicrophone size={16} className="text-[#2a8d83]" />
          Z diktovania
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zavrieť zhrnutie diktovania"
          className="w-8 h-8 -mr-2 rounded-lg flex items-center justify-center
                     text-[#8aaabb] hover:bg-gray-50 transition-colors"
        >
          <IconX size={16} />
        </button>
      </div>

      <div className="mt-1 space-y-2.5">
        <Row tone="ok"    title={`Pridané do menu (${added.length})`} items={added} />
        <Row tone="ok"    title="Upravené" items={updated} />
        <Row tone="ok"    title="Počty hostí a nastavenia" items={settings} />
        <Row tone="error" title="Vyber variant (inak sa menu nedá vytlačiť)" items={missingVariant} />
        <Row tone="warn"  title="Nenašiel som v katalógu — preskočené" items={unmatched} />
        <Row tone="warn"  title="Kategória je plná — preskočené" items={overLimit} />
        <Row tone="muted" title="Už bolo v menu" items={already} />
      </div>

      {transcript && (
        <details className="mt-3 text-xs text-[#5d7d8e]">
          <summary className="cursor-pointer select-none font-semibold">Čo som počul</summary>
          <p className="mt-1 italic leading-relaxed text-[#3a5160]">{transcript}</p>
        </details>
      )}
    </div>
  )
}
