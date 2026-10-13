/**
 * Regole derivate sui giocatori: stato, provenienza, ex Nerviano, livello, rango e sintesi automatica.
 * Porting di costruisci(), _ex_nerviano() e _sintesi() in legacy/avversari_dati.py.
 */
import { gruppo, LIVELLI, nomeCategoria, type Gruppo } from './categorie.ts';
import { f1 } from './formato.ts';

export interface RigaCarrieraCalc {
  stagione: string;
  squadra: string;
  categoria: string;
  punti: number | null;
  presenze: number | null;
  best: number | null;
  gruppo: Gruppo;
  senior: boolean;
  media: number | null;
}

export function arricchisciRiga<T extends { categoria: string; punti: number | null; presenze: number | null }>(r: T) {
  const g = gruppo(r.categoria);
  return {
    ...r,
    gruppo: g,
    senior: g !== 'Giovanili',
    media: r.punti != null && r.presenze ? Math.round((r.punti / r.presenze) * 10) / 10 : null,
  };
}

export type Stato = 'Confermato' | 'Nuovo arrivo' | 'Dal vivaio' | null;

const conCategoria = (r: RigaCarrieraCalc) => `${r.squadra} (${nomeCategoria(r.categoria)})`;

/** Stato e provenienza dalle righe della stagione precedente. */
export function statoEProvenienza(
  righe: readonly RigaCarrieraCalc[],
  nomiSquadra: readonly string[],
  breve: string,
  stagionePrec: string,
): { stato: Stato; provenienza: string | null; prev: RigaCarrieraCalc | null } {
  const prev = righe.filter((r) => r.stagione === stagionePrec);
  if (prev.some((r) => nomiSquadra.includes(r.squadra))) return { stato: 'Confermato', provenienza: `Già a ${breve}`, prev: null };
  if (!prev.length) return { stato: null, provenienza: null, prev: null };
  const giocate = prev.filter((r) => (r.presenze ?? 0) > 0);
  const scelte = giocate.filter((r) => r.senior).length ? giocate.filter((r) => r.senior) : giocate.length ? giocate : prev;
  // max() di Python restituisce il primo a parità: reduce con > fa lo stesso
  const src = scelte.reduce((a, b) => ((b.presenze ?? 0) > (a.presenze ?? 0) ? b : a));
  return { stato: 'Nuovo arrivo', provenienza: conCategoria(src), prev: src };
}

/** La riga della stagione in corso con la squadra attuale in B Interregionale. */
export function rigaCorrente(righe: readonly RigaCarrieraCalc[], nomiSquadra: readonly string[], stagione: string, categoria = 'B Interregionale') {
  return righe.find((r) => r.stagione === stagione && nomiSquadra.includes(r.squadra) && r.categoria === categoria) ?? null;
}

/** Altre squadre della stagione in corso (doppio tesseramento). */
export function doppioTesseramento(righe: readonly RigaCarrieraCalc[], corrente: RigaCarrieraCalc | null, stagione: string): string | null {
  const altre = righe.filter((r) => r.stagione === stagione && r !== corrente);
  return altre.length ? altre.map(conCategoria).join(' e ') : null;
}

export function exNerviano(righe: readonly RigaCarrieraCalc[]): string | null {
  const nerv = righe.filter((r) => /nervian/i.test(r.squadra));
  if (!nerv.length) return null;
  const senior = [...new Set(nerv.filter((r) => r.senior).map((r) => r.stagione))].sort();
  if (senior.length === 1) {
    const rr = nerv.filter((r) => r.stagione === senior[0] && r.senior);
    const tp = rr.reduce((s, r) => s + (r.punti ?? 0), 0);
    const tg = rr.reduce((s, r) => s + (r.presenze ?? 0), 0);
    return `A Nerviano nel ${senior[0]}` + (tg ? ` (${f1(tp / tg)} punti di media)` : '');
  }
  if (senior.length) return `A Nerviano dal ${senior[0]} al ${senior.at(-1)}`;
  const ys = [...new Set(nerv.map((r) => r.stagione))].sort();
  return `Nelle giovanili di Nerviano (${ys[0]}${ys.length > 1 ? `–${ys.at(-1)}` : ''})`;
}

/** Livello più alto raggiunto da senior, con almeno una presenza. */
export function livello(righe: readonly RigaCarrieraCalc[]): (typeof LIVELLI)[number] | null {
  const idx = righe
    .filter((r) => r.senior && (r.presenze ?? 0) > 0)
    .map((r) => LIVELLI.indexOf(r.gruppo as (typeof LIVELLI)[number]))
    .filter((i) => i >= 0);
  return idx.length ? LIVELLI[Math.min(...idx)]! : null;
}

