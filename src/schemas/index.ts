/**
 * Schemi zod di tutti i file in data/. Unica fonte di verità sulla forma dei dati:
 * li usano la pipeline (scripts/aggiorna), la validazione (scripts/valida.ts) e il sito (src/lib/data.ts).
 */
import { z } from 'zod';

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data ISO AAAA-MM-GG');
const ora = z.string().regex(/^\d{2}:\d{2}$/, 'ora HH:MM');
const stagione = z.string().regex(/^\d{4}\/\d{2}$/, 'stagione AAAA/AA');
const slug = z.string().regex(/^[a-z0-9]+$/, 'slug squadra: minuscole e cifre');
const idGiocatore = z.number().int().positive();
const idPartita = z.string().regex(/^\d{6}$/, 'numero gara FIP a 6 cifre');
const testo = z.string().min(1);
const colore = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'colore esadecimale #RRGGBB');
const motivo = testo;

// ---------------------------------------------------------------- config/

export const StagioneSchema = z.strictObject({
  stagione,
  squadra_riferimento: slug,
  giornate: z.number().int().positive(),
  turni_per_fase: z.number().int().positive(),
  partite_per_giornata: z.number().int().positive(),
  fip: z.strictObject({
    group: testo,
    regione_codice: testo,
    comitato_codice: testo,
    sesso: testo,
    codice_campionato: testo,
    codice_fase: testo,
    codice_girone: testo,
  }),
  playbasket: z.strictObject({
    season: z.number().int(),
    lt: z.number().int(),
    lf: testo,
    lr: testo,
    lp: testo,
    lc: testo,
    lg: z.number().int(),
    prefisso: testo,
  }),
});

export const SquadraSchema = z.strictObject({
  slug,
  nome: testo,
  breve: testo,
  sigla: z.string().regex(/^[A-Z0-9]{3}$/),
  citta: testo,
  provincia: z.string().regex(/^[A-Z]{2}$/),
  regione: testo,
  societa: testo,
  codice_fip: z.string().regex(/^\d{6}$/),
  nome_fip: testo.nullable(),
  pb_obj: z.number().int().positive(),
  nomi_pb: z.array(testo).min(1).nullable(),
  palestra: testo,
  indirizzo: testo,
  colori: z.strictObject({ primario: colore, secondario: colore }).nullable(),
  maglia_fip: testo.nullable(),
});
export const SquadreSchema = z.array(SquadraSchema);

export const SitoSchema = z.strictObject({
  titolo: testo,
  url: z.url(),
  email: z.email(),
  indicizzabile: z.boolean(),
  fonti: z.strictObject({ playbasket: z.boolean() }),
  user_agent: testo,
});

// ---------------------------------------------------------------- auto/

export const STATI_PARTITA = ['omologata', 'ufficioso', 'da_giocare'] as const;
export const STATI_TABELLINO = ['completo', 'incongruente', 'parziale', 'in_attesa', 'assente'] as const;

export const PartitaSchema = z.strictObject({
  id: idPartita,
  giornata: z.number().int().min(1),
  fase: z.enum(['andata', 'ritorno']),
  turno: z.number().int().min(1),
  data,
  ora: ora.nullable(),
  casa: slug,
  ospite: slug,
  pt_casa: z.number().int().min(0).nullable(),
  pt_ospite: z.number().int().min(0).nullable(),
  // stati FIP noti più eventuali classi sconosciute salvate grezze (§4.3)
  stato: z.union([z.enum(STATI_PARTITA), z.string().regex(/^fip:[a-z0-9-]+$/)]),
  palestra: testo.nullable(),
  citta: testo.nullable(),
  pb: z.strictObject({
    gtn: z.number().int().min(1),
    gtt: z.union([z.literal(1), z.literal(2)]),
    mn: z.number().int().min(1),
  }).nullable(),
  tabellino: z.enum(STATI_TABELLINO).nullable(),
});
export const PartiteSchema = z.array(PartitaSchema);

export const RigaClassificaSchema = z.strictObject({
  posizione: z.number().int().min(1),
  squadra: slug,
  punti: z.number().int(),
  g: z.number().int().min(0),
  v: z.number().int().min(0),
  p: z.number().int().min(0),
  pf: z.number().int().min(0),
  ps: z.number().int().min(0),
});
export const ClassificaFipSchema = z.array(RigaClassificaSchema);

export const GiocatoreSchema = z.strictObject({
  id: idGiocatore,
  cognome: testo,
  nome: z.string(),
  ruolo: z.enum(['Play', 'Guardia', 'Ala piccola', 'Ala forte', 'Centro']).nullable(),
  eta: z.number().int().min(10).max(80).nullable(),
  // PlayBasket a volte mostra solo la fascia («U19», «U17») al posto dell'età
  eta_fascia: z.string().regex(/^U\d{2}$/).nullable(),
  allenatore: z.boolean(),
});
export const GiocatoriSchema = z.array(GiocatoreSchema);

