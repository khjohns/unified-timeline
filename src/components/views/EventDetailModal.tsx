/**
 * EventDetailModal Component
 *
 * Modal for viewing detailed event data from the timeline.
 * Supports all event types with type-specific rendering.
 * Uses SectionContainer, DataList, and InlineDataList primitives for consistent UX.
 * LongTextField handles expandable text within DataList structure.
 */

import React from 'react';
import {
  Badge,
  BadgeVariant,
  Modal,
  SectionContainer,
  DataList,
  DataListItem,
  InlineDataList,
  InlineDataListItem,
} from '../primitives';
import {
  TimelineEvent,
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
  FristSpesifisertEventData,
  ResponsGrunnlagOppdatertEventData,
  ResponsVederlagOppdatertEventData,
  ResponsFristOppdatertEventData,
  ForseringVarselEventData,
  VarselInfo,
  GrunnlagResponsResultat,
  VederlagBeregningResultat,
  FristBeregningResultat,
  SubsidiaerTrigger,
  extractEventType,
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
import { EVENT_TYPE_LABELS } from '../../constants/eventTypeLabels';
import {
  formatCurrency,
  formatDateMedium,
  formatDateTimeNorwegian,
  formatVarselMetode,
} from '../../utils/formatters';
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
  event: TimelineEvent;
}

// ========== LABELS ==========

const SPOR_LABELS: Record<string, string> = {
  grunnlag: 'Ansvarsgrunnlag',
  vederlag: 'Vederlag',
  frist: 'Frist',
};

// ========== HELPER FUNCTIONS ==========

/**
 * Variant mappings for different result types
 */
const RESULTAT_VARIANTS: Record<string, BadgeVariant> = {
  // Success
  godkjent: 'success',
  // Warning
  delvis_godkjent: 'warning',
  delvis: 'warning',
  erkjenn_fm: 'warning',
  krever_avklaring: 'warning',
  hold_tilbake: 'warning',
  // Danger
  avslatt: 'danger',
  frafalt: 'danger',
};

/**
 * Generic badge helper - maps result code to variant and label
 */
function getResultatBadge(
  resultat: string | undefined,
  labelFn: (r: string) => string
): { variant: BadgeVariant; label: string } {
  const label = labelFn(resultat || '');
  const variant = RESULTAT_VARIANTS[resultat || ''] || 'neutral';
  return { variant, label };
}

// Specific badge helpers using the generic function
const getGrunnlagResultatBadge = (r: GrunnlagResponsResultat | string | undefined) =>
  getResultatBadge(r, getBhGrunnlagssvarLabel);

const getVederlagResultatBadge = (r: VederlagBeregningResultat | string | undefined) =>
  getResultatBadge(r, getBhVederlagssvarLabel);

const getFristResultatBadge = (r: FristBeregningResultat | string | undefined) =>
  getResultatBadge(r, getBhFristsvarLabel);

// Beløpsvurdering uses inline labels
const BELOP_LABELS: Record<string, string> = {
  godkjent: 'Godkjent',
  delvis: 'Delvis godkjent',
  avslatt: 'Avslått',
};

function getBelopVurderingBadge(vurdering: string | undefined) {
  return getResultatBadge(vurdering, (r) => BELOP_LABELS[r] || '-');
}

// ========== HELPER COMPONENTS ==========

interface VarselInfoDisplayProps {
  label: string;
  varsel: VarselInfo | undefined;
}

function VarselInfoDisplay({ label, varsel }: VarselInfoDisplayProps) {
  if (!varsel?.dato_sendt) return null;
  return (
    <DataListItem label={label}>
      {formatDateMedium(varsel.dato_sendt)}
      {varsel.metode && varsel.metode.length > 0 && (
        <span className="ml-2 text-pkt-grays-gray-500">
          ({formatVarselMetode(varsel.metode)})
        </span>
      )}
    </DataListItem>
  );
}

interface LongTextFieldProps {
  label: string;
  value: string | undefined;
  defaultOpen?: boolean;
}

function LongTextField({ label, value, defaultOpen = false }: LongTextFieldProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultOpen);

  if (!value) return null;

  const isLong = value.length >= 150;
  const displayText = isLong && !isExpanded ? value.slice(0, 150) + '...' : value;

  return (
    <DataListItem label={label}>
      <div>
        <p className="whitespace-pre-wrap">{displayText}</p>
        {isLong && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-pkt-brand-dark-blue-1000 hover:underline text-sm mt-1"
          >
            {isExpanded ? 'Vis mindre' : 'Vis mer'}
          </button>
        )}
      </div>
    </DataListItem>
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
    <DataListItem label="Vedlegg">
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
    </DataListItem>
  );
}

