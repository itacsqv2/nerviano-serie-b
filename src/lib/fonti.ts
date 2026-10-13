/** Indirizzi delle pagine FIP e PlayBasket, usati sia dalla pipeline sia dai link «fonte» del sito. */
import type { Stagione } from '../schemas/index.ts';

export const FIP_BASE = 'https://fip.it/risultati/';
export const PB_BASE = 'https://www.playbasket.it/';

/** Pagina FIP di una giornata: `ar` 1 = andata, 0 = ritorno; `turno` 1..15. */
export function urlFipGiornata(s: Stagione, ar: 0 | 1, turno: number): string {
  const q = new URLSearchParams({ ...s.fip, codice_ar: String(ar), giornata: String(turno) });
  return `${FIP_BASE}?${q}`;
}

/** Pagina FIP della giornata complessiva 1..30. */
export function urlFipPerGiornata(s: Stagione, giornata: number): string {
  const andata = giornata <= s.turni_per_fase;
  return urlFipGiornata(s, andata ? 1 : 0, andata ? giornata : giornata - s.turni_per_fase);
}

const pbLega = (s: Stagione) => {
  const p = s.playbasket;
  return { lt: String(p.lt), lf: p.lf, lr: p.lr, lp: p.lp, lc: p.lc, season: String(p.season), lg: String(p.lg) };
};

/** Pagine del girone su PlayBasket: cl = calendario, st = classifica, sc = marcatori, tm = squadre. */
export function urlPbLega(s: Stagione, mod: 'cl' | 'st' | 'sc' | 'tm'): string {
  return `${PB_BASE}league.php?${new URLSearchParams({ ...pbLega(s), mod })}`;
}

export function urlPbPartita(s: Stagione, pb: { gtn: number; gtt: 1 | 2; mn: number }): string {
  const p = s.playbasket;
  const q = new URLSearchParams({
    lt: String(p.lt), lr: p.lr, lp: p.lp, lc: p.lc, lg: String(p.lg), season: String(p.season), lf: p.lf,
    gtn: String(pb.gtn), gtt: String(pb.gtt), mn: String(pb.mn),
  });
  return `${PB_BASE}match.php?${q}`;
}

export function urlPbRosa(s: Stagione, pbObj: number): string {
  return `${PB_BASE}${s.playbasket.prefisso}/club.php?mod=rs&obj=${pbObj}&action=view&eid=4`;
}

/** Pagina della stagione del giocatore; con `carriera` la pagina carriera (mod=ws). */
export function urlPbGiocatore(s: Stagione, id: number, pbObjSquadra: number, carriera = false): string {
  const q = `exteid=4&extobj=${pbObjSquadra}&subj=1&season=${s.playbasket.season}&obj=${id}&action=view&eid=5`;
  return `${PB_BASE}${s.playbasket.prefisso}/profile.php?${q}${carriera ? '&mod=ws' : ''}`;
}

export function urlPbAllenatore(s: Stagione, id: number, pbObjSquadra: number): string {
  return `${PB_BASE}${s.playbasket.prefisso}/profile.php?exteid=4&extobj=${pbObjSquadra}&subj=2&season=${s.playbasket.season}&obj=${id}&action=view&eid=5`;
}