export const RosaSchema = z.strictObject({
  giocatore: idGiocatore,
  squadra: slug,
  numero: z.string().regex(/^\d{1,3}$/).nullable(),
  punti: z.number().int().min(0).nullable(),
  media: z.number().min(0).nullable(),
  in_rosa: z.boolean(),
});
export const RoseSchema = z.array(RosaSchema);

export const TabellinoSchema = z.strictObject({
  partita: idPartita,
  giocatore: idGiocatore,
  squadra: slug,
  punti: z.number().int().min(0),
});
export const TabelliniSchema = z.array(TabellinoSchema);

export const RigaCarrieraSchema = z.strictObject({
  giocatore: idGiocatore,
  stagione,
  squadra: testo,
  categoria: testo,
  punti: z.number().int().min(0).nullable(),
  presenze: z.number().int().min(0).nullable(),
  best: z.number().int().min(0).nullable(),
});
export const RiepilogoCarrieraSchema = z.strictObject({
  giocatore: idGiocatore,
  stagioni: z.number().int().min(0).nullable(),
  senior: z.number().int().min(0).nullable(),
  giovanili: z.number().int().min(0).nullable(),
  squadre: z.number().int().min(0).nullable(),
  punti: z.number().int().min(0).nullable(),
  presenze: z.number().int().min(0).nullable(),
  best: z.number().int().min(0).nullable(),
});
export const CarriereSchema = z.strictObject({
  righe: z.array(RigaCarrieraSchema),
  riepiloghi: z.array(RiepilogoCarrieraSchema),
});

export const MetaSchema = z.strictObject({
  fonti: z.strictObject({
    fip: z.strictObject({ aggiornato: data }),
    playbasket: z.strictObject({ aggiornato: data }),
  }),
  conteggi: z.record(z.string(), z.number().int().min(0)),
});

// ---------------------------------------------------------------- manuale/

const blocchiScheda = {
  tag: testo,
  profilo: testo,
  percorso: testo,
  lettura: testo,
  da_guardare: testo,
  autore: z.enum(['Claude', 'Christian']),
  scritta_il: data,
  dati_al: data,
};
export const SchedaScoutingSchema = z.strictObject({ giocatore: idGiocatore, ...blocchiScheda });
export const ScoutingSchema = z.array(SchedaScoutingSchema);

export const NotaSquadraSchema = z.strictObject({
  squadra: slug,
  stagione_precedente: testo.nullable(),
  nota: testo.nullable(),
  mercato: z.strictObject({ titolo: testo, ...blocchiScheda }).nullable(),
});
export const NoteSquadreSchema = z.array(NotaSquadraSchema);

export const GiocatoreExtraSchema = z.strictObject({
  giocatore: idGiocatore,
  altezza: z.number().int().min(140).max(240).nullable(),
  stato: z.enum(['Confermato', 'Nuovo arrivo', 'Dal vivaio']).nullable(),
  provenienza: testo.nullable(),
  doppio_tesseramento: testo.nullable(),
});
export const GiocatoriExtraSchema = z.array(GiocatoreExtraSchema);

export const StoriaSchema = z.strictObject({
  stagione,
  sintesi: z.array(z.strictObject({ id: testo, etichetta: testo, valore: testo, nota: testo })),
  playoff: z.array(z.strictObject({
    id: testo,
    turno: testo,
    gara: testo,
    data,
    casa: testo,
    ospite: testo,
    pt_casa: z.number().int().min(0),
    pt_ospite: z.number().int().min(0),
  })),
});

export const ZONE = ['Playoff', 'Salvezza', 'Playout', 'Retrocessione'] as const;
export const GuidaSchema = z.strictObject({
  zone: z.array(z.strictObject({
    id: testo,
    zona: z.enum(ZONE),
    da: z.number().int().min(1),
    a: z.number().int().min(1),
    descrizione: testo,
  })),
  tappe: z.array(z.strictObject({ id: testo, ordine: z.number().int(), titolo: testo, descrizione: testo })),
  date: z.array(z.strictObject({ id: testo, data, titolo: testo, nota: testo })),
  info: z.array(z.strictObject({ id: testo, valore: testo, nota: testo })),
});

export const CorrezioniSchema = z.strictObject({
  partite: z.array(z.strictObject({
    partita: idPartita,
    nota: testo.optional(),
    palestra: testo.optional(),
    citta: testo.optional(),
    escludi_medie: z.boolean().optional(),
    motivo,
  })),
  giocatori: z.array(z.strictObject({
    giocatore: idGiocatore,
    cognome: testo.optional(),
    nome: z.string().optional(),
    nascosto: z.boolean().optional(),
    motivo,
  })),
  carriere: z.array(z.strictObject({
    giocatore: idGiocatore,
    stagione,
    squadra: testo,
    categoria: testo.optional(),
    punti: z.number().int().min(0).nullable().optional(),
    presenze: z.number().int().min(0).nullable().optional(),
    best: z.number().int().min(0).nullable().optional(),
    rimuovi: z.boolean().optional(),
    motivo,
  })),
  penalizzazioni: z.array(z.strictObject({ squadra: slug, punti: z.number().int(), motivo })),
  eccezioni_controlli: z.array(z.strictObject({
    controllo: testo,
    chiave: testo,
    motivo,
  })),
});

