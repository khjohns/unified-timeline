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

import { Alert, Checkbox, ExpandableText, RadioGroup, RadioItem } from '../../primitives';
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
          <div className="ml-6 pl-4 border-l-2 border-pkt-border-subtle space-y-2">
            <Checkbox
              id="krever_justert_ep"
              label="Krever justerte enhetspriser (§34.3.3)"
              checked={kreverJustertEp}
              onCheckedChange={onKreverJustertEpChange}
            />
            {kreverJustertEp && (
              <>
                <p className="text-sm text-pkt-text-body-subtle">
                  <ExpandableText preview="Justering kan kreves når forutsetningene forrykkes.">
                    Justering av enhetspriser kan kreves når (1) ytelsene i det vesentlige er likeartet med ytelser det er fastsatt enhetspriser for, eller (2) forutsetningene for enhetsprisene forrykkes, f.eks. på grunn av omfang, antall eller tidspunkt for endringsarbeidet. Kravet må varsles «uten ugrunnet opphold» etter at forholdet oppsto (§34.3.3).
                  </ExpandableText>
                </p>
                {bhAvvisteEpJustering && (
                  <Alert variant="warning">
                    Du opprettholder kravet selv om byggherren avviste det.
                  </Alert>
                )}
              </>
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
