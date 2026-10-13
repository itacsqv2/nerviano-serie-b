/**
 * Date relative a oggi, calcolate nel browser (Europe/Rome): gli aggiornamenti dei dati sono a richiesta,
 * quindi «prossima partita» e «tra N giorni» non possono essere fissati in build.
 *
 * - <script type="application/json" id="calendario-rif">: le partite di Nerviano non ancora giocate
 *   [{ data, modello }] (modello = id del <template> con la scheda della partita).
 * - [data-prossima]: contenitore della scheda «prossima partita», sostituita se la data di build è superata.
 * - [data-tra="AAAA-MM-GG"]: testo «oggi», «domani», «tra N giorni».
 * - tr[data-data] in [data-evidenzia-prossima]: riceve la classe «prossima» la prima riga futura.
 */
const oggi = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const giorni = (da: string, a: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${da}T12:00:00Z`)) / 86_400_000);

export function testoTra(n: number): string {
  if (n === 0) return 'oggi';
  if (n === 1) return 'domani';
  if (n > 1) return `tra ${n} giorni`;
  return '';
}

export function attivaDate(): void {
  const o = oggi();
  const dati = document.getElementById('calendario-rif');
  const box = document.querySelector<HTMLElement>('[data-prossima]');
  if (dati && box) {
    const lista = JSON.parse(dati.textContent ?? '[]') as { data: string; modello: string }[];
    const prossima = lista.find((p) => p.data >= o);
    if (prossima && box.dataset.prossima !== prossima.modello) {
      const t = document.getElementById(prossima.modello) as HTMLTemplateElement | null;
      if (t) {
        box.replaceChildren(t.content.cloneNode(true));
        box.dataset.prossima = prossima.modello;
      }
    }
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-tra]')) {
    const t = testoTra(giorni(o, el.dataset.tra!));
    el.textContent = t;
    el.hidden = !t;
  }
  for (const tab of document.querySelectorAll<HTMLElement>('[data-evidenzia-prossima]')) {
    const righe = [...tab.querySelectorAll<HTMLElement>('[data-data]')];
    for (const r of righe) r.classList.remove('prossima');
    righe.find((r) => r.dataset.data! >= o && !r.dataset.giocata)?.classList.add('prossima');
  }
}
