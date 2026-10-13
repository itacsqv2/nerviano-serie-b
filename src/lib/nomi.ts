/** Normalizzazioni di nomi, stagioni e slug. */

export const pulisci = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** Toglie segni accessori come «©» (es. «Martinoni Niccolò©»). */
export const togliSegni = (s: string): string => pulisci(s.replace(/[©®*†]/g, ''));

/**
 * Separa «Cognome Nome» (rosa PlayBasket) usando «Nome Cognome» (titolo della pagina carriera).
 * Porting di separaNome in legacy/estrazione/avversari.js. Gestisce cognomi e nomi di più parole.
 * Restituisce [cognome, nome]; se non trova una rotazione coerente, [rosa, ''].
 */
export function separaNome(rosa: string, titolo: string): [string, string] {
  const r = togliSegni(rosa).toLowerCase();
  const t = togliSegni(titolo).split(' ').filter(Boolean);
  for (let k = 1; k < t.length; k++) {
    if ([...t.slice(k), ...t.slice(0, k)].join(' ').toLowerCase() === r) {
      return [t.slice(k).join(' '), t.slice(0, k).join(' ')];
    }
  }
  return [togliSegni(rosa), ''];
}

/**
 * Porting di _pulisci_nome (legacy/avversari_dati.py): se il nome manca,
 * la prima parola di «Cognome Nome» è il cognome.
 */
export function pulisciNome(cognome: string, nome: string): [string, string] {
  let c = togliSegni(cognome);
  let n = togliSegni(nome);
  if (!n) {
    const parti = c.split(' ');
    c = parti[0] ?? '';
    n = parti.slice(1).join(' ');
  }
  return [c, n];
}

/** «25/26» → «2025/26» (porting di _anno in legacy/avversari_dati.py). */
export function stagioneDaPb(as: string): string {
  const m = /^(\d{2})\/(\d{2})$/.exec(pulisci(as));
  if (!m) throw new Error(`Stagione PlayBasket non riconosciuta: «${as}»`);
  const a = Number(m[1]);
  return `${(a > 90 ? 1900 : 2000) + a}/${m[2]}`;
}

/** Primo anno di una stagione «2025/26» → 2025. */
export const annoStagione = (s: string): number => Number(s.slice(0, 4));

/** Stagione precedente: «2026/27» → «2025/26». */
export function stagionePrecedente(s: string): string {
  const a = annoStagione(s) - 1;
  return `${a}/${String((a + 1) % 100).padStart(2, '0')}`;
}

/** Testo in ASCII minuscolo con trattini. */
export function asciiSlug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const slugGiocatore = (g: { id: number; cognome: string; nome: string }): string =>
  [asciiSlug(g.cognome), asciiSlug(g.nome), String(g.id)].filter(Boolean).join('-');

/** Confronto di nomi tolleranti a maiuscole, spazi e apostrofi tipografici (§4.5). */
export function normalizzaNome(s: string): string {
  return pulisci(s.replace(/[’‘`´]/g, "'")).toUpperCase();
}

/** Distanza di Levenshtein, per suggerire la squadra più simile a un nome sconosciuto. */
export function distanza(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]!;
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length]!;
}
