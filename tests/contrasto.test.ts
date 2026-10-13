/** Contrasto WCAG 2.2 AA delle coppie testo/sfondo definite in src/styles/tokens.css, nei due temi. */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'styles', 'tokens.css'), 'utf8');
const [chiaroCss, scuroCss] = css.split('@media (prefers-color-scheme: dark)');
const leggi = (blocco: string) => Object.fromEntries([...blocco.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
const chiaro = leggi(chiaroCss!);
const temi = { chiaro, scuro: { ...chiaro, ...leggi(scuroCss!) } };

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
export const contrasto = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

// [testo, sfondo, minimo]: 4.5 per il testo normale, 3 per elementi grafici e bordi del focus
const COPPIE: [string, string, number][] = [];
for (const sfondo of ['sfondo', 'superficie', 'superficie-2']) {
  for (const t of ['inchiostro', 'testo', 'testo-2', 'accento-testo', 'vittoria', 'sconfitta', 'avviso', 'zona-playoff', 'zona-salvezza', 'zona-playout', 'zona-retrocessione']) {
    COPPIE.push([t, sfondo, 4.5]);
  }
  COPPIE.push(['focus', sfondo, 3], ['bordo-forte', sfondo, 3], ['grafico-asse', sfondo, 3], ['accento', sfondo, 3]);
}
COPPIE.push(
  ['testata-testo', 'testata-sfondo', 4.5],
  ['testata-testo-2', 'testata-sfondo', 4.5],
  ['accento', 'testata-sfondo', 3],
  ['avviso', 'avviso-sfondo', 4.5],
  ['testo', 'avviso-sfondo', 4.5],
);

describe.each(Object.entries(temi))('tema %s', (_, t) => {
  it.each(COPPIE)('%s su %s ≥ %d:1', (a, b, min) => {
    expect(t[a], `token --${a} mancante`).toBeDefined();
    expect(t[b], `token --${b} mancante`).toBeDefined();
    expect(contrasto(t[a]!, t[b]!)).toBeGreaterThanOrEqual(min);
  });
});
