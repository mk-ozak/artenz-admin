// Typy akcií – jediný zdroj pravdy. Poradie = poradie v ponuke „Typ akcie".
export const EVENT_TYPES = [
  { value: 'oslava',    label: 'Oslava' },
  { value: 'svadba',    label: 'Svadba' },
  { value: 'posedenie', label: 'Posedenie' },
  { value: 'kar',       label: 'Kar' },
  { value: 'stuzkova',  label: 'Stužková' },
  { value: 'firemka',   label: 'Firemka' },
  { value: 'catering',  label: 'Catering' },
]

// value → label (napr. pre zobrazenie názvu akcie)
export const EVENT_LABEL = Object.fromEntries(EVENT_TYPES.map(t => [t.value, t.label]))

// Predvolený typ (prvá položka v ponuke)
export const DEFAULT_EVENT_TYPE = EVENT_TYPES[0].value
