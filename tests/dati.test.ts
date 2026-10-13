import { describe, expect, it } from 'vitest';
import { leggiDati } from '../scripts/lib/file.ts';
import { controlla } from '../src/lib/controlli.ts';
import { costruisciDataset } from '../src/lib/dataset.ts';

describe('dati del repository', () => {
  const d = leggiDati();
  it('superano tutti i controlli bloccanti', () => {
    expect(controlla(d, '2026-10-13').errori).toEqual([]);
  });
  it('costruiscono il dataset del sito', () => {
    const ds = costruisciDataset(d);
    expect(ds.calendarioRif).toHaveLength(d.stagione.giornate);
    expect(new Set(ds.persone.map((p) => p.slug)).size).toBe(ds.persone.length);
  });
  it('tolgono da tutto il sito un giocatore nascosto', () => {
    const id = d.tabellini[0]!.giocatore;
    const ds = costruisciDataset({ ...d, correzioni: { ...d.correzioni, giocatori: [{ giocatore: id, nascosto: true, motivo: 'test' }] } });
    expect(ds.personaPerId.has(id)).toBe(false);
    expect(ds.tabellini.some((t) => t.giocatore === id)).toBe(false);
  });
});
