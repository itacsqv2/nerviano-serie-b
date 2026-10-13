/** Calcoli sui colori: contrasto WCAG e colore del testo sopra un colore di squadra. */

export function luminanza(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrasto(a: string, b: string): number {
  const [x, y] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

const SCURO = '#12203a';
const CHIARO = '#ffffff';

/** Il colore (scuro o chiaro) più leggibile sopra `sfondo`. */
export const testoSu = (sfondo: string): string => (contrasto(SCURO, sfondo) >= contrasto(CHIARO, sfondo) ? SCURO : CHIARO);
