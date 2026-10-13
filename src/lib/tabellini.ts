/** Stato del tabellino di una partita (§4.6). */
import type { Partita } from '../schemas/index.ts';
import { giorniTra } from './formato.ts';

export const GIORNI_ATTESA_TABELLINO = 14;

type Stato = NonNullable<Partita['tabellino']>;

/**
 * @param squadre le squadre per cui esiste una tabella nel tabellino
 * @param punti   somma dei punti dei giocatori, per squadra
 * @param oggi    data della lettura (AAAA-MM-GG)
 */
export function statoTabellino(
  partita: Pick<Partita, 'casa' | 'ospite' | 'pt_casa' | 'pt_ospite' | 'data'>,
  squadre: ReadonlySet<string>,
  punti: ReadonlyMap<string, number>,
  oggi: string,
): Stato | null {
  if (partita.pt_casa == null || partita.pt_ospite == null) return null;
  const n = Number(squadre.has(partita.casa)) + Number(squadre.has(partita.ospite));
  if (n === 2) {
    const ok = (punti.get(partita.casa) ?? 0) === partita.pt_casa && (punti.get(partita.ospite) ?? 0) === partita.pt_ospite;
    return ok ? 'completo' : 'incongruente';
  }
  if (n === 1) return 'parziale';
  return giorniTra(partita.data, oggi) < GIORNI_ATTESA_TABELLINO ? 'in_attesa' : 'assente';
}

const RANGO: Record<Stato, number> = { assente: 0, in_attesa: 0, parziale: 1, incongruente: 2, completo: 3 };

/** Un tabellino trovato non si declassa mai: tiene lo stato migliore tra il vecchio e il nuovo. */
export function migliore(vecchio: Stato | null, nuovo: Stato | null): Stato | null {
  if (!vecchio) return nuovo;
  if (!nuovo) return vecchio;
  return RANGO[nuovo] >= RANGO[vecchio] ? nuovo : vecchio;
}

/** Tabellini che contano come letti per i controlli (§4.6). */
export const tabellinoLetto = (s: Stato | null): boolean => s === 'completo' || s === 'incongruente';
