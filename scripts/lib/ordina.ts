/** Ordinamento stabile dei file in data/auto/: stessi dati → stesso file, diff leggibili su GitHub. */
import type { Carriere, Giocatore, Partita, Rosa, Tabellino } from '../../src/schemas/index.ts';

const perNumero = (a: string | null, b: string | null) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : Number(a) - Number(b));

export const ordinaPartite = (p: Partita[]) =>
  p.sort((a, b) => a.giornata - b.giornata || a.data.localeCompare(b.data) || (a.ora ?? '').localeCompare(b.ora ?? '') || a.id.localeCompare(b.id));

export const ordinaGiocatori = (g: Giocatore[]) => g.sort((a, b) => a.id - b.id);

export const ordinaRose = (r: Rosa[]) =>
  r.sort((a, b) => a.squadra.localeCompare(b.squadra) || Number(b.in_rosa) - Number(a.in_rosa) || perNumero(a.numero, b.numero) || a.giocatore - b.giocatore);

export const ordinaTabellini = (t: Tabellino[]) =>
  t.sort((a, b) => a.partita.localeCompare(b.partita) || a.squadra.localeCompare(b.squadra) || a.giocatore - b.giocatore);

/** Dentro la stessa stagione resta l'ordine della pagina PlayBasket (sort stabile). */
export function ordinaCarriere(c: Carriere): Carriere {
  c.righe.sort((a, b) => a.giocatore - b.giocatore || b.stagione.localeCompare(a.stagione));
  c.riepiloghi.sort((a, b) => a.giocatore - b.giocatore);
  return c;
}