/**
 * BelopVurderingItem - Display row for amount assessment (godkjent/avslått beløp)
 */
interface BelopVurderingItemProps {
  label: string;
  vurdering?: string;
  belop?: number;
  begrunnelse?: string;
  isPrekludert?: boolean;
  subsidiaertBelop?: number;
}

function BelopVurderingItem({
  label,
  vurdering,
  belop,
  begrunnelse,
  isPrekludert = false,
  subsidiaertBelop,
}: BelopVurderingItemProps) {
  if (!vurdering && belop === undefined) return null;

  const badge = getBelopVurderingBadge(vurdering);

  return (
    <div className={`py-2 border-b border-pkt-border-subtle last:border-b-0 ${isPrekludert ? 'bg-pkt-surface-yellow -mx-4 px-4' : ''}`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">
          {label}
          {isPrekludert && <span className="text-xs text-pkt-grays-gray-500 ml-1">(prekludert)</span>}
        </span>
        <div className="flex items-center gap-2">
          {vurdering && (
            <Badge variant={badge.variant}>{badge.label}</Badge>
          )}
          {belop !== undefined && (
            <span className={`font-mono font-medium ${isPrekludert ? 'line-through text-pkt-grays-gray-400' : ''}`}>
              {formatCurrency(belop)}
            </span>
          )}
        </div>
      </div>
      {begrunnelse && (
        <p className="text-sm text-pkt-grays-gray-600 mt-1">{begrunnelse}</p>
      )}
      {isPrekludert && subsidiaertBelop !== undefined && subsidiaertBelop > 0 && (
        <p className="text-xs text-pkt-text-warning mt-1">
          Subsidiært godkjent: {formatCurrency(subsidiaertBelop)}
        </p>
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
    <div className="space-y-4">
      {/* Metadata i grid-layout for bedre plassbruk */}
      <DataList variant="grid">
        {data.tittel && <DataListItem label="Tittel">{data.tittel}</DataListItem>}
        {data.hovedkategori && (
          <DataListItem label="Hovedkategori">{getHovedkategoriLabel(data.hovedkategori)}</DataListItem>
        )}
        {underkategoriLabels && (
          <DataListItem label="Underkategori">
            {underkategoriLabels}
            {hjemmelRefs.length > 0 && (
              <span className="ml-1 text-pkt-grays-gray-500 text-xs">
                ({hjemmelRefs.join(', ')})
              </span>
            )}
          </DataListItem>
        )}
        {varselkravRefs.length > 0 && (
          <DataListItem label="Varselkrav">
            <span className="text-pkt-grays-gray-600">
              NS 8407 §{varselkravRefs.join(' / §')}
            </span>
          </DataListItem>
        )}
        {data.dato_oppdaget && (
          <DataListItem label="Dato oppdaget">{formatDateMedium(data.dato_oppdaget)}</DataListItem>
        )}
        {data.grunnlag_varsel?.dato_sendt && (
          <DataListItem label="Varsel sendt">
            {formatDateMedium(data.grunnlag_varsel.dato_sendt)}
            {data.grunnlag_varsel.metode && data.grunnlag_varsel.metode.length > 0 && (
              <span className="ml-1 text-pkt-grays-gray-500">
                ({formatVarselMetode(data.grunnlag_varsel.metode)})
              </span>
            )}
          </DataListItem>
        )}
      </DataList>

      {/* Lange felt i liste-layout */}
      <DataList>
        <LongTextField label="Beskrivelse" value={data.beskrivelse} defaultOpen={true} />
        {data.kontraktsreferanser && data.kontraktsreferanser.length > 0 && (
          <DataListItem label="Kontraktsreferanser">{data.kontraktsreferanser.join(', ')}</DataListItem>
        )}
        <VedleggDisplay vedleggIds={data.vedlegg_ids} />
      </DataList>
    </div>
  );
}

function GrunnlagOppdatertSection({ data }: { data: GrunnlagOppdatertEventData }) {
  const underkategorier = data.underkategori
    ? (Array.isArray(data.underkategori)
      ? data.underkategori.map(getUnderkategoriLabel).join(', ')
      : getUnderkategoriLabel(data.underkategori))
    : undefined;

  const hasMetadata = data.tittel || data.hovedkategori || underkategorier || data.dato_oppdaget;

  return (
    <div className="space-y-4">
      {hasMetadata && (
        <DataList variant="grid">
          {data.tittel && <DataListItem label="Ny tittel">{data.tittel}</DataListItem>}
          {data.hovedkategori && (
            <DataListItem label="Ny hovedkategori">{getHovedkategoriLabel(data.hovedkategori)}</DataListItem>
          )}
          {underkategorier && <DataListItem label="Ny underkategori">{underkategorier}</DataListItem>}
          {data.dato_oppdaget && (
            <DataListItem label="Ny dato oppdaget">{formatDateMedium(data.dato_oppdaget)}</DataListItem>
          )}
        </DataList>
      )}
      <DataList>
        <LongTextField label="Ny beskrivelse" value={data.beskrivelse} />
        <LongTextField label="Begrunnelse for endring" value={data.endrings_begrunnelse} defaultOpen={true} />
      </DataList>
    </div>
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
    <div className="space-y-4">
      {/* Sammendrag - kompakt oversikt øverst */}
      <div className="bg-pkt-bg-subtle p-3 border-l-4 border-pkt-brand-dark-blue-1000">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold text-pkt-text-body-dark">
            {formatCurrency(totalBelop)}
          </span>
          <Badge variant="info">{getVederlagsmetodeLabel(data.metode)}</Badge>
        </div>
        {harSaerskiltKrav && (
          <InlineDataList className="mt-2">
            {hovedbelop > 0 && (
              <InlineDataListItem label="Hovedkrav" mono>{formatCurrency(hovedbelop)}</InlineDataListItem>
            )}
            {riggBelop > 0 && (
              <InlineDataListItem label="Rigg" mono>{formatCurrency(riggBelop)}</InlineDataListItem>
            )}
            {produktivitetBelop > 0 && (
              <InlineDataListItem label="Produktivitet" mono>{formatCurrency(produktivitetBelop)}</InlineDataListItem>
            )}
          </InlineDataList>
        )}
      </div>

      <DataList>
        <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      </DataList>

      {/* Særskilte krav - detaljer */}
      {harSaerskiltKrav && (
        <SectionContainer title="Særskilte krav" description="§34.1.3" variant="subtle" spacing="compact">
          <DataList>
            {data.saerskilt_krav?.rigg_drift && (
              <DataListItem label="Rigg/drift">
                <div className="flex items-center gap-2">
                  <span>
                    {data.saerskilt_krav.rigg_drift.belop !== undefined
                      ? formatCurrency(data.saerskilt_krav.rigg_drift.belop)
                      : 'Ja'}
                  </span>
                  {data.saerskilt_krav.rigg_drift.dato_klar_over && (
                    <span className="text-pkt-grays-gray-500 text-sm">
                      (klar over: {formatDateMedium(data.saerskilt_krav.rigg_drift.dato_klar_over)})
                    </span>
                  )}
                </div>
              </DataListItem>
            )}
            {data.saerskilt_krav?.produktivitet && (
              <DataListItem label="Produktivitetstap">
                <div className="flex items-center gap-2">
                  <span>
                    {data.saerskilt_krav.produktivitet.belop !== undefined
                      ? formatCurrency(data.saerskilt_krav.produktivitet.belop)
                      : 'Ja'}
                  </span>
                  {data.saerskilt_krav.produktivitet.dato_klar_over && (
                    <span className="text-pkt-grays-gray-500 text-sm">
                      (klar over: {formatDateMedium(data.saerskilt_krav.produktivitet.dato_klar_over)})
                    </span>
                  )}
                </div>
              </DataListItem>
            )}
          </DataList>
        </SectionContainer>
      )}

      <DataList>
        {data.krever_justert_ep && (
          <DataListItem label="Krever justerte EP">
            <Badge variant="warning">Ja - §34.3.3</Badge>
          </DataListItem>
        )}
        <VarselInfoDisplay label="Forhåndsvarsel regningsarbeid" varsel={data.regningsarbeid_varsel} />
        <VedleggDisplay vedleggIds={data.vedlegg_ids} />
      </DataList>
    </div>
  );
}

function VederlagOppdatertSection({ data }: { data: VederlagOppdatertEventData }) {
  return (
    <DataList>
      {data.nytt_belop_direkte !== undefined && (
        <DataListItem label="Nytt beløp" mono>{formatCurrency(data.nytt_belop_direkte)}</DataListItem>
      )}
      {data.nytt_kostnads_overslag !== undefined && (
        <DataListItem label="Nytt kostnadsoverslag" mono>{formatCurrency(data.nytt_kostnads_overslag)}</DataListItem>
      )}
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.dato_revidert && (
        <DataListItem label="Revidert dato">{formatDateMedium(data.dato_revidert)}</DataListItem>
      )}
    </DataList>
  );
}

function FristSection({ data }: { data: FristEventData }) {
  return (
    <DataList>
      {data.varsel_type && (
        <DataListItem label="Varseltype">{getFristVarseltypeLabel(data.varsel_type)}</DataListItem>
      )}
      <VarselInfoDisplay label="Nøytralt varsel (§33.4)" varsel={data.noytralt_varsel} />
      <VarselInfoDisplay label="Spesifisert varsel (§33.6)" varsel={data.spesifisert_varsel} />
      {data.antall_dager !== undefined && (
        <DataListItem label="Krevde dager">{data.antall_dager} dager</DataListItem>
      )}
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.ny_sluttdato && (
        <DataListItem label="Ny sluttdato">{formatDateMedium(data.ny_sluttdato)}</DataListItem>
      )}
      <LongTextField label="Fremdriftsdokumentasjon" value={data.fremdriftshindring_dokumentasjon} />
      <VedleggDisplay vedleggIds={data.vedlegg_ids} />
    </DataList>
  );
}

function FristOppdatertSection({ data }: { data: FristOppdatertEventData }) {
  return (
    <DataList>
      {data.nytt_antall_dager !== undefined && (
        <DataListItem label="Nytt antall dager">{data.nytt_antall_dager} dager</DataListItem>
      )}
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.dato_revidert && (
        <DataListItem label="Revidert dato">{formatDateMedium(data.dato_revidert)}</DataListItem>
      )}
    </DataList>
  );
}

