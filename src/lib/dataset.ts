/**
 * Costruisce, dai file di data/ già validati, tutto ciò che serve al sito: correzioni applicate,
 * giocatori con i dati derivati, classifiche, calendario di Nerviano. Funzione pura: nessun accesso a file.
 */
import type { DatiGrezzi, Foto, Partita, SchedaScouting, Squadra } from '../schemas/index.ts';
import { calcolaClassifica, giocata, type RigaClassifica } from './classifica.ts';
import {
  arricchisciRiga, doppioTesseramento, exNerviano, livello, ranghi, rigaCorrente, sintesi, statoEProvenienza,
  type RigaCarrieraCalc, type Stato,
} from './giocatori.ts';
import { slugGiocatore, stagionePrecedente } from './nomi.ts';

export interface PartitaSito extends Partita {
  nota: string | null;
  escludi_medie: boolean;
}

export interface PresenzaPartita {
  partita: PartitaSito;
  punti: number;
  casa: boolean;
  avversaria: string;
  fatti: number;
  subiti: number;
  esito: 'V' | 'P';
}

export interface Persona {
  id: number;
  slug: string;
  cognome: string;
  nome: string;
  nomeCompleto: string;
  ruolo: string | null;
  eta: number | null;
  etaFascia: string | null;
  minorenne: boolean;
  allenatore: boolean;
  squadra: string;
  numero: string | null;
  inRosa: boolean;
  altezza: number | null;
  stagione: { punti: number | null; partite: number | null; media: number | null; best: number | null };
  carriera: {
    righe: RigaCarrieraCalc[];
    stagioni: number | null;
    punti: number | null;
    presenze: number | null;
    media: number | null;
    best: number | null;
  };
  stato: Stato;
  provenienza: string | null;
  doppioTesseramento: string | null;
  exNerviano: string | null;
  livello: string | null;
  rango: number | null;
  ptsVsNerviano: number | null;
  presenzePartite: PresenzaPartita[];
  scouting: SchedaScouting | null;
  sintesi: string;
  foto: Foto | null;
}

export interface GiornataNerviano {
  giornata: number;
  fase: 'andata' | 'ritorno';
  turno: number;
  riposo: boolean;
  partita: PartitaSito | null;
  /** primo e ultimo giorno della giornata (per i turni di riposo) */
  dal: string;
  al: string;
  casa: boolean;
  avversaria: string | null;
  fatti: number | null;
  subiti: number | null;
  esito: 'V' | 'P' | null;
}

export type Dataset = ReturnType<typeof costruisciDataset>;

