// Nastavenie menu rezervácie pre MenuEditor (kalkulácia, tlač) — sekcie podľa
// blokov a počty osôb. Spoločné pre detail rezervácie (BookingMenu) a sumár
// jedál na dashboarde, aby sa všade počítalo rovnako.

// Bloky rautu (Raut + Prílohy pre raut) — pri vypnutom raute sa skryjú
export const RAUT_BLOCKS = [4, 5]

// Bloky hlavného jedla (dospelí, deti, špeciály) — pri vypnutom hlavnom jedle sa skryjú
export const MAIN_BLOCKS = [1, 2, 3]

// Skryté bloky podľa prepínačov Hlavné jedlo / Raut (menu, kalkulácia aj tlač)
export function hiddenBlocksOf({ mainOn = true, rautOn = true }) {
  return [...(mainOn ? [] : MAIN_BLOCKS), ...(rautOn ? [] : RAUT_BLOCKS)]
}

// "HH:MM:SS" z DB → "HH:MM", prázdne → ''
export const timeOf = t => (t ? String(t).slice(0, 5) : '')

// Čas v hlavičke lístka do kuchyne: čas hlavného jedla, bez hlavného jedla čas rautu
export function ticketTimeOf(row) {
  return row?.main_enabled === false ? timeOf(row?.raut_time) : timeOf(row?.main_time)
}

// Názvy blokov (sekcie kalkulácie a tlače; aj katalóg pre hlasové zadanie menu)
export const BLOCK_TITLES = {
  1: 'Hlavné jedlo - dospelí',
  2: 'Hlavné jedlo deti',
  3: 'Hlavné jedlo špeciál',
  4: 'Raut',
  5: 'Prílohy pre raut',
  6: 'Studená kuchyňa',
}

// Riadok z bookings → počty hostí a požiadavky ku strave (tvar formulára v BookingMenu)
export function detailsFromRow(row) {
  return {
    guestsAdults:       row?.guests_adults ?? '',
    guestsAdultsNoMeal: row?.guests_adults_no_meal ?? '',
    guestsSpecials:     row?.guests_specials ?? '',
    guestsKidsMeal:     row?.guests_kids_meal ?? '',
    guestsKidsNoMeal:   row?.guests_kids_no_meal ?? '',
    rautExtra:          row?.raut_extra ?? '',
    rautGrams:          row?.raut_grams ?? 200,
    notes:              row?.notes ?? '',
    mainNotes:          row?.main_notes ?? '',
    rautNotes:          row?.raut_notes ?? '',
  }
}

// Počet ľudí na raut = (dospelí + špeciály) + zaokrúhlené nahor(deti s jedlom / 2)
// + raut navyše/menej
export function rautTotalOf(details) {
  if (!details) return 0
  return (Number(details.guestsAdults) || 0) + (Number(details.guestsSpecials) || 0)
    + Math.ceil((Number(details.guestsKidsMeal) || 0) / 2)
    + (Number(details.rautExtra) || 0)
}

// Konfigurácia zhrnutia — sekcie podľa blokov + množstvá z počtov hostí
// rautTime: čas rautu "HH:MM" — pridá sa k nadpisu sekcie Raut (obrazovka aj tlač);
//   sumár jedál za viac akcií ho neposiela
// mainNotes / rautNotes: poznámky blokov Hlavné jedlo / Raut pre lístok do kuchyne
//   (posiela ich len zapnutý blok)
export function menuSummaryConfig(details, { printSubtitle = '', ticketInfo, rautTime = '', mainNotes = '', rautNotes = '' } = {}) {
  const rautTotal = rautTotalOf(details)
  return {
    titles: rautTime ? { ...BLOCK_TITLES, 4: `${BLOCK_TITLES[4]} – ${rautTime}` } : BLOCK_TITLES,
    fixedQty: {
      1: Number(details.guestsAdults) || 0,
      // hlavné jedlo deti = zadaný počet detí (vzorec /2 platí len pre raut)
      2: Number(details.guestsKidsMeal) || 0,
      4: rautTotal,
      5: rautTotal,
    },
    checkBlock:  3,
    checkTarget: Number(details.guestsSpecials) || 0,
    // Deti dostanú automaticky tú istú polievku ako dospelí (z bloku 1)
    mirror: { fromCategory: 'Polievka', toBlock: 2 },
    // Bloky, kde sa v zhrnutí zobrazí naklikané množstvo pri položke
    qtyBlocks: [6],
    // Bloky zobrazené vedľa seba (dva stĺpce): RAUT + Prílohy pre raut
    pairBlocks: [4, 5],
    printSubtitle,
    // Kalkulácia pre kuchyňu — počet ľudí na násobenie jednotkového množstva
    // blok 1 = Dospelí (bez špeciálov), blok 2 = Deti s jedlom (zadaný počet)
    calc: {
      countByBlock: {
        1: Number(details.guestsAdults) || 0,
        2: Number(details.guestsKidsMeal) || 0,
      },
      // Špeciáli pijú prípitok dospelých (lib/menuCalc → calcCount)
      specials: Number(details.guestsSpecials) || 0,
    },
    // Raut + Prílohy pre raut: naklikané kg vs počet ľudí na raut × (gramáž/1000) kg
    weightCheck: {
      blocks: RAUT_BLOCKS,
      perPerson: ((Number(details.rautGrams) > 0 ? Number(details.rautGrams) : 200) / 1000),
      people: rautTotal,
    },
    // Tlač do kuchyne (termotlačiareň) — údaje akcie + počty osôb presne tak,
    // ako s nimi admin počíta
    ticket: ticketInfo && {
      ...ticketInfo,
      counts: {
        adults:       Number(details.guestsAdults) || 0,
        adultsNoMeal: Number(details.guestsAdultsNoMeal) || 0,
        kidsMeal:     Number(details.guestsKidsMeal) || 0,
        kidsNoMeal:   Number(details.guestsKidsNoMeal) || 0,
        specials:     Number(details.guestsSpecials) || 0,
        raut:         rautTotal,
        rautExtra:    Number(details.rautExtra) || 0,
      },
      // Počet osôb v pruhu sekcie (s ktorým admin sekciu počíta); 5 a 6 bez počtu
      sectionCount: {
        1: Number(details.guestsAdults) || 0,
        2: Number(details.guestsKidsMeal) || 0,
        3: Number(details.guestsSpecials) || 0,
        4: rautTotal,
      },
      specialNotes: details.notes,
      // Poznámky blokov — tlačia sa v sekcii 1 (hlavné jedlo) a 4 (raut)
      blockNotes: { 1: mainNotes, 4: rautNotes },
    },
  }
}