function FristSpesifisertSection({ data }: { data: FristSpesifisertEventData }) {
  return (
    <DataList>
      {data.antall_dager !== undefined && (
        <DataListItem label="Antall dager">{data.antall_dager} dager</DataListItem>
      )}
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.er_svar_pa_etterlysning && (
        <DataListItem label="Svar på etterlysning">
          <Badge variant="warning">Ja (§33.6.2)</Badge>
        </DataListItem>
      )}
      {data.ny_sluttdato && (
        <DataListItem label="Ny sluttdato">{formatDateMedium(data.ny_sluttdato)}</DataListItem>
      )}
      {data.dato_spesifisert && (
        <DataListItem label="Spesifisert dato">{formatDateMedium(data.dato_spesifisert)}</DataListItem>
      )}
    </DataList>
  );
}

function ResponsGrunnlagSection({ data }: { data: ResponsGrunnlagEventData }) {
  const badge = getGrunnlagResultatBadge(data.resultat);

  return (
    <DataList>
      <DataListItem label="Resultat">
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </DataListItem>
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.akseptert_kategori && (
        <DataListItem label="Akseptert kategori">{data.akseptert_kategori}</DataListItem>
      )}
      {data.varsel_for_sent && (
        <DataListItem label="Varsel for sent">
          <Badge variant="danger">Ja - preklusjonsrisiko</Badge>
        </DataListItem>
      )}
      <LongTextField label="Varselbegrunnelse" value={data.varsel_begrunnelse} />
      {data.krever_dokumentasjon && data.krever_dokumentasjon.length > 0 && (
        <DataListItem label="Krever dokumentasjon">{data.krever_dokumentasjon.join(', ')}</DataListItem>
      )}
    </DataList>
  );
}

