/**
 * CategoryLabel Component
 *
 * Viser hovedkategori og underkategori(er) som tekst med info-ikon.
 * Tooltip viser parafrasert kontraktsregel fra KontraktsregelInline.
 *
 * Brukes i DashboardCard for kompakt visning uten accordion.
 */

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
  /** Underkategori-kode(r) - kan være string eller array */
  underkategori?: string | string[];
}

export function CategoryLabel({ hovedkategori, underkategori }: CategoryLabelProps) {
  const hovedkatObj = getHovedkategori(hovedkategori);
  const hovedLabel = getHovedkategoriLabel(hovedkategori);
  const underkategorier = Array.isArray(underkategori)
    ? underkategori
    : underkategori
      ? [underkategori]
      : [];
  const underLabels = underkategorier.map((uk) => getUnderkategoriLabel(uk)).join(', ');

  // Hent hjemmel og inline-tekst for tooltip
  // Prioritet: underkategori → hovedkategori (for Force Majeure etc.)
  const forsteUnderkategori = underkategorier[0];
  const ukObj = forsteUnderkategori ? getUnderkategoriObj(forsteUnderkategori) : null;

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
        {underLabels && <> → {underLabels}</>}
      </span>
      {hasTooltip && (
        <Tooltip.Provider delayDuration={200}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                className="text-pkt-text-body-muted hover:text-pkt-text-interactive transition-colors shrink-0 mt-0.5"
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
                className="z-50 bg-pkt-bg-card border border-pkt-border-subtle rounded-md p-3 shadow-lg max-w-sm text-sm animate-in fade-in-0 zoom-in-95"
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
