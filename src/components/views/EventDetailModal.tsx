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
  Modal,
  SectionContainer,
  DataList,
  DataListItem,
} from '../primitives';
import {
  TimelineEvent,
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
        <DataListItem label="Metode">{getVederlagsmetodeLabel(data.metode)}</DataListItem>
        <DataListItem label="Hovedkrav" mono>{formatCurrency(hovedbelop)}</DataListItem>
        {riggBelop !== undefined && (
          <DataListItem label="Rigg/drift" mono>{formatCurrency(riggBelop)}</DataListItem>
        )}
        {produktivitetBelop !== undefined && (
          <DataListItem label="Produktivitet" mono>{formatCurrency(produktivitetBelop)}</DataListItem>
        )}
        {data.krever_justert_ep && (
          <DataListItem label="Krever justerte enhetspriser">Ja</DataListItem>
        )}
      </DataList>

      {/* Særskilte krav datoer */}
      {(data.saerskilt_krav?.rigg_drift?.dato_klar_over || data.saerskilt_krav?.produktivitet?.dato_klar_over) && (
        <DataList variant="grid">
          {data.saerskilt_krav?.rigg_drift?.dato_klar_over && (
            <DataListItem label="Rigg/drift oppdaget">{formatDateMedium(data.saerskilt_krav.rigg_drift.dato_klar_over)}</DataListItem>
          )}
          {data.saerskilt_krav?.produktivitet?.dato_klar_over && (
            <DataListItem label="Produktivitetstap oppdaget">{formatDateMedium(data.saerskilt_krav.produktivitet.dato_klar_over)}</DataListItem>
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
      <VarselInfoDisplay label="Foreløpig varsel (§33.4)" varsel={data.noytralt_varsel} />
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
        <DataListItem label="Sendt etter BHs anmodning">Ja</DataListItem>
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
  return (
    <DataList>
      <DataListItem label="Resultat">{getBhGrunnlagssvarLabel(data.resultat)}</DataListItem>
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.akseptert_kategori && (
        <DataListItem label="Akseptert kategori">{data.akseptert_kategori}</DataListItem>
      )}
    </DataList>
  );
}

function ResponsGrunnlagOppdatertSection({ data }: { data: ResponsGrunnlagOppdatertEventData }) {
  return (
    <DataList>
      <DataListItem label="Nytt resultat">{getBhGrunnlagssvarLabel(data.resultat)}</DataListItem>
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.dato_endret && (
        <DataListItem label="Endret dato">{formatDateMedium(data.dato_endret)}</DataListItem>
      )}
    </DataList>
  );
}

function ResponsVederlagSection({ data }: { data: ResponsVederlagEventData }) {
  // Subsidiært hvis det finnes subsidiær-data (trigger av preklusjon eller grunnlagsavslag)
  const erSubsidiaer = data.subsidiaer_resultat !== undefined;
  const godkjentLabel = erSubsidiaer ? 'Subsidiært godkjent' : 'Godkjent';
  const godkjentBelop = erSubsidiaer
    ? data.subsidiaer_godkjent_belop
    : data.total_godkjent_belop;

  return (
    <DataList>
      {data.vederlagsmetode && (
        <DataListItem label="Metode">{getVederlagsmetodeLabel(data.vederlagsmetode)}</DataListItem>
      )}
      {data.total_krevd_belop !== undefined && (
        <DataListItem label="Krevd" mono>{formatCurrency(data.total_krevd_belop)}</DataListItem>
      )}
      {godkjentBelop !== undefined && (
        <DataListItem label={godkjentLabel} mono>{formatCurrency(godkjentBelop)}</DataListItem>
      )}
      {data.beregnings_resultat && (
        <DataListItem label="Resultat">{getBhVederlagssvarLabel(data.beregnings_resultat)}</DataListItem>
      )}
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.frist_for_spesifikasjon && (
        <DataListItem label="Spesifiseringsfrist">{formatDateMedium(data.frist_for_spesifikasjon)}</DataListItem>
      )}
    </DataList>
  );
}

function ResponsVederlagOppdatertSection({ data }: { data: ResponsVederlagOppdatertEventData }) {
  // Subsidiært hvis det finnes subsidiær-data
  const erSubsidiaer = data.subsidiaer_resultat !== undefined;
  const godkjentLabel = erSubsidiaer ? 'Nytt subsidiært godkjent' : 'Nytt godkjent';
  const godkjentBelop = erSubsidiaer
    ? data.subsidiaer_godkjent_belop
    : data.total_godkjent_belop;

  return (
    <DataList>
      {data.beregnings_resultat && (
        <DataListItem label="Nytt resultat">{getBhVederlagssvarLabel(data.beregnings_resultat)}</DataListItem>
      )}
      {godkjentBelop !== undefined && (
        <DataListItem label={godkjentLabel} mono>{formatCurrency(godkjentBelop)}</DataListItem>
      )}
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.dato_endret && (
        <DataListItem label="Endret dato">{formatDateMedium(data.dato_endret)}</DataListItem>
      )}
    </DataList>
  );
}

function ResponsFristSection({ data }: { data: ResponsFristEventData }) {
  // Subsidiært hvis det finnes subsidiær-data (trigger av preklusjon, ingen hindring, eller grunnlagsavslag)
  const erSubsidiaer = data.subsidiaer_resultat !== undefined;
  const godkjentLabel = erSubsidiaer ? 'Subsidiært godkjent' : 'Godkjent';
  const godkjentDager = erSubsidiaer
    ? data.subsidiaer_godkjent_dager
    : data.godkjent_dager;

  return (
    <DataList>
      {data.krevd_dager !== undefined && (
        <DataListItem label="Krevd">{data.krevd_dager} dager</DataListItem>
      )}
      {godkjentDager !== undefined && (
        <DataListItem label={godkjentLabel}>{godkjentDager} dager</DataListItem>
      )}
      {data.beregnings_resultat && (
        <DataListItem label="Resultat">{getBhFristsvarLabel(data.beregnings_resultat)}</DataListItem>
      )}
      <LongTextField label="Begrunnelse" value={data.begrunnelse} defaultOpen={true} />
      {data.ny_sluttdato && (
        <DataListItem label="Ny sluttdato">{formatDateMedium(data.ny_sluttdato)}</DataListItem>
      )}
    </DataList>
  );
}

function ResponsFristOppdatertSection({ data }: { data: ResponsFristOppdatertEventData }) {
  // Subsidiært hvis det finnes subsidiær-data
  const erSubsidiaer = data.subsidiaer_resultat !== undefined;
  const godkjentLabel = erSubsidiaer ? 'Nytt subsidiært godkjent' : 'Nytt godkjent';
  const godkjentDager = erSubsidiaer
    ? data.subsidiaer_godkjent_dager
    : data.godkjent_dager;

  return (
    <DataList>
      {data.beregnings_resultat && (
        <DataListItem label="Nytt resultat">{getBhFristsvarLabel(data.beregnings_resultat)}</DataListItem>
      )}
      {godkjentDager !== undefined && (
        <DataListItem label={godkjentLabel}>{godkjentDager} dager</DataListItem>
      )}
      {data.stopper_forsering && (
        <DataListItem label="Stopper forsering">Ja - §33.8</DataListItem>
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
            {erInnenforGrense
              ? `Ja (${((data.estimert_kostnad / maksKostnad) * 100).toFixed(0)}% av grensen)`
              : 'Nei - overstiger grensen'}
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
