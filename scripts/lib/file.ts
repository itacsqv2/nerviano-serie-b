/** Lettura e scrittura dei JSON in data/, con formato stabile (2 spazi, newline finale) e scrittura atomica. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILE_DATI, validaDati, type DatiGrezzi } from '../../src/schemas/index.ts';

export const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATI = path.join(RADICE, 'data');
export const CACHE = path.join(RADICE, '.cache');

export const formatta = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

export function leggiJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function leggiDati(): DatiGrezzi {
  const grezzi = Object.fromEntries(
    Object.keys(FILE_DATI).map((f) => [f, leggiJson(path.join(DATI, ...f.split('/')))]),
  );
  return validaDati(grezzi as never);
}

/**
 * Scrive più file insieme: prima tutti i temporanei, poi i rename.
 * Un file viene riscritto solo se il contenuto cambia. Restituisce i file cambiati.
 */
export function scriviTutti(files: Record<string, unknown>): string[] {
  const daScrivere: [string, string][] = [];
  for (const [rel, valore] of Object.entries(files)) {
    const dest = path.join(DATI, ...rel.split('/'));
    const testo = formatta(valore);
    const prima = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
    if (prima !== testo) daScrivere.push([dest, testo]);
  }
  const tmp = daScrivere.map(([dest, testo]) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const t = `${dest}.tmp-${process.pid}`;
    fs.writeFileSync(t, testo, 'utf8');
    return [t, dest] as const;
  });
  for (const [t, dest] of tmp) fs.renameSync(t, dest);
  return daScrivere.map(([dest]) => path.relative(DATI, dest).split(path.sep).join('/'));
}
