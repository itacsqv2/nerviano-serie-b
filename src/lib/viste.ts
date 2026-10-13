/** Dati pronti per le pagine, ricavati dal dataset (tutto in build). */
import type { Dataset, GiornataNerviano, PartitaSito, Persona } from './dataset.ts';
import { giocata } from './classifica.ts';
import { media } from './formato.ts';

/** Classifica da mostrare come principale: la provvisoria se ci sono risultati ufficiosi, altrimenti l'ufficiale. */
export function classificaCorrente(d: Dataset) {
  return d.ufficiosi.length ? d.classificaProvvisoria : d.classificaUfficiale;
}

export function riepilogoRif(d: Dataset) {
  const cl = classificaCorrente(d);
  const riga = cl.find((r) => r.squadra === d.rif)!;
  const giocate = d.calendarioRif.filter((g) => g.esito);
  const fatti = giocate.reduce((s, g) => s + (g.fatti ?? 0), 0);
  const subiti = giocate.reduce((s, g) => s + (g.subiti ?? 0), 0);
  return {
    riga,
    squadre: cl.length,
    giocate: giocate.length,
    mediaFatti: media(fatti, giocate.length),
    mediaSubiti: media(subiti, giocate.length),
    ultima: giocate.at(-1) ?? null,
    /** prossima partita alla data dei dati (il browser la ricalcola con la data di oggi) */
    prossima: d.calendarioRif.find((g) => !g.riposo && !g.esito) ?? null,
    daGiocare: d.calendarioRif.filter((g) => !g.riposo && !g.esito),
  };
}

/** Ultima giornata con almeno un risultato. */
export function ultimaGiornata(d: Dataset): number {
  return Math.max(0, ...d.partite.filter(giocata).map((p) => p.giornata));
}

export const partiteGiornata = (d: Dataset, g: number): PartitaSito[] =>
  d.partite.filter((p) => p.giornata === g).sort((a, b) => a.data.localeCompare(b.data) || (a.ora ?? '').localeCompare(b.ora ?? ''));

export const riposa = (d: Dataset, g: number): string[] => {
  const giocano = new Set(partiteGiornata(d, g).flatMap((p) => [p.casa, p.ospite]));
  return d.squadre.map((s) => s.slug).filter((s) => !giocano.has(s));
};

/** Giocatori in rosa di una squadra (senza allenatori). */
export const rosa = (d: Dataset, squadra: string): Persona[] =>
  d.persone.filter((p) => p.squadra === squadra && p.inRosa && !p.allenatore);

export const allenatori = (d: Dataset, squadra: string): Persona[] =>
  d.persone.filter((p) => p.squadra === squadra && p.allenatore);

/** Ordine di presentazione: chi è sceso in campo per media, poi gli altri per numero. */
export function perMedia(a: Persona, b: Persona): number {
  return (b.stagione.media ?? -1) - (a.stagione.media ?? -1) || (b.stagione.punti ?? 0) - (a.stagione.punti ?? 0) || Number(a.numero ?? 999) - Number(b.numero ?? 999);
}

/** Miglior realizzatore di una squadra in una partita (dai tabellini). */
export function migliorRealizzatore(d: Dataset, partita: string, squadra: string): { persona: Persona; punti: number } | null {
  // si guarda tra tutti i tabellini: se il migliore è un giocatore nascosto non si indica nessun altro al suo posto
  const t = d.tabelliniTutti.filter((x) => x.partita === partita && x.squadra === squadra).sort((a, b) => b.punti - a.punti)[0];
  const persona = t && d.personaPerId.get(t.giocatore);
  return persona && t ? { persona, punti: t.punti } : null;
}

/** Marcatori del girone: chi ha giocato almeno `minimo` partite, per media. */
export function marcatori(d: Dataset, minimo = 1): Persona[] {
  return d.persone.filter((p) => !p.allenatore && p.inRosa && (p.stagione.partite ?? 0) >= minimo).sort(perMedia);
}

/** Sfide di una squadra con Nerviano in questa stagione. */
export function sfideConRif(d: Dataset, squadra: string): GiornataNerviano[] {
  return d.calendarioRif.filter((g) => g.avversaria === squadra);
}

/** Giornata della prossima sfida con Nerviano (99 se non ce ne sono più), per ordinare le avversarie. */
export function prossimaSfida(d: Dataset, squadra: string): number {
  return sfideConRif(d, squadra).find((g) => !g.esito)?.giornata ?? 99;
}

/** Testo del luogo di una partita: «palestra, città». */
export const campo = (p: Pick<PartitaSito, 'palestra' | 'citta'>): string => [p.palestra, p.citta].filter(Boolean).join(', ');
