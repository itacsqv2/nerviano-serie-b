/**
 * Unico client HTTP della pipeline (§4.1): robots.txt, User-Agent onesto, una richiesta alla volta per sito
 * con pause, tentativi limitati, cache su disco con ETag/Last-Modified, tetto di richieste.
 * Non aggira mai un blocco: su 403 o pagine anti-bot si ferma con un messaggio chiaro.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import robotsParser from 'robots-parser';

export class ErroreFonte extends Error {}

export interface OpzioniHttp {
  userAgent: string;
  cartellaCache: string;
  offline?: boolean;
  /** pausa minima tra due richieste allo stesso sito, in ms */
  pausa?: number;
  timeout?: number;
  tentativi?: number;
  massimoRichieste?: number;
  /** per i test: sostituisce fetch e l'attesa */
  fetch?: typeof fetch;
  attendi?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
}

interface VoceCache { url: string; etag?: string; lastModified?: string; salvato: string; corpo: string }

export const HOST_CONSENTITI = new Set(['fip.it', 'www.fip.it', 'www.playbasket.it', 'playbasket.it']);

// Pagine di verifica anti-bot: se compaiono la pipeline si ferma (§4.1).
const ANTI_BOT = [/captcha/i, /cf-challenge|cf_chl_|challenge-platform/i, /Attention Required!/i, /Access denied/i, /are you a robot/i];

export class ClientHttp {
  private robots = new Map<string, ReturnType<typeof robotsParser>>();
  private ultima = new Map<string, number>();
  private code = new Map<string, Promise<unknown>>();
  readonly statistiche = { richieste: 0, daCache: 0, nonModificate: 0, byte: 0, inizio: Date.now() };
  private readonly o: Required<Omit<OpzioniHttp, 'fetch' | 'attendi' | 'log'>> & Pick<OpzioniHttp, 'fetch' | 'attendi' | 'log'>;

  constructor(opzioni: OpzioniHttp) {
    this.o = { offline: false, pausa: 1500, timeout: 20_000, tentativi: 3, massimoRichieste: 600, ...opzioni };
    if (!this.o.offline) controllaUserAgent(this.o.userAgent);
    fs.mkdirSync(this.o.cartellaCache, { recursive: true });
  }

  private attendi(ms: number) {
    return this.o.attendi ? this.o.attendi(ms) : new Promise<void>((r) => setTimeout(r, ms));
  }

  private fileCache(url: string) {
    return path.join(this.o.cartellaCache, `${crypto.createHash('sha1').update(url).digest('hex')}.json`);
  }

  private leggiCache(url: string): VoceCache | null {
    const f = this.fileCache(url);
    if (!fs.existsSync(f)) return null;
    try {
      return JSON.parse(fs.readFileSync(f, 'utf8')) as VoceCache;
    } catch {
      return null; // file di cache rovinato (scrittura interrotta): si riscarica
    }
  }

  /** Una sola coda per sito: le richieste allo stesso host non si sovrappongono mai. */
  private inCoda<T>(host: string, lavoro: () => Promise<T>): Promise<T> {
    const prima = this.code.get(host) ?? Promise.resolve();
    const dopo = prima.catch(() => undefined).then(lavoro);
    this.code.set(host, dopo);
    return dopo;
  }

  private async rispettaPausa(host: string) {
    const trascorso = Date.now() - (this.ultima.get(host) ?? 0);
    const attesa = this.o.pausa + Math.floor(Math.random() * 500) - trascorso;
    if (attesa > 0) await this.attendi(attesa);
  }

  private async robotsDi(origine: string) {
    const noto = this.robots.get(origine);
    if (noto) return noto;
    const url = `${origine}/robots.txt`;
    const testo = await this.scarica(url, { robots: true });
    const r = robotsParser(url, testo);
    this.robots.set(origine, r);
    return r;
  }

