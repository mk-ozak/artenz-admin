// Slovenský kalendár menín (civilný). Index poľa = mesiac, index v poli = deň - 1.
// null = deň bez menín (štátny sviatok a pod.)
const MENINY = [
  // Január
  [null, 'Alexandra, Karina', 'Daniela', 'Drahoslav', 'Andrea', 'Antónia', 'Bohuslava',
   'Severín', 'Alexej', 'Dáša', 'Malvína', 'Ernest', 'Rastislav', 'Radovan', 'Dobroslav',
   'Kristína', 'Nataša', 'Bohdana', 'Drahomíra, Mário', 'Dalibor', 'Vincent', 'Zora',
   'Miloš', 'Timotej', 'Gejza', 'Tamara', 'Bohuš', 'Alfonz', 'Gašpar', 'Ema', 'Emil'],
  // Február
  ['Tatiana', 'Erik, Erika', 'Blažej', 'Veronika', 'Agáta', 'Dorota', 'Vanda', 'Zoja',
   'Zdenko', 'Gabriela', 'Dezider', 'Perla', 'Arpád', 'Valentín', 'Pravoslav', 'Ida, Liana',
   'Miloslava', 'Jaromír', 'Vlasta', 'Lívia', 'Eleonóra', 'Etela', 'Roman, Romana', 'Matej',
   'Frederik, Frederika', 'Viktor', 'Alexander', 'Zlatica', 'Radomír'],
  // Marec
  ['Albín', 'Anežka', 'Bohumil, Bohumila', 'Kazimír', 'Fridrich', 'Radoslav, Radoslava',
   'Tomáš', 'Alan, Alana', 'Františka', 'Branislav, Bruno', 'Angela, Angelika', 'Gregor',
   'Vlastimil', 'Matilda', 'Svetlana', 'Boleslav', 'Ľubica', 'Eduard', 'Jozef', 'Víťazoslav',
   'Blahoslav', 'Beňadik', 'Adrián', 'Gabriel', 'Marián', 'Emanuel', 'Alena', 'Soňa',
   'Miroslav', 'Vieroslava', 'Benjamín'],
  // Apríl
  ['Hugo', 'Zita', 'Richard', 'Izidor', 'Miroslava', 'Irena', 'Zoltán', 'Albert', 'Milena',
   'Igor', 'Július', 'Estera', 'Aleš', 'Justína', 'Fedor', 'Dana, Danica', 'Rudolf', 'Valér',
   'Jela', 'Marcel', 'Ervín', 'Slavomír', 'Vojtech', 'Juraj', 'Marek', 'Jaroslava',
   'Jaroslav', 'Jarmila', 'Lea', 'Anastázia'],
  // Máj
  [null, 'Žigmund', 'Galina', 'Florián', 'Lesana, Lesia', 'Hermína', 'Monika', 'Ingrida',
   'Roland', 'Viktória', 'Blažena', 'Pankrác', 'Servác', 'Bonifác', 'Žofia', 'Svetozár',
   'Gizela', 'Viola', 'Gertrúda', 'Bernard', 'Zina', 'Júlia, Juliana', 'Želmíra', 'Ela',
   'Urban', 'Dušan', 'Iveta', 'Viliam', 'Vilma', 'Ferdinand', 'Petronela, Petrana'],
  // Jún
  ['Žaneta', 'Xénia, Oxana', 'Karolína', 'Lenka', 'Laura', 'Norbert', 'Róbert', 'Medard',
   'Stanislava', 'Margaréta', 'Dobroslava', 'Zlatko', 'Anton', 'Vasil', 'Vít',
   'Blanka, Bianka', 'Adolf', 'Vratislav', 'Alfréd', 'Valéria', 'Alojz', 'Paulína',
   'Sidónia', 'Ján', 'Olívia, Tadeáš', 'Adriána', 'Ladislav, Ladislava', 'Beáta',
   'Peter, Pavol, Petra', 'Melánia'],
  // Júl
  ['Diana', 'Berta', 'Miloslav', 'Prokop', null, 'Patrik, Patrícia', 'Oliver', 'Ivan',
   'Lujza', 'Amália', 'Milota', 'Nina', 'Margita', 'Kamil', 'Henrich', 'Drahomír',
   'Bohuslav', 'Kamila', 'Dušana', 'Iľja, Eliáš', 'Daniel', 'Magdaléna', 'Oľga', 'Vladimír',
   'Jakub', 'Anna, Hana', 'Božena', 'Krištof', 'Marta', 'Libuša', 'Ignác'],
  // August
  ['Božidara', 'Gustáv', 'Jerguš', 'Dominik, Dominika', 'Hortenzia', 'Jozefína', 'Štefánia',
   'Oskar', 'Ľubomíra', 'Vavrinec', 'Zuzana', 'Darina', 'Ľubomír', 'Mojmír', 'Marcela',
   'Leonard', 'Milica', 'Elena, Helena', 'Lýdia', 'Anabela, Liliana', 'Jana', 'Tichomír',
   'Filip', 'Bartolomej', 'Ľudovít', 'Samuel', 'Silvia', 'Augustín', 'Nikola, Nikolaj',
   'Ružena', 'Nora'],
  // September
  ['Drahoslava', 'Linda, Rebeka', 'Belo', 'Rozália', 'Regína', 'Alica', 'Marianna',
   'Miriama', 'Martina', 'Oleg', 'Bystrík', 'Mária, Marlena', 'Ctibor', 'Ľudomil', 'Jolana',
   'Ľudmila', 'Olympia', 'Eugénia', 'Konštantín', 'Ľuboslav, Ľuboslava', 'Matúš', 'Móric',
   'Zdenka', 'Ľuboš, Ľubor', 'Vladislav, Vladislava', 'Edita', 'Cyprián', 'Václav',
   'Michal, Michaela', 'Jarolím'],
  // Október
  ['Arnold', 'Levoslav', 'Stela', 'František', 'Viera', 'Natália', 'Eliška', 'Brigita',
   'Dionýz', 'Slavomíra', 'Valentína', 'Maximilián', 'Koloman', 'Boris', 'Terézia',
   'Vladimíra', 'Hedviga', 'Lukáš', 'Kristián', 'Vendelín', 'Uršuľa', 'Sergej', 'Alojzia',
   'Kvetoslava', 'Aurel', 'Demeter', 'Sabína', 'Dobromila', 'Klára', 'Šimon, Simona',
   'Aurélia'],
  // November
  ['Denis, Denisa', null, 'Hubert', 'Karol', 'Imrich', 'Renáta', 'René', 'Bohumír',
   'Teodor', 'Tibor', 'Martin, Maroš', 'Svätopluk', 'Stanislav', 'Irma', 'Leopold',
   'Agnesa', 'Klaudia', 'Eugen', 'Alžbeta', 'Félix', 'Elvíra', 'Cecília', 'Klement',
   'Emília', 'Katarína', 'Kornel', 'Milan', 'Henrieta', 'Vratko', 'Ondrej, Andrej'],
  // December
  ['Edmund', 'Bibiána', 'Oldrich', 'Barbora, Barbara', 'Oto', 'Mikuláš', 'Ambróz', 'Marína',
   'Izabela', 'Radúz', 'Hilda', 'Otília', 'Lucia', 'Branislava, Bronislava', 'Ivica',
   'Albína', 'Kornélia', 'Sláva, Slávka', 'Judita', 'Dagmara', 'Bohdan', 'Adela', 'Nadežda',
   'Adam, Eva', null, 'Štefan', 'Filomena', 'Ivana, Ivona', 'Milada', 'Dávid', 'Silvester'],
]

// Meniny pre daný dátum (default dnes); null ak deň meniny nemá.
export function getNameDay(date = new Date()) {
  return MENINY[date.getMonth()]?.[date.getDate() - 1] ?? null
}
