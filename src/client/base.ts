/**
 * JavaScript comune a tutte le pagine (caricato come modulo esterno: niente script inline per la CSP).
 * Tutto è un miglioramento progressivo: senza JavaScript le pagine mostrano gli stessi contenuti.
 */
import { attivaCerca } from './cerca.ts';
import { attivaOrdinamento } from './ordina.ts';
import { attivaFiltri } from './filtri.ts';
import { attivaDate } from './date.ts';

document.documentElement.classList.add('js');
attivaOrdinamento();
attivaFiltri();
attivaDate();
attivaCerca();
