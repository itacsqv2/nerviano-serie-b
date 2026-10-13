/** npm run valida: schemi zod, controlli di coerenza (§4.7) e controlli sulle foto (§5.1). */
import fs from 'node:fs';
import path from 'node:path';
import { leggiDati, RADICE } from './lib/file.ts';
import { controlla } from '../src/lib/controlli.ts';
import { oggiRoma } from '../src/lib/formato.ts';

const CARTELLA_FOTO = path.join(RADICE, 'src', 'assets', 'giocatori');

function main(): number {
  let dati;
  try {
    dati = leggiDati();
  } catch (e) {
    console.error((e as Error).message);
    return 1;
  }
  const { errori, avvisi } = controlla(dati, oggiRoma());
  // ogni foto elaborata deve avere la sua voce nel manifest, e ogni voce non nascosta il suo file
  const fileFoto = fs.existsSync(CARTELLA_FOTO) ? fs.readdirSync(CARTELLA_FOTO).filter((f) => !f.startsWith('.')) : [];
  const voci = new Set(dati.foto.map((f) => f.file));
  for (const f of fileFoto) if (!voci.has(f)) errori.push(`foto ${f} senza voce in data/manuale/foto.json`);
  for (const f of dati.foto) if (!f.nascosta && !fileFoto.includes(f.file)) errori.push(`foto.json: manca il file src/assets/giocatori/${f.file} (lancia npm run foto)`);

  for (const a of avvisi) console.log(`avviso: ${a}`);
  if (errori.length) {
    for (const e of errori) console.error(`ERRORE: ${e}`);
    console.error(`\n${errori.length} errori: i dati non sono validi.`);
    return 1;
  }
  console.log(`OK: tutti i controlli superati (${avvisi.length} avvisi).`);
  return 0;
}

process.exit(main());
