/**
 * EventDetailModal Component
 *
 * Modal for viewing detailed event data from the timeline.
 * Supports all event types with type-specific rendering.
 * Uses accordion (Collapsible) for long text fields.
 */

import React from 'react';
import { Badge, BadgeVariant, Collapsible, Modal } from '../primitives';
import {
  TimelineEntry,
  EventType,
  GrunnlagEventData,
  VederlagEventData,
  FristEventData,
  ResponsGrunnlagEventData,
  ResponsVederlagEventData,
  ResponsFristEventData,
  GrunnlagOppdatertEventData,
  VederlagOppdatertEventData,
  FristOppdatertEventData,
  ResponsGrunnlagOppdatertEventData,
  ResponsVederlagOppdatertEventData,
  ResponsFristOppdatertEventData,
  ForseringVarselEventData,
  VarselInfo,
  GrunnlagResponsResultat,
  VederlagBeregningResultat,
  FristBeregningResultat,
  SubsidiaerTrigger,
} from '../../types/timeline';
import {
  getHovedkategoriLabel,
  getUnderkategoriLabel,
  getUnderkategoriObj,
} from '../../constants/categories';
import { getVederlagsmetodeLabel } from '../../constants/paymentMethods';
import { getFristVarseltypeLabel } from '../../constants/fristVarselTypes';
import {
  getBhGrunnlagssvarLabel,
  getBhVederlagssvarLabel,
  getBhFristsvarLabel,
  getSubsidiaerTriggerLabel,
} from '../../constants/responseOptions';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import {
  FileTextIcon,
  CalendarIcon,
  PersonIcon,
  TargetIcon,
} from '@radix-ui/react-icons';

// ========== TYPES ==========

interface EventDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: TimelineEntry;
}

// ========== LABELS ==========

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  sak_opprettet: 'Sak opprettet',
  grunnlag_opprettet: 'Grunnlag sendt',
  grunnlag_oppdatert: 'Grunnlag oppdatert',
  grunnlag_trukket: 'Grunnlag trukket',
  vederlag_krav_sendt: 'Vederlagskrav sendt',
  vederlag_krav_oppdatert: 'Vederlagskrav oppdatert',
  vederlag_krav_trukket: 'Vederlagskrav trukket',
  frist_krav_sendt: 'Fristkrav sendt',
  frist_krav_oppdatert: 'Fristkrav oppdatert',
  frist_krav_trukket: 'Fristkrav trukket',
  respons_grunnlag: 'Svar på grunnlag',
  respons_grunnlag_oppdatert: 'Svar på grunnlag oppdatert',
  respons_vederlag: 'Svar på vederlagskrav',
  respons_vederlag_oppdatert: 'Svar på vederlagskrav oppdatert',
  respons_frist: 'Svar på fristkrav',
  respons_frist_oppdatert: 'Svar på fristkrav oppdatert',
  forsering_varsel: 'Varsel om forsering',
  eo_utstedt: 'Endringsordre utstedt',
};

const SPOR_LABELS: Record<string, string> = {
  grunnlag: 'Ansvarsgrunnlag',
  vederlag: 'Vederlag',
  frist: 'Frist',
};

// ========== HELPER FUNCTIONS ==========

function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '—';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'PPP', { locale: nb });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'PPPp', { locale: nb });
  } catch {
    return dateStr;
  }
}

function getGrunnlagResultatBadge(resultat: GrunnlagResponsResultat | string): { variant: BadgeVariant; label: string } {
  const label = getBhGrunnlagssvarLabel(resultat);
  let variant: BadgeVariant = 'neutral';

  switch (resultat) {
    case 'godkjent':
      variant = 'success';
      break;
    case 'delvis_godkjent':
    case 'erkjenn_fm':
    case 'krever_avklaring':
      variant = 'warning';
      break;
    case 'avslatt':
    case 'frafalt':
      variant = 'danger';
      break;
  }

  return { variant, label };
}

function getVederlagResultatBadge(resultat: VederlagBeregningResultat | string): { variant: BadgeVariant; label: string } {
  const label = getBhVederlagssvarLabel(resultat);
  let variant: BadgeVariant = 'neutral';

  switch (resultat) {
    case 'godkjent':
      variant = 'success';
      break;
    case 'delvis_godkjent':
    case 'hold_tilbake':
      variant = 'warning';
      break;
    case 'avslatt':
      variant = 'danger';
      break;
  }

  return { variant, label };
}

function getFristResultatBadge(resultat: FristBeregningResultat | string): { variant: BadgeVariant; label: string } {
  const label = getBhFristsvarLabel(resultat);
  let variant: BadgeVariant = 'neutral';

  switch (resultat) {
    case 'godkjent':
      variant = 'success';
      break;
    case 'delvis_godkjent':
      variant = 'warning';
      break;
    case 'avslatt':
      variant = 'danger';
      break;
  }

  return { variant, label };
}

// ========== FIELD COMPONENTS ==========

interface FieldProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

function Field({ label, value, className = '' }: FieldProps) {
  if (value === undefined || value === null || value === '' || value === '—') return null;
  return (
    <div className={`py-3 border-b border-pkt-grays-gray-200 last:border-b-0 ${className}`}>
      <dt className="text-sm font-medium text-pkt-grays-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-pkt-text-body-dark">{value}</dd>
    </div>
  );
}

