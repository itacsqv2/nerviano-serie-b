/**
 * Tabelle ordinabili: <table data-ordinabile>, con <th data-tipo="num|testo"> nelle colonne ordinabili.
 * Ogni cella può indicare il valore da usare con data-valore.
 */
export function attivaOrdinamento(): void {
  for (const tabella of document.querySelectorAll<HTMLTableElement>('table[data-ordinabile]')) {
    const corpo = tabella.tBodies[0];
    if (!corpo) continue;
    const intestazioni = [...tabella.tHead?.rows[0]?.cells ?? []];
    intestazioni.forEach((th, col) => {
      if (!th.dataset.tipo) return;
      const bottone = document.createElement('button');
      bottone.type = 'button';
      bottone.className = 'ordina';
      bottone.append(...th.childNodes);
      th.append(bottone);
      bottone.addEventListener('click', () => {
        const verso = th.getAttribute('aria-sort') === 'descending' ? 'ascending' : 'descending';
        for (const altro of intestazioni) altro.removeAttribute('aria-sort');
        th.setAttribute('aria-sort', verso);
        const num = th.dataset.tipo === 'num';
        const valore = (r: HTMLTableRowElement) => {
          const c = r.cells[col];
          const v = c?.dataset.valore ?? c?.textContent?.trim() ?? '';
          return num ? (v === '' || v === '—' ? Number.NEGATIVE_INFINITY : Number(v.replace(',', '.').replace('−', '-'))) : v;
        };
        const righe = [...corpo.rows].sort((a, b) => {
          const x = valore(a);
          const y = valore(b);
          const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'it');
          return verso === 'ascending' ? c : -c;
        });
        corpo.append(...righe);
      });
    });
  }
}
