/** Classifica calcolata dai risultati (porting di dash.calc «classifica» in legacy/page/index.html). */
import type { Guida, Partita } from '../schemas/index.ts';
import { media } from './formato.ts';

export interface PartitaClassifica extends Pick<Partita, 'id' | 'giornata' | 'casa' | 'ospite' | 'pt_casa' | 'pt_ospite' | 'stato'> {
  escludi_medie?: boolean;
}

export interface RigaClassifica {
  posizione: number;
  squadra: string;
  punti: number;
  g: number;
  v: number;
  p: number;
  pf: number;
  ps: number;
  diff: number;
  /** medie solo sulle gare giocate in campo (esclusi i risultati a tavolino) */
  pf_media: number | null;
  ps_media: number | null;
  /** ultime 5, la più recente per ultima: «VVPVP» */
  forma: string;
  zona: Guida['zone'][number]['zona'] | null;
}

export const giocata = (p: Pick<Partita, 'pt_casa' | 'pt_ospite'>): boolean => p.pt_casa != null && p.pt_ospite != null;

interface Acc {
  squadra: string; punti: number; g: number; v: number; p: number; pf: number; ps: number;
  gc: number; pfc: number; psc: number; seq: string[];
}

/**
 * @param stati quali stati contano: ['omologata'] per il confronto con FIP, ['omologata','ufficioso'] per la provvisoria
 * @param nomi  per l'ultimo criterio di parità (ordine alfabetico)
 */
export function calcolaClassifica(
  partite: readonly PartitaClassifica[],
  squadre: readonly string[],
  opz: {
    stati: readonly Partita['stato'][];
    penalizzazioni?: readonly { squadra: string; punti: number }[];
    zone?: Guida['zone'];
    nomi?: ReadonlyMap<string, string>;
  },
): RigaClassifica[] {
  const valide = partite
    .filter((p) => giocata(p) && opz.stati.includes(p.stato))
    .sort((a, b) => a.giornata - b.giornata);
  const acc = new Map<string, Acc>(squadre.map((s) => [s, { squadra: s, punti: 0, g: 0, v: 0, p: 0, pf: 0, ps: 0, gc: 0, pfc: 0, psc: 0, seq: [] }]));
  for (const m of valide) {
    const lati: [string, number, number][] = [[m.casa, m.pt_casa!, m.pt_ospite!], [m.ospite, m.pt_ospite!, m.pt_casa!]];
    for (const [s, f, c] of lati) {
      const a = acc.get(s);
      if (!a) throw new Error(`Squadra sconosciuta in classifica: ${s}`);
      a.g++; a.pf += f; a.ps += c;
      if (f > c) { a.v++; a.punti += 2; a.seq.push('V'); } else { a.p++; a.seq.push('P'); }
      if (!m.escludi_medie) { a.gc++; a.pfc += f; a.psc += c; }
    }
  }
  for (const pen of opz.penalizzazioni ?? []) {
    const a = acc.get(pen.squadra);
    if (a) a.punti -= pen.punti;
  }

  // scontri diretti tra le squadre a pari punti
  const scontri = (gruppo: Set<string>) => {
    const r = new Map<string, { punti: number; diff: number }>([...gruppo].map((s) => [s, { punti: 0, diff: 0 }]));
    for (const m of valide) {
      if (!gruppo.has(m.casa) || !gruppo.has(m.ospite)) continue;
      const d = m.pt_casa! - m.pt_ospite!;
      r.get(m.casa)!.diff += d;
      r.get(m.ospite)!.diff -= d;
      r.get(d > 0 ? m.casa : m.ospite)!.punti += 2;
    }
    return r;
  };
  const nome = (s: string) => opz.nomi?.get(s) ?? s;
  const righe = [...acc.values()].sort((a, b) => b.punti - a.punti);
  const ordinate: Acc[] = [];
  for (let i = 0; i < righe.length;) {
    let j = i;
    while (j < righe.length && righe[j]!.punti === righe[i]!.punti) j++;
    const gruppo = righe.slice(i, j);
    const sd = scontri(new Set(gruppo.map((x) => x.squadra)));
    gruppo.sort((a, b) =>
      sd.get(b.squadra)!.punti - sd.get(a.squadra)!.punti
      || sd.get(b.squadra)!.diff - sd.get(a.squadra)!.diff
      || (b.pf - b.ps) - (a.pf - a.ps)
      || b.pf - a.pf
      || nome(a.squadra).localeCompare(nome(b.squadra), 'it'));
    ordinate.push(...gruppo);
    i = j;
  }
  return ordinate.map((a, i) => ({
    posizione: i + 1,
    squadra: a.squadra,
    punti: a.punti, g: a.g, v: a.v, p: a.p, pf: a.pf, ps: a.ps, diff: a.pf - a.ps,
    pf_media: media(a.pfc, a.gc),
    ps_media: media(a.psc, a.gc),
    forma: a.seq.slice(-5).join(''),
    zona: zonaDi(i + 1, opz.zone),
  }));
}

export function zonaDi(pos: number, zone: Guida['zone'] | undefined) {
  return zone?.find((z) => z.da <= pos && pos <= z.a)?.zona ?? null;
}

/** Differenze tra la classifica calcolata (sole omologate) e quella ufficiale FIP: una riga per squadra diversa. */
export function differenzeClassifica(
  calcolata: readonly RigaClassifica[],
  fip: readonly { squadra: string; punti: number; g: number; v: number; p: number; pf: number; ps: number }[],
): string[] {
  const out: string[] = [];
  const campi = ['punti', 'g', 'v', 'p', 'pf', 'ps'] as const;
  for (const u of fip) {
    const c = calcolata.find((x) => x.squadra === u.squadra);
    if (!c) { out.push(`${u.squadra}: assente nella classifica calcolata`); continue; }
    const d = campi.filter((k) => c[k] !== u[k]);
    if (d.length) out.push(`${u.squadra}: ${d.map((k) => `${k} ${c[k]} invece di ${u[k]}`).join(', ')}`);
  }
  for (const c of calcolata) if (!fip.some((u) => u.squadra === c.squadra)) out.push(`${c.squadra}: assente nella classifica FIP`);
  return out;
}
