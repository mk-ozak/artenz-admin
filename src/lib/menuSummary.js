// Nastavenie menu rezervácie pre MenuEditor (kalkulácia, tlač) — sekcie podľa
// blokov a počty osôb. Spoločné pre detail rezervácie (BookingMenu) a sumár
// jedál na dashboarde, aby sa všade počítalo rovnako.

// Bloky rautu (Raut + Prílohy pre raut) — pri vypnutom raute sa skryjú
export const RAUT_BLOCKS = [4, 5]

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
export function menuSummaryConfig(details, { printSubtitle = '', ticketInfo } = {}) {
  const rautTotal = rautTotalOf(details)
  return {
    titles: {
      1: 'Hlavné jedlo - dospelí',
      2: 'Hlavné jedlo deti',
      3: 'Hlavné jedlo špeciál',
      4: 'Raut',
      5: 'Prílohy pre raut',
      6: 'Studená kuchyňa',
    },
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
    },
  }
}