export const FotoSchema = z.strictObject({
  giocatore: idGiocatore,
  file: z.string().regex(/^\d+\.webp$/),
  credito: testo,
  fonte: testo,
  permesso: testo,
  minorenne: z.boolean(),
  consenso_genitori: z.boolean().nullable(),
  aggiunta_il: data,
  nascosta: z.boolean().optional(),
});
export const FotoManifestSchema = z.array(FotoSchema);

// ---------------------------------------------------------------- elenco dei file

export const FILE_DATI = {
  'config/stagione.json': StagioneSchema,
  'config/squadre.json': SquadreSchema,
  'config/sito.json': SitoSchema,
  'auto/partite.json': PartiteSchema,
  'auto/classifica_fip.json': ClassificaFipSchema,
  'auto/giocatori.json': GiocatoriSchema,
  'auto/rose.json': RoseSchema,
  'auto/tabellini.json': TabelliniSchema,
  'auto/carriere.json': CarriereSchema,
  'auto/meta.json': MetaSchema,
  'manuale/scouting.json': ScoutingSchema,
  'manuale/note_squadre.json': NoteSquadreSchema,
  'manuale/giocatori_extra.json': GiocatoriExtraSchema,
  'manuale/storia.json': StoriaSchema,
  'manuale/guida.json': GuidaSchema,
  'manuale/correzioni.json': CorrezioniSchema,
  'manuale/foto.json': FotoManifestSchema,
} as const;

export type Stagione = z.infer<typeof StagioneSchema>;
export type Squadra = z.infer<typeof SquadraSchema>;
export type Sito = z.infer<typeof SitoSchema>;
export type Partita = z.infer<typeof PartitaSchema>;
export type RigaClassificaFip = z.infer<typeof RigaClassificaSchema>;
export type Giocatore = z.infer<typeof GiocatoreSchema>;
export type Rosa = z.infer<typeof RosaSchema>;
export type Tabellino = z.infer<typeof TabellinoSchema>;
export type RigaCarriera = z.infer<typeof RigaCarrieraSchema>;
export type RiepilogoCarriera = z.infer<typeof RiepilogoCarrieraSchema>;
export type Carriere = z.infer<typeof CarriereSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type SchedaScouting = z.infer<typeof SchedaScoutingSchema>;
export type NotaSquadra = z.infer<typeof NotaSquadraSchema>;
export type GiocatoreExtra = z.infer<typeof GiocatoreExtraSchema>;
export type Storia = z.infer<typeof StoriaSchema>;
export type Guida = z.infer<typeof GuidaSchema>;
export type Correzioni = z.infer<typeof CorrezioniSchema>;
export type Foto = z.infer<typeof FotoSchema>;

export interface DatiGrezzi {
  stagione: Stagione;
  squadre: Squadra[];
  sito: Sito;
  partite: Partita[];
  classifica_fip: RigaClassificaFip[];
  giocatori: Giocatore[];
  rose: Rosa[];
  tabellini: Tabellino[];
  carriere: Carriere;
  meta: Meta;
  scouting: SchedaScouting[];
  note_squadre: NotaSquadra[];
  giocatori_extra: GiocatoreExtra[];
  storia: Storia;
  guida: Guida;
  correzioni: Correzioni;
  foto: Foto[];
}

/** Valida tutti i file: restituisce i dati tipizzati o lancia un errore che elenca ogni problema. */
export function validaDati(grezzi: Record<keyof typeof FILE_DATI, unknown>): DatiGrezzi {
  const errori: string[] = [];
  const out: Record<string, unknown> = {};
  for (const [file, schema] of Object.entries(FILE_DATI)) {
    const r = (schema as z.ZodType).safeParse(grezzi[file as keyof typeof FILE_DATI]);
    if (r.success) out[file] = r.data;
    else for (const i of r.error.issues) errori.push(`${file} ${i.path.join('.')}: ${i.message}`);
  }
  if (errori.length) throw new Error(`Dati non validi:\n- ${errori.slice(0, 50).join('\n- ')}`);
  const g = (f: keyof typeof FILE_DATI) => out[f] as never;
  return {
    stagione: g('config/stagione.json'),
    squadre: g('config/squadre.json'),
    sito: g('config/sito.json'),
    partite: g('auto/partite.json'),
    classifica_fip: g('auto/classifica_fip.json'),
    giocatori: g('auto/giocatori.json'),
    rose: g('auto/rose.json'),
    tabellini: g('auto/tabellini.json'),
    carriere: g('auto/carriere.json'),
    meta: g('auto/meta.json'),
    scouting: g('manuale/scouting.json'),
    note_squadre: g('manuale/note_squadre.json'),
    giocatori_extra: g('manuale/giocatori_extra.json'),
    storia: g('manuale/storia.json'),
    guida: g('manuale/guida.json'),
    correzioni: g('manuale/correzioni.json'),
    foto: g('manuale/foto.json'),
  };
}
