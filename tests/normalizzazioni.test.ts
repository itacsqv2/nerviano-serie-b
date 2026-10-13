import { describe, expect, it } from 'vitest';
import { gruppo, nomeCategoria } from '../src/lib/categorie.ts';
import { asciiSlug, normalizzaNome, pulisciNome, separaNome, slugGiocatore, stagioneDaPb, stagionePrecedente } from '../src/lib/nomi.ts';
import { dataBreve, dataDaItaliano, dataEstesa, f1, giorniTra, oggiRoma, segno } from '../src/lib/formato.ts';

describe('nomi', () => {
  it('separa cognome e nome con il titolo della pagina', () => {
    expect(separaNome('Di Franco Fabrizio', 'Fabrizio Di Franco')).toEqual(['Di Franco', 'Fabrizio']);
    expect(separaNome('Romagnoli Davide Francesco M.', 'Davide Francesco M. Romagnoli')).toEqual(['Romagnoli', 'Davide Francesco M.']);
    expect(separaNome('Martinoni Niccolò©', 'Niccolò Martinoni')).toEqual(['Martinoni', 'Niccolò']);
    expect(separaNome('Rossi Mario', 'Altro Titolo')).toEqual(['Rossi Mario', '']);
  });
  it('pulisce il nome come il legacy', () => {
    expect(pulisciNome('Martinoni Niccolò©', '')).toEqual(['Martinoni', 'Niccolò']);
    expect(pulisciNome('De Gregori', 'Luca')).toEqual(['De Gregori', 'Luca']);
  });
  it('converte le stagioni PlayBasket', () => {
    expect(stagioneDaPb('25/26')).toBe('2025/26');
    expect(stagioneDaPb('99/00')).toBe('1999/00');
    expect(stagionePrecedente('2026/27')).toBe('2025/26');
    expect(stagionePrecedente('2000/01')).toBe('1999/00');
  });
  it('crea slug ASCII', () => {
    expect(asciiSlug('Niccolò D’Amico')).toBe('niccolo-d-amico');
    expect(slugGiocatore({ id: 175210, cognome: 'Di Franco', nome: 'Fabrizio' })).toBe('di-franco-fabrizio-175210');
  });
  it('normalizza i nomi FIP', () => {
    expect(normalizzaNome('Novipiù  Monferrato’s')).toBe(normalizzaNome("NOVIPIÙ MONFERRATO'S"));
  });
});

describe('categorie', () => {
  it.each([
    ['Under 17 Eccellenza', 'Giovanili'],
    ['Divisione Nazionale Giovanile', 'Giovanili'],
    ['Finali Nazionali Under 17', 'Giovanili'],
    ['Lega Basket', 'Serie A'],
    ['A2 Gold', 'Serie A2'],
    ['Divisione Nazionale B', 'Serie B e B Nazionale'],
    ['B Interregionale', 'B Interregionale'],
    ['C Gold', 'Serie C e regionali'],
  ])('%s → %s', (c, g) => expect(gruppo(c)).toBe(g));
  it('mostra Lega Basket come Serie A', () => expect(nomeCategoria('Lega Basket')).toBe('Serie A'));
});

describe('date e numeri', () => {
  it('legge le date FIP in italiano', () => {
    expect(dataDaItaliano('10 Ottobre 2026')).toBe('2026-10-10');
    expect(dataDaItaliano('09 Gennaio 2027')).toBe('2027-01-09');
    expect(() => dataDaItaliano('31 Smarzo 2026')).toThrow();
  });
  it('formatta in italiano', () => {
    expect(dataEstesa('2026-10-12')).toBe('12 ottobre 2026');
    expect(dataBreve('2026-10-17')).toBe('sab 17 ott');
    expect(f1(13.5)).toBe('13,5');
    expect(f1(null)).toBe('—');
    expect(segno(-3)).toBe('−3');
  });
  it('calcola oggi in Europe/Rome anche da una macchina in UTC', () => {
    expect(oggiRoma(new Date('2026-10-12T22:30:00Z'))).toBe('2026-10-13');
    expect(giorniTra('2026-09-26', '2026-10-10')).toBe(14);
  });
});
