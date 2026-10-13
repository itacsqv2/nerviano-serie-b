/**
 * Dati del sito, letti e validati in build (mai nel browser).
 * Si importano i JSON di data/ e si costruisce il dataset una volta sola per build.
 */
import { validaDati } from '../schemas/index.ts';
import { costruisciDataset, type Dataset } from './dataset.ts';
import stagione from '../../data/config/stagione.json';
import squadre from '../../data/config/squadre.json';
import sito from '../../data/config/sito.json';
import partite from '../../data/auto/partite.json';
import classificaFip from '../../data/auto/classifica_fip.json';
import giocatori from '../../data/auto/giocatori.json';
import rose from '../../data/auto/rose.json';
import tabellini from '../../data/auto/tabellini.json';
import carriere from '../../data/auto/carriere.json';
import meta from '../../data/auto/meta.json';
import scouting from '../../data/manuale/scouting.json';
import noteSquadre from '../../data/manuale/note_squadre.json';
import giocatoriExtra from '../../data/manuale/giocatori_extra.json';
import storia from '../../data/manuale/storia.json';
import guida from '../../data/manuale/guida.json';
import correzioni from '../../data/manuale/correzioni.json';
import foto from '../../data/manuale/foto.json';

let cache: Dataset | undefined;

export function dati(): Dataset {
  cache ??= costruisciDataset(
    validaDati({
      'config/stagione.json': stagione,
      'config/squadre.json': squadre,
      'config/sito.json': sitoConOverride(sito),
      'auto/partite.json': partite,
      'auto/classifica_fip.json': classificaFip,
      'auto/giocatori.json': giocatori,
      'auto/rose.json': rose,
      'auto/tabellini.json': tabellini,
      'auto/carriere.json': carriere,
      'auto/meta.json': meta,
      'manuale/scouting.json': scouting,
      'manuale/note_squadre.json': noteSquadre,
      'manuale/giocatori_extra.json': giocatoriExtra,
      'manuale/storia.json': storia,
      'manuale/guida.json': guida,
      'manuale/correzioni.json': correzioni,
      'manuale/foto.json': foto,
    }),
  );
  return cache;
}

/** FONTI_PLAYBASKET=false costruisce il sito come se fonti.playbasket fosse spento (usato dai test e dalla CI). */
function sitoConOverride(s: typeof sito) {
  const v = process.env.FONTI_PLAYBASKET;
  return v === undefined ? s : { ...s, fonti: { ...s.fonti, playbasket: v !== 'false' } };
}
