import { describe, expect, it } from 'vitest';
import { calcolaClassifica, differenzeClassifica } from '../src/lib/classifica.ts';
import { statoTabellino, migliore } from '../src/lib/tabellini.ts';
import { arricchisciRiga, exNerviano, livello, sintesi, statoEProvenienza } from '../src/lib/giocatori.ts';

const P = (
  id: string, giornata: number, casa: string, ospite: string, pc: number | null, po: number | null,
  stato: 'omologata' | 'ufficioso' | 'da_giocare' = 'omologata', escludi = false,
) => ({ id, giornata, casa, ospite, pt_casa: pc, pt_ospite: po, stato, escludi_medie: escludi });

describe('classifica', () => {
  const partite = [
    P('1', 1, 'a', 'b', 80, 70),
    P('2', 1, 'c', 'd', 0, 20, 'omologata', true),
    P('3', 2, 'b', 'a', 75, 60),
    P('4', 2, 'd', 'c', 70, 71, 'ufficioso'),
    P('5', 3, 'a', 'c', null, null, 'da_giocare'),
  ];
  it('conta solo gli stati richiesti e risolve la parità con gli scontri diretti', () => {
    const c = calcolaClassifica(partite, ['a', 'b', 'c', 'd'], { stati: ['omologata'] });
    // a, b e d a 2 punti: negli scontri diretti a e b hanno una vittoria a testa (b +5), d nessuna
    expect(c.map((r) => r.squadra)).toEqual(['b', 'a', 'd', 'c']);
  });
  it('esclude dalle medie le gare a tavolino', () => {
    const d = calcolaClassifica(partite, ['a', 'b', 'c', 'd'], { stati: ['omologata'] }).find((r) => r.squadra === 'd')!;
    expect(d.pf).toBe(20);
    expect(d.pf_media).toBeNull();
  });
  it('include gli ufficiosi nella provvisoria e applica le penalizzazioni', () => {
    const c = calcolaClassifica(partite, ['a', 'b', 'c', 'd'], { stati: ['omologata', 'ufficioso'], penalizzazioni: [{ squadra: 'c', punti: 1 }] });
    expect(c.find((r) => r.squadra === 'c')!.punti).toBe(1);
    expect(c.find((r) => r.squadra === 'c')!.forma).toBe('PV');
  });
  it('segnala le differenze con la classifica FIP', () => {
    const ab = partite.filter((p) => p.casa !== 'c' && p.casa !== 'd' && p.ospite !== 'c' && p.ospite !== 'd');
    const c = calcolaClassifica(ab, ['a', 'b'], { stati: ['omologata'] });
    const fip = [{ squadra: 'a', punti: 2, g: 2, v: 1, p: 1, pf: 140, ps: 145 }, { squadra: 'b', punti: 4, g: 2, v: 1, p: 1, pf: 145, ps: 140 }];
    expect(differenzeClassifica(c, fip)).toEqual(['b: punti 2 invece di 4']);
  });
});

describe('tabellini', () => {
  const p = { casa: 'a', ospite: 'b', pt_casa: 70, pt_ospite: 60, data: '2026-10-01' };
  it('classifica lo stato', () => {
    expect(statoTabellino(p, new Set(['a', 'b']), new Map([['a', 70], ['b', 60]]), '2026-10-02')).toBe('completo');
    expect(statoTabellino(p, new Set(['a', 'b']), new Map([['a', 73], ['b', 60]]), '2026-10-02')).toBe('incongruente');
    expect(statoTabellino(p, new Set(['a']), new Map([['a', 70]]), '2026-10-02')).toBe('parziale');
    expect(statoTabellino(p, new Set(), new Map(), '2026-10-14')).toBe('in_attesa');
    expect(statoTabellino(p, new Set(), new Map(), '2026-10-15')).toBe('assente');
    expect(statoTabellino({ ...p, pt_casa: null, pt_ospite: null }, new Set(), new Map(), '2026-10-15')).toBeNull();
  });
  it('non declassa mai un tabellino trovato', () => {
    expect(migliore('completo', 'assente')).toBe('completo');
    expect(migliore('parziale', 'completo')).toBe('completo');
    expect(migliore('in_attesa', 'assente')).toBe('assente');
  });
});

describe('giocatori', () => {
  const r = (stagione: string, squadra: string, categoria: string, punti: number | null, presenze: number | null) =>
    arricchisciRiga({ stagione, squadra, categoria, punti, presenze, best: null });
  const righe = [
    r('2026/27', 'Virtus Cermenate', 'B Interregionale', 20, 2),
    r('2025/26', 'Pallacanestro Nervianese 1919', 'B Interregionale', 300, 30),
    r('2024/25', 'Pallacanestro Nervianese 1919', 'B Interregionale', 200, 25),
    r('2018/19', 'Olimpia Milano', 'Lega Basket', 0, 1),
    r('2016/17', 'Olimpia Jr Milano', 'Under 17 Eccellenza', 100, 10),
  ];
  it('calcola stato e provenienza', () => {
    expect(statoEProvenienza(righe, ['Virtus Cermenate'], 'Cermenate', '2025/26'))
      .toMatchObject({ stato: 'Nuovo arrivo', provenienza: 'Pallacanestro Nervianese 1919 (B Interregionale)' });
    expect(statoEProvenienza(righe, ['Pallacanestro Nervianese 1919'], 'Nerviano', '2025/26'))
      .toMatchObject({ stato: 'Confermato', provenienza: 'Già a Nerviano' });
  });
  it('riconosce gli ex Nerviano e il livello', () => {
    expect(exNerviano(righe)).toBe('A Nerviano dal 2024/25 al 2025/26');
    expect(exNerviano(righe.slice(0, 2))).toBe('A Nerviano nel 2025/26 (10,0 punti di media)');
    expect(livello(righe)).toBe('Serie A');
  });
  it('scrive una sintesi neutra', () => {
    const { prev } = statoEProvenienza(righe, ['Virtus Cermenate'], 'Cermenate', '2025/26');
    const s = sintesi({
      ruolo: 'Guardia', eta: null, eta_fascia: 'U19', stato: 'Nuovo arrivo', prev, stagioniQui: 1, stagioni: 5, livello: 'Serie A',
      partite: 2, punti: 20, media: 10, rango: 1, ptsVsNerviano: 0, exNerviano: 'A Nerviano dal 2024/25 al 2025/26',
      breve: 'Cermenate', stagionePrec: '2025/26', nomiBrevi: new Map(),
    });
    expect(s).toBe(
      'Guardia, Under 19. Nuovo arrivo da Nerviano, dove nel 2025/26 ha segnato 10,0 punti di media. '
      + 'PlayBasket gli attribuisce 5 stagioni, con esperienze fino alla Serie A. '
      + "Quest'anno 10,0 punti a partita in 2 partite: miglior realizzatore della squadra. Contro Nerviano non ha segnato.",
    );
  });
});
