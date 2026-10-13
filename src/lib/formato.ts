/** Formattazione di numeri e date in italiano. Tutte le date sono calcolate in Europe/Rome. */

export const FUSO = 'Europe/Rome';

const nf1 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });

export const TRATTINO = '—';
export const MENO = '−';

export const f1 = (v: number | null | undefined): string => (v == null ? TRATTINO : nf1.format(v));
export const f0 = (v: number | null | undefined): string => (v == null ? TRATTINO : nf0.format(v));
export const segno = (v: number): string => (v > 0 ? `+${v}` : v < 0 ? `${MENO}${Math.abs(v)}` : '0');
export const ordinale = (n: number): string => `${n}ª`;
export const plurale = (n: number, uno: string, molti: string): string => (n === 1 ? uno : molti);

/** Media arrotondata a un decimale, null se il divisore è 0. */
export const media = (tot: number, n: number): number | null => (n ? Math.round((tot / n) * 10) / 10 : null);

// Una data «AAAA-MM-GG» è un giorno di calendario: si formatta a mezzogiorno UTC con timeZone UTC,
// così il giorno non cambia qualunque sia il fuso della macchina di build.
const giorno = (d: string): Date => new Date(`${d}T12:00:00Z`);
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', ...o });
const fFull = fmt({ day: 'numeric', month: 'long', year: 'numeric' });
const fLong = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
const fShort = fmt({ weekday: 'short', day: 'numeric', month: 'short' });
const fDay = fmt({ day: 'numeric', month: 'short' });

/** «12 ottobre 2026» */
export const dataEstesa = (d: string): string => fFull.format(giorno(d));
/** «sabato 17 ottobre» */
export const dataLunga = (d: string): string => fLong.format(giorno(d));
/** «sab 17 ott» */
export const dataBreve = (d: string): string => fShort.format(giorno(d)).replace(/\./g, '');
/** «17 ott» */
export const dataGiorno = (d: string): string => fDay.format(giorno(d)).replace(/\./g, '');

/** Oggi in Europe/Rome, come «AAAA-MM-GG». */
export function oggiRoma(adesso: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(adesso);
}

/** Giorni tra due date di calendario. */
export const giorniTra = (da: string, a: string): number => Math.round((giorno(a).getTime() - giorno(da).getTime()) / 86_400_000);

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** «10 Ottobre 2026» o «09 Gennaio 2027» (FIP) → «2026-10-10». */
export function dataDaItaliano(s: string): string {
  const m = /^(\d{1,2})\s+([a-zà]+)\s+(\d{4})$/i.exec(s.replace(/\s+/g, ' ').trim());
  const mese = m ? MESI.indexOf(m[2]!.toLowerCase()) : -1;
  if (!m || mese < 0) throw new Error(`Data FIP non riconosciuta: «${s}»`);
  return `${m[3]}-${String(mese + 1).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}