  /** Scarica una pagina HTML (o testo) rispettando tutte le regole; restituisce il corpo decodificato. */
  async testo(url: string): Promise<string> {
    const u = new URL(url);
    if (!HOST_CONSENTITI.has(u.hostname)) throw new ErroreFonte(`Sito non consentito: ${u.hostname}. La pipeline legge solo fip.it e playbasket.it.`);
    const r = await this.robotsDi(u.origin);
    if (r.isAllowed(url, this.o.userAgent) === false) throw new ErroreFonte(`robots.txt di ${u.hostname} non consente di leggere ${url}: la pipeline si ferma.`);
    return this.scarica(url, { robots: false });
  }

  /** Controlla un URL di destinazione di un redirect: stesso elenco di siti, robots.txt, niente pagine di errore. */
  private async controllaRedirect(da: string, verso: string, robots: boolean): Promise<void> {
    const u = new URL(verso);
    if (!HOST_CONSENTITI.has(u.hostname)) throw new ErroreFonte(`${da} rimanda a un altro sito (${u.hostname}): la pipeline non segue link esterni.`);
    if (/\/(error|denied|db_error)\.(php|htm)$/.test(u.pathname)) throw new ErroreFonte(`${u.hostname} ha rimandato a ${u.pathname}: possibile blocco, la pipeline si ferma.`);
    if (!robots) {
      const r = await this.robotsDi(u.origin);
      if (r.isAllowed(verso, this.o.userAgent) === false) throw new ErroreFonte(`${da} rimanda a ${verso}, che robots.txt non consente: la pipeline si ferma.`);
    }
  }

  private scarica(url: string, { robots }: { robots: boolean }): Promise<string> {
    const host = new URL(url).hostname;
    const cache = this.leggiCache(url);
    if (this.o.offline) {
      if (!cache) throw new ErroreFonte(`--offline: ${url} non è nella cache (.cache/http). Lancia una volta senza --offline.`);
      this.statistiche.daCache++;
      return Promise.resolve(cache.corpo);
    }
    return this.inCoda(host, async () => {
      let attuale = url;
      let salti = 0;
      for (let tentativo = 1; ; tentativo++) {
        if (this.statistiche.richieste >= this.o.massimoRichieste) {
          throw new ErroreFonte(`Raggiunto il tetto di ${this.o.massimoRichieste} richieste per esecuzione: la pipeline si ferma.`);
        }
        await this.rispettaPausa(host);
        this.statistiche.richieste++;
        this.ultima.set(host, Date.now());
        const headers: Record<string, string> = { 'User-Agent': this.o.userAgent, Accept: 'text/html,text/plain;q=0.9,*/*;q=0.5', 'Accept-Language': 'it-IT,it;q=0.9' };
        if (cache?.etag) headers['If-None-Match'] = cache.etag;
        if (cache?.lastModified) headers['If-Modified-Since'] = cache.lastModified;
        let risposta: Response;
        try {
          // i redirect si seguono a mano, per controllare host e robots.txt prima di ogni nuova richiesta
          risposta = await (this.o.fetch ?? fetch)(attuale, { headers, redirect: 'manual', signal: AbortSignal.timeout(this.o.timeout) });
        } catch (e) {
          if (tentativo >= this.o.tentativi) throw new ErroreFonte(`Errore di rete su ${url} dopo ${tentativo} tentativi: ${(e as Error).message}`);
          await this.attendi(2 ** tentativo * 1000);
          continue;
        }
        const location = risposta.headers.get('location');
        if (risposta.status >= 300 && risposta.status < 400 && risposta.status !== 304 && location) {
          if (++salti > 5) throw new ErroreFonte(`Troppi redirect su ${url}.`);
          const verso = new URL(location, attuale).toString();
          await this.controllaRedirect(attuale, verso, robots);
          attuale = verso;
          tentativo = 0;
          continue;
        }
        if (risposta.status === 304 && cache) {
          this.statistiche.nonModificate++;
          return cache.corpo;
        }
        if (robots && risposta.status === 404) return '';
        if (risposta.status === 403) throw new ErroreFonte(`${host} ha risposto 403 (accesso negato) su ${url}. Non si aggira un blocco: vedi il README, «Se una fonte blocca la pipeline».`);
        if (risposta.status === 429 || risposta.status >= 500) {
          if (tentativo >= this.o.tentativi) throw new ErroreFonte(`${host} ha risposto ${risposta.status} su ${url} dopo ${tentativo} tentativi.`);
          const ra = Number(risposta.headers.get('retry-after'));
          await this.attendi(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 120) * 1000 : 2 ** tentativo * 1000);
          continue;
        }
        if (!risposta.ok) throw new ErroreFonte(`${host} ha risposto ${risposta.status} su ${url}.`);
        const buf = Buffer.from(await risposta.arrayBuffer());
        this.statistiche.byte += buf.length;
        const corpo = decodifica(buf, risposta.headers.get('content-type'));
        if (!robots && ANTI_BOT.some((r) => r.test(corpo.slice(0, 5000))) && !/<table/i.test(corpo)) {
          throw new ErroreFonte(`${host} ha mostrato una pagina di verifica anti-bot su ${url}: la pipeline si ferma e non prova ad aggirarla.`);
        }
        const voce: VoceCache = { url, salvato: new Date().toISOString(), corpo };
        const etag = risposta.headers.get('etag');
        const lm = risposta.headers.get('last-modified');
        if (etag) voce.etag = etag;
        if (lm) voce.lastModified = lm;
        // scrittura atomica: un'interruzione non lascia file di cache troncati
        const f = this.fileCache(url);
        fs.writeFileSync(`${f}.tmp`, JSON.stringify(voce));
        fs.renameSync(`${f}.tmp`, f);
        return corpo;
      }
    });
  }

  riepilogo(): string {
    const s = this.statistiche;
    const sec = Math.round((Date.now() - s.inizio) / 1000);
    return `${s.richieste} richieste (${s.nonModificate} non modificate, ${s.daCache} dalla cache), ${(s.byte / 1024 / 1024).toFixed(1)} MB scaricati, ${Math.floor(sec / 60)} min ${sec % 60} s`;
  }
}

