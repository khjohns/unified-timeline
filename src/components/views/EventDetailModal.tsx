/**
 * EventDetailModal Component
 *
 * Modal for viewing detailed event data from the timeline.
 * Supports all event types with type-specific rendering.
 * Uses DataList (with grid variant) as primary layout primitive.
 * LongTextField handles expandable text within DataList structure.
 */

import React from 'react';
import {
  Alert,
  Badge,
  BadgeVariant,
  Modal,
  SectionContainer,
  DataList,
  DataListItem,
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
import { FileTextIcon } from '@radix-ui/react-icons';

// ========== TYPES ==========

interface EventDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: TimelineEvent;
}

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
        <span className="ml-2 text-pkt-text-body-subtle">
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
            <FileTextIcon className="w-4 h-4 text-pkt-text-body-subtle" />
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
 * @deprecated Use BelopVurderingTable instead for new implementations
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
          {isPrekludert && <span className="text-xs text-pkt-text-body-subtle ml-1">(prekludert)</span>}
        </span>
        <div className="flex items-center gap-2">
          {vurdering && (
            <Badge variant={badge.variant}>{badge.label}</Badge>
          )}
          {belop !== undefined && (
            <span className={`font-mono font-medium ${isPrekludert ? 'line-through text-pkt-text-body-subtle' : ''}`}>
              {formatCurrency(belop)}
            </span>
          )}
        </div>
      </div>
      {begrunnelse && (
        <p className="text-sm text-pkt-text-body-subtle mt-1">{begrunnelse}</p>
      )}
      {isPrekludert && subsidiaertBelop !== undefined && subsidiaertBelop > 0 && (
        <p className="text-xs text-pkt-text-warning mt-1">
          Subsidiært godkjent: {formatCurrency(subsidiaertBelop)}
        </p>
      )}
    </div>
  );
}

// ========== KASKADE-VISNING KOMPONENTER ==========

/**
 * BelopVurderingRow - En rad i beløpsvurdering-tabellen
 */
interface BelopVurderingRowProps {
  label: string;
  krevd?: number;
  godkjent?: number;
  vurdering?: string;
  isPrekludert?: boolean;
  trigger?: string;
}

function BelopVurderingRow({
  label,
  krevd,
  godkjent,
  vurdering,
  isPrekludert = false,
  trigger,
}: BelopVurderingRowProps) {
  const badge = getBelopVurderingBadge(vurdering);

  return (
    <tr className={`border-b border-pkt-border-subtle last:border-b-0 ${isPrekludert ? 'bg-amber-50' : ''}`}>
      <td className="py-2 text-sm">
        {label}
        {isPrekludert && trigger && (
          <span className="text-xs text-amber-700 ml-1">← {trigger}</span>
        )}
      </td>
      <td className="py-2 text-right font-mono text-sm">
        {krevd !== undefined ? formatCurrency(krevd) : '-'}
      </td>
      <td className="py-2 text-right font-mono text-sm">
        {isPrekludert ? (
          <span className="text-pkt-text-body-subtle">Prekludert</span>
        ) : godkjent !== undefined ? (
          formatCurrency(godkjent)
        ) : '-'}
      </td>
      <td className="py-2 text-right">
        {isPrekludert ? (
          <Badge variant="neutral">Prekludert</Badge>
        ) : vurdering ? (
          <Badge variant={badge.variant}>{badge.label}</Badge>
        ) : null}
      </td>
    </tr>
  );
}

/**
 * BelopVurderingTable - Tabell for beløpsvurdering med krevd/godkjent kolonner
 */
interface BelopVurderingTableProps {
  rows: BelopVurderingRowProps[];
  totalKrevd?: number;
  totalGodkjent?: number;
  showTotal?: boolean;
}