interface VarselInfoDisplayProps {
  label: string;
  varsel: VarselInfo | undefined;
}

function VarselInfoDisplay({ label, varsel }: VarselInfoDisplayProps) {
  if (!varsel?.dato_sendt) return null;
  return (
    <Field
      label={label}
      value={
        <span>
          {formatDate(varsel.dato_sendt)}
          {varsel.metode && varsel.metode.length > 0 && (
            <span className="ml-2 text-pkt-grays-gray-500">
              ({varsel.metode.join(', ')})
            </span>
          )}
        </span>
      }
    />
  );
}

interface LongTextFieldProps {
  label: string;
  value: string | undefined;
  defaultOpen?: boolean;
}

function LongTextField({ label, value, defaultOpen = false }: LongTextFieldProps) {
  if (!value) return null;

  // For short texts (less than 150 chars), display inline
  if (value.length < 150) {
    return <Field label={label} value={value} />;
  }

  // For longer texts, use collapsible
  return (
    <div className="py-3 border-b border-pkt-grays-gray-100 last:border-b-0">
      <Collapsible title={label} defaultOpen={defaultOpen}>
        <p className="text-sm text-pkt-text-body-dark whitespace-pre-wrap">
          {value}
        </p>
      </Collapsible>
    </div>
  );
}

/**
 * VedleggDisplay - Shows list of attached documents
 */
interface VedleggDisplayProps {
  vedleggIds: string[] | undefined;
}

function VedleggDisplay({ vedleggIds }: VedleggDisplayProps) {
  if (!vedleggIds || vedleggIds.length === 0) return null;

  return (
    <Field
      label="Vedlegg"
      value={
        <ul className="space-y-1">
          {vedleggIds.map((id) => (
            <li key={id} className="flex items-center gap-2">
              <FileTextIcon className="w-4 h-4 text-pkt-grays-gray-400" />
              <span className="text-sm text-pkt-brand-dark-blue-1000 hover:underline cursor-pointer">
                {id}
              </span>
            </li>
          ))}
        </ul>
      }
    />
  );
}

/**
 * SectionDivider - Visual separator for grouping fields
 *
 * Used to organize BH response data into logical sections without
 * hiding any content. All data remains visible at all times.
 */
interface SectionDividerProps {
  title: string;
  subtitle?: string;
}

function SectionDivider({ title, subtitle }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-3 py-2 mt-4 first:mt-0">
      <span className="text-xs font-medium text-pkt-grays-gray-500 uppercase tracking-wide whitespace-nowrap">
        {title}
      </span>
      <div className="flex-1 border-t border-pkt-grays-gray-200" />
      {subtitle && (
        <span className="text-xs text-pkt-grays-gray-400 whitespace-nowrap">
          {subtitle}
        </span>
      )}
    </div>
  );
}

// ========== SECTION COMPONENTS ==========

function GrunnlagSection({ data }: { data: GrunnlagEventData }) {
  // Get underkategori codes as array
  const underkategoriKoder = Array.isArray(data.underkategori)
    ? data.underkategori
    : [data.underkategori];

  // Get full underkategori objects for hjemmel info
  const underkategoriObjekter = underkategoriKoder
    .map((kode) => getUnderkategoriObj(kode))
    .filter((obj): obj is NonNullable<typeof obj> => obj !== undefined);

  // Format underkategori labels
  const underkategoriLabels = underkategoriObjekter
    .map((obj) => obj.label)
    .join(', ');

  // Get unique hjemmel references
  const hjemmelRefs = [...new Set(underkategoriObjekter.map((obj) => `§${obj.hjemmel_basis}`))];
  const varselkravRefs = [...new Set(underkategoriObjekter.map((obj) => obj.varselkrav_ref))];

  return (
    <dl>
      <Field label="Tittel" value={data.tittel} />
      <Field label="Hovedkategori" value={getHovedkategoriLabel(data.hovedkategori)} />
      <Field
        label="Underkategori"
        value={
          <span>
            {underkategoriLabels}
            {hjemmelRefs.length > 0 && (
              <span className="ml-2 text-pkt-grays-gray-500 text-xs">
                ({hjemmelRefs.join(', ')})
              </span>
            )}
          </span>
        }
      />
      {varselkravRefs.length > 0 && (
        <Field
          label="Varselkrav"
          value={
            <span className="text-pkt-grays-gray-600">
              NS 8407 §{varselkravRefs.join(' / §')}
            </span>
          }
        />
      )}
      <Field label="Dato oppdaget" value={formatDate(data.dato_oppdaget)} />
      <VarselInfoDisplay label="Varsel sendt" varsel={data.grunnlag_varsel} />
      <LongTextField label="Beskrivelse" value={data.beskrivelse} defaultOpen={true} />
      {data.kontraktsreferanser && data.kontraktsreferanser.length > 0 && (
        <Field label="Kontraktsreferanser" value={data.kontraktsreferanser.join(', ')} />
      )}
      <VedleggDisplay vedleggIds={data.vedlegg_ids} />
    </dl>
  );
}