/** Rango in squadra per media punti (poi punti), solo per chi è sceso in campo. */
export function ranghi<T extends { id: number; partite: number | null; media: number | null; punti: number | null }>(squadra: readonly T[]): Map<number, number> {
  const inCampo = squadra.filter((a) => a.partite).sort((a, b) => (b.media ?? 0) - (a.media ?? 0) || (b.punti ?? 0) - (a.punti ?? 0));
  return new Map(inCampo.map((a, i) => [a.id, i + 1]));
}

const ORDINALI = ['', 'Prima', 'Seconda', 'Terza', 'Quarta', 'Quinta', 'Sesta', 'Settima', 'Ottava', 'Nona', 'Decima'];
const POSIZIONI: Record<number, string> = {
  1: 'miglior realizzatore della squadra',
  2: 'secondo realizzatore della squadra',
  3: 'terzo realizzatore della squadra',
};
const FASCE: Record<string, string> = { U19: 'Under 19', U17: 'Under 17' };

export interface InputSintesi {
  ruolo: string | null;
  eta: number | null;
  eta_fascia: string | null;
  stato: Stato;
  prev: RigaCarrieraCalc | null;
  stagioniQui: number;
  stagioni: number | null;
  livello: string | null;
  partite: number | null;
  punti: number | null;
  media: number | null;
  rango: number | null;
  ptsVsNerviano: number | null;
  exNerviano: string | null;
  breve: string;
  stagionePrec: string;
  /** nome PlayBasket → nome breve, per le squadre del girone */
  nomiBrevi: ReadonlyMap<string, string>;
}

const partiteTxt = (n: number) => `${n} partit${n === 1 ? 'a' : 'e'}`;

/** Sintesi fattuale dei numeri, per i giocatori senza scheda di scouting. Testo neutro, adatto anche ai minorenni. */
export function sintesi(a: InputSintesi): string {
  const out: string[] = [];
  const etaTxt = a.eta != null ? `${a.eta} anni` : a.eta_fascia ? (FASCE[a.eta_fascia] ?? a.eta_fascia) : '';
  if (a.ruolo && etaTxt) out.push(`${a.ruolo}, ${etaTxt}.`);
  else if (a.ruolo) out.push(`${a.ruolo}.`);
  else if (etaTxt) out.push(`${etaTxt[0]!.toUpperCase()}${etaTxt.slice(1)}, ruolo non indicato.`);
  let ex = a.exNerviano;
  if (a.stato === 'Nuovo arrivo' && a.prev) {
    const sq = a.nomiBrevi.get(a.prev.squadra) ?? a.prev.squadra;
    if (/nervian/i.test(a.prev.squadra) && a.prev.presenze) {
      out.push(`Nuovo arrivo da Nerviano, dove nel ${a.stagionePrec} ha segnato ${f1((a.prev.punti ?? 0) / a.prev.presenze)} punti di media.`);
      ex = null;
    } else {
      out.push(`Nuovo arrivo: nel ${a.stagionePrec} giocava con ${sq} in ${nomeCategoria(a.prev.categoria)}.`);
    }
  } else if (a.stato === 'Confermato') {
    const n = a.stagioniQui;
    out.push(`${n < ORDINALI.length ? ORDINALI[n] : `${n}ª`} stagione con ${a.breve}.`);
  } else if ((a.stagioni ?? 0) <= 1) {
    out.push('Prima stagione registrata da PlayBasket.');
  }
  if ((a.stagioni ?? 0) > 1) {
    let s = `PlayBasket gli attribuisce ${a.stagioni} stagioni`;
    if (a.livello === 'Serie A' || a.livello === 'Serie A2' || a.livello === 'Serie B e B Nazionale') {
      s += `, con esperienze fino alla ${a.livello === 'Serie B e B Nazionale' ? 'Serie B' : a.livello}`;
    }
    out.push(`${s}.`);
  }
  if (a.partite && a.punti) {
    let s = `Quest'anno ${f1(a.media)} punti a partita in ${partiteTxt(a.partite)}`;
    if (a.rango != null && POSIZIONI[a.rango]) s += `: ${POSIZIONI[a.rango]}`;
    out.push(`${s}.`);
  } else if (a.partite) {
    out.push(`Quest'anno è sceso in campo in ${partiteTxt(a.partite)} senza segnare.`);
  } else {
    out.push("Quest'anno non è ancora a referto in B Interregionale.");
  }
  if (a.ptsVsNerviano != null) {
    const v = a.ptsVsNerviano;
    out.push(v === 0 ? 'Contro Nerviano non ha segnato.' : `Contro Nerviano ha segnato ${v} punt${v === 1 ? 'o' : 'i'}.`);
  }
  if (ex) out.push(`È un ex: ${ex[0]!.toLowerCase()}${ex.slice(1)}.`);
  return out.join(' ');
}
