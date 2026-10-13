/** Confronto dei campi ricalcolati in src/lib con quelli del legacy (sviluppo, fase 1). */
import fs from 'node:fs';
import path from 'node:path';
import { leggiDati, RADICE } from '../lib/file.ts';
import { costruisciDataset } from '../../src/lib/dataset.ts';

const L = (f: string) => JSON.parse(fs.readFileSync(path.join(RADICE, 'legacy', 'data', f), 'utf8'));
const ds = costruisciDataset(leggiDati());
const diff: Record<string, string[]> = {};
const segna = (campo: string, msg: string) => (diff[campo] ??= []).push(msg);
const n = (v: unknown) => (v === '' || v === undefined ? null : v);
for (const a of L('avversari.json')) {
  const p = ds.personaPerId.get(a.obj)!;
  const coppie: [string, unknown, unknown][] = [
    ['stato', n(a.stato), p.stato], ['provenienza', n(a.provenienza), p.provenienza],
    ['doppio', n(a.doppio_tesseramento), p.doppioTesseramento], ['ex', n(a.ex_nerviano), p.exNerviano],
    ['livello', n(a.livello), p.livello], ['rango', a.rango, p.rango], ['pts', a.pts, p.stagione.punti],
    ['partite', a.partite, p.stagione.partite], ['media', a.media, p.stagione.media], ['best', a.best, p.stagione.best],
    ['stagioni', a.stagioni, p.carriera.stagioni], ['pts_c', a.pts_carriera, p.carriera.punti], ['vsNerv', a.pts_vs_nerviano, p.ptsVsNerviano],
    ['sintesi', a.sintesi, p.sintesi], ['numero', a.numero || null, p.numero],
  ];
  for (const [c, x, y] of coppie) if (JSON.stringify(x) !== JSON.stringify(y)) segna(c, `${a.id}: legacy=${JSON.stringify(x)} nuovo=${JSON.stringify(y)}`);
}
for (const g of L('giocatori.json')) {
  const p = ds.persone.find((x) => x.squadra === 'nerviano' && x.numero === String(g.numero))!;
  const coppie: [string, unknown, unknown][] = [
    ['N.pts', g.pts, p.stagione.punti], ['N.partite', g.partite, p.stagione.partite], ['N.media', g.media, p.stagione.media], ['N.best', g.best, p.stagione.best],
    ['N.stagioni', g.stagioni, p.carriera.stagioni], ['N.pts_c', g.pts_carriera, p.carriera.punti], ['N.partite_c', g.partite_carriera, p.carriera.presenze],
    ['N.media_c', g.media_carriera, p.carriera.media], ['N.stato', g.stato, p.stato],
  ];
  for (const [c, x, y] of coppie) if (JSON.stringify(x) !== JSON.stringify(y)) segna(c, `${g.cognome}: legacy=${JSON.stringify(x)} nuovo=${JSON.stringify(y)}`);
}
for (const [c, l] of Object.entries(diff)) { console.log(`## ${c} (${l.length})`); for (const m of l.slice(0, 6)) console.log('  ', m); }
console.log('persone', ds.persone.length, 'diff campi', Object.keys(diff).length);