function GrunnlagOppdatertSection({ data }: { data: GrunnlagOppdatertEventData }) {
  const underkategorier = data.underkategori
    ? (Array.isArray(data.underkategori)
      ? data.underkategori.map(getUnderkategoriLabel).join(', ')
      : getUnderkategoriLabel(data.underkategori))
    : undefined;

  return (
    <dl>
      {data.tittel && <Field label="Ny tittel" value={data.tittel} />}
      {data.hovedkategori && <Field label="Ny hovedkategori" value={getHovedkategoriLabel(data.hovedkategori)} />}
      {underkategorier && <Field label="Ny underkategori" value={underkategorier} />}
      {data.dato_oppdaget && <Field label="Ny dato oppdaget" value={formatDate(data.dato_oppdaget)} />}
      <LongTextField label="Ny beskrivelse" value={data.beskrivelse} />
      <LongTextField label="Begrunnelse for endring" value={data.endrings_begrunnelse} defaultOpen={true} />
    </dl>
  );
}

function VederlagSection({ data }: { data: VederlagEventData }) {
  const harSaerskiltKrav = data.saerskilt_krav?.rigg_drift || data.saerskilt_krav?.produktivitet;

  // Beregn total krevd beløp
  const hovedbelop = data.belop_direkte ?? data.kostnads_overslag ?? 0;
  const riggBelop = data.saerskilt_krav?.rigg_drift?.belop ?? 0;
  const produktivitetBelop = data.saerskilt_krav?.produktivitet?.belop ?? 0;
  const totalBelop = hovedbelop + riggBelop + produktivitetBelop;

  return (
    <dl>
      {/* Sammendrag - kompakt oversikt øverst */}
      <div className="bg-pkt-bg-subtle p-3 mb-4 border-l-4 border-pkt-brand-dark-blue-1000">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold text-pkt-text-body-dark">
            {formatCurrency(totalBelop)}
          </span>
          <Badge variant="info">{getVederlagsmetodeLabel(data.metode)}</Badge>
        </div>
        {harSaerskiltKrav && (
          <div className="text-sm text-pkt-grays-gray-600 mt-1">
            {hovedbelop > 0 && <span>Hovedkrav {formatCurrency(hovedbelop)}</span>}
            {riggBelop > 0 && <span> + Rigg {formatCurrency(riggBelop)}</span>}
            {produktivitetBelop > 0 && <span> + Produktivitet {formatCurrency(produktivitetBelop)}</span>}
          </div>
        )}
      </div>

      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />

      {/* Særskilte krav - detaljer */}
      {harSaerskiltKrav && (
        <div className="py-3 border-b border-pkt-grays-gray-100">
          <dt className="text-sm font-medium text-pkt-grays-gray-500 mb-2">Særskilte krav (§34.1.3)</dt>
          <dd className="space-y-2">
            {data.saerskilt_krav?.rigg_drift && (
              <div className="pl-3 border-l-2 border-pkt-brand-dark-blue-1000">
                <span className="text-sm font-medium">Rigg/drift:</span>
                <span className="ml-2 text-sm">
                  {data.saerskilt_krav.rigg_drift.belop !== undefined
                    ? formatCurrency(data.saerskilt_krav.rigg_drift.belop)
                    : 'Ja'}
                </span>
                {data.saerskilt_krav.rigg_drift.dato_klar_over && (
                  <span className="ml-2 text-sm text-pkt-grays-gray-500">
                    (klar over: {formatDate(data.saerskilt_krav.rigg_drift.dato_klar_over)})
                  </span>
                )}
              </div>
            )}
            {data.saerskilt_krav?.produktivitet && (
              <div className="pl-3 border-l-2 border-pkt-brand-yellow-1000">
                <span className="text-sm font-medium">Produktivitetstap:</span>
                <span className="ml-2 text-sm">
                  {data.saerskilt_krav.produktivitet.belop !== undefined
                    ? formatCurrency(data.saerskilt_krav.produktivitet.belop)
                    : 'Ja'}
                </span>
                {data.saerskilt_krav.produktivitet.dato_klar_over && (
                  <span className="ml-2 text-sm text-pkt-grays-gray-500">
                    (klar over: {formatDate(data.saerskilt_krav.produktivitet.dato_klar_over)})
                  </span>
                )}
              </div>
            )}
          </dd>
        </div>
      )}

      {data.krever_justert_ep && (
        <Field label="Krever justerte EP" value={<Badge variant="warning">Ja - §34.3.3</Badge>} />
      )}

      {/* Forhåndsvarsel for regningsarbeid (§34.4) - kun denne har separat varslingskrav */}
      <VarselInfoDisplay label="Forhåndsvarsel regningsarbeid" varsel={data.regningsarbeid_varsel} />
      <VedleggDisplay vedleggIds={data.vedlegg_ids} />
    </dl>
  );
}

function VederlagOppdatertSection({ data }: { data: VederlagOppdatertEventData }) {
  return (
    <dl>
      {data.nytt_belop_direkte !== undefined && (
        <Field label="Nytt beløp" value={formatCurrency(data.nytt_belop_direkte)} />
      )}
      {data.nytt_kostnads_overslag !== undefined && (
        <Field label="Nytt kostnadsoverslag" value={formatCurrency(data.nytt_kostnads_overslag)} />
      )}
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      <Field label="Revidert dato" value={formatDate(data.dato_revidert)} />
    </dl>
  );
}

