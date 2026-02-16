/**
 * KravLinje — Reusable component for a single krav-linje in VederlagCard edit mode.
 *
 * Renders varsling + beløp + vurdering for one claim line (hovedkrav, rigg, produktivitet).
 * Handles preclusion state per D5: shows PREKLUDERT + Subsidiært badges when varslet_i_tide = false.
 */

import { Tooltip } from '../primitives';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { InlineYesNo } from './InlineYesNo';
import { InlineCurrencyInput } from './InlineCurrencyInput';
import { formatDateShort } from '../../utils/formatters';
import type { KravLinjeEditState } from '../../hooks/useVederlagBridge';

export interface KravLinjeProps {
  editState: KravLinjeEditState;
}

export function KravLinje({ editState }: KravLinjeProps) {
  const {
    label,
    paragraf,
    krevdBelop,
    godkjentBelop,
    onGodkjentBelopChange,
    showVarsling,
    varsletDato,
    varsletITide,
    onVarsletITideChange,
    vurdering,
    erPrekludert,
  } = editState;

  return (
    <div className="space-y-1.5">
      {/* Section header */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-bento-label font-semibold text-pkt-text-body-default uppercase tracking-wide">
          {label}
        </span>
        {paragraf && (
          <span className="text-bento-label text-pkt-text-body-muted">{paragraf}</span>
        )}
        {paragraf && (
          <Tooltip content={getTooltipText(label, paragraf)} side="right">
            <button type="button" className="text-pkt-text-placeholder hover:text-pkt-text-body-default cursor-help">
              <InfoCircledIcon className="w-3 h-3" />
            </button>
          </Tooltip>
        )}
        {erPrekludert && (
          <>
            <span className="bg-pkt-brand-red-1000/10 text-pkt-brand-red-1000 rounded-sm text-bento-micro px-1 py-0.5 font-bold uppercase tracking-wide">
              PREKLUDERT
            </span>
            <span className="bg-badge-warning-bg text-badge-warning-text rounded-sm text-bento-micro px-1 py-0.5 font-medium">
              Subsidiært
            </span>
          </>
        )}
      </div>

      {/* Varsling row */}
      {showVarsling && (
        <div className="space-y-1">
          {varsletDato && (
            <div className="flex justify-between items-baseline">
              <span className="text-bento-label text-pkt-text-body-muted">Varslet</span>
              <span className="text-bento-label font-mono text-pkt-text-body-muted">
                {formatDateShort(varsletDato)}
              </span>
            </div>
          )}
          <InlineYesNo
            label="Varslet i tide?"
            value={varsletITide}
            onChange={onVarsletITideChange}
            showPrekludert
          />
        </div>
      )}

      {/* Beløp input */}
      <InlineCurrencyInput
        label="Godkjent"
        value={godkjentBelop}
        onChange={onGodkjentBelopChange}
        krevdBelop={krevdBelop}
        vurdering={vurdering}
        erPrekludert={erPrekludert}
      />
    </div>
  );
}

function getTooltipText(label: string, paragraf: string): string {
  if (paragraf === '§34.1.3') {
    return `${label}: Særskilt krav om ${label.toLowerCase()} (${paragraf}). TE må varsle uten ugrunnet opphold. Varsles det ikke i tide, er kravet prekludert.`;
  }
  if (paragraf === '§34.1.2') {
    return 'Hovedkravet: Ved svikt eller andre forhold (§34.1.2) må TE varsle uten ugrunnet opphold. Varsles det ikke i tide, er kravet prekludert.';
  }
  return `${label} ${paragraf}`;
}
