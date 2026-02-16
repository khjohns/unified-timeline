/**
 * MethodCards — Three clickable cards for beregningsmetode.
 *
 * TE's choice is highlighted. BH clicks a different card to override.
 * Same card = accepted (default). Different card = overridden → shows "TE: X → BH: Y".
 *
 * Follows InlineYesNo color/style conventions.
 */

import { clsx } from 'clsx';
import { Tooltip } from '../primitives';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import type { VederlagsMetode } from '../../types/timeline';
import {
  VEDERLAGSMETODE_DESCRIPTIONS,
} from '../../constants/paymentMethods';

export interface MethodCardsProps {
  teMetode: VederlagsMetode;
  bhMetode: VederlagsMetode;
  onChange: (m: VederlagsMetode) => void;
}

interface MethodOption {
  value: VederlagsMetode;
  shortLabel: string;
  paragraf: string;
}

const METHODS: MethodOption[] = [
  { value: 'ENHETSPRISER', shortLabel: 'Enhetspriser', paragraf: '§34.3' },
  { value: 'REGNINGSARBEID', shortLabel: 'Regningsarbeid', paragraf: '§30.2' },
  { value: 'FASTPRIS_TILBUD', shortLabel: 'Fastpris', paragraf: '§34.2.1' },
];

export function MethodCards({ teMetode, bhMetode, onChange }: MethodCardsProps) {
  const harMetodeendring = bhMetode !== teMetode;

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-3 gap-1">
        {METHODS.map((method) => {
          const isTe = method.value === teMetode;
          const isBh = method.value === bhMetode;

          return (
            <button
              key={method.value}
              type="button"
              onClick={() => onChange(method.value)}
              className={clsx(
                'relative flex flex-col items-center gap-0.5 px-2 py-2 rounded-md border text-center transition-all cursor-pointer',
                isBh
                  ? 'border-pkt-brand-warm-blue-1000 bg-pkt-brand-warm-blue-1000/5 ring-1 ring-pkt-brand-warm-blue-1000/30'
                  : 'border-pkt-border-default bg-pkt-bg-subtle hover:border-pkt-border-default/80',
                !isBh && !isTe && 'opacity-60',
              )}
            >
              {/* TE badge */}
              {isTe && (
                <span className="absolute -top-1.5 -left-1 bg-pkt-brand-yellow-1000/15 text-pkt-brand-yellow-1000 rounded-sm text-bento-micro px-1 py-px font-bold uppercase tracking-wide">
                  TE
                </span>
              )}
              {/* BH badge (only when overriding) */}
              {isBh && harMetodeendring && (
                <span className="absolute -top-1.5 -right-1 bg-pkt-brand-warm-blue-1000/15 text-pkt-brand-warm-blue-1000 rounded-sm text-bento-micro px-1 py-px font-bold uppercase tracking-wide">
                  BH
                </span>
              )}
              <span className={clsx(
                'text-bento-label font-medium leading-tight',
                isBh ? 'text-pkt-brand-warm-blue-1000' : 'text-pkt-text-body-default',
              )}>
                {method.shortLabel}
              </span>
              <div className="flex items-center gap-0.5">
                <span className="text-bento-micro text-pkt-text-body-muted">{method.paragraf}</span>
                <Tooltip content={VEDERLAGSMETODE_DESCRIPTIONS[method.value]} side="bottom">
                  <span className="text-pkt-text-placeholder hover:text-pkt-text-body-default cursor-help">
                    <InfoCircledIcon className="w-2.5 h-2.5" />
                  </span>
                </Tooltip>
              </div>
            </button>
          );
        })}
      </div>
      {harMetodeendring && (
        <p className="text-bento-label text-pkt-text-body-muted">
          TE: {METHODS.find(m => m.value === teMetode)?.shortLabel} → BH: {METHODS.find(m => m.value === bhMetode)?.shortLabel}
        </p>
      )}
    </div>
  );
}
