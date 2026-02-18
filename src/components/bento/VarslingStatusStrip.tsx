/**
 * VarslingStatusStrip - Cross-track notification status overview.
 *
 * Shows TE's notification status for all relevant NS 8407 notification
 * requirements in a compact strip. Placed above VederlagCard/FristCard
 * in the bento layout.
 *
 * For TE: Acts as a checklist — what has been notified, what's missing.
 * For BH: Shows what TE has notified and any innsigelser raised.
 */

import { useMemo } from 'react';
import { clsx } from 'clsx';
import {
  CheckCircledIcon,
  ExclamationTriangleIcon,
  CrossCircledIcon,
  MinusCircledIcon,
} from '@radix-ui/react-icons';
import type { SakState, SubsidiaerTrigger } from '../../types/timeline';
import { formatDateShort } from '../../utils/formatters';

// ─── Types ───────────────────────────────────────────────────────────

type VarselStatus = 'sendt' | 'mangler' | 'innsigelse' | 'ikke_relevant';

interface VarselPunkt {
  id: string;
  label: string;
  paragraf: string;
  status: VarselStatus;
  dato?: string;
  /** Extra detail shown on innsigelse */
  innsigelseTekst?: string;
}

interface VarslingStatusStripProps {
  state: SakState;
  userRole: 'TE' | 'BH';
  className?: string;
  style?: React.CSSProperties;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function hasTrigger(triggers: SubsidiaerTrigger[] | undefined, trigger: SubsidiaerTrigger): boolean {
  return triggers?.includes(trigger) ?? false;
}

function deriveVarselPunkter(state: SakState): VarselPunkt[] {
  const g = state.grunnlag;
  const v = state.vederlag;
  const f = state.frist;
  const punkter: VarselPunkt[] = [];

  // 1. Grunnlag §32.2 / §25.1
  const grunnlagSendt = g.status !== 'ikke_relevant' && g.status !== 'utkast';
  if (grunnlagSendt) {
    const harVarsel = !!g.grunnlag_varsel?.dato_sendt;
    const innsiget = g.grunnlag_varslet_i_tide === false;
    const paragraf = g.hovedkategori === 'ENDRING' ? '§32.2' : '§25.1';

    punkter.push({
      id: 'grunnlag',
      label: 'Grunnlag',
      paragraf,
      status: innsiget ? 'innsigelse' : harVarsel ? 'sendt' : 'mangler',
      dato: g.grunnlag_varsel?.dato_sendt,
      innsigelseTekst: 'BH: for sent',
    });
  }

  // 2. Frist §33.4 — forelopig varsel
  const fristRelevant = grunnlagSendt && f.status !== 'ikke_relevant';
  if (fristRelevant) {
    const harVarsel = !!f.frist_varsel?.dato_sendt;
    const innsiget = f.frist_varsel_ok === false || hasTrigger(f.subsidiaer_triggers, 'preklusjon_varsel');

    punkter.push({
      id: 'frist_varsel',
      label: 'Frist',
      paragraf: '§33.4',
      status: innsiget ? 'innsigelse' : harVarsel ? 'sendt' : 'mangler',
      dato: f.frist_varsel?.dato_sendt,
      innsigelseTekst: 'BH: for sent',
    });

    // 3. Frist §33.6.1 — spesifisert krav (only relevant when §33.4 sent but not yet specified)
    const harSpesifisert = !!f.spesifisert_varsel?.dato_sendt || f.krevd_dager != null;
    const innsigetSpesifisert = f.spesifisert_krav_ok === false || hasTrigger(f.subsidiaer_triggers, 'reduksjon_spesifisert');

    if (harVarsel || harSpesifisert) {
      punkter.push({
        id: 'frist_spesifisert',
        label: 'Frist',
        paragraf: '§33.6.1',
        status: innsigetSpesifisert ? 'innsigelse' : harSpesifisert ? 'sendt' : 'mangler',
        dato: f.spesifisert_varsel?.dato_sendt,
        innsigelseTekst: 'BH: redusert',
      });
    }
  }

  // 4. Rigg/drift §34.1.3
  const harRiggKrav = (v.saerskilt_krav?.rigg_drift?.belop ?? 0) > 0;
  if (harRiggKrav) {
    const harVarsel = !!v.rigg_drift_varsel?.dato_sendt;
    const innsiget = hasTrigger(v.subsidiaer_triggers, 'preklusjon_rigg');

    punkter.push({
      id: 'rigg',
      label: 'Rigg/drift',
      paragraf: '§34.1.3',
      status: innsiget ? 'innsigelse' : harVarsel ? 'sendt' : 'mangler',
      dato: v.rigg_drift_varsel?.dato_sendt,
      innsigelseTekst: 'BH: for sent',
    });
  }

  // 5. Produktivitet §34.1.3
  const harProdKrav = (v.saerskilt_krav?.produktivitet?.belop ?? 0) > 0;
  if (harProdKrav) {
    const harVarsel = !!v.produktivitetstap_varsel?.dato_sendt;
    const innsiget = hasTrigger(v.subsidiaer_triggers, 'preklusjon_produktivitet');

    punkter.push({
      id: 'produktivitet',
      label: 'Produktivitet',
      paragraf: '§34.1.3',
      status: innsiget ? 'innsigelse' : harVarsel ? 'sendt' : 'mangler',
      dato: v.produktivitetstap_varsel?.dato_sendt,
      innsigelseTekst: 'BH: for sent',
    });
  }

  return punkter;
}

// ─── Status rendering ────────────────────────────────────────────────

const STATUS_CONFIG: Record<VarselStatus, {
  icon: typeof CheckCircledIcon;
  colorClass: string;
  defaultText: string;
}> = {
  sendt: {
    icon: CheckCircledIcon,
    colorClass: 'text-pkt-brand-dark-green-1000',
    defaultText: 'Varslet',
  },
  mangler: {
    icon: ExclamationTriangleIcon,
    colorClass: 'text-pkt-brand-yellow-1000',
    defaultText: 'Ikke sendt',
  },
  innsigelse: {
    icon: CrossCircledIcon,
    colorClass: 'text-pkt-brand-red-1000',
    defaultText: 'Innsiget',
  },
  ikke_relevant: {
    icon: MinusCircledIcon,
    colorClass: 'text-pkt-text-body-muted',
    defaultText: 'Ikke relevant',
  },
};

// ─── Component ───────────────────────────────────────────────────────

export function VarslingStatusStrip({ state, userRole, className, style }: VarslingStatusStripProps) {
  const punkter = useMemo(() => deriveVarselPunkter(state), [state]);

  // Don't render if nothing to show
  if (punkter.length === 0) return null;

  const harMangler = punkter.some(p => p.status === 'mangler');
  const harInnsigelser = punkter.some(p => p.status === 'innsigelse');

  return (
    <div
      className={clsx(
        'rounded-lg bg-pkt-bg-card border overflow-hidden',
        harInnsigelser
          ? 'border-pkt-brand-red-1000/20'
          : harMangler
            ? 'border-pkt-brand-yellow-1000/20'
            : 'border-pkt-border-subtle',
        className,
      )}
      style={style}
    >
      <div className="px-3 py-2">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            Varslinger
          </span>
          <span className="text-bento-label text-pkt-text-body-muted">&sect;5</span>
          {harInnsigelser && (
            <span className="bg-pkt-brand-red-1000/10 text-pkt-brand-red-1000 rounded-sm text-bento-micro px-1 py-0.5 font-medium">
              Innsigelse
            </span>
          )}
          {!harInnsigelser && harMangler && userRole === 'TE' && (
            <span className="bg-pkt-brand-yellow-1000/10 text-pkt-brand-yellow-1000 rounded-sm text-bento-micro px-1 py-0.5 font-medium">
              Handling p&aring;krevd
            </span>
          )}
        </div>

        {/* Notification points */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {punkter.map((punkt) => {
            const config = STATUS_CONFIG[punkt.status];
            const Icon = config.icon;

            return (
              <div key={punkt.id} className="flex items-center gap-1 min-w-0">
                <Icon className={clsx('w-3 h-3 shrink-0', config.colorClass)} />
                <span className="text-bento-caption font-medium text-pkt-text-body-default shrink-0">
                  {punkt.label}
                </span>
                <span className="text-bento-caption text-pkt-text-body-muted shrink-0">
                  {punkt.paragraf}
                </span>
                {punkt.status === 'sendt' && punkt.dato && (
                  <span className="text-bento-caption text-pkt-text-body-subtle font-mono shrink-0">
                    {formatDateShort(punkt.dato)}
                  </span>
                )}
                {punkt.status === 'innsigelse' && (
                  <span className="text-bento-micro text-pkt-brand-red-1000 font-medium shrink-0">
                    {punkt.innsigelseTekst}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