function ResponsGrunnlagOppdatertSection({ data }: { data: ResponsGrunnlagOppdatertEventData }) {
  const badge = getGrunnlagResultatBadge(data.resultat);

  return (
    <DataList>
      <DataListItem label="Nytt resultat">
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </DataListItem>
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.dato_endret && (
        <DataListItem label="Endret dato">{formatDateMedium(data.dato_endret)}</DataListItem>
      )}
    </DataList>
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
    data.begrunnelse ||
    data.frist_for_spesifikasjon;

  // Check if we have subsidiary data
  const hasSubsidiaerFields =
    (data.subsidiaer_triggers && data.subsidiaer_triggers.length > 0) ||
    data.subsidiaer_resultat ||
    data.subsidiaer_godkjent_belop !== undefined ||
    data.subsidiaer_begrunnelse;

  // Check if rigg/produktivitet is precluded
  const riggPrekludert = data.rigg_varslet_i_tide === false;
  const produktivitetPrekludert = data.produktivitet_varslet_i_tide === false;

  return (
    <div className="space-y-4">
      {/* ── Sammendrag ─────────────────────────────────────────────── */}
      <DataList>
        <DataListItem label="Resultat">
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </DataListItem>
        {data.total_godkjent_belop !== undefined && (
          <DataListItem label="Totalt godkjent beløp" mono>
            {formatCurrency(data.total_godkjent_belop)}
          </DataListItem>
        )}
        {data.vederlagsmetode && (
          <DataListItem label="Beregningsmetode">{getVederlagsmetodeLabel(data.vederlagsmetode)}</DataListItem>
        )}
      </DataList>

      {/* ── Port 1: Preklusjonsvurdering (§34.1.3) ─────────────────── */}
      {hasPreklusjonsFields && (
        <SectionContainer title="Preklusjonsvurdering" description="§34.1.3" variant="subtle" spacing="compact">
          <DataList>
            {data.rigg_varslet_i_tide !== undefined && (
              <DataListItem label="Rigg/drift varslet i tide">
                <Badge variant={data.rigg_varslet_i_tide ? 'success' : 'danger'}>
                  {data.rigg_varslet_i_tide ? 'Ja' : 'Nei (prekludert)'}
                </Badge>
              </DataListItem>
            )}
            {data.produktivitet_varslet_i_tide !== undefined && (
              <DataListItem label="Produktivitet varslet i tide">
                <Badge variant={data.produktivitet_varslet_i_tide ? 'success' : 'danger'}>
                  {data.produktivitet_varslet_i_tide ? 'Ja' : 'Nei (prekludert)'}
                </Badge>
              </DataListItem>
            )}
            <LongTextField label="Begrunnelse" value={data.begrunnelse_preklusjon} />
          </DataList>
        </SectionContainer>
      )}

      {/* ── Legacy varselvurdering ──────────────────────────────────── */}
      {hasLegacyVarselFields && !hasPreklusjonsFields && (
        <SectionContainer title="Varselvurdering" description="§34.1.3" variant="subtle" spacing="compact">
          <DataList>
            {data.saerskilt_varsel_rigg_drift_ok !== undefined && (
              <DataListItem label="Rigg/drift varsel OK">
                <Badge variant={data.saerskilt_varsel_rigg_drift_ok ? 'success' : 'danger'}>
                  {data.saerskilt_varsel_rigg_drift_ok ? 'Ja' : 'Nei'}
                </Badge>
              </DataListItem>
            )}
            {data.varsel_justert_ep_ok !== undefined && (
              <DataListItem label="Justert EP varsel OK">
                <Badge variant={data.varsel_justert_ep_ok ? 'success' : 'danger'}>
                  {data.varsel_justert_ep_ok ? 'Ja' : 'Nei'}
                </Badge>
              </DataListItem>
            )}
            {data.varsel_start_regning_ok !== undefined && (
              <DataListItem label="Regningsarbeid varsel OK">
                <Badge variant={data.varsel_start_regning_ok ? 'success' : 'danger'}>
                  {data.varsel_start_regning_ok ? 'Ja' : 'Nei'}
                </Badge>
              </DataListItem>
            )}
            {data.krav_fremmet_i_tide !== undefined && (
              <DataListItem label="Krav fremmet i tide">
                <Badge variant={data.krav_fremmet_i_tide ? 'success' : 'warning'}>
                  {data.krav_fremmet_i_tide ? 'Ja' : 'Nei'}
                </Badge>
              </DataListItem>
            )}
            <LongTextField label="Begrunnelse" value={data.begrunnelse_varsel} />
          </DataList>
        </SectionContainer>
      )}

      {/* ── Port 3: Beløpsvurdering per kravtype ───────────────────── */}
      {hasBelopBreakdown && (
        <SectionContainer title="Beløpsvurdering" variant="subtle" spacing="compact">
          <div className="space-y-2">
            <BelopVurderingItem
              label="Hovedkrav"
              vurdering={data.hovedkrav_vurdering}
              belop={data.hovedkrav_godkjent_belop}
              begrunnelse={data.hovedkrav_begrunnelse}
            />
            <BelopVurderingItem
              label="Rigg/drift"
              vurdering={data.rigg_vurdering}
              belop={data.rigg_godkjent_belop}
              isPrekludert={riggPrekludert}
              subsidiaertBelop={riggPrekludert ? data.rigg_godkjent_belop : undefined}
            />
            <BelopVurderingItem
              label="Produktivitetstap"
              vurdering={data.produktivitet_vurdering}
              belop={data.produktivitet_godkjent_belop}
              isPrekludert={produktivitetPrekludert}
              subsidiaertBelop={produktivitetPrekludert ? data.produktivitet_godkjent_belop : undefined}
            />
          </div>
        </SectionContainer>
      )}

      {/* ── Begrunnelse ────────────────────────────────────────────── */}
      {hasBeregningFields && (
        <SectionContainer title="Begrunnelse" variant="subtle" spacing="compact">
          <DataList>
            <LongTextField label="Samlet begrunnelse" value={data.begrunnelse} defaultOpen={true} />
            {data.frist_for_spesifikasjon && (
              <DataListItem label="Frist for spesifikasjon">{formatDateMedium(data.frist_for_spesifikasjon)}</DataListItem>
            )}
          </DataList>
        </SectionContainer>
      )}

      {/* ── Subsidiært standpunkt ──────────────────────────────────── */}
      {hasSubsidiaerFields && (
        <SectionContainer title="Subsidiært standpunkt" variant="subtle" spacing="compact">
          <DataList>
            {data.subsidiaer_triggers && data.subsidiaer_triggers.length > 0 && (
              <DataListItem label="Årsak til subsidiær vurdering">
                <div className="flex flex-wrap gap-1">
                  {data.subsidiaer_triggers.map((trigger) => (
                    <Badge key={trigger} variant="warning">
                      {getSubsidiaerTriggerLabel(trigger as SubsidiaerTrigger)}
                    </Badge>
                  ))}
                </div>
              </DataListItem>
            )}
            {data.subsidiaer_resultat && (
              <DataListItem label="Subsidiært resultat">
                <Badge variant={getVederlagResultatBadge(data.subsidiaer_resultat).variant}>
                  {getVederlagResultatBadge(data.subsidiaer_resultat).label}
                </Badge>
              </DataListItem>
            )}
            {data.subsidiaer_godkjent_belop !== undefined && (
              <DataListItem label="Subsidiært godkjent beløp" mono>
                {formatCurrency(data.subsidiaer_godkjent_belop)}
              </DataListItem>
            )}
            <LongTextField label="Subsidiær begrunnelse" value={data.subsidiaer_begrunnelse} />
          </DataList>
        </SectionContainer>
      )}
    </div>
  );
}