function BelopVurderingTable({ rows, totalKrevd, totalGodkjent, showTotal = true }: BelopVurderingTableProps) {
  // Beregn totaler hvis ikke oppgitt
  const computedTotalKrevd = totalKrevd ?? rows.reduce((sum, r) => sum + (r.krevd ?? 0), 0);
  const computedTotalGodkjent = totalGodkjent ?? rows.reduce((sum, r) => sum + (r.isPrekludert ? 0 : (r.godkjent ?? 0)), 0);
  const differanse = computedTotalKrevd - computedTotalGodkjent;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b-2 border-pkt-border-subtle">
          <th className="text-left py-1.5 font-medium">Krav</th>
          <th className="text-right py-1.5 font-medium w-28">Krevd</th>
          <th className="text-right py-1.5 font-medium w-28">Godkjent</th>
          <th className="text-right py-1.5 font-medium w-24">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <BelopVurderingRow key={idx} {...row} />
        ))}
      </tbody>
      {showTotal && (
        <tfoot>
          <tr className="border-t-2 border-pkt-border-default font-bold">
            <td className="py-2">TOTALT</td>
            <td className="text-right font-mono">{formatCurrency(computedTotalKrevd)}</td>
            <td className="text-right font-mono">{formatCurrency(computedTotalGodkjent)}</td>
            <td className="text-right text-sm font-normal">
              {computedTotalKrevd > 0 && (
                <span className="text-pkt-text-body-subtle">
                  {((computedTotalGodkjent / computedTotalKrevd) * 100).toFixed(0)}%
                </span>
              )}
            </td>
          </tr>
          {differanse > 0 && (
            <tr className="text-pkt-text-body-subtle">
              <td className="py-1 italic">Differanse</td>
              <td></td>
              <td className="text-right font-mono">{formatCurrency(differanse)}</td>
              <td></td>
            </tr>
          )}
        </tfoot>
      )}
    </table>
  );
}

/**
 * DagerVurderingTable - Tabell for frist-vurdering (dager)
 */
interface DagerVurderingTableProps {
  krevdDager: number;
  godkjentDager: number;
  label?: string;
}

