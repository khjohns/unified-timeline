/**
 * Fravik Form Schemas
 *
 * Zod validation schemas for fravik søknad forms.
 * Shared across modals for consistent validation.
 */

import { z } from 'zod';
import type { AttachmentFile } from '../../types';
import type {
  MaskinType,
  MaskinVekt,
  Arbeidskategori,
  Bruksintensitet,
  SoknadType,
  FravikGrunn,
  Drivstoff,
  StromtilgangStatus,
  ProsjektforholdType,
  AggregatType,
  Euroklasse,
} from '../../types/fravik';

// ========== KONSTANTER ==========

export const FRAVIK_GRUNNER: { value: FravikGrunn; label: string }[] = [
  { value: 'markedsmangel', label: 'Markedsmangel' },
  { value: 'leveringstid', label: 'Leveringstid' },
  { value: 'tekniske_begrensninger', label: 'Tekniske begrensninger' },
  { value: 'hms_krav', label: 'HMS-krav' },
  { value: 'annet', label: 'Annet' },
];

export const DRIVSTOFF_OPTIONS: { value: Drivstoff; label: string; description?: string }[] = [
  { value: 'HVO100', label: 'HVO100 (palmefritt)', description: 'Anbefalt - dokumentert palmefritt biodrivstoff' },
  { value: 'annet_biodrivstoff', label: 'Annet biodrivstoff', description: 'Utover omsetningskrav, ikke palmeoljebasert' },
  { value: 'diesel', label: 'Diesel', description: 'Kun med minimum Euro 6/VI' },
];

// ========== INFRASTRUKTUR KONSTANTER ==========

export const STROMTILGANG_STATUS_OPTIONS: { value: StromtilgangStatus; label: string; description: string }[] = [
  { value: 'ingen_strom', label: 'Ingen strøm tilgjengelig', description: 'Det finnes ikke strømtilkobling i nærheten' },
  { value: 'utilstrekkelig', label: 'Utilstrekkelig kapasitet', description: 'Tilgjengelig effekt dekker ikke behovet' },
  { value: 'geografisk_avstand', label: 'Geografisk avstand', description: 'For langt til nærmeste tilkoblingspunkt' },
];

export const PROSJEKTFORHOLD_OPTIONS: { value: ProsjektforholdType; label: string }[] = [
  { value: 'plassmangel', label: 'Plassmangel på byggeplassen' },
  { value: 'hms_hensyn', label: 'HMS-hensyn' },
  { value: 'stoykrav', label: 'Støykrav i området' },
  { value: 'adkomstbegrensninger', label: 'Adkomstbegrensninger' },
  { value: 'annet', label: 'Annet' },
];

export const AGGREGAT_TYPE_OPTIONS: { value: AggregatType; label: string; description: string }[] = [
  { value: 'dieselaggregat', label: 'Dieselaggregat', description: 'Standard dieseldrevet strømaggregat' },
  { value: 'hybridaggregat', label: 'Hybridaggregat', description: 'Kombinasjon av batteri og diesel' },
  { value: 'annet', label: 'Annet', description: 'Annen type erstatningsløsning' },
];

export const EUROKLASSE_OPTIONS: { value: Euroklasse; label: string; description: string }[] = [
  { value: 'euro_5', label: 'Euro 5', description: 'Ikke godkjent for nye fravik' },
  { value: 'euro_6', label: 'Euro 6', description: 'Minimum for dieselmotorer (personbiler)' },
  { value: 'euro_vi', label: 'Euro VI', description: 'Minimum for tunge kjøretøy og aggregater' },
];

// ========== MASKIN SCHEMA ==========

/**
 * Schema for maskin data (used in LeggTilMaskinModal and OpprettFravikModal)
 */
