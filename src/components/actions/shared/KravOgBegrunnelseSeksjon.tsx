/**
 * KravOgBegrunnelseSeksjon Component
 *
 * Shared component for frist claim sections that combine:
 * - Contract rule reference (§33.1 for BH forhold, §33.3 for force majeure)
 * - Calculation rule reference (§33.5)
 * - Number of days input
 * - Optional new end date
 * - Justification textarea
 *
 * Used by SendFristModal (for spesifisert krav).
 */

import {
  DatePicker,
  ExpandableText,
  FormField,
  Input,
  SectionContainer,
  Textarea,
} from '../../primitives';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';

// Generic form data type - components using this must have these fields
interface KravFormFields {
  antall_dager: number;
  begrunnelse: string;
  ny_sluttdato?: string;
}

interface KravOgBegrunnelseSeksjonProps<T extends KravFormFields> {
  /** React Hook Form control */
  control: Control<T>;
  /** Form errors */
  errors: FieldErrors<T>;
  /** Section title */
  tittel?: string;
  /** Whether this is a force majeure case (shows §33.3 instead of §33.1) */
  erForceMajeure?: boolean;
  /** Whether to show the new end date field */
  visNySluttdato?: boolean;
  /** Help text for the new end date field */
  nySluttdatoHelpText?: string;
  /** Number of rows for begrunnelse textarea */
  begrunnelseRows?: number;
  /** Additional validation message for antall_dager */
  antallDagerValidationMessage?: React.ReactNode;
}

export function KravOgBegrunnelseSeksjon<T extends KravFormFields>({
  control,
  errors,
  tittel = 'Krav og begrunnelse',
  erForceMajeure = false,
  visNySluttdato = true,
  nySluttdatoHelpText = 'Forventet ny sluttdato etter fristforlengelsen',
  begrunnelseRows = 5,
  antallDagerValidationMessage,
}: KravOgBegrunnelseSeksjonProps<T>) {
  return (
    <SectionContainer title={tittel}>
      <div className="space-y-3 sm:space-y-4">
        {/* Kontraktsregel: Vilkår for fristforlengelse (§33.1 eller §33.3) */}
        {erForceMajeure ? (
          <p className="text-sm text-pkt-text-body-subtle">
            <ExpandableText preview="Totalentreprenøren har krav på fristforlengelse ved force majeure.">
              Dersom fremdriften hindres av ekstraordinære og upåregnelige forhold utenfor partens
              kontroll (force majeure), har totalentreprenøren krav på fristforlengelse (§33.3).
            </ExpandableText>
          </p>
        ) : (
          <p className="text-sm text-pkt-text-body-subtle">
            <ExpandableText preview="Totalentreprenøren har krav på fristforlengelse når fremdriften hindres av byggherrens forhold.">
              Dersom fremdriften hindres på grunn av endringer, forsinkelse eller svikt i byggherrens
              medvirkning, eller andre forhold byggherren bærer risikoen for, har totalentreprenøren
              krav på fristforlengelse (§33.1).
            </ExpandableText>
          </p>
        )}

        {/* Kontraktsregel: Beregning av fristforlengelse (§33.5) */}
        <p className="text-sm text-pkt-text-body-subtle">
          <ExpandableText preview="Fristforlengelsen skal svare til den virkning hindringen har hatt for fremdriften.">
            Fristforlengelsen skal svare til den virkning hindringen har hatt for fremdriften (§33.5).
            Ved beregningen skal det tas hensyn til nødvendig avbrudd og oppstart, årstidsforskyvning,
            den samlede virkning av tidligere fristforlengelser, og om entreprenøren har oppfylt sin
            tapsbegrensningsplikt. Forlengelsen skal ikke overstige det som er nødvendig for å kompensere
            den reelle forsinkelsen.
          </ExpandableText>
        </p>

        {/* Antall kalenderdager og ny sluttdato */}
        <div className="flex flex-col min-[420px]:flex-row gap-3 min-[420px]:gap-6">
          <FormField
            label="Antall kalenderdager"
            required
            error={errors.antall_dager?.message as string | undefined}
          >
            <Controller
              name={'antall_dager' as any}
              control={control}
              render={({ field }) => (
                <Input
                  id="antall_dager"
                  type="number"
                  value={field.value as number}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  width="xs"
                  min={0}
                  error={!!errors.antall_dager}
                />
              )}
            />
          </FormField>

          {visNySluttdato && (
            <FormField
              label="Ny sluttdato"
              helpText={nySluttdatoHelpText}
              error={errors.ny_sluttdato?.message as string | undefined}
            >
              <Controller
                name={'ny_sluttdato' as any}
                control={control}
                render={({ field }) => (
                  <DatePicker
                    id="ny_sluttdato"
                    value={field.value as string | undefined}
                    onChange={field.onChange}
                    error={!!errors.ny_sluttdato}
                  />
                )}
              />
            </FormField>
          )}
        </div>

        {/* Optional validation message for antall_dager */}
        {antallDagerValidationMessage}

        {/* Begrunnelse */}
        <FormField
          label="Begrunnelse"
          required
          error={errors.begrunnelse?.message as string | undefined}
        >
          <Controller
            name={'begrunnelse' as any}
            control={control}
            render={({ field }) => (
              <Textarea
                id="begrunnelse"
                value={field.value as string}
                onChange={field.onChange}
                rows={begrunnelseRows}
                fullWidth
                error={!!errors.begrunnelse}
              />
            )}
          />
        </FormField>
      </div>
    </SectionContainer>
  );
}
