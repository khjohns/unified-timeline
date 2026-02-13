/**
 * EndringsordreForm Component
 *
 * Shared form component for endringsordre (change order) data entry.
 * Used by both OpprettEndringsordre page and UtstEndringsordreModal
 * to ensure consistent UI and validation.
 *
 * Extracted from UtstEndringsordreModal.tsx following the same pattern
 * as GrunnlagForm.tsx.
 */

import { useMemo } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  CurrencyInput,
  DatePicker,
  FormField,
  Input,
  SectionContainer,
  Textarea,
} from '../primitives';
import type { KandidatKOE } from '../../api/endringsordre';
import type { VederlagsMetode } from '../../types/timeline';

// ============================================================================
// SCHEMA & TYPES
// ============================================================================

export const endringsordreFormSchema = z.object({
  // Identifikasjon
  eo_nummer: z.string().min(1, 'EO-nummer er påkrevd'),
  tittel: z.string().min(3, 'Tittel må være minst 3 tegn').max(100, 'Tittel kan ikke være lengre enn 100 tegn'),
  beskrivelse: z.string().min(1, 'Beskrivelse er påkrevd'),

  // Konsekvenser
  konsekvenser_sha: z.boolean(),
  konsekvenser_kvalitet: z.boolean(),
  konsekvenser_fremdrift: z.boolean(),
  konsekvenser_pris: z.boolean(),
  konsekvenser_annet: z.boolean(),
  konsekvens_beskrivelse: z.string().optional(),

  // Oppgjør
  oppgjorsform: z.enum(['ENHETSPRISER', 'REGNINGSARBEID', 'FASTPRIS_TILBUD']).optional(),
  kompensasjon_belop: z.number().min(0).optional().nullable(),
  fradrag_belop: z.number().min(0).optional().nullable(),
  er_estimat: z.boolean(),
  frist_dager: z.number().min(0).optional().nullable(),
  ny_sluttdato: z.string().optional(),
});

export type EndringsordreFormData = z.infer<typeof endringsordreFormSchema>;

// ============================================================================
// CONSTANTS
// ============================================================================

interface OppgjorsformOption {
  value: VederlagsMetode;
  label: string;
  paragraf: string;
  indeksregulering: 'full' | 'delvis' | 'ingen';
  description: string;
}

export const OPPGJORSFORM_OPTIONS: OppgjorsformOption[] = [
  {
    value: 'ENHETSPRISER',
    label: 'Enhetspriser',
    paragraf: '§34.3',
    indeksregulering: 'full',
    description: 'Kontraktens eller justerte enhetspriser. Gjenstand for indeksregulering.',
  },
  {
    value: 'REGNINGSARBEID',
    label: 'Regningsarbeid',
    paragraf: '§30.2, §34.4',
    indeksregulering: 'delvis',
    description: 'Oppgjør etter medgått tid og materialer. Endelig beløp fastsettes ved sluttoppgjør.',
  },
  {
    value: 'FASTPRIS_TILBUD',
    label: 'Fastpris / Tilbud',
    paragraf: '§34.2.1',
    indeksregulering: 'ingen',
    description: 'Entreprenørens tilbud. Fast beløp, ikke gjenstand for indeksregulering.',
  },
];

// ============================================================================
// HELPERS
// ============================================================================

export function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

