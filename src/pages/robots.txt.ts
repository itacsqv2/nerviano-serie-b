import type { APIRoute } from 'astro';
import { dati } from '../lib/data.ts';

// Finché il sito non è indicizzabile i crawler devono poter leggere il «noindex» delle pagine:
// per questo robots.txt non vieta nulla e la sitemap non viene pubblicata.
export const GET: APIRoute = () => {
  const { sito } = dati();
  const righe = ['User-agent: *', 'Allow: /'];
  if (sito.indicizzabile) righe.push('', `Sitemap: ${new URL('sitemap.xml', `${sito.url.replace(/\/$/, '')}${import.meta.env.BASE_URL}`)}`);
  return new Response(`${righe.join('\n')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
