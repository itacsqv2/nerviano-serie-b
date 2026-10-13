import type { APIRoute } from 'astro';
import { dati } from '../lib/data.ts';
import { urlGiocatore } from '../lib/url.ts';

/** Indice di ricerca dei giocatori: l'unico dato scaricato dal browser. Vuoto se i dati PlayBasket sono spenti. */
export const GET: APIRoute = () => {
  const d = dati();
  const voci = d.playbasket
    ? d.persone
        .filter((p) => p.inRosa)
        .map((p) => [p.nomeCompleto, d.sq(p.squadra).breve, p.allenatore ? 'Allenatore' : p.ruolo ?? '', urlGiocatore(p.slug)])
        .sort((a, b) => a[0]!.localeCompare(b[0]!, 'it'))
    : [];
  return new Response(JSON.stringify(voci), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
