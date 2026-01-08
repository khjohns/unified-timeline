/**
 * VederlagMethodSelector Component
 *
 * Shared component for selecting vederlag calculation method.
 * Used by SendVederlagModal and ReviseVederlagModal.
 *
 * Features:
 * - RadioGroup with ENHETSPRISER, REGNINGSARBEID, FASTPRIS_TILBUD
 * - Nested checkbox for krever_justert_ep (§34.3.3) under ENHETSPRISER
 * - Nested checkbox for varslet_for_oppstart (§34.4) under REGNINGSARBEID
 * - Relevant alerts for preklusion warnings
 * - Optional BH response context for ReviseVederlagModal
 */

import { Alert, Checkbox, RadioGroup, RadioItem } from '../../primitives';
import { VEDERLAG_METODER, METODE_DESCRIPTIONS, type VederlagsMetode } from './vederlagConstants';

interface VederlagMethodSelectorProps {
  /** Currently selected method */
  value: VederlagsMetode | undefined;
  /** Callback when method changes */
  onChange: (metode: VederlagsMetode) => void;
  /** Error message to display */
  error?: string;

  // Nested checkbox state - krever_justert_ep (§34.3.3)
  kreverJustertEp?: boolean;
  onKreverJustertEpChange?: (value: boolean) => void;

  // Nested checkbox state - varslet_for_oppstart (§34.4)
  varsletForOppstart?: boolean;
  onVarsletForOppstartChange?: (value: boolean) => void;

  // BH response context (for ReviseVederlagModal)
  /** BH's desired method (shown as "← Byggherrens ønskede metode") */
  bhDesiredMethod?: VederlagsMetode;
  /** Whether BH rejected the EP adjustment claim */
  bhAvvisteEpJustering?: boolean;

  /** Test ID for the RadioGroup */
  testId?: string;
}

export function VederlagMethodSelector({
  value,
  onChange,
  error,
  kreverJustertEp,
  onKreverJustertEpChange,
  varsletForOppstart,
  onVarsletForOppstartChange,
  bhDesiredMethod,
  bhAvvisteEpJustering,
  testId,
}: VederlagMethodSelectorProps) {
  // Helper to get description with BH preference note
  const getDescription = (metode: VederlagsMetode): string => {
    const baseDescription = METODE_DESCRIPTIONS[metode];
    if (bhDesiredMethod === metode) {
      return `${baseDescription} ← Byggherrens ønskede metode`;
    }
    return baseDescription;
  };

  return (
    <div>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as VederlagsMetode)}
        data-testid={testId}
      >
        {/* ENHETSPRISER med nestet checkbox */}
        <RadioItem
          value="ENHETSPRISER"
          label={VEDERLAG_METODER[0].label}
          description={getDescription('ENHETSPRISER')}
        />
        {value === 'ENHETSPRISER' && onKreverJustertEpChange && (
          <div className="ml-6 pl-4 border-l-2 border-pkt-border-subtle">
            <Checkbox
              id="krever_justert_ep"
              label="Krever justerte enhetspriser (§34.3.3)"
              description="Når forutsetningene for enhetsprisene forrykkes"
              checked={kreverJustertEp}
              onCheckedChange={onKreverJustertEpChange}
            />
            {kreverJustertEp && bhAvvisteEpJustering && (
              <Alert variant="warning" className="mt-2">
                Du opprettholder kravet selv om BH avviste det.
              </Alert>
            )}
            {kreverJustertEp && !bhAvvisteEpJustering && (
              <Alert variant="warning" className="mt-2">
                Krav om justerte enhetspriser må varsles «uten ugrunnet opphold» etter at forholdet oppsto.
                Uten rettidig varsel har du bare krav på den justering byggherren «måtte forstå» (§34.3.3).
              </Alert>
            )}
          </div>
        )}

        {/* REGNINGSARBEID med nestet checkbox */}
        <RadioItem
          value="REGNINGSARBEID"
          label={VEDERLAG_METODER[1].label}
          description={getDescription('REGNINGSARBEID')}
        />
        {value === 'REGNINGSARBEID' && onVarsletForOppstartChange && (
          <div className="ml-6 pl-4 border-l-2 border-pkt-border-subtle">
            <Checkbox
              id="varslet_for_oppstart"
              label="Byggherren ble varslet før regningsarbeidet startet (§34.4)"
              checked={varsletForOppstart}
              onCheckedChange={onVarsletForOppstartChange}
            />
            {varsletForOppstart === false && (
              <Alert variant="danger" className="mt-2">
                Uten forhåndsvarsel har du bare krav på det byggherren «måtte forstå» at du har hatt av utgifter (§30.3.1).
              </Alert>
            )}
          </div>
        )}

        {/* FASTPRIS_TILBUD (ingen nestet innhold) */}
        <RadioItem
          value="FASTPRIS_TILBUD"
          label={VEDERLAG_METODER[2].label}
          description={getDescription('FASTPRIS_TILBUD')}
        />
      </RadioGroup>

      {/* Error display */}
      {error && (
        <p className="mt-2 text-sm text-pkt-text-error">{error}</p>
      )}
    </div>
  );
}
