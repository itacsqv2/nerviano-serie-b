import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ClientHttp, controllaUserAgent, userAgentDa } from '../scripts/aggiorna/http.ts';

const UA = 'NervianoBasketFan/1.0 (+https://nerviano.example.org/note-legali/; tifoso@example.org)';
const ROBOTS = 'User-agent: *\nDisallow: /denied.php\nDisallow: /ext_link.php\n';

type Risposta = { status: number; body?: string; headers?: Record<string, string> };
function finto(rotte: Record<string, Risposta | Risposta[]>) {
  const chiamate: { url: string; headers: Record<string, string> }[] = [];
  const contatori = new Map<string, number>();
  const f = (async (url: string, init?: RequestInit) => {
    chiamate.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const r = rotte[url];
    if (!r) return new Response('', { status: 404 });
    const n = contatori.get(url) ?? 0;
    contatori.set(url, n + 1);
    const x = Array.isArray(r) ? r[Math.min(n, r.length - 1)]! : r;
    return new Response(x.status === 304 ? null : x.body ?? '<table></table>', { status: x.status, headers: { 'content-type': 'text/html; charset=UTF-8', ...x.headers } });
  }) as unknown as typeof fetch;
  return { f, chiamate };
}
const attese: number[] = [];
const client = (f: typeof fetch, extra: Partial<ConstructorParameters<typeof ClientHttp>[0]> = {}) =>
  new ClientHttp({
    userAgent: UA,
    cartellaCache: fs.mkdtempSync(path.join(os.tmpdir(), 'nb-http-')),
    fetch: f,
    attendi: async (ms) => { attese.push(ms); },
    ...extra,
  });
const PB = 'https://www.playbasket.it';

describe('client HTTP', () => {
  it('legge robots.txt, manda lo User-Agent e fa una pausa tra le richieste', async () => {
    const { f, chiamate } = finto({ [`${PB}/robots.txt`]: { status: 200, body: ROBOTS }, [`${PB}/a.php`]: { status: 200 }, [`${PB}/b.php`]: { status: 200 } });
    attese.length = 0;
    const c = client(f);
    await c.testo(`${PB}/a.php`);
    await c.testo(`${PB}/b.php`);
    expect(chiamate.map((x) => x.url)).toEqual([`${PB}/robots.txt`, `${PB}/a.php`, `${PB}/b.php`]);
    expect(chiamate.every((x) => x.headers['User-Agent'] === UA)).toBe(true);
    expect(attese.filter((ms) => ms >= 1000).length).toBeGreaterThanOrEqual(2);
  });
  it('rifiuta gli URL vietati da robots.txt e i siti non consentiti', async () => {
    const { f } = finto({ [`${PB}/robots.txt`]: { status: 200, body: ROBOTS } });
    const c = client(f);
    await expect(c.testo(`${PB}/denied.php`)).rejects.toThrow(/robots\.txt/);
    await expect(c.testo('https://www.nervianobasket.it/')).rejects.toThrow(/non consentito/);
  });
  it('si ferma su 403 senza riprovare', async () => {
    const { f, chiamate } = finto({ [`${PB}/robots.txt`]: { status: 200, body: ROBOTS }, [`${PB}/x.php`]: { status: 403 } });
    await expect(client(f).testo(`${PB}/x.php`)).rejects.toThrow(/403/);
    expect(chiamate.filter((x) => x.url.endsWith('x.php'))).toHaveLength(1);
  });
  it('riprova su 503 rispettando Retry-After, al massimo 3 volte', async () => {
    const { f, chiamate } = finto({ [`${PB}/robots.txt`]: { status: 200, body: ROBOTS }, [`${PB}/y.php`]: [{ status: 503, headers: { 'retry-after': '7' } }, { status: 200 }] });
    attese.length = 0;
    await expect(client(f).testo(`${PB}/y.php`)).resolves.toContain('<table');
    expect(attese).toContain(7000);
    const { f: f2, chiamate: c2 } = finto({ [`${PB}/robots.txt`]: { status: 200, body: ROBOTS }, [`${PB}/z.php`]: { status: 500 } });
    await expect(client(f2).testo(`${PB}/z.php`)).rejects.toThrow(/500/);
    expect(c2.filter((x) => x.url.endsWith('z.php'))).toHaveLength(3);
    expect(chiamate.length).toBeGreaterThan(0);
  });
  it('non segue redirect verso altri siti o pagine di blocco', async () => {
    const { f, chiamate } = finto({
      [`${PB}/robots.txt`]: { status: 200, body: ROBOTS },
      [`${PB}/r.php`]: { status: 302, headers: { location: 'https://altrosito.example/x' } },
      [`${PB}/s.php`]: { status: 302, headers: { location: '/denied.php' } },
    });
    const c = client(f);
    await expect(c.testo(`${PB}/r.php`)).rejects.toThrow(/altro sito/);
    await expect(c.testo(`${PB}/s.php`)).rejects.toThrow(/blocco/);
    expect(chiamate.some((x) => x.url.includes('altrosito'))).toBe(false);
  });
  it('si ferma davanti a una pagina anti-bot', async () => {
    const { f } = finto({ [`${PB}/robots.txt`]: { status: 200, body: ROBOTS }, [`${PB}/c.php`]: { status: 200, body: '<html>Please complete the captcha</html>' } });
    await expect(client(f).testo(`${PB}/c.php`)).rejects.toThrow(/anti-bot/);
  });
  it('usa la cache con ETag e in modalità offline', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-http-'));
    const { f, chiamate } = finto({
      [`${PB}/robots.txt`]: { status: 200, body: ROBOTS },
      [`${PB}/e.php`]: [{ status: 200, body: '<table>v1</table>', headers: { etag: '"abc"' } }, { status: 304 }],
    });
    expect(await client(f, { cartellaCache: dir }).testo(`${PB}/e.php`)).toContain('v1');
    expect(await client(f, { cartellaCache: dir }).testo(`${PB}/e.php`)).toContain('v1');
    expect(chiamate.at(-1)!.headers['If-None-Match']).toBe('"abc"');
    const offline = client((() => { throw new Error('nessuna rete'); }) as never, { cartellaCache: dir, offline: true });
    expect(await offline.testo(`${PB}/e.php`)).toContain('v1');
  });
  it('rispetta il tetto di richieste', async () => {
    const { f } = finto({ [`${PB}/robots.txt`]: { status: 200, body: ROBOTS }, [`${PB}/t.php`]: { status: 200 } });
    const c = client(f, { massimoRichieste: 2 });
    await c.testo(`${PB}/t.php`);
    await expect(c.testo(`${PB}/t.php?2`)).rejects.toThrow(/tetto/);
  });
});

describe('User-Agent', () => {
  it('deve essere onesto e completo', () => {
    expect(() => controllaUserAgent('Mozilla/5.0 (Windows NT 10.0)')).toThrow();
    expect(() => controllaUserAgent('Python-urllib/3.12')).toThrow();
    expect(() => controllaUserAgent(userAgentDa({ user_agent: 'NervianoBasketFan/1.0 (+{url}/note-legali/; {email})', url: 'https://x.example.invalid', email: 'a@example.invalid' }))).toThrow(/segnaposto/);
    expect(userAgentDa({ user_agent: 'NervianoBasketFan/1.0 (+{url}/note-legali/; {email})', url: 'https://nb.example.org/', email: 'a@b.it' })).toBe('NervianoBasketFan/1.0 (+https://nb.example.org/note-legali/; a@b.it)');
    expect(() => controllaUserAgent(UA)).not.toThrow();
  });
});
