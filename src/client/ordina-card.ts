/** Ordinamento delle card delle avversarie: per prossima sfida con Nerviano o per classifica. */
const contenitore = document.getElementById('elenco-avversarie');
const bottoni = [...document.querySelectorAll<HTMLButtonElement>('#ordina-avversarie button[data-ordine]')];
for (const b of bottoni) {
  b.addEventListener('click', () => {
    const chiave = b.dataset.ordine === 'classifica' ? 'classifica' : 'prossima';
    for (const x of bottoni) x.setAttribute('aria-pressed', String(x === b));
    const card = [...(contenitore?.children ?? [])] as HTMLElement[];
    card.sort((x, y) => Number(x.dataset[chiave]) - Number(y.dataset[chiave]));
    contenitore?.append(...card);
  });
}