function FristSection({ data }: { data: FristEventData }) {
  return (
    <dl>
      <Field label="Varseltype" value={getFristVarseltypeLabel(data.varsel_type)} />
      <VarselInfoDisplay label="Nøytralt varsel (§33.4)" varsel={data.noytralt_varsel} />
      <VarselInfoDisplay label="Spesifisert varsel (§33.6)" varsel={data.spesifisert_varsel} />
      {data.antall_dager !== undefined && (
        <Field label="Krevde dager" value={`${data.antall_dager} dager`} />
      )}
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.ny_sluttdato && <Field label="Ny sluttdato" value={formatDate(data.ny_sluttdato)} />}
      <LongTextField label="Fremdriftsdokumentasjon" value={data.fremdriftshindring_dokumentasjon} />
      <VedleggDisplay vedleggIds={data.vedlegg_ids} />
    </dl>
  );
}

function FristOppdatertSection({ data }: { data: FristOppdatertEventData }) {
  return (
    <dl>
      {data.nytt_antall_dager !== undefined && (
        <Field label="Nytt antall dager" value={`${data.nytt_antall_dager} dager`} />
      )}
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      <Field label="Revidert dato" value={formatDate(data.dato_revidert)} />
    </dl>
  );
}

function ResponsGrunnlagSection({ data }: { data: ResponsGrunnlagEventData }) {
  const badge = getGrunnlagResultatBadge(data.resultat);

  return (
    <dl>
      <Field
        label="Resultat"
        value={<Badge variant={badge.variant}>{badge.label}</Badge>}
      />
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.akseptert_kategori && (
        <Field label="Akseptert kategori" value={data.akseptert_kategori} />
      )}
      {data.varsel_for_sent && (
        <Field label="Varsel for sent" value={<Badge variant="danger">Ja - preklusjonsrisiko</Badge>} />
      )}
      <LongTextField label="Varselbegrunnelse" value={data.varsel_begrunnelse} />
      {data.krever_dokumentasjon && data.krever_dokumentasjon.length > 0 && (
        <Field label="Krever dokumentasjon" value={data.krever_dokumentasjon.join(', ')} />
      )}
    </dl>
  );
}

function ResponsGrunnlagOppdatertSection({ data }: { data: ResponsGrunnlagOppdatertEventData }) {
  const badge = getGrunnlagResultatBadge(data.resultat);

  return (
    <dl>
      <Field
        label="Nytt resultat"
        value={<Badge variant={badge.variant}>{badge.label}</Badge>}
      />
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      <Field label="Endret dato" value={formatDate(data.dato_endret)} />
    </dl>
  );
}

