/**
 * VarslingStatusStrip - Cross-track notification status overview.
 *
 * Shows all NS 8407 notification requirements in a compact strip,
 * always visible to remind users of their obligations. Placed above
 * VederlagCard/FristCard in the bento layout.
 *
 * Points always shown (as ikke_relevant when not applicable):
 * - Grunnlag (underkategori label) — §32.2 or §25.1
 * - Frist (varslet) — §33.4
 * - Frist (krevd) — §33.6.1
 * - Hovedkrav — §34.1.2 (only SVIKT/ANDRE)
 * - Rigg/drift — §34.1.3
 * - Produktivitet — §34.1.3
 *
 * Vederlag-related points are ikke_relevant for FORCE_MAJEURE.
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
import { getUnderkategoriLabel } from '../../constants/categories';

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

  const grunnlagSendt = g.status !== 'ikke_relevant' && g.status !== 'utkast';
  const hovedkategori = g.hovedkategori;
  const erForceMajeure = hovedkategori === 'FORCE_MAJEURE';
  const erEndring = hovedkategori === 'ENDRING';

  // ── 1. Grunnlag — show underkategori label ──
  const ukLabel = getUnderkategoriLabel(g.underkategori) || 'Grunnlag';
  const grunnlagParagraf = erEndring ? '§32.2' : '§25.1';

  if (grunnlagSendt) {
    const harVarsel = !!g.grunnlag_varsel?.dato_sendt;
    const innsiget = g.grunnlag_varslet_i_tide === false;

    punkter.push({
      id: 'grunnlag',
      label: ukLabel,
      paragraf: grunnlagParagraf,
      status: innsiget ? 'innsigelse' : harVarsel ? 'sendt' : 'mangler',
      dato: g.grunnlag_varsel?.dato_sendt,
      innsigelseTekst: 'BH: for sent',
    });
  } else {
    punkter.push({
      id: 'grunnlag',
      label: 'Grunnlag',
      paragraf: '§32.2',
      status: 'ikke_relevant',
    });
  }

  // ── 2. Frist (varslet) §33.4 ──
  const fristAktiv = grunnlagSendt && f.status !== 'ikke_relevant';

  if (fristAktiv) {
    const harVarsel = !!f.frist_varsel?.dato_sendt;
    const innsiget = f.frist_varsel_ok === false || hasTrigger(f.subsidiaer_triggers, 'preklusjon_varsel');

    punkter.push({
      id: 'frist_varsel',
      label: 'Frist (varslet)',
      paragraf: '§33.4',
      status: innsiget ? 'innsigelse' : harVarsel ? 'sendt' : 'mangler',
      dato: f.frist_varsel?.dato_sendt,
      innsigelseTekst: 'BH: for sent',
    });
  } else {
    punkter.push({
      id: 'frist_varsel',
      label: 'Frist (varslet)',
      paragraf: '§33.4',
      status: 'ikke_relevant',
    });
  }

  // ── 3. Frist (krevd) §33.6.1 ──
  if (fristAktiv) {
    const harSpesifisert = !!f.spesifisert_varsel?.dato_sendt || f.krevd_dager != null;
    const innsiget = f.spesifisert_krav_ok === false || hasTrigger(f.subsidiaer_triggers, 'reduksjon_spesifisert');

    punkter.push({
      id: 'frist_spesifisert',
      label: 'Frist (krevd)',
      paragraf: '§33.6.1',
      status: innsiget ? 'innsigelse' : harSpesifisert ? 'sendt' : 'mangler',
      dato: f.spesifisert_varsel?.dato_sendt,
      innsigelseTekst: 'BH: redusert',
    });
  } else {
    punkter.push({
      id: 'frist_spesifisert',
      label: 'Frist (krevd)',
      paragraf: '§33.6.1',
      status: 'ikke_relevant',
    });
  }

  // ── 4. Hovedkrav §34.1.2 — only SVIKT/ANDRE (ENDRING has no preclusion per §34.1.1) ──
  const hovedkravPreklusjonsrelevant = !erEndring && !erForceMajeure;

  if (erForceMajeure) {
    // Force majeure: no compensation at all
    punkter.push({
      id: 'hovedkrav',
      label: 'Hovedkrav',
      paragraf: '§34.1.2',
      status: 'ikke_relevant',
    });
  } else if (erEndring) {
    // ENDRING: §34.1.1 — no preclusion for compensation
    punkter.push({
      id: 'hovedkrav',
      label: 'Hovedkrav',
      paragraf: '§34.1.1',
      status: 'ikke_relevant',
    });
  } else if (grunnlagSendt && hovedkravPreklusjonsrelevant) {
    const innsiget = hasTrigger(v.subsidiaer_triggers, 'preklusjon_hovedkrav');
    // For SVIKT/ANDRE the grunnlag notice also serves as the main claim notice
    const harVarsel = !!g.grunnlag_varsel?.dato_sendt;

    punkter.push({
      id: 'hovedkrav',
      label: 'Hovedkrav',
      paragraf: '§34.1.2',
      status: innsiget ? 'innsigelse' : harVarsel ? 'sendt' : 'mangler',
      dato: g.grunnlag_varsel?.dato_sendt,
      innsigelseTekst: 'BH: for sent',
    });
  } else {
    punkter.push({
      id: 'hovedkrav',
      label: 'Hovedkrav',
      paragraf: '§34.1.2',
      status: 'ikke_relevant',
    });
  }

  // ── 5. Rigg/drift §34.1.3 ──
  if (erForceMajeure) {
    punkter.push({
      id: 'rigg',
      label: 'Rigg/drift',
      paragraf: '§34.1.3',
      status: 'ikke_relevant',
    });
  } else {
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
    } else {
      punkter.push({
        id: 'rigg',
        label: 'Rigg/drift',
        paragraf: '§34.1.3',
        status: 'ikke_relevant',
      });
    }
  }

  // ── 6. Produktivitet §34.1.3 ──
  if (erForceMajeure) {
    punkter.push({
      id: 'produktivitet',
      label: 'Produktivitet',
      paragraf: '§34.1.3',
      status: 'ikke_relevant',
    });
  } else {
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
    } else {
      punkter.push({
        id: 'produktivitet',
        label: 'Produktivitet',
        paragraf: '§34.1.3',
        status: 'ikke_relevant',
      });
    }
  }

  return punkter;
}

// ─── Status rendering ────────────────────────────────────────────────

const STATUS_CONFIG: Record<VarselStatus, {
  icon: typeof CheckCircledIcon;
  colorClass: string;
}> = {
  sendt: {
    icon: CheckCircledIcon,
    colorClass: 'text-pkt-brand-dark-green-1000',
  },
  mangler: {
    icon: ExclamationTriangleIcon,
    colorClass: 'text-pkt-brand-yellow-1000',
  },
  innsigelse: {
    icon: CrossCircledIcon,
    colorClass: 'text-pkt-brand-red-1000',
  },
  ikke_relevant: {
    icon: MinusCircledIcon,
    colorClass: 'text-pkt-text-body-muted',
  },
};

// ─── Component ───────────────────────────────────────────────────────

export function VarslingStatusStrip({ state, userRole, className, style }: VarslingStatusStripProps) {
  const punkter = useMemo(() => deriveVarselPunkter(state), [state]);

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

        {/* Notification points — 2-col grid on mobile, flex-wrap on desktop */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1">
          {punkter.map((punkt) => {
            const config = STATUS_CONFIG[punkt.status];
            const Icon = config.icon;

            return (
              <div key={punkt.id} className={clsx(
                'flex items-center gap-1 min-w-0',
                punkt.status === 'ikke_relevant' && 'opacity-40',
              )}>
                <Icon className={clsx('w-3 h-3 shrink-0', config.colorClass)} />
                <span className="text-bento-caption font-medium text-pkt-text-body-default truncate">
                  {punkt.label}
                </span>
                <span className="text-bento-caption text-pkt-text-body-muted shrink-0">
                  {punkt.paragraf}
                </span>
                {punkt.status === 'sendt' && punkt.dato && (
                  <span className="text-bento-caption text-pkt-text-body-subtle font-mono shrink-0 hidden sm:inline">
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
