// Zdieľané polia pre menuLuna editory (denné + trvalé menu).

import { useState, useEffect, useRef } from 'react'

export const inputCls =
  'w-full border border-[#e2e8ed] rounded-lg px-2.5 py-1.5 text-sm bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#4cbfb3]/40 focus:border-[#4cbfb3] ' +
  'placeholder:text-[#b0c4cc]'

export const Label = ({ children, className = '' }) => (
  <span className={`text-[11px] uppercase tracking-wide text-[#8aaabb] block mb-0.5 ${className}`}>{children}</span>
)

// Najčastejšie alergény hlavných jedál – zobrazené ako checkboxy.
const ALLERGEN_CHECKS = ['1', '3', '7']

function parseAllergens(str) {
  return (str ?? '').split(',').map((t) => t.trim()).filter(Boolean)
}

// Zloží výsledný reťazec: bez duplicít, číselne zoradený, bez medzier
// (formát zhodný s existujúcimi dátami – ide do PDF dokumentov aj API).
function composeAllergens(tokens) {
  const uniq = [...new Set(tokens)]
  uniq.sort((a, b) => {
    const na = Number(a), nb = Number(b)
    const fa = Number.isFinite(na), fb = Number.isFinite(nb)
    if (fa && fb) return na - nb
    if (fa) return -1
    if (fb) return 1
    return a.localeCompare(b)
  })
  return uniq.join(',')
}

// Alergény – checkboxy 1/3/7 + textové pole na ostatné hodnoty.
// `value` je celý uložený reťazec (napr. "1,4,7"), checkboxy z neho
// vyberú svoje hodnoty, text zobrazuje zvyšok.
// `compact` – checkboxy tesne pri poli „iné“, celé zarovnané doprava
// (hlavné jedlá); bez neho sú checkboxy vľavo a „iné“ vpravo (polievky).
export function AllergenField({ value, onChange, compact = false }) {
  const tokens = parseAllergens(value)
  const checkedSet = new Set(tokens.filter((t) => ALLERGEN_CHECKS.includes(t)))
  const others = tokens.filter((t) => !ALLERGEN_CHECKS.includes(t)).join(',')
  const [text, setText] = useState(others)
  const editing = useRef(false)

  // externá zmena (realtime sync, načítanie) – neprepisuj text počas písania
  useEffect(() => {
    if (!editing.current) setText(others)
  }, [others])

  function emit(checked, rawText) {
    onChange(composeAllergens([...checked, ...parseAllergens(rawText)]))
  }

  return (
    <div className={`flex items-center gap-1.5 ${compact ? 'justify-end' : ''}`}>
      {ALLERGEN_CHECKS.map((a) => (
        <label key={a} className="flex items-center gap-0.5 text-sm text-[#2b3f4c] cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-3.5 h-3.5 accent-[#4cbfb3]"
            checked={checkedSet.has(a)}
            onChange={(e) => {
              const next = new Set(checkedSet)
              if (e.target.checked) next.add(a); else next.delete(a)
              emit([...next], text)
            }}
          />
          {a}
        </label>
      ))}
      <input
        className={inputCls.replace('w-full', 'w-14') + (compact ? '' : ' ml-auto')}
        value={text}
        placeholder="iné"
        onFocus={() => { editing.current = true }}
        onBlur={(e) => {
          editing.current = false
          // po dopísaní zobraz už len "ostatné" – hodnoty 1/3/7 sa presunú do checkboxov
          setText(parseAllergens(e.target.value).filter((t) => !ALLERGEN_CHECKS.includes(t)).join(','))
        }}
        onChange={(e) => { setText(e.target.value); emit([...checkedSet], e.target.value) }}
      />
    </div>
  )
}

// Gramáž select – povolí aj existujúcu hodnotu mimo zoznamu (staré dáta).
export function PortionSelect({ value, options, onChange }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls + ' appearance-none'}
    >
      <option value="">—</option>
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}
