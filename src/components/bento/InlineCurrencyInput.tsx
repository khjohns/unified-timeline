/**
 * InlineCurrencyInput — Currency input with reference value and vurdering badge.
 *
 * Wrapper around InlineNumberInput with `prefix="kr"`.
 * Shows krevd beløp as reference and auto-derived vurdering badge.
 *
 * Follows D2: "Beløp-input ER vurderingen" — no separate dropdown.
 */

import { clsx } from 'clsx';
import type { BelopVurdering } from '../../domain/vederlagDomain';
import { formatCurrencyCompact } from '../../utils/formatters';

export interface InlineCurrencyInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  krevdBelop: number;
  vurdering: BelopVurdering;
  erPrekludert?: boolean;
  disabled?: boolean;
}

const VURDERING_STYLES: Record<BelopVurdering, { bg: string; text: string; label: string }> = {
  godkjent: { bg: 'bg-pkt-brand-dark-green-1000/10', text: 'text-pkt-brand-dark-green-1000', label: 'Godkjent' },
  delvis: { bg: 'bg-pkt-brand-yellow-1000/10', text: 'text-pkt-brand-yellow-1000', label: 'Delvis' },
  avslatt: { bg: 'bg-pkt-brand-red-1000/10', text: 'text-pkt-brand-red-1000', label: 'Avvist' },
};

export function InlineCurrencyInput({
  label,
  value,
  onChange,
  krevdBelop,
  vurdering,
  erPrekludert,
  disabled,
}: InlineCurrencyInputProps) {
  const pct = krevdBelop > 0 ? ((value / krevdBelop) * 100).toFixed(1) : '0';
  const style = VURDERING_STYLES[vurdering];

  return (
    <div className="space-y-1">
      {/* Krevd reference row */}
      <div className="flex justify-between items-baseline">
        <span className="text-bento-label text-pkt-text-body-muted">Krevd</span>
        <span className="text-bento-label font-mono tabular-nums text-pkt-text-body-muted">
          kr {formatCurrencyCompact(krevdBelop)}
        </span>
      </div>

      {/* Prinsipalt kr 0 row when prekludert */}
      {erPrekludert && (
        <div className="flex justify-between items-baseline">
          <span className="text-bento-label text-pkt-brand-red-1000 font-medium">Prinsipalt</span>
          <span className="text-bento-label font-mono tabular-nums text-pkt-brand-red-1000">
            kr 0 (prekludert)
          </span>
        </div>
      )}

      {/* Input row */}
      <div className="flex justify-between items-center">
        <span className={clsx(
          'text-bento-caption',
          erPrekludert ? 'text-pkt-brand-yellow-1000' : 'text-pkt-text-body-subtle',
        )}>
          {erPrekludert ? 'Subsidiært godkjent' : label}
        </span>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5">
            <span className="text-bento-label text-pkt-text-body-muted font-mono">kr</span>
            <input
              type="number"
              value={value}
              onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
              min={0}
              max={krevdBelop}
              disabled={disabled}
              className={clsx(
                'w-24 px-2 py-0.5 text-bento-body font-mono tabular-nums text-right rounded-md border bg-pkt-bg-default transition-colors',
                'border-pkt-border-default focus:border-pkt-brand-warm-blue-1000 focus:ring-pkt-brand-warm-blue-1000/20',
                'focus:outline-none focus:ring-2',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            />
          </div>
          {/* Vurdering badge */}
          <span className={clsx(
            'rounded-sm text-bento-micro px-1.5 py-0.5 font-medium whitespace-nowrap',
            style.bg, style.text,
          )}>
            {style.label}
            {vurdering === 'delvis' && ` ${pct}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
