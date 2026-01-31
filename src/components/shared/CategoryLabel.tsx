/**
 * CategoryLabel Component
 *
 * Viser hovedkategori og underkategori(er) som tekst med info-ikon.
 * Tooltip viser parafrasert kontraktsregel fra KontraktsregelInline.
 *
 * Brukes i DashboardCard for kompakt visning uten accordion.
 */

import { useState } from 'react';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  getHovedkategori,
  getHovedkategoriLabel,
  getUnderkategoriLabel,
  getUnderkategoriObj,
} from '../../constants/categories';
import { getHjemmelInline } from './KontraktsregelInline';

interface CategoryLabelProps {
  /** Hovedkategori-kode (f.eks. "ENDRING", "SVIKT") */
  hovedkategori: string;
  /** Underkategori-kode */
  underkategori?: string;
}

export function CategoryLabel({ hovedkategori, underkategori }: CategoryLabelProps) {
  const [open, setOpen] = useState(false);
  const hovedkatObj = getHovedkategori(hovedkategori);
  const hovedLabel = getHovedkategoriLabel(hovedkategori);
  const underLabel = underkategori ? getUnderkategoriLabel(underkategori) : '';

  // Hent hjemmel og inline-tekst for tooltip
  // Prioritet: underkategori → hovedkategori (for Force Majeure etc.)
  const ukObj = underkategori ? getUnderkategoriObj(underkategori) : null;

  let tooltipTitle: string | null = null;
  let hjemmelKey: string | null = null;
  let inlineTekst: string | null = null;
  let beskrivelse: string | null = null;

  if (ukObj) {
    // Har underkategori - vis "Navn (§hjemmel)" som tittel
    hjemmelKey = `§${ukObj.hjemmel_basis.split(' ')[0]}`;
    tooltipTitle = `${ukObj.label} (${hjemmelKey})`;
    inlineTekst = getHjemmelInline(hjemmelKey);
  } else if (hovedkatObj) {
    // Ingen underkategori (f.eks. Force Majeure) - vis "Navn (§hjemmel)" som tittel
    hjemmelKey = `§${hovedkatObj.hjemmel_frist}`;
    tooltipTitle = `${hovedkatObj.label} (${hjemmelKey})`;
    inlineTekst = getHjemmelInline(hjemmelKey);
    beskrivelse = hovedkatObj.beskrivelse;
  }

  const hasTooltip = tooltipTitle && (inlineTekst || beskrivelse);

  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="font-medium text-pkt-text-body-dark">
        {hovedLabel}
        {underLabel && <> → {underLabel}</>}
      </span>
      {hasTooltip && (
        <Tooltip.Provider delayDuration={200}>
          <Tooltip.Root open={open} onOpenChange={setOpen}>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                onClick={() => setOpen(!open)}
                className="p-1 -m-1 rounded text-pkt-text-body-muted hover:bg-pkt-surface-strong-dark-blue hover:text-pkt-text-body-light transition-colors shrink-0"
                aria-label={`Vis kontraktsregel ${hjemmelKey}`}
              >
                <InfoCircledIcon className="w-4 h-4" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="bottom"
                align="start"
                sideOffset={4}
                collisionPadding={12}
                avoidCollisions
                onPointerDownOutside={() => setOpen(false)}
                className="z-50 bg-pkt-bg-card border border-pkt-border-subtle rounded-md p-3 shadow-lg max-w-[calc(100vw-2rem)] sm:max-w-sm text-sm animate-in fade-in-0 zoom-in-95"
              >
                <p className="font-semibold text-pkt-text-body-dark mb-1">{tooltipTitle}</p>
                <p className="text-pkt-text-body leading-relaxed">
                  {inlineTekst || beskrivelse}
                </p>
                <Tooltip.Arrow className="fill-pkt-bg-card" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      )}
    </div>
  );
}
