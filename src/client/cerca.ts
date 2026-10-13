/**
 * Ricerca dei giocatori: scarica l'indice /cerca.json solo quando serve (al primo focus) e filtra nel browser.
 * Formato dell'indice: [[nome visualizzato, squadra breve, ruolo o "", url]].
 */
type Voce = [string, string, string, string];

const piega = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function attivaCerca(): void {
  const input = document.querySelector<HTMLInputElement>('#cerca-giocatore');
  const lista = document.querySelector<HTMLUListElement>('#cerca-risultati');
  if (!input || !lista) return;
  let indice: Promise<Voce[]> | null = null;
  let attivo = -1;
  const carica = () => (indice ??= fetch(input.dataset.indice!).then((r) => r.json() as Promise<Voce[]>).catch(() => []));
  const chiudi = () => {
    lista.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    attivo = -1;
  };
  const evidenzia = (i: number) => {
    const voci = [...lista.querySelectorAll('li')];
    if (!voci.length) return;
    attivo = (i + voci.length) % voci.length;
    voci.forEach((li, k) => li.setAttribute('aria-selected', String(k === attivo)));
    input.setAttribute('aria-activedescendant', voci[attivo]!.id);
    voci[attivo]!.scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('focus', () => void carica(), { once: true });
  input.addEventListener('input', async () => {
    const q = piega(input.value.trim());
    if (q.length < 2) return chiudi();
    const parole = q.split(/\s+/);
    const trovati = (await carica()).filter(([nome]) => parole.every((p) => piega(nome).includes(p))).slice(0, 12);
    lista.replaceChildren(
      ...(trovati.length
        ? trovati.map(([nome, squadra, ruolo, href], i) => {
            const li = document.createElement('li');
            li.id = `cerca-${i}`;
            li.setAttribute('role', 'option');
            const a = document.createElement('a');
            a.href = href;
            a.tabIndex = -1;
            a.textContent = nome;
            const s = document.createElement('span');
            s.className = 'nota';
            s.textContent = [squadra, ruolo].filter(Boolean).join(' · ');
            a.append(s);
            li.append(a);
            return li;
          })
        : [Object.assign(document.createElement('li'), { textContent: 'Nessun giocatore trovato', className: 'nota' })]),
    );
    lista.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    attivo = -1;
  });
  input.addEventListener('keydown', (e) => {
    if (lista.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); evidenzia(attivo + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); evidenzia(attivo - 1); }
    else if (e.key === 'Enter' && attivo >= 0) {
      e.preventDefault();
      lista.querySelectorAll('a')[attivo]?.click();
    } else if (e.key === 'Escape') chiudi();
  });
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Node) || !input.parentElement?.contains(e.target)) chiudi();
  });
}
