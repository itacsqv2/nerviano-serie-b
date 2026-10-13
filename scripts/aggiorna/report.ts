/** Report in Markdown di un aggiornamento: stampato a terminale e salvato in .cache/report.md (§4.8). */
import fs from 'node:fs';
import path from 'node:path';
import type { Giocatore, Partita } from '../../src/schemas/index.ts';
import { CACHE } from '../lib/file.ts';

export interface Report {
  oggi: string;
  opzioni: string;
  prova: boolean;
  nuoviRisultati: Partita[];
  classifica: { posizione: number; squadra: string; punti: number; v: number; p: number; delta: number; noi: boolean }[];
  marcatori: { giocatore: Giocatore; squadra: string; punti: number; partita: string }[];
  entrati: { id: number; squadra: string; nome: string; da?: string }[];
  usciti: { id: number; squadra: string; nome: string }[];
  avvisi: string[];
  scouting: string[];
  errori?: string[];
  richieste: string;
  fileCambiati: string[];
}

const freccia = (d: number) => (d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : '=');

export function testoReport(r: Report): string {
  const out: string[] = [];
  out.push(`# Aggiornamento dati del ${r.oggi}`, '');
  out.push(`Modalità: \`${r.opzioni}\`${r.prova ? ' (prova: nessun file scritto)' : ''}. ${r.richieste}.`, '');
  if (r.errori?.length) {
    out.push('## ❌ Errori: nessun file è stato scritto', '', ...r.errori.map((e) => `- ${e}`), '');
  } else if (!r.prova) {
    out.push(r.fileCambiati.length ? `File aggiornati: ${r.fileCambiati.map((f) => `\`${f}\``).join(', ')}.` : 'Nessuna novità: nessun file è cambiato.', '');
  }
  if (r.nuoviRisultati.length) {
    out.push('## Nuovi risultati', '', '| G | Gara | Partita | Risultato | Stato |', '|---|---|---|---|---|');
    for (const p of r.nuoviRisultati) out.push(`| ${p.giornata} | ${p.id} | ${p.casa}–${p.ospite} | ${p.pt_casa}-${p.pt_ospite} | ${p.stato} |`);
    out.push('');
  }
  if (r.classifica.some((x) => x.delta !== 0) || r.nuoviRisultati.length) {
    out.push('## Classifica FIP', '', '| Pos | Squadra | Pt | V-P | Variazione |', '|---|---|---|---|---|');
    for (const c of r.classifica) {
      const nome = c.noi ? `**${c.squadra}**` : c.squadra;
      out.push(`| ${c.posizione} | ${nome} | ${c.punti} | ${c.v}-${c.p} | ${freccia(c.delta)} |`);
    }
    out.push('');
  }
  if (r.marcatori.length) {
    out.push('## Migliori marcatori dei tabellini letti', '');
    for (const m of r.marcatori) out.push(`- ${m.giocatore.nome} ${m.giocatore.cognome} (${m.squadra}): ${m.punti} punti, gara ${m.partita}`);
    out.push('');
  }
  if (r.entrati.length || r.usciti.length) {
    out.push('## Rose', '');
    for (const e of r.entrati) out.push(`- ➕ ${e.nome} (${e.id}) ${e.da ? `passa da ${e.da} a ${e.squadra}` : `entra nella rosa di ${e.squadra}`}`);
    for (const u of r.usciti) out.push(`- ➖ ${u.nome} (${u.id}) non è più nella rosa di ${u.squadra}`);
    out.push('');
  }
  if (r.avvisi.length) out.push('## Avvisi', '', ...r.avvisi.map((a) => `- ${a}`), '');
  if (r.scouting.length) out.push('## Schede di scouting da rivedere', '', ...r.scouting.map((a) => `- ${a.replace(/^scheda di scouting da rivedere: /, '')}`), '');
  return out.join('\n');
}

export function scriviReport(r: Report): void {
  const testo = testoReport(r);
  console.log(`\n${testo}`);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(path.join(CACHE, 'report.md'), `${testo}\n`);
}