export function costruisciDataset(d: DatiGrezzi) {
  const rif = d.stagione.squadra_riferimento;
  const stagione = d.stagione.stagione;
  const stagionePrec = stagionePrecedente(stagione);
  const squadre = new Map<string, Squadra>(d.squadre.map((s) => [s.slug, s]));
  const sq = (slug: string): Squadra => {
    const s = squadre.get(slug);
    if (!s) throw new Error(`Squadra sconosciuta: ${slug}`);
    return s;
  };
  const nomi = new Map(d.squadre.map((s) => [s.slug, s.breve]));
  const nomiBrevi = new Map<string, string>();
  for (const s of d.squadre) for (const n of s.nomi_pb ?? []) nomiBrevi.set(n, s.breve);
  const playbasket = d.sito.fonti.playbasket;

  // ---------------------------------------------------------------- partite con le correzioni
  const corrP = new Map(d.correzioni.partite.map((c) => [c.partita, c]));
  const partite: PartitaSito[] = d.partite.map((p) => {
    const c = corrP.get(p.id);
    return {
      ...p,
      palestra: c?.palestra ?? p.palestra,
      citta: c?.citta ?? p.citta,
      nota: c?.nota ?? null,
      escludi_medie: c?.escludi_medie ?? false,
    };
  });
  const partitaPerId = new Map(partite.map((p) => [p.id, p]));
  const giornate = d.stagione.giornate;

  // ---------------------------------------------------------------- classifiche
  const slugs = d.squadre.map((s) => s.slug);
  const zone = d.guida.zone;
  const opz = { penalizzazioni: d.correzioni.penalizzazioni, zone, nomi };
  const classificaOmologate = calcolaClassifica(partite, slugs, { ...opz, stati: ['omologata'] });
  const classificaProvvisoria = calcolaClassifica(partite, slugs, { ...opz, stati: ['omologata', 'ufficioso'] });
  // Classifica ufficiale: posizioni e numeri FIP, con medie e forma calcolate sulle stesse gare
  const classificaUfficiale: RigaClassifica[] = d.classifica_fip
    .slice()
    .sort((a, b) => a.posizione - b.posizione)
    .map((u) => {
      const c = classificaOmologate.find((x) => x.squadra === u.squadra)!;
      return { ...c, ...u, diff: u.pf - u.ps, zona: zone.find((z) => z.da <= u.posizione && u.posizione <= z.a)?.zona ?? null };
    });
  const ufficiosi = partite.filter((p) => p.stato === 'ufficioso' && giocata(p));

  // ---------------------------------------------------------------- persone
  const corrG = new Map(d.correzioni.giocatori.map((c) => [c.giocatore, c]));
  const nascosti = new Set(d.correzioni.giocatori.filter((c) => c.nascosto).map((c) => c.giocatore));
  const corrC = d.correzioni.carriere;
  const righeCarriera = new Map<number, RigaCarrieraCalc[]>();
  for (const r0 of d.carriere.righe) {
    const c = corrC.find((x) => x.giocatore === r0.giocatore && x.stagione === r0.stagione && x.squadra === r0.squadra);
    if (c?.rimuovi) continue;
    const r = { ...r0, ...(c ? Object.fromEntries(Object.entries(c).filter(([k, v]) => v !== undefined && !['giocatore', 'stagione', 'squadra', 'motivo', 'rimuovi'].includes(k))) : {}) };
    const { giocatore: _g, ...resto } = r;
    const lista = righeCarriera.get(r0.giocatore) ?? [];
    lista.push(arricchisciRiga(resto));
    righeCarriera.set(r0.giocatore, lista);
  }
  const riepiloghi = new Map(d.carriere.riepiloghi.map((r) => [r.giocatore, r]));
  const extra = new Map(d.giocatori_extra.map((e) => [e.giocatore, e]));
  const scouting = new Map(d.scouting.map((s) => [s.giocatore, s]));
  const foto = new Map(d.foto.filter((f) => !f.nascosta).map((f) => [f.giocatore, f]));
  const tabPerGiocatore = new Map<number, typeof d.tabellini>();
  for (const t of d.tabellini) {
    if (nascosti.has(t.giocatore)) continue;
    const l = tabPerGiocatore.get(t.giocatore) ?? [];
    l.push(t);
    tabPerGiocatore.set(t.giocatore, l);
  }
  // squadra di un giocatore: la rosa attuale, altrimenti l'ultima squadra nei tabellini
  const rosaDi = new Map<number, (typeof d.rose)[number]>();
  for (const r of d.rose) if (r.in_rosa || !rosaDi.has(r.giocatore)) rosaDi.set(r.giocatore, r);

  const persone: Persona[] = [];
  const perSintesi = new Map<number, { prev: RigaCarrieraCalc | null; stagioniQui: number }>();
  for (const g of d.giocatori) {
    if (nascosti.has(g.id)) continue;
    const corr = corrG.get(g.id);
    const cognome = corr?.cognome ?? g.cognome;
    const nome = corr?.nome ?? g.nome;
    const rosa = rosaDi.get(g.id);
    if (!rosa) throw new Error(`Giocatore ${g.id} senza squadra in rose.json`);
    const s = sq(rosa.squadra);
    const nomiPb = s.nomi_pb ?? [];
    const righe = righeCarriera.get(g.id) ?? [];
    const riep = riepiloghi.get(g.id);
    const cur = rigaCorrente(righe, nomiPb, stagione);
    const presenze: PresenzaPartita[] = (tabPerGiocatore.get(g.id) ?? [])
      .map((t) => {
        const p = partitaPerId.get(t.partita)!;
        const casa = p.casa === t.squadra;
        const fatti = (casa ? p.pt_casa : p.pt_ospite) ?? 0;
        const subiti = (casa ? p.pt_ospite : p.pt_casa) ?? 0;
        return { partita: p, punti: t.punti, casa, avversaria: casa ? p.ospite : p.casa, fatti, subiti, esito: fatti > subiti ? 'V' as const : 'P' as const };
      })
      .sort((a, b) => a.partita.giornata - b.partita.giornata);
    const partiteS = (cur?.presenze || null) ?? (presenze.length || null);
    let puntiS = rosa.punti ?? (presenze.length ? presenze.reduce((x, y) => x + y.punti, 0) : null);
    if (!partiteS) puntiS = null;
    const best = partiteS ? (presenze.length ? Math.max(...presenze.map((x) => x.punti)) : cur?.best ?? null) : null;
    const totP = righe.reduce((x, r) => x + (r.punti ?? 0), 0);
    const totG = righe.reduce((x, r) => x + (r.presenze ?? 0), 0);
    const calc = statoEProvenienza(righe, nomiPb, s.breve, stagionePrec);
    const ex = extra.get(g.id);
    const vsRif = rosa.squadra === rif ? undefined : presenze.find((x) => x.avversaria === rif);
    const minorenne = g.eta == null || g.eta < 18 || (foto.get(g.id)?.minorenne ?? false);
    persone.push({
      id: g.id,
      slug: slugGiocatore({ id: g.id, cognome, nome }),
      cognome,
      nome,
      nomeCompleto: `${nome} ${cognome}`.trim(),
      ruolo: g.allenatore ? 'Allenatore' : g.ruolo,
      eta: g.eta,
      etaFascia: g.eta_fascia,
      minorenne,
      allenatore: g.allenatore,
      squadra: rosa.squadra,
      numero: rosa.numero,
      inRosa: rosa.in_rosa,
      altezza: ex?.altezza ?? null,
      stagione: {
        punti: puntiS,
        partite: partiteS,
        media: partiteS && puntiS != null ? Math.round((puntiS / partiteS) * 10) / 10 : null,
        best,
      },
      carriera: {
        righe,
        stagioni: riep?.stagioni ?? (new Set(righe.map((r) => r.stagione)).size || null),
        punti: totG ? totP : null,
        presenze: totG || null,
        media: totG ? Math.round((totP / totG) * 10) / 10 : null,
        best: riep?.best ?? null,
      },
      stato: ex?.stato ?? calc.stato,
      provenienza: ex?.provenienza ?? calc.provenienza,
      doppioTesseramento: ex ? ex.doppio_tesseramento : doppioTesseramento(righe, cur, stagione),
      exNerviano: rosa.squadra === rif ? null : exNerviano(righe),
      livello: livello(righe),
      rango: null,
      ptsVsNerviano: vsRif ? vsRif.punti : null,
      presenzePartite: presenze,
      scouting: scouting.get(g.id) ?? null,
      sintesi: '',
      foto: foto.get(g.id) ?? null,
    });
    perSintesi.set(g.id, { prev: calc.prev, stagioniQui: new Set(righe.filter((r) => nomiPb.includes(r.squadra)).map((r) => r.stagione)).size });
  }
  for (const slug of slugs) {
    // a parità di media e punti conta l'ordine della rosa (numero di maglia), come nel legacy
    const membri = persone
      .filter((p) => p.squadra === slug && p.inRosa && !p.allenatore)
      .sort((a, b) => Number(a.numero ?? 999) - Number(b.numero ?? 999) || a.id - b.id);
    const rg = ranghi(membri.map((p) => ({ id: p.id, partite: p.stagione.partite, media: p.stagione.media, punti: p.stagione.punti })));
    for (const p of membri) p.rango = rg.get(p.id) ?? null;
  }
  for (const p of persone) {
    const x = perSintesi.get(p.id)!;
    p.sintesi = p.allenatore ? '' : sintesi({
      ruolo: p.ruolo, eta: p.eta, eta_fascia: p.etaFascia, stato: p.stato, prev: x.prev, stagioniQui: x.stagioniQui,
      stagioni: p.carriera.stagioni, livello: p.livello, partite: p.stagione.partite, punti: p.stagione.punti,
      media: p.stagione.media, rango: p.rango, ptsVsNerviano: p.ptsVsNerviano, exNerviano: p.exNerviano,
      breve: sq(p.squadra).breve, stagionePrec, nomiBrevi,
    });
  }
  persone.sort((a, b) => a.id - b.id);
  const personaPerId = new Map(persone.map((p) => [p.id, p]));

  // ---------------------------------------------------------------- Nerviano giornata per giornata
  const calendarioRif: GiornataNerviano[] = [];
  for (let g = 1; g <= giornate; g++) {
    const dellaGiornata = partite.filter((p) => p.giornata === g);
    const date = dellaGiornata.map((p) => p.data).sort();
    const fase = g <= d.stagione.turni_per_fase ? 'andata' as const : 'ritorno' as const;
    const turno = fase === 'andata' ? g : g - d.stagione.turni_per_fase;
    const p = dellaGiornata.find((x) => x.casa === rif || x.ospite === rif) ?? null;
    if (!p) {
      calendarioRif.push({ giornata: g, fase, turno, riposo: true, partita: null, dal: date[0]!, al: date.at(-1)!, casa: false, avversaria: null, fatti: null, subiti: null, esito: null });
      continue;
    }
    const casa = p.casa === rif;
    const fatti = casa ? p.pt_casa : p.pt_ospite;
    const subiti = casa ? p.pt_ospite : p.pt_casa;
    calendarioRif.push({
      giornata: g, fase, turno, riposo: false, partita: p, dal: p.data, al: p.data, casa, avversaria: casa ? p.ospite : p.casa,
      fatti, subiti, esito: fatti == null || subiti == null ? null : fatti > subiti ? 'V' : 'P',
    });
  }

  return {
    stagione: d.stagione,
    sito: d.sito,
    meta: d.meta,
    guida: d.guida,
    storia: d.storia,
    correzioni: d.correzioni,
    note: new Map(d.note_squadre.map((n) => [n.squadra, n])),
    playbasket,
    rif,
    squadre: d.squadre,
    sq,
    nomi,
    partite,
    partitaPerId,
    classificaUfficiale,
    classificaOmologate,
    classificaProvvisoria,
    ufficiosi,
    persone,
    personaPerId,
    calendarioRif,
    tabellini: d.tabellini.filter((t) => !nascosti.has(t.giocatore)),
    fotoTutte: d.foto,
  };
}