function ResponsVederlagOppdatertSection({ data }: { data: ResponsVederlagOppdatertEventData }) {
  const badge = getVederlagResultatBadge(data.beregnings_resultat);

  return (
    <DataList>
      <DataListItem label="Nytt resultat">
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </DataListItem>
      {data.total_godkjent_belop !== undefined && (
        <DataListItem label="Nytt godkjent beløp" mono>{formatCurrency(data.total_godkjent_belop)}</DataListItem>
      )}
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.dato_endret && (
        <DataListItem label="Endret dato">{formatDateMedium(data.dato_endret)}</DataListItem>
      )}
    </DataList>
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
    data.begrunnelse ||
    data.frist_for_spesifisering;

  // Check if we have subsidiary data
  const hasSubsidiaerFields =
    (data.subsidiaer_triggers && data.subsidiaer_triggers.length > 0) ||
    data.subsidiaer_resultat ||
    data.subsidiaer_godkjent_dager !== undefined ||
    data.subsidiaer_begrunnelse;

  return (
    <div className="space-y-4">
      {/* ── Sammendrag ─────────────────────────────────────────────── */}
      <DataList>
        <DataListItem label="Resultat">
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </DataListItem>
        {data.godkjent_dager !== undefined && (
          <DataListItem label="Godkjente dager">{data.godkjent_dager} dager</DataListItem>
        )}
        {data.ny_sluttdato && (
          <DataListItem label="Ny sluttdato">{formatDateMedium(data.ny_sluttdato)}</DataListItem>
        )}
      </DataList>

      {/* ── Varselvurdering (§33.4/§33.6) ─────────────────────────── */}
      {hasVarselFields && (
        <SectionContainer title="Varselvurdering" description="§33.4 / §33.6" variant="subtle" spacing="compact">
          <DataList>
            {data.noytralt_varsel_ok !== undefined && (
              <DataListItem label="Nøytralt varsel OK">
                <Badge variant={data.noytralt_varsel_ok ? 'success' : 'danger'}>
                  {data.noytralt_varsel_ok ? 'Ja' : 'Nei'}
                </Badge>
              </DataListItem>
            )}
            {data.spesifisert_krav_ok !== undefined && (
              <DataListItem label="Spesifisert krav OK">
                <Badge variant={data.spesifisert_krav_ok ? 'success' : 'danger'}>
                  {data.spesifisert_krav_ok ? 'Ja' : 'Nei'}
                </Badge>
              </DataListItem>
            )}
            {data.har_bh_etterlyst && (
              <DataListItem label="BH har etterlyst">
                <Badge variant="warning">Ja</Badge>
              </DataListItem>
            )}
            <LongTextField label="Begrunnelse" value={data.begrunnelse_varsel} />
          </DataList>
        </SectionContainer>
      )}

      {/* ── Vilkårsvurdering (§33.5) ──────────────────────────────── */}
      {hasVilkarFields && (
        <SectionContainer title="Vilkårsvurdering" description="§33.5" variant="subtle" spacing="compact">
          <DataList>
            {data.vilkar_oppfylt !== undefined && (
              <DataListItem label="Vilkår oppfylt">
                <Badge variant={data.vilkar_oppfylt ? 'success' : 'danger'}>
                  {data.vilkar_oppfylt ? 'Ja' : 'Nei'}
                </Badge>
              </DataListItem>
            )}
            <LongTextField label="Begrunnelse" value={data.begrunnelse_vilkar} />
          </DataList>
        </SectionContainer>
      )}

      {/* ── Beregning ─────────────────────────────────────────────── */}
      {hasBeregningFields && (
        <SectionContainer title="Beregning" variant="subtle" spacing="compact">
          <DataList>
            <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
            {data.frist_for_spesifisering && (
              <DataListItem label="Frist for spesifisering">{formatDateMedium(data.frist_for_spesifisering)}</DataListItem>
            )}
          </DataList>
        </SectionContainer>
      )}

      {/* ── Subsidiært standpunkt ──────────────────────────────────── */}
      {hasSubsidiaerFields && (
        <SectionContainer title="Subsidiært standpunkt" variant="subtle" spacing="compact">
          <DataList>
            {data.subsidiaer_triggers && data.subsidiaer_triggers.length > 0 && (
              <DataListItem label="Årsak til subsidiær vurdering">
                <div className="flex flex-wrap gap-1">
                  {data.subsidiaer_triggers.map((trigger) => (
                    <Badge key={trigger} variant="warning">
                      {getSubsidiaerTriggerLabel(trigger as SubsidiaerTrigger)}
                    </Badge>
                  ))}
                </div>
              </DataListItem>
            )}
            {data.subsidiaer_resultat && (
              <DataListItem label="Subsidiært resultat">
                <Badge variant={getFristResultatBadge(data.subsidiaer_resultat).variant}>
                  {getFristResultatBadge(data.subsidiaer_resultat).label}
                </Badge>
              </DataListItem>
            )}
            {data.subsidiaer_godkjent_dager !== undefined && (
              <DataListItem label="Subsidiært godkjent dager">{data.subsidiaer_godkjent_dager} dager</DataListItem>
            )}
            <LongTextField label="Subsidiær begrunnelse" value={data.subsidiaer_begrunnelse} />
          </DataList>
        </SectionContainer>
      )}
    </div>
  );
}

