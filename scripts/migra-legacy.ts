/**
 * Migrazione una tantum da legacy/ (copia di Basket/sorgenti) ai nuovi file in data/.
 * Uso: npm run migra. Sovrascrive data/config, data/auto e data/manuale.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RADICE, scriviTutti } from './lib/file.ts';
import { validaDati, type Partita, type Squadra, type Tabellino } from '../src/schemas/index.ts';
import { statoTabellino } from '../src/lib/tabellini.ts';
import { pulisciNome } from '../src/lib/nomi.ts';

const LEGACY = path.join(RADICE, 'legacy');
const DATA_DATI = '2026-10-12'; // data di raccolta dei dati legacy (AGGIORNATO in build_data.py)

const leggi = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(LEGACY, 'data', f), 'utf8')) as T;
type R = Record<string, any>;
const vuotoNull = <T>(v: T | '' | null | undefined): T | null => (v === '' || v === undefined ? null : v);
const num = (v: unknown): number | null => {
  if (v === '' || v == null || v === '-') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Numero non valido: ${String(v)}`);
  return n;
};
const int = (v: unknown): number | null => {
  const n = num(v);
  return n == null ? null : Math.round(n);
};

// ---------------------------------------------------------------- tabelle da legacy/LEGGIMI.md
const leggimi = fs.readFileSync(path.join(LEGACY, 'LEGGIMI.md'), 'utf8');
const righeTabella = (titolo: string): [string, number][] => {
  const parte = leggimi.split(titolo)[1]!.split('\n\n')[1]!;
  return parte
    .split('\n')
    .filter((l) => /^\| [^-|]/.test(l) && /\| \d+ \|$/.test(l))
    .map((l) => {
      const [a, b] = l.split('|').slice(1, 3).map((x) => x.trim());
      return [a!, Number(b)];
    });
};
const OBJ_SQUADRE = new Map(righeTabella('**Squadre su PlayBasket'));
const OBJ_NERVIANO = new Map(righeTabella('**Giocatori di Nerviano'));
if (OBJ_SQUADRE.size !== 15 || OBJ_NERVIANO.size !== 17) throw new Error('Tabelle degli id in LEGGIMI.md non lette');
const ALLENATORE_NERVIANO = 76478; // Davide Viceconti (LEGGIMI.md)

// ---------------------------------------------------------------- config
const stagione = {
  stagione: '2026/27',
  squadra_riferimento: 'nerviano',
  giornate: 30,
  turni_per_fase: 15,
  partite_per_giornata: 7,
  fip: {
    group: 'campionati-regionali',
    regione_codice: 'PI',
    comitato_codice: 'RPI',
    sesso: 'M',
    codice_campionato: 'B2',
    codice_fase: '1',
    codice_girone: '85162',
  },
  playbasket: { season: 2027, lt: 1, lf: 'M', lr: 'LA', lp: 'RM', lc: 'B/MR', lg: 1, prefisso: 'lombardia' },
};

const sqLegacy = leggi<R[]>('squadre.json');
const squadre: Squadra[] = sqLegacy.map((s) => ({
  slug: s.key,
  nome: s.nome,
  breve: s.breve,
  sigla: s.sigla,
  citta: s.citta,
  provincia: s.provincia,
  regione: s.regione,
  societa: s.societa,
  codice_fip: s.codice_fip,
  nome_fip: null,
  pb_obj: OBJ_SQUADRE.get(s.key)!,
  nomi_pb: [s.playbasket],
  palestra: s.palestra,
  indirizzo: s.indirizzo,
  colori: null,
  maglia_fip: null,
}));
const SQ = new Map(squadre.map((s) => [s.slug, s]));

const sito = {
  titolo: 'Nerviano Basket',
  url: 'https://nerviano-basket.example.invalid',
  email: 'contatti@example.invalid',
  indicizzabile: false,
  fonti: { playbasket: true },
  user_agent: 'NervianoBasketFan/1.0 (+{url}/note-legali/; {email})',
};

// ---------------------------------------------------------------- note squadre e correzioni
const scoutNerv = leggi<R[]>('scouting.json');
const mercato = scoutNerv.find((s) => s.id === 'mercato')!;
const firma = { autore: 'Claude' as const, scritta_il: DATA_DATI, dati_al: DATA_DATI };
const note_squadre = sqLegacy.map((s) => ({
  squadra: s.key,
  stagione_precedente: vuotoNull(s.stagione_2526),
  nota: vuotoNull(s.nota),
  mercato: s.key === 'nerviano'
    ? { titolo: mercato.nome, tag: mercato.tag, profilo: mercato.profilo, percorso: mercato.percorso, lettura: mercato.lettura, da_guardare: mercato.da_guardare, ...firma }
    : null,
}));

const correzioni = {
  partite: [
    { partita: '000518', nota: 'Risultato a tavolino', escludi_medie: true, motivo: 'Gallarate–Oleggio 0-20 assegnata a tavolino: conta in classifica ma non nelle medie punti e nel grafico attacco/difesa.' },
    { partita: '000535', palestra: 'Centro Polifunzionale', citta: 'Sorso', motivo: 'Sennori ha giocato questa gara in casa a Sorso (dato FIP del 2026-10-12).' },
  ],
  giocatori: [],
  carriere: [],
  penalizzazioni: [],
  eccezioni_controlli: [
    { controllo: 'tabellino', chiave: '000518', motivo: 'Gara assegnata a tavolino (0-20): PlayBasket conserva i punti segnati in campo.' },
  ],
};

// ---------------------------------------------------------------- partite
const STATI: Record<string, Partita['stato']> = { ufficiale: 'omologata', ufficioso: 'ufficioso', 'da giocare': 'da_giocare' };
const pLegacy = leggi<R[]>('partite.json');
const partiteBase = pLegacy.map((p) => {
  const corr = correzioni.partite.find((c) => c.partita === p.gara);
  const casa = SQ.get(p.casa)!;
  return {
    id: p.gara as string,
    giornata: p.g as number,
    fase: p.g <= 15 ? 'andata' as const : 'ritorno' as const,
    turno: p.turno as number,
    data: p.data as string,
    ora: vuotoNull<string>(p.ora),
    casa: p.casa as string,
    ospite: p.ospite as string,
    pt_casa: p.pt_casa as number | null,
    pt_ospite: p.pt_ospite as number | null,
    stato: STATI[p.stato]!,
    // la palestra della 000535 viene da correzioni.json: qui resta quella della squadra di casa
    palestra: corr?.palestra ? casa.palestra : (p.palestra as string),
    citta: corr?.citta ? casa.citta : (p.citta as string),
    pb: null,
    tabellino: null as Partita['tabellino'],
  };
});
const partitaDi = (g: number, a: string, b: string) => {
  const p = partiteBase.find((x) => x.giornata === g && ((x.casa === a && x.ospite === b) || (x.casa === b && x.ospite === a)));
  if (!p) throw new Error(`Partita G${g} ${a}–${b} non trovata`);
  return p;
};

// ---------------------------------------------------------------- blocchi grezzi PlayBasket delle avversarie (rose e riepiloghi)
type Blocco = { R: string[][]; S: Map<string, string[]> };
const blocchi = new Map<string, Blocco>();
for (const f of fs.readdirSync(path.join(LEGACY, 'raw', 'avversari'))) {
  const testo = JSON.parse(fs.readFileSync(path.join(LEGACY, 'raw', 'avversari', f), 'utf8')) as string;
  const b: Blocco = { R: [], S: new Map() };
  for (const riga of testo.split('\n').slice(1)) {
    const c = riga.split('\t');
    if (c[0] === 'R') b.R.push(c.slice(1));
    if (c[0] === 'S') b.S.set(c[1]!, c.slice(2));
  }
  blocchi.set(f.replace('.json', ''), b);
}
// Bonavida: la sua pagina carriera ha una tabella in più e il blocco non ha il riepilogo:
// valori ricopiati a mano nel legacy (CORREZIONI in avversari_dati.py).
blocchi.get('gallarate')!.S.set('98191', ['14', '11', '3', '9', '4459', '276', '41']);

// ---------------------------------------------------------------- giocatori, rose, carriere
const RUOLI = new Set(['Play', 'Guardia', 'Ala piccola', 'Ala forte', 'Centro']);
const ruolo = (r: string) => (RUOLI.has(r) ? r : null) as never;
const eta = (e: string): { eta: number | null; eta_fascia: string | null } =>
  /^\d+$/.test(e) ? { eta: Number(e), eta_fascia: null } : /^U\d{2}$/.test(e) ? { eta: null, eta_fascia: e } : { eta: null, eta_fascia: null };

const giocatori: R[] = [];
const rose: R[] = [];
const righe: R[] = [];
const riepiloghi: R[] = [];
const extra: R[] = [];

const avversari = leggi<R[]>('avversari.json');
for (const a of avversari) {
  const b = blocchi.get(a.squadra)!;
  const r = b.R.find((x) => Number(x[0]) === a.obj)!;
  const [cognome, nome] = pulisciNome(a.cognome, a.nome);
  giocatori.push({ id: a.obj, cognome, nome, ruolo: ruolo(a.ruolo), ...eta(a.eta), allenatore: false });
  rose.push({ giocatore: a.obj, squadra: a.squadra, numero: vuotoNull(r[1]!), punti: int(r[4]), media: num(r[5]), in_rosa: true });
  const s = b.S.get(String(a.obj)) ?? [];
  riepiloghi.push({
    giocatore: a.obj, stagioni: int(s[0]), senior: int(s[1]), giovanili: int(s[2]), squadre: int(s[3]),
    punti: int(s[4]), presenze: int(s[5]), best: int(s[6]),
  });
}
for (const c of leggi<R[]>('carriere_avversari.json')) {
  righe.push({
    giocatore: Number(c.giocatore.split('-').pop()), stagione: c.stagione, squadra: c.squadra,
    categoria: c.categoria.replace('Serie A (Lega Basket)', 'Lega Basket'),
    punti: c.pts, presenze: c.presenze, best: c.best,
  });
}

const nervLegacy = leggi<R[]>('giocatori.json');
const objDaMaglia = new Map<number, number>();
for (const g of nervLegacy) {
  const chiave = g.cognome === 'Viceconti' ? 'F. Viceconti' : g.cognome;
  const obj = OBJ_NERVIANO.get(chiave);
  if (!obj) throw new Error(`obj PlayBasket mancante per ${g.cognome}`);
  objDaMaglia.set(g.numero, obj);
  giocatori.push({ id: obj, cognome: g.cognome, nome: g.nome, ruolo: ruolo(g.ruolo), ...eta(g.eta), allenatore: false });
  rose.push({ giocatore: obj, squadra: 'nerviano', numero: String(g.numero), punti: g.pts, media: g.media, in_rosa: true });
  riepiloghi.push({
    giocatore: obj, stagioni: g.stagioni, senior: null, giovanili: null, squadre: null,
    punti: g.pts_carriera, presenze: g.partite_carriera, best: g.best_carriera,
  });
  extra.push({
    giocatore: obj, altezza: g.altezza, stato: vuotoNull(g.stato), provenienza: vuotoNull(g.provenienza),
    doppio_tesseramento: vuotoNull(g.doppio_tesseramento),
  });
}
giocatori.push({ id: ALLENATORE_NERVIANO, cognome: 'Viceconti', nome: 'Davide', ruolo: null, eta: null, eta_fascia: null, allenatore: true });
rose.push({ giocatore: ALLENATORE_NERVIANO, squadra: 'nerviano', numero: null, punti: null, media: null, in_rosa: true });

for (const c of leggi<R[]>('carriere.json')) {
  righe.push({
    giocatore: objDaMaglia.get(c.numero)!, stagione: c.stagione, squadra: c.squadra,
    categoria: c.categoria.replace('Serie A (Lega Basket)', 'Lega Basket'),
    punti: c.pts, presenze: c.presenze, best: c.best,
  });
}

// ---------------------------------------------------------------- tabellini
const tabellini: Tabellino[] = [];
for (const r of leggi<R[]>('partite_avversari.json')) {
  const p = partitaDi(r.g, r.squadra, r.avversario);
  tabellini.push({ partita: p.id, giocatore: Number(r.giocatore.split('-').pop()), squadra: r.squadra, punti: r.punti });
}
for (const r of leggi<R[]>('punti_partita.json')) {
  const p = partitaDi(r.g, 'nerviano', r.avversario);
  tabellini.push({ partita: p.id, giocatore: objDaMaglia.get(r.numero)!, squadra: 'nerviano', punti: r.punti });
}
for (const p of partiteBase) {
  const t = tabellini.filter((x) => x.partita === p.id);
  const punti = new Map<string, number>();
  for (const x of t) punti.set(x.squadra, (punti.get(x.squadra) ?? 0) + x.punti);
  p.tabellino = statoTabellino(p, new Set(punti.keys()), punti, DATA_DATI);
}

// ---------------------------------------------------------------- classifica FIP (controllo `uff` in build_data.py)
const build = fs.readFileSync(path.join(LEGACY, 'build_data.py'), 'utf8');
const uffTesto = build.split('uff = {')[1]!.split('}')[0]!;
const uff = [...uffTesto.matchAll(/"(\w+)": \((\d+), (\d+), (\d+), (\d+), (\d+), (\d+)\)/g)].map((m) => ({
  squadra: m[1]!, punti: +m[2]!, g: +m[3]!, v: +m[4]!, p: +m[5]!, pf: +m[6]!, ps: +m[7]!,
}));
if (uff.length !== 15) throw new Error('Classifica FIP del legacy non letta');
// L'ordine in build_data.py segue la classifica FIP del 12/10/2026.
const classifica_fip = uff.map((r, i) => ({ posizione: i + 1, ...r }));

// ---------------------------------------------------------------- scouting
const scouting: R[] = [];
for (const s of scoutNerv) {
  if (s.tipo === 'squadra') continue;
  const id = s.id === 'coach' ? ALLENATORE_NERVIANO : objDaMaglia.get(Number(s.id))!;
  scouting.push({ giocatore: id, tag: s.tag, profilo: s.profilo, percorso: s.percorso, lettura: s.lettura, da_guardare: s.da_guardare, ...firma });
}
for (const s of leggi<R[]>('scouting_avversari.json')) {
  scouting.push({ giocatore: Number(s.id.split('-').pop()), tag: s.tag, profilo: s.profilo, percorso: s.percorso, lettura: s.lettura, da_guardare: s.da_guardare, ...firma });
}

// ---------------------------------------------------------------- storia e guida
const storiaL = leggi<R[]>('storia.json');
const storia = {
  stagione: '2025/26',
  sintesi: storiaL.filter((s) => s.tipo === 'sintesi').map(({ id, etichetta, valore, nota }) => ({ id, etichetta, valore, nota })),
  playoff: storiaL.filter((s) => s.tipo === 'playoff').map(({ id, turno, gara, data, casa, ospite, pt_casa, pt_ospite }) => ({ id, turno, gara, data, casa, ospite, pt_casa, pt_ospite })),
};
const guidaL = leggi<R[]>('guida.json');
const guida = {
  zone: guidaL.filter((g) => g.tipo === 'zona').map(({ id, zona, da, a, descrizione }) => ({ id, zona, da, a, descrizione })),
  tappe: guidaL.filter((g) => g.tipo === 'tappa').map(({ id, ordine, titolo, descrizione }) => ({ id, ordine, titolo, descrizione })),
  date: guidaL.filter((g) => g.tipo === 'data').map(({ id, data, titolo, nota }) => ({ id, data, titolo, nota })),
  // «aggiornato» non si migra: la data dei dati sta in auto/meta.json
  info: guidaL.filter((g) => g.tipo === 'info' && g.id !== 'aggiornato').map(({ id, valore, nota }) => ({ id, valore, nota })),
};

// ---------------------------------------------------------------- ordinamento stabile e scrittura
const perNumero = (a: string | null, b: string | null) => (a == null ? 1 : b == null ? -1 : Number(a) - Number(b));
const partite = partiteBase.sort((a, b) => a.giornata - b.giornata || a.data.localeCompare(b.data) || (a.ora ?? '').localeCompare(b.ora ?? '') || a.id.localeCompare(b.id));
giocatori.sort((a, b) => a.id - b.id);
rose.sort((a, b) => a.squadra.localeCompare(b.squadra) || perNumero(a.numero, b.numero) || a.giocatore - b.giocatore);
tabellini.sort((a, b) => a.partita.localeCompare(b.partita) || a.squadra.localeCompare(b.squadra) || a.giocatore - b.giocatore);
righe.sort((a, b) => a.giocatore - b.giocatore || b.stagione.localeCompare(a.stagione)); // sort stabile: dentro la stagione resta l'ordine PlayBasket
riepiloghi.sort((a, b) => a.giocatore - b.giocatore);
scouting.sort((a, b) => a.giocatore - b.giocatore);
extra.sort((a, b) => a.giocatore - b.giocatore);

const conteggi = {
  partite: partite.length, classifica_fip: classifica_fip.length, giocatori: giocatori.length, rose: rose.length,
  tabellini: tabellini.length, carriere: righe.length,
};
const meta = { fonti: { fip: { aggiornato: DATA_DATI }, playbasket: { aggiornato: DATA_DATI } }, conteggi };

const files = {
  'config/stagione.json': stagione,
  'config/squadre.json': squadre,
  'config/sito.json': sito,
  'auto/partite.json': partite,
  'auto/classifica_fip.json': classifica_fip,
  'auto/giocatori.json': giocatori,
  'auto/rose.json': rose,
  'auto/tabellini.json': tabellini,
  'auto/carriere.json': { righe, riepiloghi },
  'auto/meta.json': meta,
  'manuale/scouting.json': scouting,
  'manuale/note_squadre.json': note_squadre,
  'manuale/giocatori_extra.json': extra,
  'manuale/storia.json': storia,
  'manuale/guida.json': guida,
  'manuale/correzioni.json': correzioni,
  'manuale/foto.json': [],
};
validaDati(files as never); // mai dati non validi: se fallisce non scrive nulla
const cambiati = scriviTutti(files);
console.log(`Migrazione completata: ${cambiati.length} file scritti.`);
console.log(Object.entries(conteggi).map(([k, v]) => `${k}: ${v}`).join(', '));
const stati = new Map<string, number>();
for (const p of partite) if (p.tabellino) stati.set(p.tabellino, (stati.get(p.tabellino) ?? 0) + 1);
console.log('tabellini:', Object.fromEntries(stati));
