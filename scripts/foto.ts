/**
 * npm run foto — prepara le foto dei giocatori (§5.1).
 *
 * Per ogni voce di data/manuale/foto.json prende l'originale da foto/da-elaborare/<id>.<estensione>,
 * lo orienta secondo l'EXIF, lo ritaglia in 4:5 sul soggetto, lo riduce a 640×800 al massimo
 * e lo salva in src/assets/giocatori/<id>.webp SENZA metadati (spariscono GPS ed EXIF).
 * Non scarica nulla da internet: le foto arrivano solo da chi ha il permesso di usarle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { leggiDati, RADICE } from './lib/file.ts';
import { elabora } from './lib/foto.ts';

const ORIGINALI = path.join(RADICE, 'foto', 'da-elaborare');
const DESTINAZIONE = path.join(RADICE, 'src', 'assets', 'giocatori');
const ESTENSIONI = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff'];

async function main(): Promise<number> {
  const d = leggiDati();
  const eta = new Map(d.giocatori.map((g) => [g.id, g.eta]));
  fs.mkdirSync(DESTINAZIONE, { recursive: true });
  const originali = fs.existsSync(ORIGINALI) ? fs.readdirSync(ORIGINALI) : [];
  const errori: string[] = [];
  let fatte = 0;

  for (const f of d.foto) {
    if (f.nascosta) continue;
    if (!eta.has(f.giocatore)) { errori.push(`${f.giocatore}: giocatore inesistente`); continue; }
    const e = eta.get(f.giocatore);
    if ((f.minorenne || e == null || e < 18) && f.consenso_genitori !== true) {
      errori.push(`${f.giocatore}: è (o può essere) minorenne e manca consenso_genitori: true`);
      continue;
    }
    const originale = originali.find((x) => path.parse(x).name === String(f.giocatore) && ESTENSIONI.includes(path.extname(x).toLowerCase()));
    const dest = path.join(DESTINAZIONE, f.file);
    if (!originale) {
      if (!fs.existsSync(dest)) errori.push(`${f.giocatore}: manca l'originale in foto/da-elaborare/ (${f.giocatore}.jpg o simile)`);
      continue;
    }
    await elabora(path.join(ORIGINALI, originale), dest);
    fatte++;
    console.log(`✓ ${originale} → src/assets/giocatori/${f.file}`);
  }
  // foto elaborate senza voce nel manifest
  for (const f of fs.readdirSync(DESTINAZIONE)) {
    if (f.endsWith('.webp') && !d.foto.some((x) => x.file === f)) errori.push(`src/assets/giocatori/${f} non ha una voce in data/manuale/foto.json: cancellala o aggiungi la voce`);
  }
  for (const e of errori) console.error(`ERRORE: ${e}`);
  console.log(`${fatte} foto elaborate.`);
  return errori.length ? 1 : 0;
}

main().then((c) => process.exit(c), (e: unknown) => {
  console.error(`ERRORE: ${(e as Error).message}`);
  process.exit(1);
});
