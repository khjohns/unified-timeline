/**
 * GrunnlagForm Component
 *
 * Shared form component for grunnlag (basis/foundation) data entry.
 * Used by both OpprettSakPage and SendGrunnlagModal to ensure
 * consistent UI and validation.
 */

import { useMemo } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import {
  Alert,
  DatePicker,
  FormField,
  Input,
  RadioGroup,
  RadioItem,
  SectionContainer,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '../primitives';
import { VarselSeksjon } from '../actions/shared/VarselSeksjon';
import { KontraktsregelInline } from '../shared';
import {
  HOVEDKATEGORI_OPTIONS,
  getHovedkategori,
  getUnderkategoriObj,
  getGrupperteUnderkategorier,
} from '../../constants';
import {
  getPreklusjonsvarselMellomDatoer,
  beregnDagerSiden,
} from '../../utils/preklusjonssjekk';

// Shared schema for grunnlag form (without sak_id)
// Underkategori is only required if the hovedkategori has underkategorier (e.g., not Force Majeure)
export const grunnlagFormSchema = z.object({
  hovedkategori: z.string().min(1, 'Kategori er påkrevd'),
  underkategori: z.string().default(''),
  tittel: z.string().min(3, 'Tittel må være minst 3 tegn').max(100, 'Tittel kan ikke være lengre enn 100 tegn'),
  beskrivelse: z.string().min(10, 'Beskrivelse må være minst 10 tegn'),
  dato_oppdaget: z.string().min(1, 'Dato oppdaget er påkrevd'),
  varsel_sendes_na: z.boolean().optional(),
  dato_varsel_sendt: z.string().optional(),
  varsel_metode: z.array(z.string()).optional(),
});

// Refine function to add underkategori validation
export const grunnlagFormRefine = (data: z.infer<typeof grunnlagFormSchema>) => {
  const hovedkat = getHovedkategori(data.hovedkategori);
  if (!hovedkat || hovedkat.underkategorier.length === 0) {
    return true;
  }
  return data.underkategori.length > 0;
};

export const grunnlagFormRefineMessage = {
  message: 'Hjemmel må velges',
  path: ['underkategori'] as const,
};

export type GrunnlagFormData = z.infer<typeof grunnlagFormSchema>;

// Map underkategori to KontraktsregelInline hjemmel
const hjemmelMap: Record<string, '§10.2' | '§14.4' | '§14.6' | '§15.2' | '§19.1' | '§21.4' | '§22' | '§23.1' | '§23.3' | '§24.1' | '§24.2.2' | '§26.3' | '§29.2' | '§32.1' | '§38.1'> = {
  'VALGRETT': '§14.6',
  'SVAR_VARSEL': '§24.2.2',
  'LOV_GJENSTAND': '§14.4',
  'LOV_PROSESS': '§15.2',
  'IRREG': '§32.1',
  'GRUNN': '§23.1',
  'KULTURMINNER': '§23.3',
  'PROSJ_RISIKO': '§24.1',
  'MEDVIRK': '§22',
  'GEBYR': '§26.3',
  'SAMORD': '§21.4',
  'NEKT_MH': '§10.2',
  'SKADE_BH': '§19.1',
  'BRUKSTAKELSE': '§38.1',
  'STANS_BET': '§29.2',
};

interface GrunnlagFormProps<T extends GrunnlagFormData> {
  form: UseFormReturn<T>;
  /** Currently selected hovedkategori (for UI state) */
  selectedHovedkategori: string;
  /** Callback when hovedkategori changes */
  onHovedkategoriChange: (value: string) => void;
  /** Hide varsling section (e.g., in update mode where varsel already sent) */
  hideVarsling?: boolean;
  /** Prefix for test IDs */
  testIdPrefix?: string;
}

export function GrunnlagForm<T extends GrunnlagFormData>({
  form,
  selectedHovedkategori,
  onHovedkategoriChange,
  hideVarsling = false,
  testIdPrefix = 'grunnlag',
}: GrunnlagFormProps<T>) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const varselSendesNa = watch('varsel_sendes_na' as keyof T) as boolean | undefined;
  const selectedUnderkategorier = watch('underkategori' as keyof T) as string;
  const datoOppdaget = watch('dato_oppdaget' as keyof T) as string;
  const datoVarselSendt = watch('dato_varsel_sendt' as keyof T) as string | undefined;

  // Get selected category info
  const valgtHovedkategori = useMemo(
    () => getHovedkategori(selectedHovedkategori),
    [selectedHovedkategori]
  );

  // Get selected underkategori info
  const valgtUnderkategori = useMemo(() => {
    if (!selectedUnderkategorier) return undefined;
    return getUnderkategoriObj(selectedUnderkategorier);
  }, [selectedUnderkategorier]);

  // Calculate preclusion risk between discovery and earlier notification date
  const preklusjonsResultatVarsel = useMemo(() => {
    if (!datoOppdaget || !datoVarselSendt || varselSendesNa) return null;
    return getPreklusjonsvarselMellomDatoer(datoOppdaget, datoVarselSendt, undefined, selectedHovedkategori);
  }, [datoOppdaget, datoVarselSendt, varselSendesNa, selectedHovedkategori]);

  return (
    <>
      {/* Seksjon: Ansvarsgrunnlag */}
      <SectionContainer title="Ansvarsgrunnlag">
        <div className="space-y-3 sm:space-y-4">
          {/* Hovedkategori */}
          <FormField
            label="Kategori"
            required
            error={errors.hovedkategori?.message as string | undefined}
            helpText="Velg rettslig grunnlag iht. NS 8407. Dette bestemmer hvilke kontraktsbestemmelser som gjelder og hvilke krav som kan fremmes."
          >
            <Controller
              name={'hovedkategori' as keyof T as never}
              control={control as never}
              render={({ field }) => (
                <RadioGroup
                  value={field.value as string}
                  onValueChange={(value) => {
                    field.onChange(value);
                    onHovedkategoriChange(value);
                  }}
                  data-testid={`${testIdPrefix}-hovedkategori`}
                >
                  {HOVEDKATEGORI_OPTIONS.filter(opt => opt.value !== '').map((option) => {
                    const erValgt = field.value === option.value;
                    const kategoriInfo = erValgt ? getHovedkategori(option.value) : null;
                    return (
                      <div key={option.value}>
                        <RadioItem
                          value={option.value}
                          label={option.label}
                          error={!!errors.hovedkategori}
                        />
                        {erValgt && kategoriInfo && (
                          <div className="mt-2 ml-6">
                            <KontraktsregelInline
                              custom={{
                                tekst: kategoriInfo.beskrivelse,
                                konsekvens: `Fristforlengelse: §${kategoriInfo.hjemmel_frist}${kategoriInfo.hjemmel_vederlag ? `, Vederlagsjustering: §${kategoriInfo.hjemmel_vederlag}` : ''}`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </RadioGroup>
              )}
            />
          </FormField>

          {/* Underkategori - Dynamic based on hovedkategori, grouped Select */}
          {selectedHovedkategori && valgtHovedkategori && valgtHovedkategori.underkategorier.length > 0 && (
            <Controller
              name={'underkategori' as keyof T as never}
              control={control as never}
              render={({ field }) => {
                const grupperteUnderkategorier = getGrupperteUnderkategorier(valgtHovedkategori.underkategorier);
                const hjemmel = field.value ? hjemmelMap[field.value as string] : undefined;
                return (
                  <FormField
                    label="Hjemmel"
                    required
                    error={errors.underkategori?.message as string | undefined}
                  >
                    <div className="space-y-2">
                      <Select
                        value={(field.value as string) || ''}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          error={!!errors.underkategori}
                          data-testid={`${testIdPrefix}-underkategori-list`}
                        >
                          <SelectValue placeholder="Velg hjemmel" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(grupperteUnderkategorier.entries()).map(([gruppeNavn, underkategorier]) => (
                            <SelectGroup key={gruppeNavn ?? 'ungrouped'}>
                              {gruppeNavn && <SelectLabel>{gruppeNavn}</SelectLabel>}
                              {underkategorier.map((uk) => (
                                <SelectItem key={uk.kode} value={uk.kode}>
                                  {uk.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Vis hjemmel-info for valgt underkategori */}
                      {field.value && valgtUnderkategori && (
                        <div className="mt-2">
                          {hjemmel ? (
                            <KontraktsregelInline hjemmel={hjemmel} />
                          ) : (
                            <KontraktsregelInline
                              custom={{
                                tekst: valgtUnderkategori.beskrivelse,
                                hjemmel: `§${valgtUnderkategori.hjemmel_basis}`,
                                konsekvens: `Varslingskrav: §${valgtUnderkategori.varselkrav_ref}`,
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </FormField>
                );
              }}
            />
          )}
        </div>
      </SectionContainer>

      {/* Seksjon: Beskrivelse */}
      <SectionContainer
        title="Beskrivelse"
        description="Beskriv forholdet som varsles"
      >
        <div className="space-y-3 sm:space-y-4">
          <FormField
            label="Tittel på varselet"
            required
            error={errors.tittel?.message as string | undefined}
            helpText="Kort beskrivende tittel for enkel identifikasjon av saken"
          >
            <Input
              id="tittel"
              data-testid={`${testIdPrefix}-tittel`}
              {...register('tittel' as keyof T as never)}
              fullWidth
            />
          </FormField>

          <FormField
            label="Beskrivelse"
            required
            error={errors.beskrivelse?.message as string | undefined}
            helpText="Beskriv ansvarsgrunnlaget for endringsmeldingen"
          >
            <Textarea
              id="beskrivelse"
              data-testid={`${testIdPrefix}-beskrivelse`}
              {...register('beskrivelse' as keyof T as never)}
              rows={5}
              fullWidth
              error={!!errors.beskrivelse}
            />
          </FormField>
        </div>
      </SectionContainer>

      {/* Seksjon: Tidspunkt */}
      <SectionContainer
        title="Tidspunkt"
        description="Når ble endringsforholdet oppdaget?"
      >
        <FormField
          label="Dato forhold oppdaget"
          required
          error={errors.dato_oppdaget?.message as string | undefined}
          helpText="Datoen da forholdet som gir grunnlag for endringskravet ble kjent for deg"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Controller
              name={'dato_oppdaget' as keyof T as never}
              control={control as never}
              render={({ field }) => (
                <DatePicker
                  id="dato_oppdaget"
                  data-testid={`${testIdPrefix}-dato-oppdaget`}
                  value={field.value as string}
                  onChange={field.onChange}
                  error={!!errors.dato_oppdaget}
                />
              )}
            />
            {datoOppdaget && (
              <span className="text-sm text-pkt-text-body-subtle whitespace-nowrap">
                {beregnDagerSiden(datoOppdaget)} dager siden
              </span>
            )}
          </div>
        </FormField>
      </SectionContainer>

      {/* Seksjon: Varsling */}
      {!hideVarsling && (
        <SectionContainer
          title="Varsling"
          description="Når og hvordan ble byggherre varslet om forholdet?"
        >
          <Controller
            name={'varsel_sendes_na' as keyof T as never}
            control={control as never}
            render={({ field: sendesNaField }) => (
              <Controller
                name={'dato_varsel_sendt' as keyof T as never}
                control={control as never}
                render={({ field: datoField }) => (
                  <VarselSeksjon
                    checkboxLabel="Varselet ble sendt tidligere"
                    harTidligere={!((sendesNaField.value as boolean) ?? true)}
                    onHarTidligereChange={(v) => sendesNaField.onChange(!v)}
                    datoSendt={datoField.value as string | undefined}
                    onDatoSendtChange={datoField.onChange}
                    registerMetoder={register('varsel_metode' as keyof T as never)}
                    idPrefix={`${testIdPrefix}_varsel`}
                    testId={`${testIdPrefix}-varsel-valg`}
                    extraContent={
                      preklusjonsResultatVarsel?.alert && (
                        <div className="mt-3">
                          <Alert
                            variant={preklusjonsResultatVarsel.alert.variant}
                            title={preklusjonsResultatVarsel.alert.title}
                          >
                            {preklusjonsResultatVarsel.alert.message}
                          </Alert>
                        </div>
                      )
                    }
                  />
                )}
              />
            )}
          />
        </SectionContainer>
      )}
    </>
  );
}

export default GrunnlagForm;