export const maskinSchema = z.object({
  maskin_type: z.enum([
    'Gravemaskin',
    'Hjullaster',
    'Lift',
    'Asfaltutlegger',
    'Bergboremaskin',
    'Borerigg',
    'Hjuldoser',
    'Pælemaskin',
    'Spuntmaskin',
    'Vals',
    'Annet',
  ] as const, {
    errorMap: () => ({ message: 'Velg maskintype' }),
  }),
  annet_type: z.string().optional(),
  vekt: z.enum(['liten', 'medium', 'stor', 'svart_stor'] as const, {
    errorMap: () => ({ message: 'Velg vektkategori' }),
  }),
  registreringsnummer: z.string().optional(),
  start_dato: z.string().min(1, 'Startdato er påkrevd'),
  slutt_dato: z.string().min(1, 'Sluttdato er påkrevd'),
  // Grunner for fravik - påkrevd, minst én
  grunner: z.array(z.enum(['markedsmangel', 'leveringstid', 'tekniske_begrensninger', 'hms_krav', 'annet'] as const))
    .min(1, 'Velg minst én grunn for fravik'),
  begrunnelse: z.string().min(20, 'Detaljert begrunnelse må være minst 20 tegn'),
  alternativer_vurdert: z.string().min(10, 'Beskriv alternative løsninger (minst 10 tegn)'),
  markedsundersokelse: z.boolean(),
  undersøkte_leverandorer: z.string().optional(),
  // Erstatningsmaskin - påkrevde felt
  erstatningsmaskin: z.string().min(1, 'Oppgi erstatningsmaskin'),
  erstatningsdrivstoff: z.enum(['HVO100', 'annet_biodrivstoff', 'diesel'] as const, {
    errorMap: () => ({ message: 'Velg drivstoff for erstatningsmaskin' }),
  }),
  arbeidsbeskrivelse: z.string().min(10, 'Beskriv arbeidsoppgaver (minst 10 tegn)'),
  // Nye felter for kategorisering og rapportering
  arbeidskategori: z.enum(['graving', 'lasting', 'lofting', 'boring_peling', 'asfalt_komprimering', 'annet'] as const, {
    errorMap: () => ({ message: 'Velg arbeidskategori' }),
  }),
  bruksintensitet: z.enum(['sporadisk', 'normal', 'intensiv'] as const, {
    errorMap: () => ({ message: 'Velg bruksintensitet' }),
  }),
  estimert_drivstofforbruk: z.number().min(0, 'Må være et positivt tall').optional(),
  attachments: z.array(z.custom<AttachmentFile>()).optional().default([]),
}).refine(
  (data) => data.maskin_type !== 'Annet' || (data.annet_type && data.annet_type.length >= 3),
  { message: 'Spesifiser maskintype (minst 3 tegn)', path: ['annet_type'] }
).refine(
  (data) => !data.markedsundersokelse || (data.undersøkte_leverandorer && data.undersøkte_leverandorer.length >= 10),
  { message: 'Beskriv undersøkte leverandører (minst 10 tegn)', path: ['undersøkte_leverandorer'] }
).refine(
  (data) => {
    if (!data.start_dato || !data.slutt_dato) return true;
    return new Date(data.slutt_dato) >= new Date(data.start_dato);
  },
  { message: 'Sluttdato må være etter startdato', path: ['slutt_dato'] }
);

export type MaskinFormData = z.infer<typeof maskinSchema>;

// ========== INFRASTRUKTUR SCHEMA ==========

/**
 * Schema for infrastruktur data (used in InfrastrukturModal)
 * For søknader om fravik fra utslippsfrie krav for elektrisk infrastruktur på byggeplass.
 */
