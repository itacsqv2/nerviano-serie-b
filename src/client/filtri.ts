/**
 * Filtri generici. Un controllo ha data-filtro="<gruppo>" e data-campo="<campo>":
 *   - <select> o <input>: il valore scelto;
 *   - un contenitore .segmenti con bottoni data-valore: il bottone premuto.
 * Gli elementi filtrati hanno data-gruppo="<gruppo>" e data-<campo>="token1 token2 ...".
 * Il valore vuoto o «tutte» mostra tutto. Un elemento [data-vuoto="<gruppo>"] compare se non resta nulla.
 * Bottoni data-passo="-1|1" con data-filtro e data-campo spostano un <select> all'opzione precedente o successiva.
 */
type Controllo = { campo: string; valore: () => string };

export function attivaFiltri(): void {
  const gruppi = new Map<string, Controllo[]>();
  const aggiungi = (g: string, c: Controllo) => gruppi.set(g, [...(gruppi.get(g) ?? []), c]);

  for (const el of document.querySelectorAll<HTMLElement>('[data-filtro][data-campo]')) {
    const gruppo = el.dataset.filtro!;
    const campo = el.dataset.campo!;
    if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) {
      aggiungi(gruppo, { campo, valore: () => el.value });
      el.addEventListener(el instanceof HTMLInputElement ? 'input' : 'change', () => applica(gruppo));
    } else if (el.classList.contains('segmenti')) {
      const bottoni = [...el.querySelectorAll<HTMLButtonElement>('button[data-valore]')];
      aggiungi(gruppo, { campo, valore: () => bottoni.find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.valore ?? '' });
      for (const b of bottoni) {
        b.addEventListener('click', () => {
          for (const x of bottoni) x.setAttribute('aria-pressed', String(x === b));
          applica(gruppo);
        });
      }
    } else if (el.dataset.passo) {
      el.addEventListener('click', () => {
        const sel = document.querySelector<HTMLSelectElement>(`select[data-filtro="${gruppo}"][data-campo="${campo}"]`);
        if (!sel) return;
        const i = Math.min(sel.options.length - 1, Math.max(0, sel.selectedIndex + Number(el.dataset.passo)));
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event('change'));
      });
    }
  }

  function applica(gruppo: string): void {
    const controlli = (gruppi.get(gruppo) ?? []).map((c) => ({ campo: c.campo, valore: c.valore() }));
    let visibili = 0;
    for (const el of document.querySelectorAll<HTMLElement>(`[data-gruppo="${gruppo}"]`)) {
      const ok = controlli.every(({ campo, valore }) => {
        if (!valore || valore === 'tutte') return true;
        const tokens = (el.dataset[campo] ?? '').split(' ');
        return tokens.includes(valore);
      });
      el.hidden = !ok;
      if (ok) visibili++;
    }
    for (const v of document.querySelectorAll<HTMLElement>(`[data-vuoto="${gruppo}"]`)) v.hidden = visibili > 0;
    for (const p of document.querySelectorAll<HTMLButtonElement>(`button[data-passo][data-filtro="${gruppo}"]`)) {
      const sel = document.querySelector<HTMLSelectElement>(`select[data-filtro="${gruppo}"][data-campo="${p.dataset.campo}"]`);
      if (sel) p.disabled = Number(p.dataset.passo) < 0 ? sel.selectedIndex <= 0 : sel.selectedIndex >= sel.options.length - 1;
    }
  }

  for (const g of gruppi.keys()) applica(g);
}
