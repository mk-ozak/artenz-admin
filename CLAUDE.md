# artenz-admin — konvencie projektu

Tento súbor slúži ako referencia pri písaní taskov pre Claude Code.

## Jazyk
- **JavaScript** (nie TypeScript) — žiadne `.ts`, žiadne typové anotácie

## Databáza (Supabase)
- Tabuľka: **`bookings`** (nie `reservations`)
- Kľúč sály: **`ARTENZ_PLUS`** (podčiarkovník, nie medzera)
- Ostatné sály: `ARTENZ`, `LUNA`, `CATERING`
- Celý názov akcie: **`event_type + ' – ' + customer_name`** (nie stĺpec `title`)

## State management
- **`useState` + `useEffect`** (nie React Query / `useQuery`)

## Tailwind
- Tokeny sa definujú cez **`@theme` v CSS** (nie cez `theme.extend` v `tailwind.config.js`)

## Príklad správneho kódu

```js
// hook
export function useNextEvent() {
  const [data, setData] = useState(null)
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('bookings')
      .select('*')
      .gte('date', today)
      .order('date')
      .limit(1)
      .then(({ data }) => setData(data?.[0] ?? null))
  }, [])
  return data
}

// hall key mapping
const HALL_COLOR = {
  'ARTENZ_PLUS': '#4cbfb3',
  'ARTENZ':      '#d4a036',
  'LUNA':        '#b55db8',
  'CATERING':    '#7aaaca',
}

// event title
const title = `${booking.event_type} – ${booking.customer_name}`
```

```css
/* Tailwind tokeny — v CSS súbore, nie v tailwind.config.js */
@theme {
  --color-hall-ap: #4cbfb3;
  --color-status-dopyt: #f0f2f4;
  /* ... */
}
```