export const infrastrukturSchema = z.object({
  // Periode
  start_dato: z.string().min(1, 'Startdato er påkrevd'),
  slutt_dato: z.string().min(1, 'Sluttdato er påkrevd'),

  // Strømtilgang - strukturerte felter
  stromtilgang_status: z.enum(['ingen_strom', 'utilstrekkelig', 'geografisk_avstand'] as const, {
    errorMap: () => ({ message: 'Velg status for strømtilgang' }),
  }),
  avstand_til_tilkobling_meter: z.number().min(0, 'Må være et positivt tall').optional(),
  tilgjengelig_effekt_kw: z.number().min(0, 'Må være et positivt tall').optional(),
  effektbehov_kw: z.number().min(0, 'Må være et positivt tall'),
  stromtilgang_tilleggsbeskrivelse: z.string().optional(),

  // Vurderte alternativer
  mobil_batteri_vurdert: z.boolean().default(false),
  midlertidig_nett_vurdert: z.boolean().default(false),
  redusert_effekt_vurdert: z.boolean().default(false),
  faseinndeling_vurdert: z.boolean().default(false),
  alternative_metoder: z.string().optional(),

  // Prosjektspesifikke forhold - strukturerte felter
  prosjektforhold: z.array(z.enum(['plassmangel', 'hms_hensyn', 'stoykrav', 'adkomstbegrensninger', 'annet'] as const))
    .default([]),
  prosjektforhold_beskrivelse: z.string().optional(),

  // Kostnadsvurdering - strukturerte felter
  kostnad_utslippsfri_nok: z.number().min(0, 'Må være et positivt tall'),
  kostnad_fossil_nok: z.number().min(0, 'Må være et positivt tall'),
  prosjektkostnad_nok: z.number().min(0, 'Må være et positivt tall').optional(),
  kostnad_tilleggsbeskrivelse: z.string().optional(),

  // Erstatningsløsning - strukturerte felter
  aggregat_type: z.enum(['dieselaggregat', 'hybridaggregat', 'annet'] as const, {
    errorMap: () => ({ message: 'Velg type aggregat' }),
  }),
  aggregat_type_annet: z.string().optional(),
  euroklasse: z.enum(['euro_5', 'euro_6', 'euro_vi'] as const, {
    errorMap: () => ({ message: 'Velg euroklasse' }),
  }),
  erstatningsdrivstoff: z.enum(['HVO100', 'annet_biodrivstoff', 'diesel'] as const, {
    errorMap: () => ({ message: 'Velg drivstoff' }),
  }),
  aggregat_modell: z.string().optional(),

  // Vedlegg
  attachments: z.array(z.custom<AttachmentFile>()).optional().default([]),
}).refine(
  (data) => {
    if (!data.start_dato || !data.slutt_dato) return true;
    return new Date(data.slutt_dato) >= new Date(data.start_dato);
  },
  { message: 'Sluttdato må være etter startdato', path: ['slutt_dato'] }
).refine(
  (data) => data.aggregat_type !== 'annet' || (data.aggregat_type_annet && data.aggregat_type_annet.length >= 3),
  { message: 'Spesifiser type aggregat (minst 3 tegn)', path: ['aggregat_type_annet'] }
);

export type InfrastrukturFormData = z.infer<typeof infrastrukturSchema>;

// ========== OPPRETT SØKNAD SCHEMA ==========

/**
 * Schema for creating a new fravik søknad (OpprettFravikModal)
 */
export const opprettSoknadSchema = z.object({
  // Prosjektinfo
  prosjekt_navn: z.string().min(3, 'Prosjektnavn må være minst 3 tegn'),
  prosjekt_nummer: z.string().optional(),
  rammeavtale: z.string().optional(),
  entreprenor: z.string().optional(),

  // Søkerinfo
  soker_navn: z.string().min(2, 'Navn er påkrevd'),
  soker_epost: z.string().email('Ugyldig e-postadresse').optional().or(z.literal('')),

  // Søknadstype
  soknad_type: z.enum(['machine', 'infrastructure'] as const, {
    errorMap: () => ({ message: 'Velg søknadstype' }),
  }),

  // Haste
  er_haste: z.boolean().default(false),
  haste_begrunnelse: z.string().optional(),
  frist_for_svar: z.string().optional(),
}).refine(
  (data) => !data.er_haste || (data.haste_begrunnelse && data.haste_begrunnelse.length >= 10),
  { message: 'Begrunnelse for hastebehandling er påkrevd (minst 10 tegn)', path: ['haste_begrunnelse'] }
);

export type OpprettSoknadFormData = z.infer<typeof opprettSoknadSchema>;