function ResponsVederlagSection({ data }: { data: ResponsVederlagEventData }) {
  const badge = getVederlagResultatBadge(data.beregnings_resultat);

  // Check if we have Port 1 preclusion fields
  const hasPreklusjonsFields =
    data.rigg_varslet_i_tide !== undefined ||
    data.produktivitet_varslet_i_tide !== undefined ||
    data.begrunnelse_preklusjon;

  // Check if we have legacy varsel fields
  const hasLegacyVarselFields =
    data.saerskilt_varsel_rigg_drift_ok !== undefined ||
    data.varsel_justert_ep_ok !== undefined ||
    data.varsel_start_regning_ok !== undefined ||
    data.krav_fremmet_i_tide !== undefined ||
    data.begrunnelse_varsel;

  // Check if we have detailed breakdown
  const hasBelopBreakdown =
    data.hovedkrav_vurdering ||
    data.hovedkrav_godkjent_belop !== undefined ||
    data.rigg_vurdering ||
    data.rigg_godkjent_belop !== undefined ||
    data.produktivitet_vurdering ||
    data.produktivitet_godkjent_belop !== undefined;

  // Check if we have calculation details
  const hasBeregningFields =
    data.begrunnelse_beregning ||
    data.begrunnelse ||
    data.frist_for_spesifikasjon;

  // Check if we have subsidiary data
  const hasSubsidiaerFields =
    (data.subsidiaer_triggers && data.subsidiaer_triggers.length > 0) ||
    data.subsidiaer_resultat ||
    data.subsidiaer_godkjent_belop !== undefined ||
    data.subsidiaer_begrunnelse;

  // Helper to get beløpsvurdering badge
  const getBelopVurderingBadge = (vurdering: string | undefined) => {
    switch (vurdering) {
      case 'godkjent': return { variant: 'success' as const, label: 'Godkjent' };
      case 'delvis': return { variant: 'warning' as const, label: 'Delvis godkjent' };
      case 'avslatt': return { variant: 'danger' as const, label: 'Avslått' };
      default: return { variant: 'neutral' as const, label: '-' };
    }
  };

  // Check if rigg/produktivitet is precluded
  const riggPrekludert = data.rigg_varslet_i_tide === false;
  const produktivitetPrekludert = data.produktivitet_varslet_i_tide === false;

  return (
    <dl>
      {/* ── Sammendrag ─────────────────────────────────────────────── */}
      <Field
        label="Resultat"
        value={<Badge variant={badge.variant}>{badge.label}</Badge>}
      />
      {data.total_godkjent_belop !== undefined && (
        <Field
          label="Totalt godkjent beløp"
          value={formatCurrency(data.total_godkjent_belop)}
        />
      )}
      {data.vederlagsmetode && (
        <Field label="Oppgjørsform" value={getVederlagsmetodeLabel(data.vederlagsmetode)} />
      )}

      {/* ── Port 1: Preklusjonsvurdering (§34.1.3) ─────────────────── */}
      {hasPreklusjonsFields && (
        <>
          <SectionDivider title="Preklusjonsvurdering" subtitle="§34.1.3" />
          {data.rigg_varslet_i_tide !== undefined && (
            <Field
              label="Rigg/drift varslet i tide"
              value={
                <Badge variant={data.rigg_varslet_i_tide ? 'success' : 'danger'}>
                  {data.rigg_varslet_i_tide ? 'Ja' : 'Nei (prekludert)'}
                </Badge>
              }
            />
          )}
          {data.produktivitet_varslet_i_tide !== undefined && (
            <Field
              label="Produktivitet varslet i tide"
              value={
                <Badge variant={data.produktivitet_varslet_i_tide ? 'success' : 'danger'}>
                  {data.produktivitet_varslet_i_tide ? 'Ja' : 'Nei (prekludert)'}
                </Badge>
              }
            />
          )}
          <LongTextField label="Begrunnelse" value={data.begrunnelse_preklusjon} />
        </>
      )}

      {/* ── Legacy varselvurdering ──────────────────────────────────── */}
      {hasLegacyVarselFields && !hasPreklusjonsFields && (
        <>
          <SectionDivider title="Varselvurdering" subtitle="§34.1.3" />
          {data.saerskilt_varsel_rigg_drift_ok !== undefined && (
            <Field
              label="Rigg/drift varsel OK"
              value={
                <Badge variant={data.saerskilt_varsel_rigg_drift_ok ? 'success' : 'danger'}>
                  {data.saerskilt_varsel_rigg_drift_ok ? 'Ja' : 'Nei'}
                </Badge>
              }
            />
          )}
          {data.varsel_justert_ep_ok !== undefined && (
            <Field
              label="Justert EP varsel OK"
              value={
                <Badge variant={data.varsel_justert_ep_ok ? 'success' : 'danger'}>
                  {data.varsel_justert_ep_ok ? 'Ja' : 'Nei'}
                </Badge>
              }
            />
          )}
          {data.varsel_start_regning_ok !== undefined && (
            <Field
              label="Regningsarbeid varsel OK"
              value={
                <Badge variant={data.varsel_start_regning_ok ? 'success' : 'danger'}>
                  {data.varsel_start_regning_ok ? 'Ja' : 'Nei'}
                </Badge>
              }
            />
          )}
          {data.krav_fremmet_i_tide !== undefined && (
            <Field
              label="Krav fremmet i tide"
              value={
                <Badge variant={data.krav_fremmet_i_tide ? 'success' : 'warning'}>
                  {data.krav_fremmet_i_tide ? 'Ja' : 'Nei'}
                </Badge>
              }
            />
          )}
          <LongTextField label="Begrunnelse" value={data.begrunnelse_varsel} />
        </>
      )}

      {/* ── Port 3: Beløpsvurdering per kravtype ───────────────────── */}
      {hasBelopBreakdown && (
        <>
          <SectionDivider title="Beløpsvurdering" />

          {/* Hovedkrav */}
          {(data.hovedkrav_vurdering || data.hovedkrav_godkjent_belop !== undefined) && (
            <div className="py-2 border-b border-pkt-border-subtle">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Hovedkrav</span>
                <div className="flex items-center gap-2">
                  {data.hovedkrav_vurdering && (
                    <Badge variant={getBelopVurderingBadge(data.hovedkrav_vurdering).variant} size="sm">
                      {getBelopVurderingBadge(data.hovedkrav_vurdering).label}
                    </Badge>
                  )}
                  {data.hovedkrav_godkjent_belop !== undefined && (
                    <span className="font-mono">{formatCurrency(data.hovedkrav_godkjent_belop)}</span>
                  )}
                </div>
              </div>
              {data.hovedkrav_begrunnelse && (
                <p className="text-sm text-pkt-grays-gray-600 mt-1">{data.hovedkrav_begrunnelse}</p>
              )}
            </div>
          )}

          {/* Rigg/drift */}
          {(data.rigg_vurdering || data.rigg_godkjent_belop !== undefined) && (
            <div className={`py-2 border-b border-pkt-border-subtle ${riggPrekludert ? 'bg-pkt-surface-yellow' : ''}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">
                  Rigg/drift
                  {riggPrekludert && <span className="text-xs text-pkt-grays-gray-500 ml-1">(prekludert)</span>}
                </span>
                <div className="flex items-center gap-2">
                  {data.rigg_vurdering && (
                    <Badge variant={getBelopVurderingBadge(data.rigg_vurdering).variant} size="sm">
                      {getBelopVurderingBadge(data.rigg_vurdering).label}
                    </Badge>
                  )}
                  {data.rigg_godkjent_belop !== undefined && (
                    <span className={`font-mono ${riggPrekludert ? 'line-through text-pkt-grays-gray-400' : ''}`}>
                      {formatCurrency(data.rigg_godkjent_belop)}
                    </span>
                  )}
                </div>
              </div>
              {riggPrekludert && data.rigg_godkjent_belop !== undefined && data.rigg_godkjent_belop > 0 && (
                <p className="text-xs text-pkt-text-warning mt-1">
                  Subsidiært godkjent: {formatCurrency(data.rigg_godkjent_belop)}
                </p>
              )}
            </div>
          )}

          {/* Produktivitet */}
          {(data.produktivitet_vurdering || data.produktivitet_godkjent_belop !== undefined) && (
            <div className={`py-2 border-b border-pkt-border-subtle ${produktivitetPrekludert ? 'bg-pkt-surface-yellow' : ''}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">
                  Produktivitetstap
                  {produktivitetPrekludert && <span className="text-xs text-pkt-grays-gray-500 ml-1">(prekludert)</span>}
                </span>
                <div className="flex items-center gap-2">
                  {data.produktivitet_vurdering && (
                    <Badge variant={getBelopVurderingBadge(data.produktivitet_vurdering).variant} size="sm">
                      {getBelopVurderingBadge(data.produktivitet_vurdering).label}
                    </Badge>
                  )}
                  {data.produktivitet_godkjent_belop !== undefined && (
                    <span className={`font-mono ${produktivitetPrekludert ? 'line-through text-pkt-grays-gray-400' : ''}`}>
                      {formatCurrency(data.produktivitet_godkjent_belop)}
                    </span>
                  )}
                </div>
              </div>
              {produktivitetPrekludert && data.produktivitet_godkjent_belop !== undefined && data.produktivitet_godkjent_belop > 0 && (
                <p className="text-xs text-pkt-text-warning mt-1">
                  Subsidiært godkjent: {formatCurrency(data.produktivitet_godkjent_belop)}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Begrunnelse ────────────────────────────────────────────── */}
      {hasBeregningFields && (
        <>
          <SectionDivider title="Begrunnelse" />
          <LongTextField label="Samlet begrunnelse" value={data.begrunnelse ?? data.begrunnelse_beregning} defaultOpen={true} />
          {data.frist_for_spesifikasjon && (
            <Field label="Frist for spesifikasjon" value={formatDate(data.frist_for_spesifikasjon)} />
          )}
        </>
      )}

      {/* ── Subsidiært standpunkt ──────────────────────────────────── */}
      {hasSubsidiaerFields && (
        <>
          <SectionDivider title="Subsidiært standpunkt" />
          {data.subsidiaer_triggers && data.subsidiaer_triggers.length > 0 && (
            <Field
              label="Årsak til subsidiær vurdering"
              value={
                <div className="flex flex-wrap gap-1">
                  {data.subsidiaer_triggers.map((trigger) => (
                    <Badge key={trigger} variant="warning" size="sm">
                      {getSubsidiaerTriggerLabel(trigger as SubsidiaerTrigger)}
                    </Badge>
                  ))}
                </div>
              }
            />
          )}
          {data.subsidiaer_resultat && (
            <Field
              label="Subsidiært resultat"
              value={
                <Badge variant={getVederlagResultatBadge(data.subsidiaer_resultat).variant}>
                  {getVederlagResultatBadge(data.subsidiaer_resultat).label}
                </Badge>
              }
            />
          )}
          {data.subsidiaer_godkjent_belop !== undefined && (
            <Field label="Subsidiært godkjent beløp" value={formatCurrency(data.subsidiaer_godkjent_belop)} />
          )}
          <LongTextField label="Subsidiær begrunnelse" value={data.subsidiaer_begrunnelse} />
        </>
      )}
    </dl>
  );
}

function ResponsVederlagOppdatertSection({ data }: { data: ResponsVederlagOppdatertEventData }) {
  const badge = getVederlagResultatBadge(data.beregnings_resultat);

  return (
    <dl>
      <Field
        label="Nytt resultat"
        value={<Badge variant={badge.variant}>{badge.label}</Badge>}
      />
      {data.total_godkjent_belop !== undefined && (
        <Field label="Nytt godkjent beløp" value={formatCurrency(data.total_godkjent_belop)} />
      )}
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      <Field label="Endret dato" value={formatDate(data.dato_endret)} />
    </dl>
  );
}

function ResponsFristSection({ data }: { data: ResponsFristEventData }) {
  const badge = getFristResultatBadge(data.beregnings_resultat);

  // Check if we have any varsel fields to show
  const hasVarselFields =
    data.noytralt_varsel_ok !== undefined ||
    data.spesifisert_krav_ok !== undefined ||
    data.har_bh_etterlyst ||
    data.begrunnelse_varsel;

  // Check if we have vilkår fields
  const hasVilkarFields =
    data.vilkar_oppfylt !== undefined ||
    data.begrunnelse_vilkar;

  // Check if we have calculation details
  const hasBeregningFields =
    data.begrunnelse_beregning ||
    data.frist_for_spesifisering;

  // Check if we have subsidiary data
  const hasSubsidiaerFields =
    (data.subsidiaer_triggers && data.subsidiaer_triggers.length > 0) ||
    data.subsidiaer_resultat ||
    data.subsidiaer_godkjent_dager !== undefined ||
    data.subsidiaer_begrunnelse;

  return (
    <dl>
      {/* ── Sammendrag ─────────────────────────────────────────────── */}
      <Field
        label="Resultat"
        value={<Badge variant={badge.variant}>{badge.label}</Badge>}
      />
      {data.godkjent_dager !== undefined && (
        <Field label="Godkjente dager" value={`${data.godkjent_dager} dager`} />
      )}
      {data.ny_sluttdato && <Field label="Ny sluttdato" value={formatDate(data.ny_sluttdato)} />}

      {/* ── Varselvurdering (§33.4/§33.6) ─────────────────────────── */}
      {hasVarselFields && (
        <>
          <SectionDivider title="Varselvurdering" subtitle="§33.4 / §33.6" />
          {data.noytralt_varsel_ok !== undefined && (
            <Field
              label="Nøytralt varsel OK"
              value={
                <Badge variant={data.noytralt_varsel_ok ? 'success' : 'danger'}>
                  {data.noytralt_varsel_ok ? 'Ja' : 'Nei'}
                </Badge>
              }
            />
          )}
          {data.spesifisert_krav_ok !== undefined && (
            <Field
              label="Spesifisert krav OK"
              value={
                <Badge variant={data.spesifisert_krav_ok ? 'success' : 'danger'}>
                  {data.spesifisert_krav_ok ? 'Ja' : 'Nei'}
                </Badge>
              }
            />
          )}
          {data.har_bh_etterlyst && (
            <Field label="BH har etterlyst" value={<Badge variant="warning">Ja</Badge>} />
          )}
          <LongTextField label="Begrunnelse" value={data.begrunnelse_varsel} />
        </>
      )}

      {/* ── Vilkårsvurdering (§33.5) ──────────────────────────────── */}
      {hasVilkarFields && (
        <>
          <SectionDivider title="Vilkårsvurdering" subtitle="§33.5" />
          {data.vilkar_oppfylt !== undefined && (
            <Field
              label="Vilkår oppfylt"
              value={
                <Badge variant={data.vilkar_oppfylt ? 'success' : 'danger'}>
                  {data.vilkar_oppfylt ? 'Ja' : 'Nei'}
                </Badge>
              }
            />
          )}
          <LongTextField label="Begrunnelse" value={data.begrunnelse_vilkar} />
        </>
      )}

      {/* ── Beregning ─────────────────────────────────────────────── */}
      {hasBeregningFields && (
        <>
          <SectionDivider title="Beregning" />
          <LongTextField label="Begrunnelse" value={data.begrunnelse_beregning} defaultOpen={true} />
          {data.frist_for_spesifisering && (
            <Field label="Frist for spesifisering" value={formatDate(data.frist_for_spesifisering)} />
          )}
        </>
      )}

      {/* ── Subsidiært standpunkt ──────────────────────────────────── */}
      {hasSubsidiaerFields && (
        <>
          <SectionDivider title="Subsidiært standpunkt" />
          {data.subsidiaer_triggers && data.subsidiaer_triggers.length > 0 && (
            <Field
              label="Årsak til subsidiær vurdering"
              value={
                <div className="flex flex-wrap gap-1">
                  {data.subsidiaer_triggers.map((trigger) => (
                    <Badge key={trigger} variant="warning" size="sm">
                      {getSubsidiaerTriggerLabel(trigger as SubsidiaerTrigger)}
                    </Badge>
                  ))}
                </div>
              }
            />
          )}
          {data.subsidiaer_resultat && (
            <Field
              label="Subsidiært resultat"
              value={
                <Badge variant={getFristResultatBadge(data.subsidiaer_resultat).variant}>
                  {getFristResultatBadge(data.subsidiaer_resultat).label}
                </Badge>
              }
            />
          )}
          {data.subsidiaer_godkjent_dager !== undefined && (
            <Field label="Subsidiært godkjent dager" value={`${data.subsidiaer_godkjent_dager} dager`} />
          )}
          <LongTextField label="Subsidiær begrunnelse" value={data.subsidiaer_begrunnelse} />
        </>
      )}
    </dl>
  );
}

function ResponsFristOppdatertSection({ data }: { data: ResponsFristOppdatertEventData }) {
  const badge = getFristResultatBadge(data.beregnings_resultat);

  return (
    <dl>
      <Field
        label="Nytt resultat"
        value={<Badge variant={badge.variant}>{badge.label}</Badge>}
      />
      {data.godkjent_dager !== undefined && (
        <Field label="Nye godkjente dager" value={`${data.godkjent_dager} dager`} />
      )}
      {data.stopper_forsering && (
        <Field label="Stopper forsering" value={<Badge variant="info">Ja - §33.8</Badge>} />
      )}
      <LongTextField label="Kommentar" value={data.kommentar} defaultOpen={true} />
      <Field label="Endret dato" value={formatDate(data.dato_endret)} />
    </dl>
  );
}

function ForseringVarselSection({ data }: { data: ForseringVarselEventData }) {
  // Beregn 30%-grense for visning
  const maksKostnad = data.avslatte_dager * data.dagmulktsats * 1.3;
  const erInnenforGrense = data.estimert_kostnad <= maksKostnad;

  return (
    <dl>
      <div className="py-3 bg-pkt-surface-faded-red -mx-4 px-4 mb-2 border-b border-pkt-brand-red-1000">
        <Badge variant="danger" size="lg">Forseringsvarsel (§33.8)</Badge>
        {data.grunnlag_avslag_trigger && (
          <span className="ml-2 text-sm text-pkt-brand-red-1000">(utløst av grunnlagsavslag)</span>
        )}
      </div>

      {/* Sammendrag */}
      <Field label="Estimert forseringskostnad" value={formatCurrency(data.estimert_kostnad)} />
      <Field label="Dato iverksettelse" value={formatDate(data.dato_iverksettelse)} />

      {/* 30%-beregning */}
      <SectionDivider title="30%-beregning" subtitle="§33.8" />
      <Field label="Avslåtte dager" value={`${data.avslatte_dager} dager`} />
      <Field label="Dagmulktsats" value={formatCurrency(data.dagmulktsats)} />
      <Field label="Maks forseringskostnad" value={formatCurrency(maksKostnad)} />
      <Field
        label="Innenfor 30%-grense"
        value={
          erInnenforGrense ? (
            <Badge variant="success">Ja ({((data.estimert_kostnad / maksKostnad) * 100).toFixed(0)}% av grensen)</Badge>
          ) : (
            <Badge variant="danger">Nei - overstiger grensen</Badge>
          )
        }
      />

      {/* Begrunnelse */}
      <SectionDivider title="Begrunnelse" />
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />

      {/* Referanser */}
      <SectionDivider title="Referanser" />
      <Field label="Fristkrav-ID" value={data.frist_krav_id} />
      <Field label="Fristrespons-ID" value={data.respons_frist_id} />
    </dl>
  );
}

function GenericSection({ data }: { data: Record<string, unknown> }) {
  if (!data || typeof data !== 'object') {
    return <p className="text-pkt-grays-gray-500 italic">Ingen skjemadata tilgjengelig.</p>;
  }

  return (
    <dl>
      {Object.entries(data).map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return (
            <Field
              key={key}
              label={key}
              value={
                <pre className="text-xs bg-pkt-bg-subtle p-2 rounded overflow-x-auto">
                  {JSON.stringify(value, null, 2)}
                </pre>
              }
            />
          );
        }
        return (
          <Field
            key={key}
            label={key}
            value={String(value)}
          />
        );
      })}
    </dl>
  );
}

// ========== MAIN COMPONENT ==========

export function EventDetailModal({
  open,
  onOpenChange,
  event,
}: EventDetailModalProps) {
  const eventTypeLabel = event.event_type
    ? EVENT_TYPE_LABELS[event.event_type] || event.type
    : event.type;

  const sporLabel = event.spor ? SPOR_LABELS[event.spor] : 'Generelt';

  // Render event-specific data section
  const renderEventData = () => {
    if (!event.event_data) {
      return (
        <p className="text-pkt-grays-gray-500 italic py-4">
          Ingen detaljert skjemadata tilgjengelig for denne hendelsen.
        </p>
      );
    }

    const data = event.event_data;
    const eventType = event.event_type;

    switch (eventType) {
      case 'grunnlag_opprettet':
        return <GrunnlagSection data={data as GrunnlagEventData} />;

      case 'grunnlag_oppdatert':
        return <GrunnlagOppdatertSection data={data as GrunnlagOppdatertEventData} />;

      case 'vederlag_krav_sendt':
        return <VederlagSection data={data as VederlagEventData} />;

      case 'vederlag_krav_oppdatert':
        return <VederlagOppdatertSection data={data as VederlagOppdatertEventData} />;

      case 'frist_krav_sendt':
        return <FristSection data={data as FristEventData} />;

      case 'frist_krav_oppdatert':
        return <FristOppdatertSection data={data as FristOppdatertEventData} />;

      case 'respons_grunnlag':
        return <ResponsGrunnlagSection data={data as ResponsGrunnlagEventData} />;

      case 'respons_grunnlag_oppdatert':
        return <ResponsGrunnlagOppdatertSection data={data as ResponsGrunnlagOppdatertEventData} />;

      case 'respons_vederlag':
        return <ResponsVederlagSection data={data as ResponsVederlagEventData} />;

      case 'respons_vederlag_oppdatert':
        return <ResponsVederlagOppdatertSection data={data as ResponsVederlagOppdatertEventData} />;

      case 'respons_frist':
        return <ResponsFristSection data={data as ResponsFristEventData} />;

      case 'respons_frist_oppdatert':
        return <ResponsFristOppdatertSection data={data as ResponsFristOppdatertEventData} />;

      case 'forsering_varsel':
        return <ForseringVarselSection data={data as ForseringVarselEventData} />;

      default:
        return <GenericSection data={data as Record<string, unknown>} />;
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={eventTypeLabel}
      description={`Innsendt av ${event.aktor} (${event.rolle})`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Metadata header */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-pkt-grays-gray-600 pb-4 border-b border-pkt-grays-gray-200">
          <span className="flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4" />
            {formatDateTime(event.tidsstempel)}
          </span>
          <span className="flex items-center gap-1.5">
            <PersonIcon className="w-4 h-4" />
            {event.aktor}
          </span>
          <Badge variant={event.rolle === 'TE' ? 'info' : 'warning'}>
            {event.rolle}
          </Badge>
          {event.spor && (
            <span className="flex items-center gap-1.5">
              <TargetIcon className="w-4 h-4" />
              <Badge variant="neutral">{sporLabel}</Badge>
            </span>
          )}
        </div>

        {/* Summary */}
        <div className="bg-pkt-bg-subtle p-4 border border-pkt-grays-gray-200">
          <p className="text-sm font-medium text-pkt-grays-gray-700 mb-1">Sammendrag</p>
          <p className="text-pkt-text-body-dark">{event.sammendrag}</p>
        </div>

        {/* Full form data */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileTextIcon className="w-5 h-5 text-pkt-grays-gray-500" />
            <h4 className="text-base font-semibold text-pkt-text-body-dark">Skjemadata</h4>
          </div>
          <div className="bg-pkt-bg-card border border-pkt-grays-gray-200 p-4">
            {renderEventData()}
          </div>
        </div>

        {/* Event ID footer */}
        <p className="text-xs text-pkt-grays-gray-400 pt-4 border-t border-pkt-grays-gray-200">
          Event ID: {event.event_id}
        </p>
      </div>
    </Modal>
  );
}
