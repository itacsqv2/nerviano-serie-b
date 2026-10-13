import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { capitalizza, leggiCampo, leggiClassifica, leggiPartite } from '../scripts/aggiorna/fip.ts';
import { leggiCalendario, leggiCarriera, leggiRosa, leggiTabellino, nomeGiocatore } from '../scripts/aggiorna/pb.ts';
import { decodifica } from '../scripts/aggiorna/http.ts';

const fx = (f: string) => fs.readFileSync(path.join(import.meta.dirname, 'fixtures', f), 'utf8');

describe('FIP', () => {
  it('legge una giornata giocata', () => {
    const p = leggiPartite(fx('fip-giornata-giocata.html'));
    expect(p).toHaveLength(7);
    expect(p[0]).toMatchObject({ id: '000531', casa: 'BOCCONI MILANO', ospite: 'DON BOSCO CROCETTA TORINO', pt_casa: 78, pt_ospite: 94, data: '2026-10-10', ora: '18:00', stato: 'omologata', palestra: 'Bocconi Sport Center', citta: 'Milano' });
    // senza indicatore di stato una gara giocata è omologata
    expect(p.find((x) => x.id === '000532')!.stato).toBe('omologata');
    expect(p.find((x) => x.id === '000535')).toMatchObject({ palestra: 'CENTRO POLIFUNZIONALE', citta: 'Sorso' });
  });
  it('legge una giornata futura', () => {
    const p = leggiPartite(fx('fip-giornata-futura.html'));
    expect(p).toHaveLength(7);
    expect(p.every((x) => x.pt_casa === null && x.stato === 'da_giocare')).toBe(true);
    expect(p[0]!.data).toBe('2026-10-24');
  });
  it('legge la classifica senza recapiti personali', () => {
    const c = leggiClassifica(fx('fip-giornata-giocata.html'));
    expect(c).toHaveLength(15);
    expect(c[0]).toMatchObject({ posizione: 1, nome: 'RISO SCOTTI PALL. PAVIA 1933', punti: 6, g: 3, v: 3, p: 0, pf: 292, ps: 208, codice_fip: '020614' });
    expect(c[0]!.maglia).toMatch(/^Bianco/);
    expect(JSON.stringify(c)).not.toMatch(/riferimento/i);
  });
  it('normalizza campi e città', () => {
    expect(leggiCampo('PALARAVIZZA 1164203 - PAVIA (PV)').citta).toBe('Pavia');
    expect(leggiCampo('Palazzetto, Via Giulini 22 20010 BOFFALORA SOPRA TICINO ( MI)')).toEqual({ palestra: 'Palazzetto', citta: 'Boffalora sopra Ticino' });
    expect(capitalizza("SANT'ANGELO LODIGIANO")).toBe("Sant'Angelo Lodigiano");
    expect(leggiCampo('')).toEqual({ palestra: null, citta: null });
  });
});

describe('PlayBasket', () => {
  it('legge il calendario del girone', () => {
    const c = leggiCalendario(fx('pb-calendario.html'));
    expect(c).toHaveLength(35);
    expect(c[0]).toMatchObject({ gtn: 1, gtt: 1, mn: 1, casa: 'Campus Varese', obj_casa: 904, obj_ospite: 15262, pt_casa: 75, pt_ospite: 96, tabellino: true });
    const futura = c.find((x) => x.gtn === 10)!;
    expect(futura.pt_casa).toBeNull();
    expect(c.some((x) => x.gtt === 2)).toBe(true);
  });
  it('legge un tabellino', () => {
    const t = leggiTabellino(fx('pb-tabellino.html'));
    expect(t.titolo_pt).toEqual([75, 74]);
    expect(t.titolo_casa).toBe('Pallacanestro Nervianese 1919');
    expect(t.squadre).toHaveLength(2);
    expect(t.squadre[0]!.righe.reduce((s, r) => s + r.punti, 0)).toBe(75);
    expect(t.squadre[0]!.totale).toBe(75);
    expect(t.squadre[0]!.righe[0]).toMatchObject({ giocatore: 149193, squadra_obj: 2574, nome_rosa: 'Azzolini Marco', ruolo: 'Guardia', eta: 20, punti: 3 });
  });
  it('riconosce una partita senza tabellino', () => {
    const t = leggiTabellino(fx('pb-partita-futura.html'));
    expect(t.squadre).toHaveLength(0);
    expect(t.titolo_pt).toBeNull();
  });
  it('legge una rosa con lo staff tecnico, senza anni di nascita', () => {
    const r = leggiRosa(fx('pb-rosa.html'));
    expect(r.giocatori).toHaveLength(17);
    expect(r.giocatori[1]).toMatchObject({ giocatore: 149193, numero: '2', punti: 6, media: 2, presenze: 3, eta: 20, ruolo: 'Guardia' });
    expect(r.allenatori).toEqual([{ giocatore: 76478, nome_rosa: 'Viceconti Davide' }]);
    expect(JSON.stringify(r)).not.toMatch(/"(19|20)\d\d"/);
  });
  it('sceglie la tabella con PTS in una carriera con due tabelle', () => {
    const c = leggiCarriera(fx('pb-carriera-due-tabelle.html'));
    expect(c.titolo_nome).toBe('Giacomo Bonavida');
    expect(c.righe[0]).toEqual({ stagione: '2026/27', squadra: 'BasketBall Gallarate', categoria: 'B Interregionale', punti: 50, presenze: 2, best: 29 });
    expect(c.riepilogo).toEqual({ stagioni: 14, senior: 11, giovanili: 3, squadre: 9, punti: 4459, presenze: 276, best: 41 });
    // gli stessi totali della correzione a mano del legacy: non serve più
    expect(c.righe.reduce((s, r) => s + (r.punti ?? 0), 0)).toBe(4459);
  });
  it('separa cognome e nome', () => {
    expect(nomeGiocatore('Di Franco Fabrizio', 'Fabrizio Di Franco')).toEqual({ cognome: 'Di Franco', nome: 'Fabrizio' });
    expect(nomeGiocatore('Rossi Mario', null)).toEqual({ cognome: 'Rossi', nome: 'Mario' });
  });
});

describe('decodifica', () => {
  it('usa il charset dell\'header, anche tra virgolette, o del meta', () => {
    const latin = Buffer.from([0x63, 0x61, 0x66, 0xe8]); // «cafè» in latin-1
    expect(decodifica(latin, 'text/html; charset="ISO-8859-1"')).toBe('cafè');
    expect(decodifica(Buffer.from('<meta charset="iso-8859-1">x\xe8', 'latin1'), 'text/html')).toBe('<meta charset="iso-8859-1">xè');
    expect(decodifica(Buffer.from('città', 'utf8'), 'text/html; charset=UTF-8')).toBe('città');
  });
});
