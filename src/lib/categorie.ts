/** Livelli dei campionati PlayBasket (porting di gruppo() in legacy/build_data.py). */

export const LIVELLI = ['Serie A', 'Serie A2', 'Serie B e B Nazionale', 'B Interregionale', 'Serie C e regionali'] as const;
export const GRUPPI = [...LIVELLI, 'Giovanili'] as const;
export type Gruppo = (typeof GRUPPI)[number];

const A2 = new Set(['Serie A2', 'A2 Gold', 'A2 Silver', 'Legadue']);
const B = new Set([
  'Serie B', 'B Nazionale', 'Divisione Nazionale A', 'Divisione Nazionale B',
  'A Dil.', 'B Dil.', 'B Eccellenza', 'Serie B2',
]);

/** Le categorie che compaiono in gruppo() in modo esplicito o per parola chiave: le altre vanno segnalate. */
export function categoriaNota(cat: string): boolean {
  const c = cat.toLowerCase();
  return /under|giovanile|finali nazionali/.test(c) || cat === 'Lega Basket' || A2.has(cat) || B.has(cat) || cat === 'B Interregionale';
}

export function gruppo(cat: string): Gruppo {
  const c = cat.toLowerCase();
  if (c.includes('under') || c.includes('giovanile') || c.includes('finali nazionali')) return 'Giovanili';
  if (cat === 'Lega Basket') return 'Serie A';
  if (A2.has(cat)) return 'Serie A2';
  if (B.has(cat)) return 'Serie B e B Nazionale';
  if (cat === 'B Interregionale') return 'B Interregionale';
  return 'Serie C e regionali';
}

/** Nome della categoria da mostrare: «Lega Basket» diventa «Serie A». */
export function nomeCategoria(cat: string): string {
  return cat === 'Lega Basket' ? 'Serie A' : cat;
}
