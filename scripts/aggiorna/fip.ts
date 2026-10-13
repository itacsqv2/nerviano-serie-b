/**
 * Parser delle pagine FIP dei risultati (§4.3). Funzioni pure: HTML in ingresso, dati in uscita.
 * Si leggono solo squadre, punti, data, ora, numero gara, stato e campo di gioco.
 * Arbitri, ufficiali di campo, provvedimenti e «Riferimento» non vengono mai letti né salvati.
 */
import * as cheerio from 'cheerio';
import { dataDaItaliano } from '../../src/lib/formato.ts';
import { pulisci } from '../../src/lib/nomi.ts';
import { ErroreFonte } from './http.ts';

export interface PartitaFip {
  id: string;
  casa: string;
  ospite: string;
  pt_casa: number | null;
  pt_ospite: number | null;
  data: string;
  ora: string | null;
  /** omologata | ufficioso | da_giocare | fip:<classe sconosciuta> */
  stato: string;
  stato_testo: string | null;
  palestra: string | null;
  citta: string | null;
}

export interface RigaClassificaFip {
  posizione: number;
  nome: string;
  punti: number;
  g: number; v: number; p: number; pf: number; ps: number;
  codice_fip: string | null;
  campo: string | null;
  maglia: string | null;
}

const STATI_NOTI: Record<string, string> = {
  omologata: 'omologata',
  ufficioso: 'ufficioso',
  'designata-nonvisibile': 'da_giocare',
  'non-designata': 'da_giocare',
};

const PICCOLE = new Set(['di', 'del', 'della', 'de', 'sopra', 'sotto', 'sul', 'al', 'in', 'e']);
/** «GAZZADA SCHIANNO» → «Gazzada Schianno», «BOFFALORA SOPRA TICINO» → «Boffalora sopra Ticino». */
export function capitalizza(s: string): string {
  return pulisci(s)
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && PICCOLE.has(w) ? w : w.replace(/(^|[-'’])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())))
    .join(' ');
}

/** «Bocconi Sport Center, Viale Toscana 30 20136 MILANO ( MI)» → palestra e città. */
export function leggiCampo(testo: string): { palestra: string | null; citta: string | null } {
  const t = pulisci(testo);
  if (!t) return { palestra: null, citta: null };
  const palestra = pulisci(t.split(',')[0] ?? '') || null;
  const m = /(?:\d{5}\s+)?([^\d,()]+?)\s*\(\s*[A-Z]{2}\s*\)\s*$/.exec(t);
  return { palestra, citta: m ? capitalizza(m[1]!) : null };
}

const numero = (s: string): number | null => {
  const t = pulisci(s);
  if (!t) return null;
  if (!/^\d+$/.test(t)) throw new ErroreFonte(`FIP: punteggio non numerico «${t}»`);
  return Number(t);
};

export function leggiPartite(html: string): PartitaFip[] {
  const $ = cheerio.load(html);
  return $('.results-matches__match').toArray().map((el) => {
    const m = $(el);
    const squadre = m.find('.teams .team');
    if (squadre.length !== 2) throw new ErroreFonte('FIP: una partita non ha due squadre (struttura della pagina cambiata?)');
    const [casa, ospite] = squadre.toArray().map((t) => $(t));
    const id = pulisci(m.find('.ref').first().text());
    if (!/^\d{6}$/.test(id)) throw new ErroreFonte(`FIP: numero gara non valido «${id}»`);
    const pt_casa = numero(casa!.find('.team__points').text());
    const pt_ospite = numero(ospite!.find('.team__points').text());
    const st = m.find('.match-status').first();
    const classe = (st.attr('class') ?? '').split(/\s+/).find((c) => c.startsWith('match-status--'))?.slice('match-status--'.length);
    // Una gara giocata senza indicatore di stato è omologata; una non giocata senza indicatore è da giocare.
    const giocata = pt_casa != null && pt_ospite != null;
    const stato = classe ? (STATI_NOTI[classe] ?? `fip:${classe}`) : giocata ? 'omologata' : 'da_giocare';
    let campo = '';
    m.find('.results-matches__match__moreinfo .info').each((_, i) => {
      if (/^campo di gioco$/i.test(pulisci($(i).children('.label').text()))) campo = $(i).children('.value').text();
    });
    const ora = pulisci(m.find('.results-matches__match__info .time').first().text());
    return {
      id,
      casa: pulisci(casa!.find('.team__name').text()),
      ospite: pulisci(ospite!.find('.team__name').text()),
      pt_casa,
      pt_ospite,
      data: dataDaItaliano(pulisci(m.find('.results-matches__match__info .date').first().text())),
      ora: /^\d{1,2}:\d{2}$/.test(ora) ? ora.padStart(5, '0') : null,
      stato,
      stato_testo: pulisci(st.find('.match-status__legend h4').text()) || null,
      ...leggiCampo(campo),
    };
  });
}

export function leggiClassifica(html: string): RigaClassificaFip[] {
  const $ = cheerio.load(html);
  const tabella = $('.results-ranking-full table').first();
  if (!tabella.length) return [];
  const intest = tabella.find('thead th').toArray().map((t) => pulisci($(t).text()).toLowerCase());
  const attese = ['', 'squadra', 'punti', 'g', 'v', 'p', 'pf', 'ps'];
  if (attese.some((a, i) => (intest[i] ?? '').replace('#', '') !== a)) throw new ErroreFonte(`FIP: intestazione della classifica cambiata (${intest.join(', ')})`);
  const righe: RigaClassificaFip[] = [];
  for (const tr of tabella.find('tbody tr').toArray()) {
    const r = $(tr);
    const info = r.find('td.team__info');
    if (info.length) {
      const ultima = righe.at(-1);
      if (!ultima) continue;
      ultima.codice_fip = /^(\d{6})\b/.exec(pulisci(info.find('h4').text()))?.[1] ?? null;
      // solo «Campo da gioco» e «Maglia»: «Riferimento» è un recapito personale e non si legge
      info.find('strong').each((_, s) => {
        const etichetta = pulisci($(s).text()).toLowerCase();
        if (etichetta !== 'campo da gioco' && etichetta !== 'maglia') return;
        let valore = '';
        for (let n = s.nextSibling; n && !(n.type === 'tag' && ['strong', 'br'].includes((n as { name?: string }).name ?? '')); n = n.nextSibling) {
          valore += $(n).text();
        }
        valore = pulisci(valore.replace(/^\s*:/, ''));
        if (etichetta === 'maglia') ultima.maglia = valore || null;
        else ultima.campo = valore || null;
      });
      continue;
    }
    const td = r.children('td').toArray().map((x) => pulisci($(x).text()));
    if (td.length < 8) continue;
    const n = td.slice(2, 8).map(Number);
    if (n.some((x) => !Number.isInteger(x))) throw new ErroreFonte(`FIP: riga di classifica non numerica (${td.join(' | ')})`);
    righe.push({
      posizione: Number(td[0]),
      nome: pulisci(r.find('.team__name').text()),
      punti: n[0]!, g: n[1]!, v: n[2]!, p: n[3]!, pf: n[4]!, ps: n[5]!,
      codice_fip: null, campo: null, maglia: null,
    });
  }
  return righe;
}
