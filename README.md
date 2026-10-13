# 🏀 Nerviano Basket

Il sito dei tifosi di **Invalves PeB Nerviano** in Serie B Interregionale 2026/27 (Conference Nord, Girone A):
calendario, classifica, la rosa, le avversarie, le schede dei giocatori e i marcatori del girone.

> Pagina non ufficiale curata da un tifoso: non è collegata alla società, alla FIP né a PlayBasket.

Il sito è **statico**: tutte le pagine vengono generate una volta sola, a partire da file JSON salvati in questo repository.
Niente database, niente server, niente cookie. Vercel pubblica il sito a ogni modifica del branch `main`.

---

## Indice

1. [Stato dei lavori](#stato-dei-lavori)
2. [Come è fatto](#come-è-fatto)
3. [Primo avvio sul PC](#primo-avvio-sul-pc)
4. [I comandi](#i-comandi)
5. [Dove stanno i dati](#dove-stanno-i-dati)
6. [Le cose di tutti i giorni](#le-cose-di-tutti-i-giorni)
   - [Aggiornare i dati](#aggiornare-i-dati)
   - [Controllare e approvare una pull request](#controllare-e-approvare-una-pull-request)
   - [Modificare un testo o una scheda](#modificare-un-testo-o-una-scheda)
   - [Correggere un dato o nascondere un giocatore](#correggere-un-dato-o-nascondere-un-giocatore)
   - [Aggiungere una foto](#aggiungere-una-foto)
   - [Cambiare i colori](#cambiare-i-colori)
7. [Se una fonte blocca la pipeline](#se-una-fonte-blocca-la-pipeline)
8. [Cambio di stagione](#cambio-di-stagione)
9. [Prima di rendere pubblico il sito](#prima-di-rendere-pubblico-il-sito)
10. [Domande frequenti](#domande-frequenti)

---

## Stato dei lavori

Il nuovo sito si sta costruendo sul branch `rebuild`. Finché non viene unito a `main`, il sito online resta quello vecchio.

| Fase | Cosa | Stato |
|---|---|---|
| 1 | Progetto Astro, schemi dei dati, migrazione dal vecchio sito, `npm run valida` | ✅ fatto |
| 2 | Tutte le pagine (home, calendario, classifica, Nerviano, avversarie, giocatori, partite, marcatori, guida, note legali) | ✅ fatto |
| 3 | Grafica: palette, caratteri, tema chiaro e scuro, badge e avatar | ✅ fatto |
| 4 | Pipeline di aggiornamento da FIP e PlayBasket (`npm run aggiorna`) | ✅ scritta e testata; manca la prima prova sui siti veri (servono email e URL in `sito.json`) |
| 5 | Foto dei giocatori (`npm run foto`) | ✅ fatto |
| 6 | Controlli automatici su GitHub, header di sicurezza, `CLAUDE.md` | ✅ fatto (da provare su GitHub dopo il push) |
| 7 | Prima prova di «Aggiorna dati» da GitHub, dopo il merge | ⏳ da fare |

Le parti segnate con 🚧 sono pronte ma non ancora provate sui siti veri o su GitHub.

---

## Come è fatto

```
FIP (calendario, risultati, classifica)  ─┐
                                          ├─►  npm run aggiorna  ─►  data/auto/*.json  ─┐
PlayBasket (rose, tabellini, carriere)   ─┘                                            ├─►  npm run build  ─►  dist/  ─►  Vercel
                                       testi e correzioni scritti a mano: data/manuale/ ─┘
```

- **Astro** genera le pagine HTML. Nel browser gira solo un po' di JavaScript (circa 2 KB) per ordinare le tabelle,
  filtrare il calendario, cercare un giocatore e calcolare «tra quanti giorni» c'è la prossima partita.
- I **dati** sono file JSON in `data/`, controllati da schemi (zod) prima di ogni build: se un file non è valido, la build si ferma.
- I **grafici** sono disegni SVG preparati in build: nessuna libreria grafica viene scaricata dal browser.
- I **caratteri** (Barlow e Barlow Condensed) sono ospitati dal sito stesso: nessuna chiamata a Google.

### Le cartelle

| Cartella | Cosa contiene |
|---|---|
| `data/config/` | Stagione, squadre e impostazioni del sito. Scritti a mano |
| `data/auto/` | Partite, classifica FIP, giocatori, rose, tabellini, carriere. Li scrive **solo** la pipeline |
| `data/manuale/` | Schede di scouting, note sulle squadre, storia, guida, correzioni, foto. Scritti a mano (o da Claude Code su richiesta) |
| `src/` | Il sito: pagine, componenti, stili, calcoli |
| `src/styles/tokens.css` | **Tutti** i colori e i caratteri del sito |
| `scripts/` | Pipeline di aggiornamento, validazione, migrazione, foto |
| `tests/` | Test automatici (le pagine di esempio di FIP e PlayBasket sono in `tests/fixtures/`, senza dati personali) |
| `.github/workflows/` | `ci.yml` (controlli a ogni push) e `aggiorna-dati.yml` (il pulsante «Aggiorna dati») |
| `CLAUDE.md` | Le regole del progetto per Claude Code |
| `legacy/` | Copia del vecchio progetto, solo sul PC (non va su GitHub) |

---

## Primo avvio sul PC

Servono [Node.js 24](https://nodejs.org/) e Git.

```powershell
git clone https://github.com/itacsqv2/nerviano-serie-b.git
cd nerviano-serie-b
git switch rebuild        # finché il nuovo sito non è su main
npm ci                    # installa le dipendenze (la prima volta ci mette un po')
npm run dev               # apre il sito in locale
```

Poi apri **http://localhost:4321** nel browser. Ogni modifica ai file si vede subito.
Per fermare il sito premi `Ctrl+C` nel terminale.

---

## I comandi

| Comando | A cosa serve |
|---|---|
| `npm run dev` | Sito in locale, si aggiorna mentre modifichi |
| `npm run build` | Costruisce il sito definitivo in `dist/` |
| `npm run preview` | Mostra il sito costruito con `build`, come sarà online |
| `npm run valida` | Controlla tutti i JSON e la coerenza dei dati (vedi sotto) |
| `npm test` | Lancia i test automatici |
| `npm run check` | Controlla i tipi del codice |
| `npm run aggiorna` 🚧 | Legge FIP e PlayBasket e aggiorna `data/auto/` |
| `npm run foto` | Prepara le foto dei giocatori |
| `npm run migra` | Una tantum, già fatto: ricreava i dati dal vecchio progetto in `legacy/`. Si rifiuta di partire se `data/manuale/` esiste (con `-- --force` lo sovrascrive: non farlo) |

### Che cosa controlla `npm run valida`

**Errori** (bloccano tutto):

- un file che non rispetta il suo schema;
- un calendario sbagliato: 210 partite, 7 per giornata, ogni squadra 14 in casa e 14 fuori, andata e ritorno speculari;
- la classifica calcolata con le gare omologate diversa da quella ufficiale FIP;
- un riferimento a un giocatore, una squadra o una partita che non esiste;
- una foto senza permesso, o di un minorenne senza consenso dei genitori.

**Avvisi** (non bloccano, vanno letti):

- tabellini mancanti, parziali o con punti diversi dal risultato FIP;
- totali di carriera diversi dal riepilogo PlayBasket;
- schede di scouting da rivedere (scritte da più di 21 giorni, o con una media punti cambiata di oltre il 30%).

---

## Dove stanno i dati

| File | Cosa contiene | Chi lo scrive |
|---|---|---|
| `config/stagione.json` | Stagione, codici FIP e PlayBasket del girone, squadra di riferimento | a mano |
| `config/squadre.json` | Le 15 squadre: nomi, sigla, città, palestra, codici, colori | a mano |
| `config/sito.json` | Titolo, URL, email di contatto, indicizzazione, fonti attive | a mano |
| `auto/partite.json` | Le 210 partite con data, ora, campo, risultato e stato | pipeline |
| `auto/classifica_fip.json` | La classifica ufficiale FIP | pipeline |
| `auto/giocatori.json` | Nome, ruolo ed età dei giocatori (mai la data di nascita) | pipeline |
| `auto/rose.json` | Chi gioca in quale squadra, con numero di maglia | pipeline |
| `auto/tabellini.json` | Punti di ogni giocatore in ogni partita | pipeline |
| `auto/carriere.json` | Le stagioni di ogni giocatore | pipeline |
| `auto/meta.json` | Data dell'ultimo aggiornamento di ogni fonte | pipeline |
| `manuale/scouting.json` | Le schede di scouting | a mano / Claude Code |
| `manuale/note_squadre.json` | Note sulle squadre, stagione scorsa, mercato | a mano / Claude Code |
| `manuale/giocatori_extra.json` | Altezza e stato curato dei giocatori di Nerviano | a mano |
| `manuale/storia.json`, `manuale/guida.json` | La stagione 2025/26 e la guida al campionato | a mano |
| `manuale/correzioni.json` | Correzioni applicate sopra i dati automatici | a mano |
| `manuale/foto.json` | L'elenco delle foto con i permessi | a mano |

**Regola d'oro:** non modificare mai a mano i file in `data/auto/`. Al prossimo aggiornamento verrebbero sovrascritti.
Se un dato automatico è sbagliato, si corregge in `data/manuale/correzioni.json`.

Tutto ciò che si può calcolare (classifica provvisoria, medie, stato «Confermato» o «Nuovo arrivo», ex Nerviano,
sintesi automatica dei giocatori…) **non** è salvato: lo calcola il sito a ogni build.

---

## Le cose di tutti i giorni

### Aggiornare i dati

🚧 *La pipeline è pronta ma non è ancora stata provata sui siti veri: prima vanno compilati `url` ed `email` in `data/config/sito.json`.*

**Una volta sola, prima della GitHub Action:** nelle impostazioni del repository (Settings → Actions → General) attiva «Allow GitHub Actions to create and approve pull requests».

**Da GitHub (consigliato):**

1. Apri il repository su GitHub → scheda **Actions** → **Aggiorna dati** → **Run workflow**.
2. Lascia «completo» spento per l'aggiornamento normale (4-5 minuti). Accendilo a inizio stagione o se la classifica non torna (12-15 minuti).
3. Alla fine, nel riepilogo della workflow trovi il report: nuovi risultati, variazioni di classifica, marcatori della giornata, avvisi.
4. Se ci sono novità, GitHub apre una pull request «dati/aggiornamento». Vedi il punto successivo.

**Dal PC:**

```powershell
git switch main
git pull
npm run aggiorna                 # aggiornamento normale
npm run aggiorna -- --prova      # fa tutto ma non scrive nulla: solo il report
npm run aggiorna -- --completo   # rilegge tutta la stagione
npm run aggiorna -- --solo fip   # una sola fonte (fip oppure playbasket)
```

Il report finisce anche in `.cache/report.md`. Poi crea un branch, fai commit e apri una pull request,
oppure chiedi a Claude Code: «aggiorna i dati».

La pipeline è educata: legge solo fip.it e playbasket.it, rispetta i loro robots.txt, si presenta con un nome onesto,
fa una richiesta alla volta con almeno un secondo e mezzo di pausa, e si ferma da sola se qualcosa non va.
Se i dati letti non sono validi **non scrive nulla**.

### Controllare e approvare una pull request

1. Apri la pull request su GitHub: nella descrizione c'è il report.
2. Vercel aggiunge un commento con il link all'**anteprima**: aprila e guarda home, classifica e una pagina giocatore.
3. Nella scheda **Files changed** devono esserci solo file di `data/auto/`.
4. Se il controllo verde ✅ è passato e l'anteprima è a posto, premi **Merge pull request**: dopo un minuto il sito è aggiornato.

### Modificare un testo o una scheda

I testi delle schede sono in `data/manuale/scouting.json`. Ogni scheda ha questa forma:

```json
{
  "giocatore": 14016,
  "tag": "Nuovo arrivo · Veterano",
  "profilo": "…",
  "percorso": "…",
  "lettura": "…",
  "da_guardare": "…",
  "autore": "Claude",
  "scritta_il": "2026-10-12",
  "dati_al": "2026-10-12"
}
```

- `giocatore` è il numero del giocatore su PlayBasket (si legge nell'indirizzo della sua pagina, `obj=…`).
- Se riscrivi tu la scheda, metti `"autore": "Christian"`: sparisce l'avviso «scritta con AI».
- Aggiorna `scritta_il` e `dati_al` con la data di oggi.

Dopo la modifica lancia `npm run valida` e `npm run dev` per vedere il risultato.

Si può anche chiedere a Claude Code, per esempio: «riscrivi la scheda di Maspero con i dati aggiornati».
Le schede vanno scritte in italiano, solo con fatti presi dai JSON, con un tono neutro per i minorenni.

Gli altri testi: note sulle squadre e mercato in `note_squadre.json`, stagione scorsa in `storia.json`,
zone, date e formula in `guida.json`. I testi fissi delle pagine sono nei file di `src/pages/`.

### Correggere un dato o nascondere un giocatore

In `data/manuale/correzioni.json`. Ogni voce ha un `motivo`, per ricordarsi perché c'è.

```json
{
  "partite": [
    { "partita": "000518", "nota": "Risultato a tavolino", "escludi_medie": true, "motivo": "…" }
  ],
  "giocatori": [
    { "giocatore": 123456, "nascosto": true, "motivo": "Richiesta di rimozione del 2026-11-02" }
  ],
  "carriere": [],
  "penalizzazioni": [
    { "squadra": "saronno", "punti": 1, "motivo": "Penalizzazione FIP comunicato n. …" }
  ],
  "eccezioni_controlli": [
    { "controllo": "tabellino", "chiave": "000518", "motivo": "…" }
  ]
}
```

- **`nascosto: true`** toglie il giocatore da **tutto** il sito alla build successiva: pagina personale, rose,
  tabellini, marcatori, ricerca e foto. È la risposta alle richieste di rimozione.
- **`penalizzazioni`** servono se la FIP toglie punti in classifica: senza, il controllo della classifica fallisce.
- **`eccezioni_controlli`** zittiscono un avviso già noto e accettato (`controllo` può essere `tabellino`, `classifica`, `carriera`, `punti_rosa`).

### Aggiungere una foto

Le foto **non** si scaricano da internet: le fornisci tu, solo con il permesso del club o del fotografo.
Per i minorenni serve il consenso dei genitori raccolto dalla società. Senza foto il sito mostra un riquadro con iniziali e numero.

1. Metti l'originale in `foto/da-elaborare/<id>.jpg` (la cartella non va su GitHub).
2. Aggiungi una voce in `data/manuale/foto.json`:

   ```json
   {
     "giocatore": 14016,
     "file": "14016.webp",
     "credito": "Foto: Mario Rossi",
     "fonte": "fornita da U.S. Nervianese PuntoeBasket",
     "permesso": "autorizzazione via email del 2026-10-20",
     "minorenne": false,
     "consenso_genitori": null,
     "aggiunta_il": "2026-10-20"
   }
   ```

3. Lancia `npm run foto`: ritaglia la foto in 4:5, la rimpicciolisce e **toglie tutti i metadati** (GPS compreso).
4. Lancia `npm run valida`, poi commit e pull request.

Per togliere una foto cancella la voce e il file `src/assets/giocatori/<id>.webp`, oppure metti `"nascosta": true`.
⚠️ La foto resta comunque nella storia di Git: per cancellarla del tutto bisogna riscrivere la storia del repository.

### Cambiare i colori

Tutti i colori e i caratteri sono in **`src/styles/tokens.css`**, con una parte per il tema chiaro e una per quello scuro.
I nomi parlano da soli: `--sfondo`, `--testo`, `--accento`, `--vittoria`, `--sconfitta`…

Dopo una modifica lancia `npm test`: un test controlla che ogni coppia testo/sfondo resti leggibile
(contrasto WCAG AA, anche per chi vede poco). Se un test fallisce, scurisci o schiarisci il colore indicato.

I colori delle squadre (usati nei badge e negli avatar) sono in `data/config/squadre.json`, campo `colori`.

---

## Se una fonte blocca la pipeline

Se FIP o PlayBasket rispondono «accesso negato» o mostrano una pagina di verifica anti-bot, la pipeline
**si ferma e lo dice**. Non prova ad aggirare il blocco: niente browser finti, proxy o trucchi. È una scelta voluta.

Cosa fare:

1. Se il blocco riguarda solo i server di GitHub, lancia `npm run aggiorna` dal tuo PC e fai push (oppure chiedi a Claude Code).
2. Se il blocco c'è anche dal PC, aspetta qualche giorno e riprova con calma.
3. Se continua, scrivi al sito in questione e chiedi il permesso.
4. Per escludere PlayBasket: in `data/config/sito.json` metti `"fonti": { "playbasket": false }`. La pipeline non lo contatta più
   e il sito toglie pagine dei giocatori, marcatori, rose, schede e ricerca. Restano calendario, classifica, risultati e guida.

---

## Cambio di stagione

1. **Archivia la stagione chiusa:** copia `data/auto/` e `data/manuale/` in `data/archivio/2026-27/`.
2. **Codici FIP:** su [fip.it/risultati](https://fip.it/risultati/) scegli il nuovo campionato e girone, poi copia dall'indirizzo
   i parametri `regione_codice`, `comitato_codice`, `codice_campionato`, `codice_fase` e `codice_girone` in `config/stagione.json`.
3. **Codici PlayBasket:** nel menu del campionato su playbasket.it, apri il calendario del girone e copia dall'indirizzo `season` e `lg`.
4. **Squadre:** aggiorna `config/squadre.json`. L'`obj` PlayBasket di una squadra si legge nell'indirizzo della sua pagina (`club.php?obj=…`).
   `npm run aggiorna -- --proponi-config` 🚧 propone nomi FIP, maglie e varianti dei nomi PlayBasket in `.cache/squadre-proposta.json`.
5. Aggiorna `stagione` in `config/stagione.json`, svuota le schede in `manuale/scouting.json` e aggiorna guida e storia.
6. Lancia `npm run aggiorna -- --completo`, poi `npm run valida` e `npm run build`.

---

## Prima di rendere pubblico il sito

- [ ] **Chiedere il permesso a PlayBasket** per usare i loro dati (lo chiedono per email: info@playbasket.it).
- [ ] Compilare `url` ed `email` veri in `data/config/sito.json` (oggi sono segnaposto e la pipeline non parte).
- [ ] Valutare di rendere **privato** il repository: oggi è pubblico e chiunque può scaricare i JSON con rose e carriere, anche di minorenni.
- [ ] Rileggere le note legali (`src/pages/note-legali.astro`).
- [ ] Decidere se il sito deve comparire su Google: `"indicizzabile": true` in `sito.json` toglie il `noindex` e pubblica la sitemap.
- [ ] Controllare che le foto pubblicate abbiano tutte permesso e, per i minorenni, consenso dei genitori.

---

## Domande frequenti

**Perché la classifica è diversa da quella FIP?**
Sul sito ci sono due classifiche: quella **ufficiale FIP**, che conta solo le gare omologate, e quella **provvisoria**,
che comprende anche i risultati non ancora omologati. La provvisoria compare solo quando serve, con un avviso.

**Perché un giocatore ha 0 partite ma ha giocato?**
I punti arrivano dai tabellini di PlayBasket, che le società caricano qualche giorno dopo la partita (a volte mai).

**Perché le date «tra 3 giorni» sono giuste anche se non aggiorno?**
Le calcola il browser con la data di oggi. Senza JavaScript si vede la data della prossima partita al momento dell'ultimo aggiornamento.

**Il sito usa cookie o statistiche?**
No. Nessun cookie, nessuna statistica di visita, nessuna richiesta a siti esterni.

**Chi scrive le schede di scouting?**
Claude, a partire dai soli dati PlayBasket, senza aver visto le partite: ogni scheda lo dice. Si possono riscrivere a mano.