function DagerVurderingTable({ krevdDager, godkjentDager, label = 'Fristforlengelse' }: DagerVurderingTableProps) {
  const differanse = krevdDager - godkjentDager;
  const prosent = krevdDager > 0 ? (godkjentDager / krevdDager) * 100 : 0;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b-2 border-pkt-border-subtle">
          <th className="text-left py-1.5 font-medium">Krav</th>
          <th className="text-right py-1.5 font-medium w-24">Krevd</th>
          <th className="text-right py-1.5 font-medium w-24">Godkjent</th>
          <th className="text-right py-1.5 font-medium w-24">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-pkt-border-subtle">
          <td className="py-2">{label}</td>
          <td className="text-right font-mono">{krevdDager} dager</td>
          <td className="text-right font-mono">{godkjentDager} dager</td>
          <td className="text-right">
            {godkjentDager >= krevdDager ? (
              <Badge variant="success">Godkjent</Badge>
            ) : godkjentDager > 0 ? (
              <Badge variant="warning">Delvis</Badge>
            ) : (
              <Badge variant="danger">Avslått</Badge>
            )}
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-pkt-border-default font-bold">
          <td className="py-2">DIFFERANSE</td>
          <td></td>
          <td className="text-right font-mono">{differanse} dager</td>
          <td className="text-right text-sm font-normal text-pkt-text-body-subtle">
            {prosent.toFixed(0)}%
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

/**
 * ResultatKort - Viser prinsipalt eller subsidiært resultat i en fremhevet boks
 */
interface ResultatKortProps {
  variant: 'prinsipalt' | 'subsidiaert';
  resultatBadge: { variant: BadgeVariant; label: string };
  verdi?: string;
  beskrivelse?: string;
}

function ResultatKort({ variant, resultatBadge, verdi, beskrivelse }: ResultatKortProps) {
  const isPrinsipalt = variant === 'prinsipalt';

  return (
    <div className={`p-4 rounded ${isPrinsipalt ? 'bg-pkt-surface-strong-dark-blue text-white' : 'bg-amber-50 border border-amber-200'}`}>
      <h5 className={`font-medium text-xs mb-2 ${isPrinsipalt ? 'opacity-70' : 'text-amber-700'}`}>
        {isPrinsipalt ? 'PRINSIPALT STANDPUNKT' : 'SUBSIDIÆRT STANDPUNKT'}
      </h5>
      <div className="flex items-center gap-3">
        <Badge variant={resultatBadge.variant} size="lg">{resultatBadge.label}</Badge>
        {verdi && (
          <span className={`text-lg font-mono font-bold ${isPrinsipalt ? 'text-white' : 'text-amber-900'}`}>
            {verdi}
          </span>
        )}
      </div>
      {beskrivelse && (
        <p className={`mt-2 text-sm ${isPrinsipalt ? 'opacity-80' : 'text-amber-700'}`}>
          {beskrivelse}
        </p>
      )}
    </div>
  );
}

/**
 * KaskadePil - Visuell pil mellom prinsipalt og subsidiært
 */
function KaskadePil({ trigger }: { trigger?: string }) {
  return (
    <div className="flex items-center justify-center py-2">
      <div className="flex flex-col items-center text-pkt-text-body-subtle">
        <span className="text-xs mb-1">{trigger || 'fordi avvist'}</span>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-pkt-text-body-subtle">
          <path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}

/**
 * PreklusjonStatus - Viser preklusjonsvurdering for vederlag (rigg/produktivitet)
 */
interface PreklusjonStatusProps {
  riggVarsletITide?: boolean;
  produktivitetVarsletITide?: boolean;
  harRiggKrav?: boolean;
  harProduktivitetKrav?: boolean;
}

function PreklusjonStatus({ riggVarsletITide, produktivitetVarsletITide, harRiggKrav, harProduktivitetKrav }: PreklusjonStatusProps) {
  const showRigg = harRiggKrav && riggVarsletITide !== undefined;
  const showProduktivitet = harProduktivitetKrav && produktivitetVarsletITide !== undefined;

  if (!showRigg && !showProduktivitet) return null;

  return (
    <div className="space-y-2">
      <h5 className="font-medium text-sm text-pkt-text-body-subtle">Preklusjon (§34.1.3)</h5>
      <div className="flex flex-col gap-2">
        {showRigg && (
          <div className="flex items-center justify-between py-1.5 px-3 bg-pkt-surface-subtle rounded">
            <span className="text-sm">Rigg/drift</span>
            <Badge variant={riggVarsletITide ? 'success' : 'danger'}>
              {riggVarsletITide ? '✓ I tide' : '✗ For sent'}
            </Badge>
          </div>
        )}
        {showProduktivitet && (
          <div className="flex items-center justify-between py-1.5 px-3 bg-pkt-surface-subtle rounded">
            <span className="text-sm">Produktivitet</span>
            <Badge variant={produktivitetVarsletITide ? 'success' : 'danger'}>
              {produktivitetVarsletITide ? '✓ I tide' : '✗ For sent'}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * VilkarStatus - Viser vilkårsvurdering for frist
 */
interface VilkarStatusProps {
  noytraltVarselOk?: boolean;
  spesifisertKravOk?: boolean;
  vilkarOppfylt?: boolean;
}

function VilkarStatus({ noytraltVarselOk, spesifisertKravOk, vilkarOppfylt }: VilkarStatusProps) {
  const harPreklusjon = noytraltVarselOk !== undefined || spesifisertKravOk !== undefined;
  const harVilkar = vilkarOppfylt !== undefined;

  if (!harPreklusjon && !harVilkar) return null;

  return (
    <div className="space-y-3">
      {harPreklusjon && (
        <div className="space-y-2">
          <h5 className="font-medium text-sm text-pkt-text-body-subtle">Preklusjon (§33.4/§33.6)</h5>
          <div className="flex flex-col gap-2">
            {noytraltVarselOk !== undefined && (
              <div className="flex items-center justify-between py-1.5 px-3 bg-pkt-surface-subtle rounded">
                <span className="text-sm">Nøytralt varsel (§33.4)</span>
                <Badge variant={noytraltVarselOk ? 'success' : 'danger'}>
                  {noytraltVarselOk ? '✓ I tide' : '✗ For sent'}
                </Badge>
              </div>
            )}
            {spesifisertKravOk !== undefined && (
              <div className="flex items-center justify-between py-1.5 px-3 bg-pkt-surface-subtle rounded">
                <span className="text-sm">Spesifisert krav (§33.6)</span>
                <Badge variant={spesifisertKravOk ? 'success' : 'danger'}>
                  {spesifisertKravOk ? '✓ I tide' : '✗ For sent'}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}
      {harVilkar && (
        <div className="space-y-2">
          <h5 className="font-medium text-sm text-pkt-text-body-subtle">Årsakssammenheng (§33.1)</h5>
          <div className="flex items-center justify-between py-1.5 px-3 bg-pkt-surface-subtle rounded">
            <span className="text-sm">Hindring erkjent</span>
            <Badge variant={vilkarOppfylt ? 'success' : 'warning'}>
              {vilkarOppfylt ? '✓ Ja' : '✗ Nei'}
            </Badge>
          </div>
        </div>
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
              <span className="ml-1 text-pkt-text-body-subtle text-xs">
                ({hjemmelRefs.join(', ')})
              </span>
            )}
          </DataListItem>
        )}
        {varselkravRefs.length > 0 && (
          <DataListItem label="Varselkrav">
            <span className="text-pkt-text-body-subtle">
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
              <span className="ml-1 text-pkt-text-body-subtle">
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
  const hovedbelop = data.belop_direkte ?? data.kostnads_overslag ?? 0;
  const riggBelop = data.saerskilt_krav?.rigg_drift?.belop;
  const produktivitetBelop = data.saerskilt_krav?.produktivitet?.belop;

  return (
    <div className="space-y-4">
      {/* Hoveddata i grid */}
      <DataList variant="grid">
        <DataListItem label="Metode">
          <Badge variant="info">{getVederlagsmetodeLabel(data.metode)}</Badge>
        </DataListItem>
        <DataListItem label="Hovedkrav" mono>{formatCurrency(hovedbelop)}</DataListItem>
        {riggBelop !== undefined && (
          <DataListItem label="Rigg/drift" mono>{formatCurrency(riggBelop)}</DataListItem>
        )}
        {produktivitetBelop !== undefined && (
          <DataListItem label="Produktivitet" mono>{formatCurrency(produktivitetBelop)}</DataListItem>
        )}
        {data.krever_justert_ep && (
          <DataListItem label="Justerte EP">
            <Badge variant="warning">Ja</Badge>
          </DataListItem>
        )}
      </DataList>

      {/* Særskilte krav datoer */}
      {(data.saerskilt_krav?.rigg_drift?.dato_klar_over || data.saerskilt_krav?.produktivitet?.dato_klar_over) && (
        <DataList variant="grid">
          {data.saerskilt_krav?.rigg_drift?.dato_klar_over && (
            <DataListItem label="Rigg klar over">{formatDateMedium(data.saerskilt_krav.rigg_drift.dato_klar_over)}</DataListItem>
          )}
          {data.saerskilt_krav?.produktivitet?.dato_klar_over && (
            <DataListItem label="Produktivitet klar over">{formatDateMedium(data.saerskilt_krav.produktivitet.dato_klar_over)}</DataListItem>
          )}
        </DataList>
      )}

      {/* Begrunnelse og vedlegg */}
      <DataList>
        <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
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
  const prinsipaltBadge = getVederlagResultatBadge(data.beregnings_resultat);

  // Check if rigg/produktivitet is precluded
  const riggPrekludert = data.rigg_varslet_i_tide === false;
  const produktivitetPrekludert = data.produktivitet_varslet_i_tide === false;
  const harPrekludertKrav = riggPrekludert || produktivitetPrekludert;

  // Check if we have detailed breakdown
  const hasBelopBreakdown =
    data.hovedkrav_vurdering ||
    data.hovedkrav_godkjent_belop !== undefined ||
    data.rigg_vurdering ||
    data.rigg_godkjent_belop !== undefined ||
    data.produktivitet_vurdering ||
    data.produktivitet_godkjent_belop !== undefined;

  // Check if we have subsidiary data
  const hasSubsidiaer = data.subsidiaer_resultat || data.subsidiaer_godkjent_belop !== undefined;
  const subsidiaertBadge = data.subsidiaer_resultat
    ? getVederlagResultatBadge(data.subsidiaer_resultat)
    : null;

  // Calculate totals for display
  const totalKrevd = data.total_krevd_belop ?? 0;

  return (
    <div className="space-y-4">
      {/* ========== PRINSIPALT STANDPUNKT ========== */}
      <SectionContainer title="Prinsipalt standpunkt" spacing="compact">
        {/* Preklusjon (§34.1.3) - kun hvis relevant */}
        <PreklusjonStatus
          riggVarsletITide={data.rigg_varslet_i_tide}
          produktivitetVarsletITide={data.produktivitet_varslet_i_tide}
          harRiggKrav={data.rigg_vurdering !== undefined || data.rigg_godkjent_belop !== undefined}
          harProduktivitetKrav={data.produktivitet_vurdering !== undefined || data.produktivitet_godkjent_belop !== undefined}
        />

        {/* Beløpsvurdering tabell */}
        {hasBelopBreakdown && (
          <div className="mt-4">
            <h5 className="font-medium text-sm text-pkt-text-body-subtle mb-2">Beløpsvurdering</h5>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-pkt-border-subtle">
                  <th className="text-left py-1.5 font-medium">Krav</th>
                  <th className="text-right py-1.5 font-medium w-28">Krevd</th>
                  <th className="text-right py-1.5 font-medium w-28">Godkjent</th>
                  <th className="text-right py-1.5 font-medium w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {/* Hovedkrav */}
                {(data.hovedkrav_vurdering || data.hovedkrav_godkjent_belop !== undefined) && (
                  <tr className="border-b border-pkt-border-subtle">
                    <td className="py-2">Hovedkrav</td>
                    <td className="text-right font-mono">-</td>
                    <td className="text-right font-mono">
                      {formatCurrency(data.hovedkrav_godkjent_belop ?? 0)}
                    </td>
                    <td className="text-right">
                      <Badge variant={getBelopVurderingBadge(data.hovedkrav_vurdering).variant}>
                        {getBelopVurderingBadge(data.hovedkrav_vurdering).label}
                      </Badge>
                    </td>
                  </tr>
                )}

                {/* Rigg/drift */}
                {(data.rigg_vurdering || data.rigg_godkjent_belop !== undefined) && (
                  <>
                    <tr className={`border-b border-pkt-border-subtle ${riggPrekludert ? 'bg-amber-50' : ''}`}>
                      <td className="py-2">
                        Rigg/drift
                        {riggPrekludert && <span className="text-xs text-amber-700 ml-1">← trigger subsidiær</span>}
                      </td>
                      <td className="text-right font-mono">-</td>
                      <td className="text-right font-mono">
                        {riggPrekludert ? formatCurrency(0) : formatCurrency(data.rigg_godkjent_belop ?? 0)}
                      </td>
                      <td className="text-right">
                        {riggPrekludert ? (
                          <Badge variant="danger">Prekludert</Badge>
                        ) : (
                          <Badge variant={getBelopVurderingBadge(data.rigg_vurdering).variant}>
                            {getBelopVurderingBadge(data.rigg_vurdering).label}
                          </Badge>
                        )}
                      </td>
                    </tr>
                    {/* Subsidiær rad for rigg */}
                    {riggPrekludert && (
                      <tr className="border-b border-pkt-border-subtle bg-amber-50/50">
                        <td className="py-2 pl-4 italic text-amber-700">↳ Subsidiært</td>
                        <td className="text-right font-mono text-amber-700">-</td>
                        <td className="text-right font-mono text-amber-700">
                          {formatCurrency(data.rigg_godkjent_belop ?? 0)}
                        </td>
                        <td className="text-right">
                          <Badge variant={getBelopVurderingBadge(data.rigg_vurdering).variant}>
                            {getBelopVurderingBadge(data.rigg_vurdering).label}
                          </Badge>
                        </td>
                      </tr>
                    )}
                  </>
                )}

                {/* Produktivitet */}
                {(data.produktivitet_vurdering || data.produktivitet_godkjent_belop !== undefined) && (
                  <>
                    <tr className={`border-b border-pkt-border-subtle ${produktivitetPrekludert ? 'bg-amber-50' : ''}`}>
                      <td className="py-2">
                        Produktivitetstap
                        {produktivitetPrekludert && <span className="text-xs text-amber-700 ml-1">← trigger subsidiær</span>}
                      </td>
                      <td className="text-right font-mono">-</td>
                      <td className="text-right font-mono">
                        {produktivitetPrekludert ? formatCurrency(0) : formatCurrency(data.produktivitet_godkjent_belop ?? 0)}
                      </td>
                      <td className="text-right">
                        {produktivitetPrekludert ? (
                          <Badge variant="danger">Prekludert</Badge>
                        ) : (
                          <Badge variant={getBelopVurderingBadge(data.produktivitet_vurdering).variant}>
                            {getBelopVurderingBadge(data.produktivitet_vurdering).label}
                          </Badge>
                        )}
                      </td>
                    </tr>
                    {/* Subsidiær rad for produktivitet */}
                    {produktivitetPrekludert && (
                      <tr className="border-b border-pkt-border-subtle bg-amber-50/50">
                        <td className="py-2 pl-4 italic text-amber-700">↳ Subsidiært</td>
                        <td className="text-right font-mono text-amber-700">-</td>
                        <td className="text-right font-mono text-amber-700">
                          {formatCurrency(data.produktivitet_godkjent_belop ?? 0)}
                        </td>
                        <td className="text-right">
                          <Badge variant={getBelopVurderingBadge(data.produktivitet_vurdering).variant}>
                            {getBelopVurderingBadge(data.produktivitet_vurdering).label}
                          </Badge>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
              {/* Totalt */}
              <tfoot>
                <tr className="border-t-2 border-pkt-border-default font-bold">
                  <td className="py-2">TOTALT PRINSIPALT</td>
                  <td className="text-right font-mono">{totalKrevd > 0 ? formatCurrency(totalKrevd) : '-'}</td>
                  <td className="text-right font-mono">{formatCurrency(data.total_godkjent_belop ?? 0)}</td>
                  <td className="text-right text-sm font-normal">
                    {totalKrevd > 0 && data.total_godkjent_belop !== undefined && (
                      <span className="text-pkt-text-body-subtle">
                        {((data.total_godkjent_belop / totalKrevd) * 100).toFixed(0)}%
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Prinsipalt resultat-kort */}
        <ResultatKort
          variant="prinsipalt"
          resultatBadge={prinsipaltBadge}
          verdi={data.total_godkjent_belop !== undefined ? formatCurrency(data.total_godkjent_belop) : undefined}
        />
      </SectionContainer>

      {/* ========== SUBSIDIÆRT STANDPUNKT ========== */}
      {(harPrekludertKrav || hasSubsidiaer) && (
        <>
          <KaskadePil trigger={harPrekludertKrav ? 'fordi prekludert' : undefined} />

          <SectionContainer title="Subsidiært standpunkt" variant="subtle" spacing="compact">
            {data.subsidiaer_triggers && data.subsidiaer_triggers.length > 0 && (
              <div className="mb-3">
                <span className="text-sm text-pkt-text-body-subtle">Trigger: </span>
                {data.subsidiaer_triggers.map((trigger) => (
                  <Badge key={trigger} variant="warning" className="ml-1">
                    {getSubsidiaerTriggerLabel(trigger as SubsidiaerTrigger)}
                  </Badge>
                ))}
              </div>
            )}

            {subsidiaertBadge && (
              <ResultatKort
                variant="subsidiaert"
                resultatBadge={subsidiaertBadge}
                verdi={data.subsidiaer_godkjent_belop !== undefined ? formatCurrency(data.subsidiaer_godkjent_belop) : undefined}
                beskrivelse="Dersom BH tar feil om preklusjon"
              />
            )}
          </SectionContainer>
        </>
      )}

      {/* ========== BEGRUNNELSE ========== */}
      <DataList>
        <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
        {data.subsidiaer_begrunnelse && (
          <LongTextField label="Subsidiær begrunnelse" value={data.subsidiaer_begrunnelse} />
        )}
      </DataList>

      {/* Metode og annen info */}
      {(data.vederlagsmetode || data.frist_for_spesifikasjon) && (
        <DataList variant="grid">
          {data.vederlagsmetode && (
            <DataListItem label="Metode">{getVederlagsmetodeLabel(data.vederlagsmetode)}</DataListItem>
          )}
          {data.frist_for_spesifikasjon && (
            <DataListItem label="Frist spesifikasjon">{formatDateMedium(data.frist_for_spesifikasjon)}</DataListItem>
          )}
        </DataList>
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
  const prinsipaltBadge = getFristResultatBadge(data.beregnings_resultat);

  // Check if precluded (nøytralt or spesifisert varsel not OK)
  const erPrekludert = data.noytralt_varsel_ok === false || data.spesifisert_krav_ok === false;
  // Check if hindring not acknowledged
  const ingenHindring = data.vilkar_oppfylt === false;
  // Check if subsidiary is needed
  const harSubsidiaerTrigger = erPrekludert || ingenHindring;

  // Check if we have subsidiary data
  const hasSubsidiaer = data.subsidiaer_resultat || data.subsidiaer_godkjent_dager !== undefined;
  const subsidiaertBadge = data.subsidiaer_resultat
    ? getFristResultatBadge(data.subsidiaer_resultat)
    : null;

  // Get godkjent dager
  const godkjentDager = data.godkjent_dager ?? 0;

  return (
    <div className="space-y-4">
      {/* ========== PRINSIPALT STANDPUNKT ========== */}
      <SectionContainer title="Prinsipalt standpunkt" spacing="compact">
        {/* Vilkårsvurdering */}
        <VilkarStatus
          noytraltVarselOk={data.noytralt_varsel_ok}
          spesifisertKravOk={data.spesifisert_krav_ok}
          vilkarOppfylt={data.vilkar_oppfylt}
        />

        {/* Etterlysning */}
        {data.har_bh_etterlyst && (
          <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
            <Badge variant="warning">BH har etterlyst (§33.6.2)</Badge>
            {data.frist_for_spesifisering && (
              <span className="text-sm text-amber-700 ml-2">
                Frist: {formatDateMedium(data.frist_for_spesifisering)}
              </span>
            )}
          </div>
        )}

        {/* Dagerberegning */}
        {godkjentDager !== undefined && (
          <div className="mt-4">
            <h5 className="font-medium text-sm text-pkt-text-body-subtle mb-2">Beregning</h5>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-pkt-border-subtle">
                  <th className="text-left py-1.5 font-medium">Krav</th>
                  <th className="text-right py-1.5 font-medium w-24">Godkjent</th>
                  <th className="text-right py-1.5 font-medium w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className={`border-b border-pkt-border-subtle ${erPrekludert || ingenHindring ? 'bg-amber-50' : ''}`}>
                  <td className="py-2">
                    Fristforlengelse
                    {erPrekludert && <span className="text-xs text-amber-700 ml-1">← prekludert</span>}
                    {!erPrekludert && ingenHindring && <span className="text-xs text-amber-700 ml-1">← ingen hindring</span>}
                  </td>
                  <td className="text-right font-mono">
                    {erPrekludert || ingenHindring ? '0 dager' : `${godkjentDager} dager`}
                  </td>
                  <td className="text-right">
                    {erPrekludert ? (
                      <Badge variant="danger">Prekludert</Badge>
                    ) : ingenHindring ? (
                      <Badge variant="danger">Avslått</Badge>
                    ) : godkjentDager > 0 ? (
                      <Badge variant="success">Godkjent</Badge>
                    ) : (
                      <Badge variant="danger">Avslått</Badge>
                    )}
                  </td>
                </tr>
                {/* Subsidiær rad hvis relevant */}
                {harSubsidiaerTrigger && (
                  <tr className="border-b border-pkt-border-subtle bg-amber-50/50">
                    <td className="py-2 pl-4 italic text-amber-700">↳ Subsidiært</td>
                    <td className="text-right font-mono text-amber-700">
                      {data.subsidiaer_godkjent_dager !== undefined
                        ? `${data.subsidiaer_godkjent_dager} dager`
                        : `${godkjentDager} dager`}
                    </td>
                    <td className="text-right">
                      {subsidiaertBadge ? (
                        <Badge variant={subsidiaertBadge.variant}>{subsidiaertBadge.label}</Badge>
                      ) : godkjentDager > 0 ? (
                        <Badge variant="warning">Delvis</Badge>
                      ) : (
                        <Badge variant="danger">Avslått</Badge>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Prinsipalt resultat-kort */}
        <ResultatKort
          variant="prinsipalt"
          resultatBadge={prinsipaltBadge}
          verdi={`${erPrekludert || ingenHindring ? 0 : godkjentDager} dager`}
          beskrivelse={erPrekludert ? 'Avvist pga. preklusjon' : ingenHindring ? 'Avvist pga. ingen hindring' : undefined}
        />
      </SectionContainer>

      {/* ========== SUBSIDIÆRT STANDPUNKT ========== */}
      {(harSubsidiaerTrigger || hasSubsidiaer) && (
        <>
          <KaskadePil trigger={erPrekludert ? 'fordi prekludert' : ingenHindring ? 'fordi ingen hindring' : undefined} />

          <SectionContainer title="Subsidiært standpunkt" variant="subtle" spacing="compact">
            {data.subsidiaer_triggers && data.subsidiaer_triggers.length > 0 && (
              <div className="mb-3">
                <span className="text-sm text-pkt-text-body-subtle">Trigger: </span>
                {data.subsidiaer_triggers.map((trigger) => (
                  <Badge key={trigger} variant="warning" className="ml-1">
                    {getSubsidiaerTriggerLabel(trigger as SubsidiaerTrigger)}
                  </Badge>
                ))}
              </div>
            )}

            {subsidiaertBadge && (
              <ResultatKort
                variant="subsidiaert"
                resultatBadge={subsidiaertBadge}
                verdi={data.subsidiaer_godkjent_dager !== undefined
                  ? `${data.subsidiaer_godkjent_dager} dager`
                  : undefined}
                beskrivelse={erPrekludert
                  ? 'Dersom varsel var i tide'
                  : ingenHindring
                    ? 'Dersom det var reell hindring'
                    : 'Dersom BH tar feil'}
              />
            )}
          </SectionContainer>
        </>
      )}

      {/* ========== BEGRUNNELSE ========== */}
      <DataList>
        <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
        {data.begrunnelse_vilkar && (
          <LongTextField label="Begrunnelse vilkår" value={data.begrunnelse_vilkar} />
        )}
        {data.subsidiaer_begrunnelse && (
          <LongTextField label="Subsidiær begrunnelse" value={data.subsidiaer_begrunnelse} />
        )}
      </DataList>

      {/* Ny sluttdato */}
      {data.ny_sluttdato && (
        <DataList variant="grid">
          <DataListItem label="Ny sluttdato">{formatDateMedium(data.ny_sluttdato)}</DataListItem>
        </DataList>
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
      <Alert variant="danger" title="Forseringsvarsel (§33.8)">
        {data.grunnlag_avslag_trigger && (
          <span className="text-sm">(utløst av grunnlagsavslag)</span>
        )}
      </Alert>

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
    return <p className="text-pkt-text-body-subtle italic">Ingen skjemadata tilgjengelig.</p>;
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

  // Render event-specific data section
  const renderEventData = () => {
    if (!event.data) {
      return (
        <p className="text-pkt-text-body-subtle italic py-4">
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
      size="lg"
    >
      <div className="space-y-6">
        {/* Metadata */}
        <p className="text-sm text-pkt-text-body-subtle pb-4 border-b border-pkt-border-subtle">
          {event.time ? formatDateTimeNorwegian(event.time) : 'Ukjent tid'}
          {' · '}
          {event.actor || 'Ukjent'}
          {event.actorrole && ` (${event.actorrole === 'TE' ? 'Entreprenør' : 'Byggherre'})`}
        </p>

        {/* Event data */}
        {renderEventData()}

        {/* Event ID footer */}
        <p className="text-xs text-pkt-text-body-subtle pt-4 border-t border-pkt-border-subtle">
          Event ID: {event.id}
        </p>
      </div>
    </Modal>
  );
}
