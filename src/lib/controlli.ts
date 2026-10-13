/**
 * Controlli di coerenza (§4.7). Gli errori bloccano pipeline, validazione e build; gli avvisi finiscono nel report.
 * Una differenza nota si accetta in correzioni.json → eccezioni_controlli ({ controllo, chiave, motivo }).
 */
import type { DatiGrezzi } from '../schemas/index.ts';
import { calcolaClassifica, differenzeClassifica, giocata } from './classifica.ts';
import { giorniTra } from './formato.ts';
import { tabellinoLetto } from './tabellini.ts';

export interface EsitoControlli {
  errori: string[];
  avvisi: string[];
}

export const GIORNI_REVISIONE_SCHEDA = 21;
export const SOGLIA_MEDIA_SCHEDA = 0.3;

export function controlla(d: DatiGrezzi, oggi: string): EsitoControlli {
  const errori: string[] = [];
  const avvisi: string[] = [];
  const eccezione = (controllo: string, chiave: string) =>
    d.correzioni.eccezioni_controlli.some((e) => e.controllo === controllo && e.chiave === chiave);

  const slugs = new Set(d.squadre.map((s) => s.slug));
  const n = slugs.size;
  const { giornate, partite_per_giornata: perGiornata, turni_per_fase: perFase } = d.stagione;

  // ---------------------------------------------------------------- squadre
  if (!slugs.has(d.stagione.squadra_riferimento)) errori.push(`squadra di riferimento «${d.stagione.squadra_riferimento}» non presente in squadre.json`);
  if (new Set(d.squadre.map((s) => s.pb_obj)).size !== n) errori.push('squadre.json: pb_obj duplicati');

  // ---------------------------------------------------------------- calendario
  const P = d.partite;
  if (P.length !== giornate * perGiornata) errori.push(`calendario: ${P.length} partite invece di ${giornate * perGiornata}`);
  if (new Set(P.map((p) => p.id)).size !== P.length) errori.push('calendario: numeri gara duplicati');
  for (const p of P) {
    if (!slugs.has(p.casa) || !slugs.has(p.ospite)) errori.push(`partita ${p.id}: squadra sconosciuta (${p.casa}–${p.ospite})`);
    if (p.casa === p.ospite) errori.push(`partita ${p.id}: la squadra gioca contro sé stessa`);
    const attesa = p.giornata <= perFase ? 'andata' : 'ritorno';
    if (p.fase !== attesa || p.turno !== (attesa === 'andata' ? p.giornata : p.giornata - perFase)) errori.push(`partita ${p.id}: fase/turno incoerenti con la giornata ${p.giornata}`);
    if ((p.pt_casa == null) !== (p.pt_ospite == null)) errori.push(`partita ${p.id}: punteggio incompleto`);
    if (giocata(p) && p.stato === 'da_giocare') errori.push(`partita ${p.id}: ha un risultato ma è «da giocare»`);
    if (!giocata(p) && (p.stato === 'omologata' || p.stato === 'ufficioso')) errori.push(`partita ${p.id}: «${p.stato}» senza risultato`);
  }
  for (let g = 1; g <= giornate; g++) {
    const gg = P.filter((p) => p.giornata === g);
    if (gg.length !== perGiornata) errori.push(`giornata ${g}: ${gg.length} partite invece di ${perGiornata}`);
    const sq = gg.flatMap((p) => [p.casa, p.ospite]);
    if (new Set(sq).size !== sq.length || sq.length !== perGiornata * 2) errori.push(`giornata ${g}: squadre ripetute o mancanti`);
  }
  for (const s of slugs) {
    const casa = P.filter((p) => p.casa === s).length;
    const fuori = P.filter((p) => p.ospite === s).length;
    if (casa !== n - 1 || fuori !== n - 1) errori.push(`calendario: ${s} gioca ${casa} partite in casa e ${fuori} in trasferta invece di ${n - 1} e ${n - 1}`);
  }
  const coppie = new Set(P.map((p) => `${p.casa}|${p.ospite}`));
  if (coppie.size !== P.length) errori.push('calendario: una coppia casa/ospite compare più di una volta');
  for (const fase of ['andata', 'ritorno'] as const) {
    const incontri = P.filter((p) => p.fase === fase).map((p) => [p.casa, p.ospite].sort().join('|'));
    const attesi = (n * (n - 1)) / 2;
    if (new Set(incontri).size !== attesi || incontri.length !== attesi) errori.push(`calendario: il ${fase} non ha ${attesi} incontri diversi`);
  }

  // ---------------------------------------------------------------- classifica calcolata = classifica FIP
  const calcolata = calcolaClassifica(P, [...slugs], { stati: ['omologata'], penalizzazioni: d.correzioni.penalizzazioni });
  const diff = differenzeClassifica(calcolata, d.classifica_fip).filter((r) => !eccezione('classifica', r.split(':')[0]!));
  if (diff.length) {
    errori.push(`la classifica calcolata con le gare omologate non coincide con quella FIP (rilancia con --completo: FIP può aver corretto una giornata già letta):\n    ${diff.join('\n    ')}`);
  }
  if (new Set(d.classifica_fip.map((r) => r.posizione)).size !== d.classifica_fip.length) errori.push('classifica FIP: posizioni duplicate');

  // ---------------------------------------------------------------- riferimenti
  const ids = new Set(d.giocatori.map((g) => g.id));
  if (ids.size !== d.giocatori.length) errori.push('giocatori.json: id duplicati');
  const partite = new Map(P.map((p) => [p.id, p]));
  const inRosa = new Set<number>();
  const conRiga = new Set<number>();
  for (const r of d.rose) {
    if (!ids.has(r.giocatore)) errori.push(`rose: giocatore ${r.giocatore} inesistente`);
    if (!slugs.has(r.squadra)) errori.push(`rose: squadra ${r.squadra} inesistente`);
    if (r.in_rosa) {
      if (inRosa.has(r.giocatore)) errori.push(`rose: giocatore ${r.giocatore} in rosa in due squadre`);
      inRosa.add(r.giocatore);
    }
    conRiga.add(r.giocatore);
  }
  for (const g of d.giocatori) if (!conRiga.has(g.id)) errori.push(`giocatore ${g.id} (${g.cognome}) senza riga in rose.json`);
  const chiaviTab = new Set<string>();
  for (const t of d.tabellini) {
    const p = partite.get(t.partita);
    if (!p) { errori.push(`tabellini: partita ${t.partita} inesistente`); continue; }
    if (!ids.has(t.giocatore)) errori.push(`tabellini: giocatore ${t.giocatore} inesistente`);
    if (t.squadra !== p.casa && t.squadra !== p.ospite) errori.push(`tabellini: ${t.squadra} non gioca la partita ${t.partita}`);
    const k = `${t.partita}|${t.giocatore}`;
    if (chiaviTab.has(k)) errori.push(`tabellini: giocatore ${t.giocatore} due volte nella partita ${t.partita}`);
    chiaviTab.add(k);
  }
  for (const r of d.carriere.righe) if (!ids.has(r.giocatore)) errori.push(`carriere: giocatore ${r.giocatore} inesistente`);
  for (const r of d.carriere.riepiloghi) if (!ids.has(r.giocatore)) errori.push(`carriere (riepilogo): giocatore ${r.giocatore} inesistente`);
  const manuali: [string, number[]][] = [
    ['scouting.json', d.scouting.map((s) => s.giocatore)],
    ['foto.json', d.foto.map((f) => f.giocatore)],
    ['giocatori_extra.json', d.giocatori_extra.map((e) => e.giocatore)],
    ['correzioni.json (giocatori)', d.correzioni.giocatori.map((c) => c.giocatore)],
    ['correzioni.json (carriere)', d.correzioni.carriere.map((c) => c.giocatore)],
  ];
  for (const [f, lista] of manuali) for (const id of lista) if (!ids.has(id)) errori.push(`${f}: giocatore ${id} inesistente`);
  for (const c of d.correzioni.partite) if (!partite.has(c.partita)) errori.push(`correzioni.json: partita ${c.partita} inesistente`);
  for (const c of d.correzioni.penalizzazioni) if (!slugs.has(c.squadra)) errori.push(`correzioni.json: squadra ${c.squadra} inesistente`);
  for (const nota of d.note_squadre) if (!slugs.has(nota.squadra)) errori.push(`note_squadre.json: squadra ${nota.squadra} inesistente`);
  if (new Set(d.scouting.map((s) => s.giocatore)).size !== d.scouting.length) errori.push('scouting.json: più schede per lo stesso giocatore');

  // ---------------------------------------------------------------- foto: permessi e minorenni (§5.1)
  const eta = new Map(d.giocatori.map((g) => [g.id, g.eta]));
  for (const f of d.foto) {
    if (f.file !== `${f.giocatore}.webp`) errori.push(`foto.json: il file della foto di ${f.giocatore} deve chiamarsi ${f.giocatore}.webp`);
    const e = eta.get(f.giocatore);
    const minorenne = f.minorenne || e == null || e < 18;
    if (minorenne && f.consenso_genitori !== true) errori.push(`foto.json: ${f.giocatore} è (o può essere) minorenne e manca consenso_genitori: true`);
  }

  // ---------------------------------------------------------------- avvisi
  for (const p of P) {
    if (typeof p.stato === 'string' && p.stato.startsWith('fip:')) avvisi.push(`partita ${p.id}: stato FIP sconosciuto «${p.stato.slice(4)}»`);
    if (!giocata(p)) continue;
    if (p.tabellino === 'incongruente' && !eccezione('tabellino', p.id)) avvisi.push(`partita ${p.id} (${p.casa}–${p.ospite} ${p.pt_casa}-${p.pt_ospite}): i punti del tabellino PlayBasket non tornano con il risultato FIP`);
    if (p.tabellino && !tabellinoLetto(p.tabellino) && !eccezione('tabellino', p.id)) avvisi.push(`partita ${p.id} (${p.casa}–${p.ospite}): tabellino ${p.tabellino.replace('_', ' ')}`);
  }
  // totali di carriera contro il riepilogo PlayBasket
  const somme = new Map<number, { p: number; g: number }>();
  for (const r of d.carriere.righe) {
    const s = somme.get(r.giocatore) ?? { p: 0, g: 0 };
    s.p += r.punti ?? 0; s.g += r.presenze ?? 0;
    somme.set(r.giocatore, s);
  }
  for (const r of d.carriere.riepiloghi) {
    if (r.punti == null || eccezione('carriera', String(r.giocatore))) continue;
    const s = somme.get(r.giocatore) ?? { p: 0, g: 0 };
    if (s.p !== r.punti || s.g !== (r.presenze ?? 0)) avvisi.push(`giocatore ${r.giocatore}: totali di carriera ${s.p}/${s.g} diversi dal riepilogo PlayBasket ${r.punti}/${r.presenze}`);
  }
  // punti nei tabellini contro i punti della rosa, se tutti i tabellini della squadra sono letti
  const squadraLetta = new Map<string, boolean>();
  for (const s of slugs) squadraLetta.set(s, P.filter((p) => giocata(p) && (p.casa === s || p.ospite === s)).every((p) => tabellinoLetto(p.tabellino)));
  for (const r of d.rose) {
    if (!r.in_rosa || r.punti == null || !squadraLetta.get(r.squadra)) continue;
    const tot = d.tabellini.filter((t) => t.giocatore === r.giocatore && t.squadra === r.squadra).reduce((a, t) => a + t.punti, 0);
    if (tot !== r.punti && !eccezione('punti_rosa', String(r.giocatore))) avvisi.push(`giocatore ${r.giocatore} (${r.squadra}): ${r.punti} punti in rosa ma ${tot} nei tabellini`);
  }
  // schede, foto e correzioni di chi non è più in rosa
  for (const [f, lista] of manuali) for (const id of lista) if (ids.has(id) && !inRosa.has(id)) avvisi.push(`${f}: il giocatore ${id} non è più in rosa`);
  // schede di scouting da rivedere
  const mediaAl = (id: number, al: string | null) => {
    const t = d.tabellini.filter((x) => x.giocatore === id && (al == null || partite.get(x.partita)!.data <= al));
    return t.length ? t.reduce((a, x) => a + x.punti, 0) / t.length : null;
  };
  for (const s of d.scouting) {
    const motivi: string[] = [];
    if (giorniTra(s.scritta_il, oggi) > GIORNI_REVISIONE_SCHEDA) motivi.push(`scritta il ${s.scritta_il}`);
    const prima = mediaAl(s.giocatore, s.dati_al);
    const ora = mediaAl(s.giocatore, null);
    if (ora != null && (prima == null ? ora > 0 : Math.abs(ora - prima) > SOGLIA_MEDIA_SCHEDA * Math.max(prima, 1))) {
      motivi.push(`media punti passata da ${prima == null ? '—' : prima.toFixed(1)} a ${ora.toFixed(1)}`);
    }
    if (motivi.length) avvisi.push(`scheda di scouting da rivedere: giocatore ${s.giocatore} (${motivi.join('; ')})`);
  }

  return { errori, avvisi };
}
