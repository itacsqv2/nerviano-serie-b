# CLAUDE.md — Nerviano Basket

Sito statico di tifosi (non ufficiale) su Invalves PeB Nerviano, Serie B Interregionale 2026/27, Girone A.
Astro 7 statico + TypeScript strict + zod 4. Dati in JSON nel repository, pipeline di scraping a richiesta.
Interfaccia, testi, commenti e messaggi in **italiano**. Christian usa Windows: script npm cross-platform, percorsi con `path`.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` / `npm run build` / `npm run preview` | Sito in locale / build in `dist/` / anteprima della build |
| `npm run check` | `astro check` (tipi) |
| `npm test` | Vitest: calcoli, parser su fixture, client HTTP, foto, contrasto dei colori, dati del repo |
| `npm run valida` | Schemi zod + controlli di coerenza (`src/lib/controlli.ts`) + foto + header noindex |
| `npm run aggiorna [-- --completo \| --solo fip\|playbasket \| --prova \| --offline \| --proponi-config]` | Pipeline (`scripts/aggiorna/`) |
| `npm run foto` | Elabora `foto/da-elaborare/<id>.*` → `src/assets/giocatori/<id>.webp` |
| `npx tsx scripts/dev/server-csp.ts` | Serve `dist/` con gli header di `vercel.json` (per provare la CSP) |

Prima di ogni commit: `npm run check && npm test && npm run valida && npm run build`.

## Regole sui dati

- `data/auto/` lo scrive **solo** la pipeline. Mai modificarlo a mano: le correzioni vanno in `data/manuale/correzioni.json` (con `motivo`).
- `data/manuale/` e `data/config/` si scrivono a mano (o da Claude Code su richiesta), mai dalla pipeline.
- Chiavi snake_case in italiano; id giocatore = obj PlayBasket (intero); id partita = numero gara FIP (stringa a 6 cifre); squadre per `slug`.
- `null` per «non disponibile», mai stringhe vuote. Date ISO, ore `HH:MM`, stagioni `AAAA/AA`, fuso `Europe/Rome`.
- Ciò che si può calcolare (classifiche, medie, stato, provenienza, ex Nerviano, rango, sintesi) si calcola in `src/lib/`, non si salva.
- Se la validazione fallisce la pipeline non scrive nulla.

## Regole di scraping (non negoziabili)

- Solo **fip.it** e **playbasket.it**, tutto passa da `scripts/aggiorna/http.ts`.
- Rispettare robots.txt; User-Agent onesto da `sito.json` (mai imitare un browser); una richiesta alla volta per sito, ≥ 1,5 s di pausa; max 600 richieste.
- Su 403, pagine anti-bot o redirect verso altri siti: **fermarsi**. Mai aggirare blocchi (niente UA falsi, proxy, browser headless, captcha).
- Mai estrarre dati a mano dal browser. Mai scaricare foto o loghi. Mai chiamare modelli AI dalla pipeline.
- Non leggere né salvare: arbitri, ufficiali di campo, provvedimenti, «Riferimento», date/anni di nascita, recapiti.
- Non copiare articoli o cronache. Siti da non leggere mai in automatico: nervianobasket.it, basketnerviano.it, puntoebasket.it, varesenews, fippiemonte, pallacanestropavia, basketinside, legapallacanestro, social network.

## Privacy e minori

- Solo dati sportivi pubblici e pertinenti. Niente cookie, analytics o richieste a terze parti (font self-hosted).
- Foto solo dal manifest `data/manuale/foto.json`, con `permesso`; per i minorenni (età < 18 o sconosciuta) serve `consenso_genitori: true`.
- `nascosto: true` in `correzioni.json` toglie un giocatore da tutto il sito.

## Schede di scouting (`data/manuale/scouting.json`)

- In italiano, fattuali, basate **solo** sui dati dei JSON (mai su fonti esterne), con `dati_al` = data dei dati usati.
- Tono neutro e descrittivo, soprattutto per i minorenni: nessun giudizio sulla persona.
- `autore: "Claude"` → il sito mostra l'avviso «scritta con AI, senza aver visto le partite». Aggiornare `scritta_il` e `dati_al`.
- `npm run valida` segnala le schede da rivedere (più vecchie di 21 giorni o con media cambiata di oltre il 30%).

## Procedura «aggiorna i dati»

1. `git switch main && git pull`, poi `git switch -c dati/aggiornamento-AAAA-MM-GG`.
2. `npm run aggiorna` (o `-- --completo` se la classifica non torna). Leggere il report (`.cache/report.md`): errori, avvisi, schede da rivedere.
3. `npm run valida && npm run build`.
4. Commit dei soli file di `data/auto/`, push e pull request con il report nella descrizione. Il merge su `main` lo fa Christian.

## CSP e frontend

- La CSP in `vercel.json` non ha `'unsafe-inline'`: niente attributi `style`, niente `<script>` inline eseguibili (i dati per il browser vanno in `<script type="application/json">`), niente isole. SVG colorati con classi o attributi (`fill`), mai `style`.
- Colori e font solo in `src/styles/tokens.css`; `npm test` verifica il contrasto AA.
- JS client in `src/client/` (miglioramento progressivo: la pagina funziona anche senza).
- Ogni grafico ha la tabella dati equivalente.

## Git

- Lavoro su branch, mai push su `main` senza OK di Christian (il merge pubblica su Vercel).
- `legacy/` (vecchio progetto) è solo locale e in `.gitignore`.