function IndeksreguleringsInfo({ indeks }: { indeks: 'full' | 'delvis' | 'ingen' }) {
  const variants: Record<string, 'success' | 'warning' | 'default'> = {
    full: 'success',
    delvis: 'warning',
    ingen: 'default',
  };
  const labels = {
    full: 'Full indeksreg.',
    delvis: 'Delvis indeksreg.',
    ingen: 'Ingen indeksreg.',
  };

  return <Badge variant={variants[indeks]}>{labels[indeks]}</Badge>;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface EndringsordreFormProps<T extends EndringsordreFormData> {
  form: UseFormReturn<T>;
  kandidatSaker?: KandidatKOE[];
  kandidaterLoading?: boolean;
  selectedKoeIds?: string[];
  onToggleKoeSelection?: (koeId: string) => void;
  totalFromKOE?: number;
  totalDagerFromKOE?: number;
  showIdentifikasjon?: boolean;
  showKoeSelection?: boolean;
  /** Callback to generate next EO number (for "Generer neste" button) */
  onGenererNesteNummer?: () => void;
  /** Whether the generate button should be disabled */
  genererNesteDisabled?: boolean;
}

export function EndringsordreForm<T extends EndringsordreFormData>({
  form,
  kandidatSaker = [],
  kandidaterLoading = false,
  selectedKoeIds = [],
  onToggleKoeSelection,
  totalFromKOE = 0,
  totalDagerFromKOE = 0,
  showIdentifikasjon = true,
  showKoeSelection = true,
  onGenererNesteNummer,
  genererNesteDisabled = false,
}: EndringsordreFormProps<T>) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;

  const formValues = watch() as EndringsordreFormData;

  // Computed netto beløp
  const nettoBelop = useMemo(() => {
    const komp = formValues.kompensasjon_belop || 0;
    const frad = formValues.fradrag_belop || 0;
    return komp - frad;
  }, [formValues.kompensasjon_belop, formValues.fradrag_belop]);

  const harKonsekvens =
    formValues.konsekvenser_sha ||
    formValues.konsekvenser_kvalitet ||
    formValues.konsekvenser_fremdrift ||
    formValues.konsekvenser_pris ||
    formValues.konsekvenser_annet;

  return (
    <>
      {/* Seksjon: Identifikasjon */}
      {showIdentifikasjon && (
        <SectionContainer
          title="Identifikasjon"
          description="EO-nummer og tittel for enkel identifikasjon"
        >
          <FormField
            label="EO-nummer"
            required
            error={errors.eo_nummer?.message as string | undefined}
            helpText="Unik identifikator for endringsordren"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                {...register('eo_nummer' as any)}
                error={!!errors.eo_nummer}
                width="md"
              />
              {onGenererNesteNummer && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onGenererNesteNummer}
                  disabled={genererNesteDisabled}
                  className="w-full sm:w-auto"
                >
                  Generer neste
                </Button>
              )}
            </div>
          </FormField>

          <FormField
            label="Tittel"
            required
            error={errors.tittel?.message as string | undefined}
            helpText="Kort beskrivende tittel for enkel identifikasjon"
          >
            <Input
              {...register('tittel' as any)}
              error={!!errors.tittel}
              fullWidth
            />
          </FormField>

          <FormField
            label="Beskrivelse"
            required
            error={errors.beskrivelse?.message as string | undefined}
            helpText="Beskriv hva endringen innebærer"
          >
            <Textarea
              {...register('beskrivelse' as any)}
              rows={4}
              fullWidth
              error={!!errors.beskrivelse}
            />
          </FormField>
        </SectionContainer>
      )}

      {/* Seksjon: Relaterte KOE-saker */}
      {showKoeSelection && (
        <SectionContainer
          title="Relaterte KOE-saker"
          description="Velg KOE-saker som skal inkluderes i endringsordren, eller fortsett uten for proaktiv EO"
        >
          {kandidaterLoading ? (
            <div className="flex items-center gap-3 py-4 text-pkt-text-body-muted">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">Henter kandidatsaker...</span>
            </div>
          ) : kandidatSaker.length === 0 ? (
            <p className="text-pkt-text-body-subtle text-sm py-2">
              Ingen KOE-saker er klare for endringsordre. Du kan fortsette med en proaktiv EO.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-pkt-border-subtle">
              {/* Mobilvennlig liste-layout */}
              <div className="divide-y divide-pkt-border-subtle">
                {kandidatSaker.map((koe) => {
                  const isSelected = selectedKoeIds.includes(koe.sak_id);
                  return (
                    <div
                      key={koe.sak_id}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => onToggleKoeSelection?.(koe.sak_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onToggleKoeSelection?.(koe.sak_id);
                        }
                      }}
                      className={`flex items-start gap-2 p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-pkt-surface-light-beige'
                          : 'hover:bg-pkt-surface-subtle'
                      }`}
                    >
                      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleKoeSelection?.(koe.sak_id)}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{koe.tittel}</p>
                        <p className="text-xs text-pkt-text-body-subtle">
                          {koe.overordnet_status}
                        </p>
                        <div className="flex gap-3 mt-1 text-xs">
                          <span className="font-mono text-pkt-brand-dark-green-1000">
                            {koe.sum_godkjent !== undefined
                              ? formatCurrency(koe.sum_godkjent)
                              : '-'}
                          </span>
                          {koe.godkjent_dager !== undefined && koe.godkjent_dager > 0 && (
                            <span className="text-pkt-text-body-subtle">
                              {koe.godkjent_dager} dager
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Totalsum */}
              {selectedKoeIds.length > 0 && (
                <div className="border-t-2 border-pkt-border-default bg-pkt-surface-subtle p-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold">Totalt ({selectedKoeIds.length} valgt)</span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-pkt-brand-dark-green-1000">
                        {formatCurrency(totalFromKOE)}
                      </span>
                      {totalDagerFromKOE > 0 && (
                        <span className="text-pkt-text-body-subtle ml-2">
                          / {totalDagerFromKOE} dager
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionContainer>
      )}

      {/* Seksjon: Konsekvenser */}
      <SectionContainer
        title="Konsekvenser"
        description="Kryss av for konsekvenser endringen medfører"
      >
        <div className="space-y-3">
          <Controller
            name={'konsekvenser_sha' as any}
            control={control as never}
            render={({ field }) => (
              <Checkbox
                id="konsekvenser_sha"
                checked={field.value as boolean}
                onCheckedChange={field.onChange}
                label="SHA-konsekvens"
                description="Endringen påvirker sikkerhet, helse eller arbeidsmiljø"
              />
            )}
          />

          <Controller
            name={'konsekvenser_kvalitet' as any}
            control={control as never}
            render={({ field }) => (
              <Checkbox
                id="konsekvenser_kvalitet"
                checked={field.value as boolean}
                onCheckedChange={field.onChange}
                label="Kvalitetskonsekvens"
                description="Endringen påvirker kvalitet eller spesifikasjoner"
              />
            )}
          />

          <Controller
            name={'konsekvenser_fremdrift' as any}
            control={control as never}
            render={({ field }) => (
              <Checkbox
                id="konsekvenser_fremdrift"
                checked={field.value as boolean}
                onCheckedChange={field.onChange}
                label="Fremdriftskonsekvens"
                description="Endringen gir rett til fristforlengelse"
              />
            )}
          />

          <Controller
            name={'konsekvenser_pris' as any}
            control={control as never}
            render={({ field }) => (
              <Checkbox
                id="konsekvenser_pris"
                checked={field.value as boolean}
                onCheckedChange={field.onChange}
                label="Priskonsekvens"
                description="Endringen gir rett til vederlagsjustering"
              />
            )}
          />

          <Controller
            name={'konsekvenser_annet' as any}
            control={control as never}
            render={({ field }) => (
              <Checkbox
                id="konsekvenser_annet"
                checked={field.value as boolean}
                onCheckedChange={field.onChange}
                label="Andre konsekvenser"
                description="Endringen har andre konsekvenser som bør dokumenteres"
              />
            )}
          />
        </div>

        {harKonsekvens && (
          <FormField label="Utdypende beskrivelse">
            <Textarea
              {...register('konsekvens_beskrivelse' as any)}
              rows={3}
              fullWidth
            />
          </FormField>
        )}

        {!harKonsekvens && (
          <Alert variant="warning" title="Ingen konsekvenser valgt">
            Er du sikker på at endringen ikke har konsekvenser?
          </Alert>
        )}
      </SectionContainer>

      {/* Seksjon: Oppgjør - kun hvis pris eller fremdrift */}
      {(formValues.konsekvenser_pris || formValues.konsekvenser_fremdrift) && (
        <SectionContainer
          title="Oppgjør"
          description="Spesifiser vederlag og/eller fristforlengelse"
        >
          {/* Vederlagsjustering */}
          {formValues.konsekvenser_pris && (
            <div className="space-y-3 sm:space-y-4">
              <FormField
                label="Beregningsmetode"
                required
                error={!formValues.oppgjorsform ? 'Velg beregningsmetode' : undefined}
              >
                <div className="space-y-2">
                  {OPPGJORSFORM_OPTIONS.map((opt) => (
                    <Controller
                      key={opt.value}
                      name={'oppgjorsform' as any}
                      control={control as never}
                      render={({ field }) => (
                        <button
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          className={`w-full p-3 border rounded-none text-left transition-colors ${
                            (field.value as string) === opt.value
                              ? 'border-pkt-brand-purple-1000 bg-pkt-surface-light-beige'
                              : 'border-pkt-border-default hover:border-pkt-border-focus'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">
                                {opt.label}{' '}
                                <span className="text-pkt-text-body-subtle">({opt.paragraf})</span>
                              </p>
                              <p className="text-xs text-pkt-text-body-subtle mt-0.5">
                                {opt.description}
                              </p>
                            </div>
                            <IndeksreguleringsInfo indeks={opt.indeksregulering} />
                          </div>
                        </button>
                      )}
                    />
                  ))}
                </div>
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Kompensasjon (tillegg)"
                  helpText={totalFromKOE > 0 ? `Fra valgte KOE: ${formatCurrency(totalFromKOE)}` : 'Beløp som tilkjennes TE'}
                >
                  <Controller
                    name={'kompensasjon_belop' as any}
                    control={control as never}
                    render={({ field }) => (
                      <CurrencyInput
                        value={field.value as number | null}
                        onChange={field.onChange}
                        allowNegative={false}
                      />
                    )}
                  />
                </FormField>

                <FormField label="Fradrag" helpText="Eventuelt motregningsbeløp">
                  <Controller
                    name={'fradrag_belop' as any}
                    control={control as never}
                    render={({ field }) => (
                      <CurrencyInput
                        value={field.value as number | null}
                        onChange={field.onChange}
                        allowNegative={false}
                      />
                    )}
                  />
                </FormField>
              </div>

              <div className="p-3 bg-pkt-surface-subtle border border-pkt-border-subtle rounded-none">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Netto beløp:</span>
                  <span className={`font-bold text-base ${nettoBelop < 0 ? 'text-pkt-brand-red-1000' : ''}`}>
                    {formatCurrency(nettoBelop)}
                  </span>
                </div>
              </div>

              {/* Info om oppgjør ved sluttoppgjør (kun regningsarbeid trenger eksplisitt merknad) */}
              {formValues.oppgjorsform === 'REGNINGSARBEID' && (
                <Alert variant="info" title="Oppgjør ved sluttoppgjør">
                  Endelig beløp fastsettes basert på dokumenterte kostnader.
                </Alert>
              )}
            </div>
          )}

          {/* Fristforlengelse */}
          {formValues.konsekvenser_fremdrift && (
            <div className={`space-y-4 ${formValues.konsekvenser_pris ? 'pt-4 border-t-2 border-pkt-border-subtle' : ''}`}>
              {formValues.konsekvenser_pris && (
                <h4 className="font-medium text-sm">Fristforlengelse</h4>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Antall dager"
                  helpText={totalDagerFromKOE > 0 ? `Fra valgte KOE: ${totalDagerFromKOE} dager` : 'Fristforlengelse i kalenderdager'}
                >
                  <Controller
                    name={'frist_dager' as any}
                    control={control as never}
                    render={({ field }) => (
                      <Input
                        type="number"
                        value={(field.value as number | null) ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)
                        }
                        width="xs"
                      />
                    )}
                  />
                </FormField>

                <FormField label="Ny sluttdato" helpText="Justert kontraktsfrist">
                  <Controller
                    name={'ny_sluttdato' as any}
                    control={control as never}
                    render={({ field }) => (
                      <DatePicker id="ny_sluttdato" value={field.value as string} onChange={field.onChange} />
                    )}
                  />
                </FormField>
              </div>
            </div>
          )}
        </SectionContainer>
      )}
    </>
  );
}

export default EndringsordreForm;