/** Decodifica secondo il charset dell'header (anche tra virgolette) o, in mancanza, del <meta charset> della pagina. */
export function decodifica(buf: Buffer, contentType: string | null): string {
  const daHeader = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType ?? '')?.[1];
  const testa = buf.subarray(0, 4096).toString('latin1');
  const daMeta = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(testa)?.[1];
  let charset = (daHeader ?? daMeta ?? 'utf-8').toLowerCase();
  if (charset === 'iso-8859-1' || charset === 'latin1') charset = 'windows-1252';
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

/** Nomi che PlayBasket blocca nel suo robots.txt o che imitano un browser: lo User-Agent non deve contenerli. */
const UA_VIETATI = [/mozilla/i, /chrome/i, /safari/i, /python-urllib/i, /httplib/i, /lwp-trivial/i, /gptbot/i, /wget/i, /curl/i];

export function controllaUserAgent(ua: string): void {
  if (UA_VIETATI.some((r) => r.test(ua))) throw new ErroreFonte(`User-Agent non ammesso: «${ua}». Deve identificare il sito in modo onesto, senza imitare un browser.`);
  if (/example\.invalid|\{url\}|\{email\}/.test(ua)) {
    throw new ErroreFonte('Lo User-Agent contiene ancora i valori segnaposto: compila «url» ed «email» in data/config/sito.json prima di leggere i siti veri.');
  }
}

/** Costruisce lo User-Agent dal modello in sito.json («{url}» ed «{email}» vengono sostituiti). */
export function userAgentDa(sito: { user_agent: string; url: string; email: string }): string {
  return sito.user_agent.replace('{url}', sito.url.replace(/\/$/, '')).replace('{email}', sito.email);
}
