import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import { getHovedkategori, getUnderkategoriObj } from '../../constants/categories';
import { formatDateShort } from '../../utils/formatters';
import { TrackHistory } from './track-cards/TrackHistory';
import type { SporHistoryEntry } from '../views/SporHistory';

interface ClaimContextPanelProps {
  grunnlagEvent: {
    hovedkategori?: string;
    underkategori?: string | string[];
    beskrivelse?: string;
    dato_oppdaget?: string;
    dato_varslet?: string;
  };
  entries: SporHistoryEntry[];
}

export function ClaimContextPanel({ grunnlagEvent, entries }: ClaimContextPanelProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const { hovedkategori, underkategori, beskrivelse, dato_oppdaget, dato_varslet } = grunnlagEvent;

  const hkObj = hovedkategori ? getHovedkategori(hovedkategori) : undefined;
  const ukCode = Array.isArray(underkategori) ? underkategori[0] : underkategori;
  const ukObj = ukCode ? getUnderkategoriObj(ukCode) : undefined;

  const hasDates = !!(dato_oppdaget || dato_varslet);

  // Entitlement line
  const entitlementLine = hkObj
    ? hkObj.hjemmel_vederlag
      ? `Vederlag (§${hkObj.hjemmel_vederlag}) + Frist (§${hkObj.hjemmel_frist})`
      : `Kun frist (§${hkObj.hjemmel_frist})`
    : null;

  // Mobile compact header
  const compactLine = [
    hkObj?.kode.replace(/_/g, ' '),
    ukObj?.label?.split('(')[0]?.trim(),
  ].filter(Boolean).join(' · ');

  return (
    <>
      {/* ===== MOBILE: Compact sticky header ===== */}
      <div className="md:hidden sticky top-0 z-10 bg-pkt-bg-card border-b border-pkt-border-subtle -mx-4 px-4 py-2">
        <button
          type="button"
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-pkt-text-body-default uppercase tracking-wide truncate">
              {compactLine || "TE&apos;s krav"}
            </p>
            {hasDates && (
              <p className="text-[10px] text-pkt-text-body-muted">
                {dato_oppdaget && formatDateShort(dato_oppdaget)}
                {dato_oppdaget && dato_varslet && ' \u2192 '}
                {dato_varslet && formatDateShort(dato_varslet)}
              </p>
            )}
          </div>
          {mobileExpanded ? (
            <ChevronUpIcon className="w-4 h-4 text-pkt-text-body-subtle shrink-0" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-pkt-text-body-subtle shrink-0" />
          )}
        </button>
        {mobileExpanded && (
          <div className="mt-2 pt-2 border-t border-pkt-border-subtle">
            <ContextContent
              hkObj={hkObj}
              ukObj={ukObj}
              beskrivelse={beskrivelse}
              dato_oppdaget={dato_oppdaget}
              dato_varslet={dato_varslet}
              entitlementLine={entitlementLine}
              entries={entries}
            />
          </div>
        )}
      </div>

      {/* ===== DESKTOP: Full sticky panel ===== */}
      <div className="hidden md:block sticky top-4">
        <div className="bg-pkt-bg-subtle/50 rounded-lg p-4">
          <p className="text-[10px] font-medium text-pkt-text-body-muted uppercase tracking-wide mb-3">
            TE&apos;s krav
          </p>
          <ContextContent
            hkObj={hkObj}
            ukObj={ukObj}
            beskrivelse={beskrivelse}
            dato_oppdaget={dato_oppdaget}
            dato_varslet={dato_varslet}
            entitlementLine={entitlementLine}
            entries={entries}
          />
        </div>
      </div>
    </>
  );
}

/** Shared content for both mobile-expanded and desktop views */
function ContextContent({
  hkObj,
  ukObj,
  beskrivelse,
  dato_oppdaget,
  dato_varslet,
  entitlementLine,
  entries,
}: {
  hkObj: ReturnType<typeof getHovedkategori>;
  ukObj: ReturnType<typeof getUnderkategoriObj>;
  beskrivelse?: string;
  dato_oppdaget?: string;
  dato_varslet?: string;
  entitlementLine: string | null;
  entries: SporHistoryEntry[];
}) {
  return (
    <div className="space-y-3">
      {/* Category header */}
      {hkObj && (
        <div>
          <p className="text-[11px] font-semibold text-pkt-text-body-default uppercase tracking-wide">
            {hkObj.kode.replace(/_/g, ' ')}
            {ukObj && (
              <span className="text-pkt-text-body-muted font-normal ml-1.5">
                · §{ukObj.hjemmel_basis}
              </span>
            )}
          </p>
          {ukObj && (
            <p className="text-sm text-pkt-text-body-default mt-0.5">
              {ukObj.label.replace(/\s*\(([^)]+)\)\s*$/, ' — $1')}
            </p>
          )}
        </div>
      )}

      {/* Beskrivelse */}
      {beskrivelse && (
        <p className="text-xs text-pkt-text-body-default italic line-clamp-6">
          «{beskrivelse}»
        </p>
      )}

      {/* Entitlement */}
      {entitlementLine && (
        <p className="text-[10px] text-pkt-text-body-muted">
          Gir grunnlag for krav om: {entitlementLine}
        </p>
      )}

      {/* Dates */}
      {(dato_oppdaget || dato_varslet) && (
        <div className="space-y-1">
          {dato_oppdaget && (
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-pkt-text-body-subtle">Oppdaget</span>
              <span className="text-xs font-mono text-pkt-text-body-default">
                {formatDateShort(dato_oppdaget)}
              </span>
            </div>
          )}
          {dato_varslet && (
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-pkt-text-body-subtle">Varslet</span>
              <span className="text-xs font-mono text-pkt-text-body-default">
                {formatDateShort(dato_varslet)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <TrackHistory entries={entries} />
    </div>
  );
}
