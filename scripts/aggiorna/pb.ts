/**
 * Parser delle pagine PlayBasket (§4.4). Funzioni pure: HTML in ingresso, dati in uscita.
 * Si leggono solo tabelle di dati sportivi: niente articoli, cronache, foto o anni di nascita.
 */
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { pulisci, separaNome, stagioneDaPb, togliSegni } from '../../src/lib/nomi.ts';
import { ErroreFonte } from './http.ts';

const RUOLI: Record<string, string> = {
  PM: 'Play', G: 'Guardia', AP: 'Ala piccola', AF: 'Ala forte', C: 'Centro',
  play: 'Play', playmaker: 'Play', guardia: 'Guardia', 'ala piccola': 'Ala piccola', 'ala forte': 'Ala forte', centro: 'Centro',
};
export const ruolo = (s: string | null | undefined): string | null => (s ? RUOLI[pulisci(s)] ?? RUOLI[pulisci(s).toLowerCase()] ?? null : null);

const param = (href: string | undefined, nome: string): string | null => {
  const m = new RegExp(`[?&]${nome}=([^&#]*)`).exec((href ?? '').replace(/&amp;/g, '&'));
  return m ? decodeURIComponent(m[1]!) : null;
};
const intero = (s: string | null | undefined): number | null => {
  const t = pulisci(s ?? '');
  return /^\d+$/.test(t) ? Number(t) : null;
};
const decimale = (s: string | null | undefined): number | null => {
  const t = pulisci(s ?? '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};

// ---------------------------------------------------------------- calendario del girone (league.php?mod=cl)

export interface PartitaPb {
  gtn: number;
  gtt: 1 | 2;
  mn: number;
  /** giorno e mese «dd/mm» come da PlayBasket */
  data: string;
  casa: string;
  ospite: string;
  /** obj PlayBasket delle due squadre, dall'attributo data-team */
  obj_casa: number | null;
  obj_ospite: number | null;
  pt_casa: number | null;
  pt_ospite: number | null;
  /** c'è l'icona «Tabellini» */
  tabellino: boolean;
}

export function leggiCalendario(html: string): PartitaPb[] {
  const $ = cheerio.load(html);
  const out: PartitaPb[] = [];
  for (const tr of $('tr[data-team]').toArray()) {
    const r = $(tr);
    const href = r.find('a[href*="match.php"]').first().attr('href');
    const gtn = intero(param(href, 'gtn'));
    const gtt = intero(param(href, 'gtt'));
    const mn = intero(param(href, 'mn'));
    if (!gtn || (gtt !== 1 && gtt !== 2) || !mn) continue;
    const td = r.children('td').toArray().map((x) => pulisci($(x).text()));
    const [oc, oo] = (r.attr('data-team') ?? '').split(',').map((x) => intero(x));
    const giocata = td.length >= 6 && intero(td[4]) != null && intero(td[5]) != null;
    out.push({
      gtn, gtt, mn,
      data: td[0] ?? '',
      casa: td[1] ?? '',
      ospite: td[2] ?? '',
      obj_casa: oc ?? null,
      obj_ospite: oo ?? null,
      pt_casa: giocata ? intero(td[4]) : null,
      pt_ospite: giocata ? intero(td[5]) : null,
      tabellino: r.find('img[alt="T"]').length > 0,
    });
  }
  if (!out.length) throw new ErroreFonte('PlayBasket: nessuna partita nel calendario del girone (struttura della pagina cambiata?)');
  return out;
}

// ---------------------------------------------------------------- tabellino (match.php)

export interface RigaTabellino {
  giocatore: number;
  /** obj PlayBasket della squadra (extobj) */
  squadra_obj: number | null;
  nome_rosa: string;
  ruolo: string | null;
  eta: number | null;
  punti: number;
}
export interface TabellinoPb {
  titolo: string;
  /** dal titolo della pagina «Casa - Ospite 75-74 [4 Ott]» */
  titolo_casa: string | null;
  titolo_ospite: string | null;
  titolo_pt: [number, number] | null;
  /** una voce per tabella trovata: [0] casa, [1] ospite */
  squadre: { nome: string; righe: RigaTabellino[]; totale: number | null }[];
}

export function leggiTabellino(html: string): TabellinoPb {
  const $ = cheerio.load(html);
  const titolo = pulisci($('title').text()).split('|')[0]!.trim();
  const m = /^(.*?) - (.*?)(?: (\d+)-(\d+))? \[[^\]]*\]$/.exec(titolo);
  const tabelle = $('table').toArray().filter((t) => $(t).find('th').toArray().some((th) => pulisci($(th).text()) === 'Pts'));
  const squadre = tabelle.map((t) => {
    const tab = $(t);
    const nome = pulisci(tab.find('th').eq(1).text());
    const righe: RigaTabellino[] = [];
    let totale: number | null = null;
    for (const tr of tab.find('tr').toArray()) {
      const celle = $(tr).children('td');
      if (celle.length < 3) continue;
      const link = celle.eq(1).find('a[href*="profile.php"]').first();
      if (!link.length) {
        if (/^totale$/i.test(pulisci(celle.eq(1).text()))) totale = intero(celle.eq(2).text());
        continue;
      }
      const id = intero(param(link.attr('href'), 'obj'));
      if (!id) throw new ErroreFonte(`PlayBasket: giocatore senza obj nel tabellino «${titolo}»`);
      const nodoNome = link.contents().toArray().find((n: AnyNode) => n.type === 'text' && pulisci($(n).text()));
      const pts = pulisci(celle.eq(2).text());
      righe.push({
        giocatore: id,
        squadra_obj: intero(param(link.attr('href'), 'extobj')),
        nome_rosa: togliSegni(nodoNome ? $(nodoNome).text() : link.text()),
        ruolo: ruolo(/Ruolo:\s*(.+)$/i.exec(link.find('.playerInfos_role').attr('title') ?? '')?.[1]),
        eta: intero(/Età:\s*(\d+)/i.exec(link.find('.playerInfos_age').attr('title') ?? '')?.[1]),
        punti: pts === '' || pts === '-' ? 0 : (intero(pts) ?? (() => { throw new ErroreFonte(`PlayBasket: punti non numerici «${pts}» in «${titolo}»`); })()),
      });
    }
    return { nome, righe, totale };
  });
  return {
    titolo,
    titolo_casa: m?.[1] ?? null,
    titolo_ospite: m?.[2] ?? null,
    titolo_pt: m?.[3] ? [Number(m[3]), Number(m[4])] : null,
    squadre,
  };
}

// ---------------------------------------------------------------- rosa di una squadra (club.php?mod=rs)

export interface GiocatoreRosa {
  giocatore: number;
  numero: string | null;
  nome_rosa: string;
  punti: number | null;
  media: number | null;
  presenze: number | null;
  eta: number | null;
  /** «U19», «U17» quando PlayBasket mostra la fascia invece dell'età */
  eta_fascia: string | null;
  ruolo: string | null;
  href: string;
}
export interface RosaPb {
  nome: string;
  giocatori: GiocatoreRosa[];
  allenatori: { giocatore: number; nome_rosa: string }[];
}

export function leggiRosa(html: string): RosaPb {
  const $ = cheerio.load(html);
  const tabelle = $('table').toArray().map((t) => $(t));
  const rosa = tabelle.find((t) => t.find('th').toArray().some((th) => /cognome nome/i.test(pulisci($(th).text()))));
  if (!rosa) throw new ErroreFonte('PlayBasket: la pagina della rosa non ha la tabella dei giocatori');
  const giocatori: GiocatoreRosa[] = [];
  for (const tr of rosa.find('tr').toArray()) {
    const link = $(tr).find('a[href*="profile.php"]').first();
    if (!link.length) continue;
    const td = $(tr).children('td').toArray().map((x) => pulisci($(x).text()));
    const id = intero(param(link.attr('href'), 'obj'));
    if (!id) continue;
    const eta = td[4] ?? '';
    giocatori.push({
      giocatore: id,
      numero: /^\d{1,3}$/.test(td[0] ?? '') ? String(Number(td[0])) : null,
      nome_rosa: togliSegni(link.text()),
      punti: intero(td[2]),
      media: decimale(td[3]),
      presenze: intero(/(\d+) presenz/i.exec(link.attr('title') ?? '')?.[1]),
      // la cella dell'età ha come title l'anno di nascita: non si legge
      eta: /^\d+$/.test(eta) ? Number(eta) : null,
      eta_fascia: /^U\d{2}$/i.test(eta) ? eta.toUpperCase() : null,
      ruolo: ruolo(td[5]),
      href: (link.attr('href') ?? '').replace(/&amp;/g, '&'),
    });
  }
  const allenatori: RosaPb['allenatori'] = [];
  const staff = tabelle.find((t) => /staff tecnico/i.test(pulisci(t.find('th').text())));
  // il primo dello staff tecnico è l'allenatore; gli assistenti non si salvano
  const primo = staff?.find('a[href*="profile.php"][href*="subj=2"]').first();
  if (primo?.length) {
    const id = intero(param(primo.attr('href'), 'obj'));
    if (id) allenatori.push({ giocatore: id, nome_rosa: togliSegni(primo.text()) });
  }
  return { nome: pulisci($('title').text()).split(/ B Interregionale| \|/)[0]!.trim(), giocatori, allenatori };
}

// ---------------------------------------------------------------- carriera di un giocatore (profile.php ... mod=ws)

export interface CarrieraPb {
  /** «Nome Cognome» dal titolo della pagina */
  titolo_nome: string;
  righe: { stagione: string; squadra: string; categoria: string; punti: number | null; presenze: number | null; best: number | null }[];
  riepilogo: { stagioni: number | null; senior: number | null; giovanili: number | null; squadre: number | null; punti: number | null; presenze: number | null; best: number | null };
}

export function leggiCarriera(html: string): CarrieraPb {
  const $ = cheerio.load(html);
  const titolo_nome = togliSegni(pulisci($('title').text()).split(' - ')[0] ?? '');
  // la pagina può avere più tabelle (per esempio le stagioni senza statistiche): si usa quella con la colonna PTS
  const tab = $('table').toArray().map((t) => $(t)).find((t) => t.find('th').toArray().some((th) => /^PTS$/i.test(pulisci($(th).text()))));
  const vuoto = { stagioni: null, senior: null, giovanili: null, squadre: null, punti: null, presenze: null, best: null };
  if (!tab) return { titolo_nome, righe: [], riepilogo: vuoto };
  const th = tab.find('th').toArray().map((x) => pulisci($(x).text()));
  const s = th.slice(7);
  const sg = /(\d+)\s*senior\s*\/\s*(\d+)\s*giovanil/i.exec(s[1] ?? '');
  const righe: CarrieraPb['righe'] = [];
  for (const tr of tab.find('tr').toArray()) {
    const td = $(tr).children('td').toArray().map((x) => pulisci($(x).text()));
    if (td.length < 7) continue;
    righe.push({
      stagione: stagioneDaPb(td[0]!),
      squadra: td[1]!,
      categoria: td[2]!,
      punti: intero(td[3]),
      presenze: intero(td[4]),
      best: intero(td[6]),
    });
  }
  return {
    titolo_nome,
    righe,
    riepilogo: {
      stagioni: intero(s[0]), senior: sg ? Number(sg[1]) : null, giovanili: sg ? Number(sg[2]) : null,
      squadre: intero(s[2]), punti: intero(s[3]), presenze: intero(s[4]), best: intero(s[6]),
    },
  };
}

/** Cognome e nome dalla rosa («Cognome Nome») e dal titolo della carriera («Nome Cognome»). */
export function nomeGiocatore(nomeRosa: string, titoloNome: string | null): { cognome: string; nome: string } {
  if (titoloNome) {
    const [cognome, nome] = separaNome(nomeRosa, titoloNome);
    if (nome) return { cognome, nome };
  }
  const parti = togliSegni(nomeRosa).split(' ');
  return { cognome: parti[0] ?? nomeRosa, nome: parti.slice(1).join(' ') };
}
