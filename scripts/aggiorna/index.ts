/**
 * npm run aggiorna — pipeline di aggiornamento da FIP e PlayBasket (§4).
 *
 *   npm run aggiorna                      aggiornamento incrementale
 *   npm run aggiorna -- --completo        rilegge tutta la stagione
 *   npm run aggiorna -- --solo fip        una sola fonte (fip | playbasket)
 *   npm run aggiorna -- --prova           fa tutto ma non scrive i file
 *   npm run aggiorna -- --offline         usa solo la cache in .cache/http
 *   npm run aggiorna -- --proponi-config  propone nomi e colori delle squadre in .cache/squadre-proposta.json
 *
 * Scrive SOLO in data/auto/. Valida tutto in memoria prima di scrivere: se qualcosa non va non scrive nulla.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CACHE, leggiDati, scriviTutti } from '../lib/file.ts';
import { ordinaCarriere, ordinaGiocatori, ordinaPartite, ordinaRose, ordinaTabellini } from '../lib/ordina.ts';
import { validaDati, type Carriere, type DatiGrezzi, type Giocatore, type Partita, type Rosa, type Squadra, type Tabellino } from '../../src/schemas/index.ts';
import { controlla } from '../../src/lib/controlli.ts';
import { giorniTra, oggiRoma } from '../../src/lib/formato.ts';
import { distanza, normalizzaNome } from '../../src/lib/nomi.ts';
import { GIORNI_ATTESA_TABELLINO, migliore, statoTabellino } from '../../src/lib/tabellini.ts';
import { urlFipGiornata, urlPbGiocatore, urlPbLega, urlPbPartita, urlPbRosa } from '../../src/lib/fonti.ts';
import { ClientHttp, ErroreFonte, userAgentDa } from './http.ts';
import { leggiClassifica, leggiPartite, type PartitaFip, type RigaClassificaFip } from './fip.ts';
import { leggiCalendario, leggiCarriera, leggiRosa, leggiTabellino, nomeGiocatore, type PartitaPb } from './pb.ts';
import { scriviReport, type Report } from './report.ts';
import { proponiColori } from './colori.ts';

// ---------------------------------------------------------------- opzioni
const argv = process.argv.slice(2);
const opz = {
  completo: argv.includes('--completo'),
  prova: argv.includes('--prova'),
  offline: argv.includes('--offline'),
  proponi: argv.includes('--proponi-config'),
  solo: (() => {
    const i = argv.indexOf('--solo');
    const v = i >= 0 ? argv[i + 1] : undefined;
    if (i >= 0 && v !== 'fip' && v !== 'playbasket') throw new Error('--solo vuole «fip» oppure «playbasket»');
    return v as 'fip' | 'playbasket' | undefined;
  })(),
};

const log = (m: string) => console.log(m);

async function main(): Promise<number> {
  const prima = leggiDati();
  const { stagione: S, squadre, sito } = prima;
  const oggi = oggiRoma();
  const usaFip = opz.solo !== 'playbasket';
  const usaPb = opz.solo !== 'fip' && sito.fonti.playbasket;
  if (opz.solo === 'playbasket' && !sito.fonti.playbasket) throw new ErroreFonte('fonti.playbasket è spento in data/config/sito.json: PlayBasket non si legge.');

  const http = new ClientHttp({ userAgent: userAgentDa(sito), cartellaCache: path.join(CACHE, 'http'), offline: opz.offline });
  const report: Report = { oggi, opzioni: argv.join(' ') || 'incrementale', nuoviRisultati: [], classifica: [], marcatori: [], entrati: [], usciti: [], avvisi: [], scouting: [], richieste: '', fileCambiati: [], prova: opz.prova };
  const avviso = (m: string) => report.avvisi.push(m);
  const perSlug = new Map(squadre.map((s) => [s.slug, s]));
  const perObj = new Map(squadre.map((s) => [s.pb_obj, s]));
  const perCodice = new Map(squadre.map((s) => [s.codice_fip, s]));

  // copie di lavoro dei dati automatici
  let partite: Partita[] = structuredClone(prima.partite);
  let classificaFip = structuredClone(prima.classifica_fip);
  const giocatori = new Map<number, Giocatore>(prima.giocatori.map((g) => [g.id, structuredClone(g)]));
  let rose: Rosa[] = structuredClone(prima.rose);
  let tabellini: Tabellino[] = structuredClone(prima.tabellini);
  const carriere: Carriere = structuredClone(prima.carriere);
  const lette = { fip: false, playbasket: false };

  // ---------------------------------------------------------------- FIP
  const nomiFip = new Map<string, string>(); // nome FIP normalizzato → slug
  for (const s of squadre) if (s.nome_fip) nomiFip.set(normalizzaNome(s.nome_fip), s.slug);
  const slugFip = (nome: string): string => {
    const s = nomiFip.get(normalizzaNome(nome));
    if (s) return s;
    const vicina = [...squadre].sort((a, b) => distanza(normalizzaNome(nome), normalizzaNome(a.nome_fip ?? a.nome)) - distanza(normalizzaNome(nome), normalizzaNome(b.nome_fip ?? b.nome)))[0]!;
    throw new ErroreFonte(`FIP: squadra sconosciuta «${nome}». La più simile è «${vicina.slug}»: aggiungi il nome esatto in data/config/squadre.json (nome_fip) oppure lancia --proponi-config.`);
  };
  let classificaLetta: RigaClassificaFip[] = [];

  if (usaFip || opz.proponi) {
    const perFase = S.turni_per_fase;
    const giornate = (() => {
      // per la proposta basta una giornata: la classifica in fondo alla pagina ha tutte le squadre
      if (opz.proponi) return [1];
      if (opz.completo) return range(1, S.giornate);
      const iniziate = range(1, S.giornate).filter((g) => partite.some((p) => p.giornata === g && p.data <= oggi));
      const conPendenti = iniziate.filter((g) => partite.some((p) => p.giornata === g && p.stato !== 'omologata'));
      const ultima = Math.max(0, ...iniziate);
      return [...new Set([...conPendenti, ultima + 1, ultima + 2])].filter((g) => g >= 1 && g <= S.giornate).sort((a, b) => a - b);
    })();
    log(`FIP: giornate ${giornate.join(', ')}`);
    const lettePerGiornata = new Map<number, PartitaFip[]>();
    for (const g of giornate) {
      const andata = g <= perFase;
      const html = await http.testo(urlFipGiornata(S, andata ? 1 : 0, andata ? g : g - perFase));
      const pp = leggiPartite(html);
      if (pp.length !== S.partite_per_giornata) throw new ErroreFonte(`FIP: la giornata ${g} ha ${pp.length} partite invece di ${S.partite_per_giornata}`);
      if (!classificaLetta.length) {
        classificaLetta = leggiClassifica(html);
        // la classifica collega i nomi FIP alle squadre tramite il codice FIP, anche se nome_fip non è ancora in config
        for (const r of classificaLetta) {
          const s = r.codice_fip ? perCodice.get(r.codice_fip) : undefined;
          if (!s) continue;
          if (!nomiFip.has(normalizzaNome(r.nome))) nomiFip.set(normalizzaNome(r.nome), s.slug);
          if (s.nome_fip && normalizzaNome(s.nome_fip) !== normalizzaNome(r.nome)) avviso(`config: ${s.slug} su FIP ora si chiama «${r.nome}» (in squadre.json: «${s.nome_fip}»)`);
          if (!s.nome_fip && !opz.proponi) avviso(`config: manca nome_fip per ${s.slug} («${r.nome}»): lancia --proponi-config`);
          if (s.maglia_fip && r.maglia && s.maglia_fip !== r.maglia) avviso(`config: maglia di ${s.slug} cambiata su FIP: «${r.maglia}»`);
        }
      }
      lettePerGiornata.set(g, pp);
    }
    if (!opz.proponi) {
      for (const [g, pp] of lettePerGiornata) {
        for (const f of pp) {
          const casa = slugFip(f.casa);
          const ospite = slugFip(f.ospite);
          const i = partite.findIndex((p) => p.id === f.id);
          const vecchia = i >= 0 ? partite[i] : undefined;
          if (vecchia && (vecchia.giornata !== g || vecchia.casa !== casa || vecchia.ospite !== ospite)) {
            throw new ErroreFonte(`FIP: la gara ${f.id} risulta ${casa}–${ospite} in giornata ${g}, ma nei dati è ${vecchia.casa}–${vecchia.ospite} in giornata ${vecchia.giornata}`);
          }
          // gli stati sconosciuti li segnala controlla() (una volta sola)
          const nuova: Partita = {
            id: f.id,
            giornata: g,
            fase: g <= perFase ? 'andata' : 'ritorno',
            turno: g <= perFase ? g : g - perFase,
            data: f.data,
            ora: f.ora,
            casa,
            ospite,
            pt_casa: f.pt_casa,
            pt_ospite: f.pt_ospite,
            stato: f.stato as Partita['stato'],
            palestra: f.palestra ?? vecchia?.palestra ?? null,
            citta: f.citta ?? vecchia?.citta ?? null,
            pb: vecchia?.pb ?? null,
            tabellino: vecchia?.tabellino ?? null,
          };
          if (f.pt_casa != null && vecchia?.pt_casa == null) report.nuoviRisultati.push(nuova);
          if (vecchia && f.pt_casa != null && vecchia.pt_casa != null && (vecchia.pt_casa !== f.pt_casa || vecchia.pt_ospite !== f.pt_ospite)) {
            avviso(`FIP: il risultato della gara ${f.id} è cambiato da ${vecchia.pt_casa}-${vecchia.pt_ospite} a ${f.pt_casa}-${f.pt_ospite}`);
          }
          if (i >= 0) partite[i] = nuova;
          else partite.push(nuova);
        }
      }
      if (classificaLetta.length) {
        classificaFip = classificaLetta.map((r) => ({
          posizione: r.posizione,
          squadra: r.codice_fip && perCodice.get(r.codice_fip) ? perCodice.get(r.codice_fip)!.slug : slugFip(r.nome),
          punti: r.punti, g: r.g, v: r.v, p: r.p, pf: r.pf, ps: r.ps,
        }));
      }
      lette.fip = true;
    }
  }

  // ---------------------------------------------------------------- PlayBasket
  const nomiPbVisti = new Map<string, Set<string>>(); // slug → nomi visti su PlayBasket
  const vedi = (slug: string, nome: string) => {
    if (!nome) return;
    const set = nomiPbVisti.get(slug) ?? new Set();
    set.add(nome);
    nomiPbVisti.set(slug, set);
  };
  if (usaPb || opz.proponi) {
    const cal = leggiCalendario(await http.testo(urlPbLega(S, 'cl')));
    if (cal.length !== S.giornate * S.partite_per_giornata) throw new ErroreFonte(`PlayBasket: il calendario ha ${cal.length} partite invece di ${S.giornate * S.partite_per_giornata}`);
    const slugPb = (obj: number | null, nome: string): string => {
      const s = (obj != null ? perObj.get(obj) : undefined) ?? squadre.find((x) => x.nomi_pb?.includes(nome));
      if (!s) throw new ErroreFonte(`PlayBasket: squadra sconosciuta «${nome}» (obj ${obj ?? '?'}). Controlla pb_obj e nomi_pb in data/config/squadre.json.`);
      return s.slug;
    };
    for (const c of cal) {
      vedi(slugPb(c.obj_casa, c.casa), c.casa);
      vedi(slugPb(c.obj_ospite, c.ospite), c.ospite);
    }
    if (!opz.proponi) {
      // collega ogni partita PlayBasket alla gara FIP: stessa giornata, stessa coppia casa/ospite
      const daLeggere: { p: Partita; c: PartitaPb }[] = [];
      for (const c of cal) {
        const g = c.gtt === 1 ? c.gtn : c.gtn + S.turni_per_fase;
        const casa = slugPb(c.obj_casa, c.casa);
        const ospite = slugPb(c.obj_ospite, c.ospite);
        const p = partite.find((x) => x.giornata === g && x.casa === casa && x.ospite === ospite);
        if (!p) throw new ErroreFonte(`PlayBasket: la partita ${casa}–${ospite} (giornata ${g}) non esiste nel calendario FIP`);
        p.pb = { gtn: c.gtn, gtt: c.gtt, mn: c.mn };
        const [gg, mm] = c.data.split('/');
        if (gg && mm && p.data.slice(5) !== `${mm}-${gg}`) avviso(`date diverse per la gara ${p.id} (${casa}–${ospite}): FIP ${p.data}, PlayBasket ${c.data}`);
        const giocata = p.pt_casa != null && p.pt_ospite != null;
        if (!giocata) continue;
        const recente = giorniTra(p.data, oggi) < GIORNI_ATTESA_TABELLINO;
        if (opz.completo ? c.tabellino || p.tabellino !== 'completo' : recente && p.tabellino !== 'completo' && c.tabellino) daLeggere.push({ p, c });
        else if (!c.tabellino && p.tabellino !== 'completo' && p.tabellino !== 'incongruente' && p.tabellino !== 'parziale') {
          p.tabellino = statoTabellino(p, new Set(), new Map(), oggi);
        }
      }
      log(`PlayBasket: ${daLeggere.length} tabellini da leggere`);
      const giocatoriTabellini = new Set<number>();
      for (const { p, c } of daLeggere) {
        const t = leggiTabellino(await http.testo(urlPbPartita(S, c)));
        const squadreConTabella = new Set<string>();
        const righe: Tabellino[] = [];
        t.squadre.forEach((tab, i) => {
          const slug = i === 0 ? p.casa : p.ospite;
          const atteso = perSlug.get(slug)!;
          const obj = tab.righe.find((r) => r.squadra_obj != null)?.squadra_obj;
          if (obj != null && obj !== atteso.pb_obj) throw new ErroreFonte(`PlayBasket: nel tabellino della gara ${p.id} la squadra ${i === 0 ? 'di casa' : 'ospite'} non è ${slug}`);
          vedi(slug, tab.nome);
          squadreConTabella.add(slug);
          for (const r of tab.righe) {
            righe.push({ partita: p.id, giocatore: r.giocatore, squadra: slug, punti: r.punti });
            giocatoriTabellini.add(r.giocatore);
            if (!giocatori.has(r.giocatore)) {
              const n = nomeGiocatore(r.nome_rosa, null);
              giocatori.set(r.giocatore, { id: r.giocatore, ...n, ruolo: r.ruolo as Giocatore['ruolo'], eta: r.eta, eta_fascia: null, allenatore: false });
            }
          }
        });
        if (t.titolo_pt && p.pt_casa != null && (t.titolo_pt[0] !== p.pt_casa || t.titolo_pt[1] !== p.pt_ospite)) {
          avviso(`gara ${p.id}: PlayBasket indica ${t.titolo_pt.join('-')}, FIP ${p.pt_casa}-${p.pt_ospite}`);
        }
        const punti = new Map<string, number>();
        for (const r of righe) punti.set(r.squadra, (punti.get(r.squadra) ?? 0) + r.punti);
        const nuovo = statoTabellino(p, squadreConTabella, punti, oggi);
        const tenuto = migliore(p.tabellino, nuovo);
        // un tabellino trovato non si cancella e non si declassa mai
        if (tenuto === nuovo && righe.length) {
          tabellini = tabellini.filter((x) => x.partita !== p.id).concat(righe);
        }
        p.tabellino = tenuto;
      }
      // marcatori dei nuovi tabellini, per il report
      const idNuove = new Set(daLeggere.map((x) => x.p.id));
      report.marcatori = tabellini.filter((x) => idNuove.has(x.partita)).sort((a, b) => b.punti - a.punti).slice(0, 10)
        .map((x) => ({ giocatore: giocatori.get(x.giocatore)!, squadra: x.squadra, punti: x.punti, partita: x.partita }));

      // rose delle 15 squadre
      const vecchieRose = new Map(rose.filter((r) => r.in_rosa).map((r) => [r.giocatore, r]));
      const nuoveRose: Rosa[] = [];
      const nuoviGiocatori = new Set<number>();
      for (const s of squadre) {
        const r = leggiRosa(await http.testo(urlPbRosa(S, s.pb_obj)));
        if (r.giocatori.length < 5) throw new ErroreFonte(`PlayBasket: la rosa di ${s.slug} ha solo ${r.giocatori.length} giocatori (struttura della pagina cambiata?)`);
        vedi(s.slug, r.nome);
        for (const g of r.giocatori) {
          nuoveRose.push({ giocatore: g.giocatore, squadra: s.slug, numero: g.numero, punti: g.punti, media: g.media, in_rosa: true });
          const esistente = giocatori.get(g.giocatore);
          if (!esistente) nuoviGiocatori.add(g.giocatore);
          giocatori.set(g.giocatore, {
            id: g.giocatore,
            ...(esistente ? { cognome: esistente.cognome, nome: esistente.nome } : nomeGiocatore(g.nome_rosa, null)),
            ruolo: (g.ruolo ?? esistente?.ruolo ?? null) as Giocatore['ruolo'],
            eta: g.eta ?? (g.eta_fascia ? null : esistente?.eta ?? null),
            eta_fascia: g.eta_fascia,
            allenatore: false,
          });
          const prima = vecchieRose.get(g.giocatore);
          if (!prima) report.entrati.push({ id: g.giocatore, squadra: s.slug, nome: g.nome_rosa });
          else if (prima.squadra !== s.slug) report.entrati.push({ id: g.giocatore, squadra: s.slug, nome: g.nome_rosa, da: prima.squadra });
        }
        for (const a of r.allenatori) {
          nuoveRose.push({ giocatore: a.giocatore, squadra: s.slug, numero: null, punti: null, media: null, in_rosa: true });
          const esistente = giocatori.get(a.giocatore);
          giocatori.set(a.giocatore, { id: a.giocatore, ...(esistente ? { cognome: esistente.cognome, nome: esistente.nome } : nomeGiocatore(a.nome_rosa, null)), ruolo: null, eta: null, eta_fascia: null, allenatore: true });
        }
      }
      // chi non è più in rosa resta, con in_rosa: false (compare nei tabellini o nei dati scritti a mano)
      const inRosa = new Set(nuoveRose.map((r) => r.giocatore));
      for (const [id, r] of vecchieRose) {
        if (inRosa.has(id)) continue;
        nuoveRose.push({ giocatore: id, squadra: r.squadra, numero: null, punti: null, media: null, in_rosa: false });
        const g = giocatori.get(id);
        report.usciti.push({ id, squadra: r.squadra, nome: g ? `${g.cognome} ${g.nome}` : String(id) });
      }
      for (const r of rose) if (!r.in_rosa && !inRosa.has(r.giocatore) && !nuoveRose.some((x) => x.giocatore === r.giocatore)) nuoveRose.push(r);
      rose = nuoveRose;
      // chi compare solo in un tabellino (mai in una rosa letta) ha comunque una riga, con in_rosa: false
      for (const g of giocatori.values()) {
        if (rose.some((r) => r.giocatore === g.id)) continue;
        const ultimo = tabellini.filter((t) => t.giocatore === g.id).sort((a, b) => b.partita.localeCompare(a.partita))[0];
        if (ultimo) rose.push({ giocatore: g.id, squadra: ultimo.squadra, numero: null, punti: null, media: null, in_rosa: false });
      }

      // carriere: tutte con --completo, altrimenti dei nuovi e di chi ha giocato nelle partite appena lette
      const allenatori = new Set([...giocatori.values()].filter((g) => g.allenatore).map((g) => g.id));
      const daCarriera = [...inRosa].filter((id) => !allenatori.has(id) && (opz.completo || nuoviGiocatori.has(id) || giocatoriTabellini.has(id)));
      log(`PlayBasket: ${daCarriera.length} carriere da leggere`);
      const categorieNote = new Set(carriere.righe.map((r) => r.categoria));
      for (const id of daCarriera) {
        const rosa = rose.find((r) => r.giocatore === id && r.in_rosa)!;
        const c = leggiCarriera(await http.testo(urlPbGiocatore(S, id, perSlug.get(rosa.squadra)!.pb_obj, true)));
        const g = giocatori.get(id)!;
        if (c.titolo_nome) {
          const vecchioNome = `${g.cognome} ${g.nome}`;
          const n = nomeGiocatore(`${g.cognome} ${g.nome}`.trim(), c.titolo_nome);
          if (n.nome) Object.assign(g, n);
          if (`${g.cognome} ${g.nome}` !== vecchioNome && !nuoviGiocatori.has(id)) avviso(`giocatore ${id}: nome cambiato da «${vecchioNome}» a «${g.cognome} ${g.nome}»`);
        }
        if (!c.righe.length && carriere.righe.some((r) => r.giocatore === id)) {
          avviso(`giocatore ${id}: la pagina carriera non ha la tabella con i punti, tengo i dati precedenti`);
          continue;
        }
        for (const r of c.righe) if (!categorieNote.has(r.categoria)) { avviso(`categoria nuova su PlayBasket: «${r.categoria}» (giocatore ${id})`); categorieNote.add(r.categoria); }
        carriere.righe = carriere.righe.filter((r) => r.giocatore !== id).concat(c.righe.map((r) => ({ giocatore: id, ...r })));
        carriere.riepiloghi = carriere.riepiloghi.filter((r) => r.giocatore !== id).concat([{ giocatore: id, ...c.riepilogo }]);
      }
      // giocatori nuovi senza carriera letta (per esempio allenatori): il nome resta quello della rosa
      lette.playbasket = true;
    }
  }

  // ---------------------------------------------------------------- proposta di configurazione iniziale
  if (opz.proponi) {
    const proposta = squadre.map((s) => {
      const r = classificaLetta.find((x) => x.codice_fip === s.codice_fip);
      return {
        slug: s.slug,
        nome_fip: r?.nome ?? null,
        maglia_fip: r?.maglia ?? null,
        campo_fip: r?.campo ?? null,
        colori: proponiColori(r?.maglia ?? null),
        nomi_pb: [...(nomiPbVisti.get(s.slug) ?? [])].sort(),
      };
    });
    const f = path.join(CACHE, 'squadre-proposta.json');
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(f, `${JSON.stringify(proposta, null, 2)}\n`);
    log(`Proposta scritta in ${path.relative(process.cwd(), f)}: controllala e copia i valori in data/config/squadre.json.`);
    log(http.riepilogo());
    return 0;
  }

  // nomi PlayBasket mai visti in config: solo un avviso, il collegamento usa gli obj
  for (const [slug, nomi] of nomiPbVisti) {
    const s = perSlug.get(slug)!;
    for (const n of nomi) if (!s.nomi_pb?.includes(n)) avviso(`config: nome PlayBasket nuovo per ${slug}: «${n}» (aggiungilo a nomi_pb)`);
  }

  // ---------------------------------------------------------------- validazione in memoria e scrittura
  partite = ordinaPartite(partite);
  const nuoviDati: DatiGrezzi = {
    ...prima,
    partite,
    classifica_fip: classificaFip.sort((a, b) => a.posizione - b.posizione),
    giocatori: ordinaGiocatori([...giocatori.values()]),
    rose: ordinaRose(rose),
    tabellini: ordinaTabellini(tabellini),
    carriere: ordinaCarriere(carriere),
  };
  const conteggi = {
    partite: nuoviDati.partite.length, classifica_fip: nuoviDati.classifica_fip.length, giocatori: nuoviDati.giocatori.length,
    rose: nuoviDati.rose.length, tabellini: nuoviDati.tabellini.length, carriere: nuoviDati.carriere.righe.length,
  };
  const cambia = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
  const cambiataFip = cambia(prima.partite.map(soloFip), nuoviDati.partite.map(soloFip)) || cambia(prima.classifica_fip, nuoviDati.classifica_fip);
  const cambiataPb = cambia(prima.rose, nuoviDati.rose) || cambia(prima.tabellini, nuoviDati.tabellini) || cambia(prima.carriere, nuoviDati.carriere)
    || cambia(prima.giocatori, nuoviDati.giocatori) || cambia(prima.partite.map(soloPb), nuoviDati.partite.map(soloPb));
  nuoviDati.meta = {
    fonti: {
      fip: { aggiornato: lette.fip && cambiataFip ? oggi : prima.meta.fonti.fip.aggiornato },
      playbasket: { aggiornato: lette.playbasket && cambiataPb ? oggi : prima.meta.fonti.playbasket.aggiornato },
    },
    conteggi,
  };
  validaDati(Object.fromEntries(Object.entries({
    'config/stagione.json': nuoviDati.stagione, 'config/squadre.json': nuoviDati.squadre, 'config/sito.json': nuoviDati.sito,
    'auto/partite.json': nuoviDati.partite, 'auto/classifica_fip.json': nuoviDati.classifica_fip, 'auto/giocatori.json': nuoviDati.giocatori,
    'auto/rose.json': nuoviDati.rose, 'auto/tabellini.json': nuoviDati.tabellini, 'auto/carriere.json': nuoviDati.carriere, 'auto/meta.json': nuoviDati.meta,
    'manuale/scouting.json': nuoviDati.scouting, 'manuale/note_squadre.json': nuoviDati.note_squadre, 'manuale/giocatori_extra.json': nuoviDati.giocatori_extra,
    'manuale/storia.json': nuoviDati.storia, 'manuale/guida.json': nuoviDati.guida, 'manuale/correzioni.json': nuoviDati.correzioni, 'manuale/foto.json': nuoviDati.foto,
  })) as never);
  const esito = controlla(nuoviDati, oggi);
  report.avvisi = [...new Set([...report.avvisi, ...esito.avvisi.filter((a) => !a.startsWith('scheda di scouting'))])];
  report.scouting = esito.avvisi.filter((a) => a.startsWith('scheda di scouting'));
  report.classifica = variazioniClassifica(prima.classifica_fip, nuoviDati.classifica_fip, prima.stagione.squadra_riferimento, perSlug);
  report.richieste = http.riepilogo();
  if (esito.errori.length) {
    report.errori = esito.errori;
    scriviReport(report);
    console.error(`\n${esito.errori.length} errori: nessun file è stato scritto.`);
    return 1;
  }
  if (!opz.prova) {
    report.fileCambiati = scriviTutti({
      'auto/partite.json': nuoviDati.partite,
      'auto/classifica_fip.json': nuoviDati.classifica_fip,
      'auto/giocatori.json': nuoviDati.giocatori,
      'auto/rose.json': nuoviDati.rose,
      'auto/tabellini.json': nuoviDati.tabellini,
      'auto/carriere.json': nuoviDati.carriere,
      'auto/meta.json': nuoviDati.meta,
    });
  }
  scriviReport(report);
  return 0;
}

const soloFip = (p: Partita) => [p.id, p.data, p.ora, p.pt_casa, p.pt_ospite, p.stato, p.palestra, p.citta];
const soloPb = (p: Partita) => [p.id, p.pb, p.tabellino];
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

function variazioniClassifica(prima: DatiGrezzi['classifica_fip'], dopo: DatiGrezzi['classifica_fip'], rif: string, sq: Map<string, Squadra>) {
  return dopo.map((r) => {
    const p = prima.find((x) => x.squadra === r.squadra);
    return { posizione: r.posizione, squadra: sq.get(r.squadra)!.breve, punti: r.punti, v: r.v, p: r.p, delta: p ? p.posizione - r.posizione : 0, noi: r.squadra === rif };
  });
}

main()
  .then((c) => process.exit(c))
  .catch((e: unknown) => {
    const msg = e instanceof ErroreFonte || e instanceof Error ? e.message : String(e);
    console.error(`\nERRORE: ${msg}\nNessun file è stato scritto.`);
    try {
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(path.join(CACHE, 'report.md'), `# Aggiornamento dati: errore\n\n${msg}\n\nNessun file è stato scritto.\n`);
    } catch { /* il report è un di più */ }
    process.exit(1);
  });
