/**
 * Proposta dei colori di una squadra a partire dal testo «Maglia» di FIP (per esempio «Bianco - N Nero - Bia», troncato).
 * È solo una proposta per --proponi-config: i colori veri si decidono in data/config/squadre.json.
 */
const COLORI: [RegExp, string][] = [
  [/^bianc/i, '#ffffff'],
  [/^ner/i, '#111111'],
  [/^blu/i, '#1d3a8a'],
  [/^azzur/i, '#2f80c8'],
  [/^celest/i, '#7cb8e4'],
  [/^ross/i, '#c8102e'],
  [/^granat/i, '#7b1e2b'],
  [/^amarant/i, '#8b1a3a'],
  [/^giall/i, '#f2c200'],
  [/^or[oa]$/i, '#c9a227'],
  [/^arancio|^arancion/i, '#e8701a'],
  [/^verd/i, '#1d7a3a'],
  [/^viol/i, '#5b2a86'],
  [/^grig/i, '#8a8f98'],
];

export function proponiColori(maglia: string | null): { primario: string; secondario: string } | null {
  if (!maglia) return null;
  const trovati: string[] = [];
  for (const parola of maglia.split(/[\s\-/,]+/)) {
    const c = COLORI.find(([r]) => r.test(parola))?.[1];
    if (c && !trovati.includes(c)) trovati.push(c);
  }
  if (!trovati.length) return null;
  return { primario: trovati[0]!, secondario: trovati[1] ?? (trovati[0] === '#ffffff' ? '#111111' : '#ffffff') };
}