function ResponsFristOppdatertSection({ data }: { data: ResponsFristOppdatertEventData }) {
  const badge = getFristResultatBadge(data.beregnings_resultat);

  return (
    <DataList>
      <DataListItem label="Nytt resultat">
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </DataListItem>
      {data.godkjent_dager !== undefined && (
        <DataListItem label="Nye godkjente dager">{data.godkjent_dager} dager</DataListItem>
      )}
      {data.stopper_forsering && (
        <DataListItem label="Stopper forsering">
          <Badge variant="info">Ja - §33.8</Badge>
        </DataListItem>
      )}
      <LongTextField label="Kommentar" value={data.kommentar} defaultOpen={true} />
      {data.dato_endret && (
        <DataListItem label="Endret dato">{formatDateMedium(data.dato_endret)}</DataListItem>
      )}
    </DataList>
  );
}

function ForseringVarselSection({ data }: { data: ForseringVarselEventData }) {
  // Beregn 30%-grense for visning
  const maksKostnad = data.avslatte_dager * data.dagmulktsats * 1.3;
  const erInnenforGrense = data.estimert_kostnad <= maksKostnad;

  return (
    <div className="space-y-4">
      <div className="py-3 bg-pkt-surface-faded-red px-4 border-b border-pkt-brand-red-1000">
        <Badge variant="danger" size="lg">Forseringsvarsel (§33.8)</Badge>
        {data.grunnlag_avslag_trigger && (
          <span className="ml-2 text-sm text-pkt-brand-red-1000">(utløst av grunnlagsavslag)</span>
        )}
      </div>

      {/* Sammendrag */}
      <DataList>
        <DataListItem label="Estimert forseringskostnad" mono>
          {formatCurrency(data.estimert_kostnad)}
        </DataListItem>
        <DataListItem label="Dato iverksettelse">{formatDateMedium(data.dato_iverksettelse)}</DataListItem>
      </DataList>

      {/* 30%-beregning */}
      <SectionContainer title="30%-beregning" description="§33.8" variant="subtle" spacing="compact">
        <DataList>
          <DataListItem label="Avslåtte dager">{data.avslatte_dager} dager</DataListItem>
          <DataListItem label="Dagmulktsats" mono>{formatCurrency(data.dagmulktsats)}</DataListItem>
          <DataListItem label="Maks forseringskostnad" mono>{formatCurrency(maksKostnad)}</DataListItem>
          <DataListItem label="Innenfor 30%-grense">
            {erInnenforGrense ? (
              <Badge variant="success">Ja ({((data.estimert_kostnad / maksKostnad) * 100).toFixed(0)}% av grensen)</Badge>
            ) : (
              <Badge variant="danger">Nei - overstiger grensen</Badge>
            )}
          </DataListItem>
        </DataList>
      </SectionContainer>

      {/* Begrunnelse */}
      <SectionContainer title="Begrunnelse" variant="subtle" spacing="compact">
        <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      </SectionContainer>

      {/* Referanser */}
      <SectionContainer title="Referanser" variant="subtle" spacing="compact">
        <DataList>
          <DataListItem label="Fristkrav-ID">{data.frist_krav_id}</DataListItem>
          <DataListItem label="Fristrespons-ID">{data.respons_frist_id}</DataListItem>
        </DataList>
      </SectionContainer>
    </div>
  );
}

