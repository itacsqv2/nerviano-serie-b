/**
 * Riduce le pagine scaricate in .cache/raw/ alle fixture dei test (tests/fixtures/), tenendo solo i nodi usati dai parser.
 * Toglie tutto ciò che non si deve salvare: arbitri e ufficiali di campo, provvedimenti, «Riferimento» e sede,
 * anni di nascita, loghi, articoli e cronache.
 * Uso (sviluppo): npx tsx scripts/dev/riduci-fixture.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { RADICE } from '../lib/file.ts';

const RAW = path.join(RADICE, '.cache', 'raw');
const OUT = path.join(RADICE, 'tests', 'fixtures');
fs.mkdirSync(OUT, { recursive: true });
const leggi = (f: string) => cheerio.load(fs.readFileSync(path.join(RAW, f), 'utf8'));
const pagina = (titolo: string, corpo: string) =>
  `<!doctype html>\n<html><head><meta charset="utf-8"><title>${titolo}</title></head><body>\n${corpo}\n</body></html>\n`;
const scrivi = (f: string, html: string) => {
  fs.writeFileSync(path.join(OUT, f), html.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n'));
  console.log(f, html.length);
};

function fip(f: string, out: string, conClassifica: boolean) {
  const $ = leggi(f);
  const partite = $('.results-matches__match').toArray().map((m) => {
    const p = $(m).clone();
    p.find('.team__flag').empty();
    p.find('.results-matches__match__moreinfo .info').each((_, i) => {
      if (!/^campo di gioco$/i.test($(i).children('.label').text().trim())) $(i).remove();
    });
    p.find('.col2, .value--provvedimento').remove();
    p.find('[style]').removeAttr('style');
    return $.html(p);
  });
  let classifica = '';
  if (conClassifica) {
    const t = $('.results-ranking-full table').first().clone();
    t.find('.team__flag').empty();
    t.find('td.team__info').each((_, td) => {
      const info = $(td);
      const h4 = info.find('h4').text().trim();
      const valore = (etichetta: string) => {
        const s = info.find('strong').filter((_, x) => $(x).text().trim().toLowerCase() === etichetta).first()[0];
        let v = '';
        for (let n = s?.nextSibling; n && !(n.type === 'tag' && ['strong', 'br'].includes((n as { name?: string }).name ?? '')); n = n.nextSibling) v += $(n).text();
        return v.trim();
      };
      info.html(`<h4>${h4}</h4><strong>Campo da gioco</strong> ${valore('campo da gioco')}<br><strong>Maglia</strong> ${valore('maglia')}`);
    });
    classifica = `<div class="results-ranking-full">${$.html(t)}</div>`;
  }
  scrivi(out, pagina('Risultati - Federazione Italiana Pallacanestro', `<div class="results-matches">\n${partite.join('\n')}\n</div>\n${classifica}`));
}

function pbCalendario() {
  const $ = leggi('pb-cal.html');
  const blocchi = $('table').toArray().filter((t) => $(t).find('tr[data-team]').length);
  const tenute = [0, 1, 2, 9, 15].map((i) => blocchi[i]!).map((t) => `${$.html($(t).prev('h2'))}\n${$.html(t)}`);
  scrivi('pb-calendario.html', pagina($('title').text().trim(), `<div class="calendar">\n${tenute.join('\n')}\n</div>`));
}

function pbTabelle(f: string, out: string, soloConPts: boolean) {
  const $ = leggi(f);
  const conPts = (t: Element) => $(t).find('th').toArray().some((th) => $(th).text().trim() === 'Pts');
  const tabelle = $('table').toArray().filter((t) => !soloConPts || conPts(t)).map((t) => {
    const c = $(t).clone();
    c.find('[title]').each((_, x) => {
      // l'anno di nascita sta nel title della cella dell'età: non deve finire nelle fixture
      if (/^\d{4}$/.test($(x).attr('title') ?? '')) $(x).removeAttr('title');
    });
    c.find('[style]').removeAttr('style');
    return $.html(c);
  });
  scrivi(out, pagina($('title').text().trim(), tabelle.join('\n')));
}

fip('fip-a3.html', 'fip-giornata-giocata.html', true);
fip('fip-a5.html', 'fip-giornata-futura.html', false);
pbCalendario();
pbTabelle('pb-match-g2.html', 'pb-tabellino.html', true);
pbTabelle('pb-match-g4.html', 'pb-partita-futura.html', true);
pbTabelle('pb-rosa-nerviano.html', 'pb-rosa.html', false);
pbTabelle('pb-carriera-98191.html', 'pb-carriera-due-tabelle.html', false);
