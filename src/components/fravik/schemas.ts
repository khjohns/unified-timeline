/**
 * Fravik Form Schemas
 *
 * Zod validation schemas for fravik søknad forms.
 * Shared across modals for consistent validation.
 */

import { z } from 'zod';
import type { AttachmentFile } from '../../types';
import type { MaskinType, SoknadType } from '../../types/fravik';

// ========== MASKIN SCHEMA ==========

/**
 * Schema for maskin data (used in LeggTilMaskinModal and OpprettFravikModal)
 */
export const maskinSchema = z.object({
  maskin_type: z.enum(['Gravemaskin', 'Hjullaster', 'Lift', 'Annet'] as const, {
    errorMap: () => ({ message: 'Velg maskintype' }),
  }),
  annet_type: z.string().optional(),
  registreringsnummer: z.string().optional(),
  start_dato: z.string().min(1, 'Startdato er påkrevd'),
  slutt_dato: z.string().min(1, 'Sluttdato er påkrevd'),
  begrunnelse: z.string().min(20, 'Begrunnelse må være minst 20 tegn'),
  alternativer_vurdert: z.string().optional(),
  markedsundersokelse: z.boolean(),
  undersøkte_leverandorer: z.string().optional(),
  erstatningsmaskin: z.string().optional(),
  erstatningsdrivstoff: z.string().optional(),
  arbeidsbeskrivelse: z.string().optional(),
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

// ========== OPPRETT SØKNAD SCHEMA ==========

/**
 * Schema for creating a new fravik søknad (OpprettFravikModal)
 */
export const opprettSoknadSchema = z.object({
  // Prosjektinfo
  prosjekt_id: z.string().min(1, 'Prosjekt-ID er påkrevd'),
  prosjekt_navn: z.string().min(3, 'Prosjektnavn må være minst 3 tegn'),
  prosjekt_nummer: z.string().optional(),
  rammeavtale: z.string().optional(),
  hovedentreprenor: z.string().optional(),

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

// ========== SEND INN SCHEMA ==========

/**
 * Schema for submitting søknad for review (SendInnModal)
 */
export const sendInnSchema = z.object({
  avbotende_tiltak: z.string().optional(),
  konsekvenser_ved_avslag: z.string().optional(),
  bekreft_korrekt: z.boolean().refine((val) => val === true, {
    message: 'Du må bekrefte at informasjonen er korrekt',
  }),
});

export type SendInnFormData = z.infer<typeof sendInnSchema>;

// ========== MASKIN TYPE OPTIONS ==========

export const MASKIN_TYPE_OPTIONS: { value: MaskinType; label: string }[] = [
  { value: 'Gravemaskin', label: 'Gravemaskin' },
  { value: 'Hjullaster', label: 'Hjullaster' },
  { value: 'Lift', label: 'Lift' },
  { value: 'Annet', label: 'Annet' },
];

export const SOKNAD_TYPE_OPTIONS: { value: SoknadType; label: string }[] = [
  { value: 'machine', label: 'Maskin (enkeltmaskiner)' },
  { value: 'infrastructure', label: 'Infrastruktur (strøm/lading)' },
];
