/** Link interni che rispettano il percorso base (BASE_PATH) della build. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export const url = (percorso: string): string => `${BASE}${percorso.startsWith('/') ? percorso : `/${percorso}`}`;
export const urlGiocatore = (slug: string) => url(`/giocatori/${slug}/`);
export const urlSquadra = (slug: string) => url(`/avversarie/${slug}/`);
export const urlPartita = (id: string) => url(`/partite/${id}/`);