function GenericSection({ data }: { data: Record<string, unknown> }) {
  if (!data || typeof data !== 'object') {
    return <p className="text-pkt-grays-gray-500 italic">Ingen skjemadata tilgjengelig.</p>;
  }

  return (
    <DataList>
      {Object.entries(data).map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return (
            <DataListItem key={key} label={key}>
              <pre className="text-xs bg-pkt-bg-subtle p-2 rounded overflow-x-auto">
                {JSON.stringify(value, null, 2)}
              </pre>
            </DataListItem>
          );
        }
        return (
          <DataListItem key={key} label={key}>
            {String(value)}
          </DataListItem>
        );
      })}
    </DataList>
  );
}

// ========== MAIN COMPONENT ==========

export function EventDetailModal({
  open,
  onOpenChange,
  event,
}: EventDetailModalProps) {
  const eventType = extractEventType(event.type);
  const eventTypeLabel = eventType
    ? EVENT_TYPE_LABELS[eventType] || event.type
    : event.type;

  const sporLabel = event.spor ? SPOR_LABELS[event.spor] : 'Generelt';

  // Render event-specific data section
  const renderEventData = () => {
    if (!event.data) {
      return (
        <p className="text-pkt-grays-gray-500 italic py-4">
          Ingen detaljert skjemadata tilgjengelig for denne hendelsen.
        </p>
      );
    }

    const data = event.data;

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

      case 'frist_krav_spesifisert':
        return <FristSpesifisertSection data={data as FristSpesifisertEventData} />;

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
        return <GenericSection data={data as unknown as Record<string, unknown>} />;
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={eventTypeLabel}
      description={`Innsendt av ${event.actor || 'Ukjent'} (${event.actorrole || 'Ukjent'})`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Metadata header */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-pkt-grays-gray-600 pb-4 border-b border-pkt-border-subtle">
          <span className="flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4" />
            {event.time ? formatDateTimeNorwegian(event.time) : 'Ukjent tid'}
          </span>
          <span className="text-pkt-grays-gray-300">|</span>
          <span className="flex items-center gap-1.5">
            <PersonIcon className="w-4 h-4" />
            {event.actor || 'Ukjent'}
          </span>
          <span className="text-pkt-grays-gray-300">|</span>
          <Badge variant={event.actorrole === 'TE' ? 'info' : 'warning'}>
            {event.actorrole || 'Ukjent'}
          </Badge>
          {event.spor && (
            <>
              <span className="text-pkt-grays-gray-300">|</span>
              <span className="flex items-center gap-1.5">
                <TargetIcon className="w-4 h-4" />
                <Badge variant="neutral">{sporLabel}</Badge>
              </span>
            </>
          )}
        </div>

        {/* Summary */}
        <SectionContainer title="Sammendrag" variant="subtle" spacing="none">
          <p className="text-pkt-text-body-dark">{event.summary || 'Ingen sammendrag'}</p>
        </SectionContainer>

        {/* Full form data */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileTextIcon className="w-5 h-5 text-pkt-grays-gray-500" />
            <h4 className="text-sm font-semibold text-pkt-text-body-dark">Skjemadata</h4>
          </div>
          <div className="bg-pkt-bg-card border border-pkt-grays-gray-200 p-4">
            {renderEventData()}
          </div>
        </div>

        {/* Event ID footer */}
        <p className="text-xs text-pkt-grays-gray-400 pt-4 border-t border-pkt-grays-gray-200">
          Event ID: {event.id}
        </p>
      </div>
    </Modal>
  );
}
