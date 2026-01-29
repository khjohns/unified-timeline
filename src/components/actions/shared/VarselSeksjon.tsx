/**
 * VarselSeksjon Component
 *
 * Shared component for notification/varsling sections in modals.
 * Uses a checkbox pattern:
 * - Checkbox for "har tidligere varslet/fremsatt"
 * - If checked: show date and method fields
 * - If not checked: optionally show info text
 */

import {
  Checkbox,
  DatePicker,
  FormField,
} from '../../primitives';
import { VARSEL_METODER_OPTIONS } from '../../../constants/varselMetoder';
import type { UseFormRegister } from 'react-hook-form';

interface VarselSeksjonProps {
  /** Label for the checkbox, e.g. "Jeg har tidligere varslet om dette kravet" */
  checkboxLabel: string;
  /** Whether notification was sent earlier (true) or is being sent now (false) */
  harTidligere: boolean;
  /** Callback when harTidligere changes */
  onHarTidligereChange: (value: boolean) => void;
  /** Date when notification was sent (only used if harTidligere is true) */
  datoSendt?: string;
  /** Callback when datoSendt changes */
  onDatoSendtChange: (value: string | undefined) => void;
  /** Error for datoSendt field */
  datoError?: string;
  /** Register function from react-hook-form for varselmetoder checkboxes */
  registerMetoder: ReturnType<UseFormRegister<Record<string, unknown>>>;
  /** Prefix for unique IDs, e.g. "frist_varsel" */
  idPrefix: string;
  /** Optional test ID for the checkbox */
  testId?: string;
  /** Optional info text to show when not checked (sending now) */
  infoTextWhenNow?: string;
  /** Optional label for date field (default: "Dato varsel ble sendt") */
  datoLabel?: string;
  /** Optional extra content to render after the date field (e.g., preclusion warnings) */
  extraContent?: React.ReactNode;
}

export function VarselSeksjon({
  checkboxLabel,
  harTidligere,
  onHarTidligereChange,
  datoSendt,
  onDatoSendtChange,
  datoError,
  registerMetoder,
  idPrefix,
  testId,
  infoTextWhenNow,
  datoLabel = 'Dato varsel ble sendt',
  extraContent,
}: VarselSeksjonProps) {
  return (
    <div className="space-y-4">
      <Checkbox
        id={`${idPrefix}_tidligere`}
        label={checkboxLabel}
        checked={harTidligere}
        onCheckedChange={onHarTidligereChange}
        data-testid={testId}
      />

      {harTidligere ? (
        <>
          <FormField
            label={datoLabel}
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
            label="Varselmetode"
            helpText="Kun skriftlige varsler er gyldige iht. §5."
          >
            <div className="space-y-2">
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
        </>
      ) : (
        <p className="text-sm text-pkt-text-body-subtle">
          {infoTextWhenNow ?? 'Sendes i dag sammen med dette skjemaet.'}
        </p>
      )}
    </div>
  );
}
