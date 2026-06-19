// Vyúčtovanie — kľúč/label v rovnakom štýle ako stav rezervácie.
// Uložená hodnota = kľúč (settlement_document / settlement_method).

export const SETTLEMENT_DOCUMENTS = [
  { value: 'kasa',    label: 'Kasa' },
  { value: 'faktura', label: 'Faktúra' },
  { value: 'dohoda',  label: 'Dohoda' },
]

export const SETTLEMENT_METHODS = [
  { value: 'cash',   label: 'Cash' },
  { value: 'prevod', label: 'Prevod' },
]

export const SETTLEMENT_DOCUMENT_LABEL =
  Object.fromEntries(SETTLEMENT_DOCUMENTS.map(o => [o.value, o.label]))
export const SETTLEMENT_METHOD_LABEL =
  Object.fromEntries(SETTLEMENT_METHODS.map(o => [o.value, o.label]))
