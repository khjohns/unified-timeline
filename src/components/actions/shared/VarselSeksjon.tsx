/**
 * VarselSeksjon Component
 *
 * Shared component for notification/varsling sections in modals.
 * Follows the pattern from SendGrunnlagModal:
 * - RadioGroup for "sendes nå" vs "sendt tidligere"
 * - Nested section with border-left for "tidligere" details
 * - DatePicker for notification date
 * - Checkbox list for notification methods
 */

import {
  Checkbox,
  DatePicker,
  FormField,
  RadioGroup,
  RadioItem,
} from '../../primitives';
import { VARSEL_METODER_OPTIONS } from '../../../constants/varselMetoder';
import type { UseFormRegister } from 'react-hook-form';

interface VarselSeksjonProps {
  /** Label for the main question, e.g. "Når ble byggherren varslet?" */
  label: string;
  /** Optional tooltip for the label */
  labelTooltip?: string;
  /** Whether notification is being sent now (true) or was sent earlier (false) */
  sendesNa: boolean;
  /** Callback when sendesNa changes */
  onSendesNaChange: (value: boolean) => void;
  /** Date when notification was sent (only used if sendesNa is false) */
  datoSendt?: string;
  /** Callback when datoSendt changes */
  onDatoSendtChange: (value: string | undefined) => void;
  /** Error for datoSendt field */
  datoError?: string;
  /** Register function from react-hook-form for varselmetoder checkboxes */
  registerMetoder: ReturnType<UseFormRegister<Record<string, unknown>>>;
  /** Prefix for unique IDs, e.g. "noytralt_varsel" */
  idPrefix: string;
  /** Optional test ID for the radio group */
  testId?: string;
  /** Optional extra content to render after the date field (e.g., preclusion warnings) */
  extraContent?: React.ReactNode;
}

export function VarselSeksjon({
  label,
  labelTooltip,
  sendesNa,
  onSendesNaChange,
  datoSendt,
  onDatoSendtChange,
  datoError,
  registerMetoder,
  idPrefix,
  testId,
  extraContent,
}: VarselSeksjonProps) {
  return (
    <div className="space-y-4">
      <FormField label={label} labelTooltip={labelTooltip}>
        <RadioGroup
          value={sendesNa ? 'na' : 'tidligere'}
          onValueChange={(v) => onSendesNaChange(v === 'na')}
          data-testid={testId}
        >
          <RadioItem
            value="na"
            label="Varsel sendes nå (sammen med dette skjemaet)"
          />
          <RadioItem value="tidligere" label="Varsel ble sendt tidligere" />
        </RadioGroup>
      </FormField>

      {/* Nested details - only shown when "tidligere" is selected */}
      {!sendesNa && (
        <div className="border-l-2 border-pkt-border-subtle pl-4 space-y-4">
          <FormField
            label="Dato varsel sendt"
            helpText="Skriftlig varsel, e-post til avtalt adresse, eller innført i referat (§5)."
            error={datoError}
          >
            <DatePicker
              id={`${idPrefix}_dato`}
              value={datoSendt}
              onChange={onDatoSendtChange}
              error={!!datoError}
            />
            {extraContent}
          </FormField>

          <FormField
            label="Varselmetode (§5)"
            helpText="Kun skriftlige varsler er gyldige iht. §5."
          >
            <div className="space-y-3">
              {VARSEL_METODER_OPTIONS.map((option) => (
                <Checkbox
                  key={option.value}
                  id={`${idPrefix}-${option.value}`}
                  label={option.label}
                  value={option.value}
                  {...registerMetoder}
                />
              ))}
            </div>
          </FormField>
        </div>
      )}
    </div>
  );
}