// ========== MASKIN TYPE OPTIONS ==========

export const MASKIN_TYPE_OPTIONS: { value: MaskinType; label: string }[] = [
  { value: 'Gravemaskin', label: 'Gravemaskin' },
  { value: 'Hjullaster', label: 'Hjullaster' },
  { value: 'Lift', label: 'Lift' },
  { value: 'Asfaltutlegger', label: 'Asfaltutlegger' },
  { value: 'Bergboremaskin', label: 'Bergboremaskin' },
  { value: 'Borerigg', label: 'Borerigg' },
  { value: 'Hjuldoser', label: 'Hjuldoser' },
  { value: 'Pælemaskin', label: 'Pælemaskin' },
  { value: 'Spuntmaskin', label: 'Spuntmaskin' },
  { value: 'Vals', label: 'Vals' },
  { value: 'Annet', label: 'Annet' },
];

/** Grupperte maskintyper for bedre visuell organisering i Select */
export const MASKIN_TYPE_GROUPS: { label: string; options: { value: MaskinType; label: string }[] }[] = [
  {
    label: 'Graving og planering',
    options: [
      { value: 'Gravemaskin', label: 'Gravemaskin' },
      { value: 'Hjullaster', label: 'Hjullaster' },
      { value: 'Hjuldoser', label: 'Hjuldoser' },
    ],
  },
  {
    label: 'Boring og peling',
    options: [
      { value: 'Bergboremaskin', label: 'Bergboremaskin' },
      { value: 'Borerigg', label: 'Borerigg' },
      { value: 'Pælemaskin', label: 'Pælemaskin' },
      { value: 'Spuntmaskin', label: 'Spuntmaskin' },
    ],
  },
  {
    label: 'Asfalt og vei',
    options: [
      { value: 'Asfaltutlegger', label: 'Asfaltutlegger' },
      { value: 'Vals', label: 'Vals' },
    ],
  },
  {
    label: 'Løfting',
    options: [
      { value: 'Lift', label: 'Lift' },
    ],
  },
  {
    label: 'Annet',
    options: [
      { value: 'Annet', label: 'Annet' },
    ],
  },
];

export const MASKIN_VEKT_OPTIONS: { value: MaskinVekt; label: string; description: string }[] = [
  { value: 'liten', label: 'Liten', description: 'Mindre enn 8 tonn' },
  { value: 'medium', label: 'Medium', description: '8–20 tonn' },
  { value: 'stor', label: 'Stor', description: '20–50 tonn' },
  { value: 'svart_stor', label: 'Svært stor', description: 'Større enn 50 tonn' },
];

export const ARBEIDSKATEGORI_OPTIONS: { value: Arbeidskategori; label: string; description: string }[] = [
  { value: 'graving', label: 'Graving', description: 'Grøfter, fundamenter, masseuttak' },
  { value: 'lasting', label: 'Lasting', description: 'Lasting/lossing av masser' },
  { value: 'lofting', label: 'Løfting', description: 'Kranarbeid, montasje' },
  { value: 'boring_peling', label: 'Boring/pæling', description: 'Fjellboring, pæling, spunting' },
  { value: 'asfalt_komprimering', label: 'Asfalt/komprimering', description: 'Utlegging, komprimering' },
  { value: 'annet', label: 'Annet', description: 'Andre arbeidstyper' },
];

export const BRUKSINTENSITET_OPTIONS: { value: Bruksintensitet; label: string; description: string }[] = [
  { value: 'sporadisk', label: 'Sporadisk', description: 'Mindre enn 2 timer per dag' },
  { value: 'normal', label: 'Normal', description: '2–6 timer per dag' },
  { value: 'intensiv', label: 'Intensiv', description: 'Mer enn 6 timer per dag' },
];

export const SOKNAD_TYPE_OPTIONS: { value: SoknadType; label: string }[] = [
  { value: 'machine', label: 'Maskin (enkeltmaskiner)' },
  { value: 'infrastructure', label: 'Infrastruktur (strøm/lading)' },
];
