/**
 * ViewSubmittedEventModal Component
 *
 * Modal for viewing the complete submitted form data for a timeline event.
 * Renders different layouts based on event type.
 */

import { Badge, Modal } from '../primitives';
import { TimelineEntry, EventType } from '../../types/timeline';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import {
  getHovedkategoriLabel,
  getUnderkategoriLabel,
} from '../../constants';

interface ViewSubmittedEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: TimelineEntry;
}

// Labels for event types
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

// Labels for vederlagsmetode
const METODE_LABELS: Record<string, string> = {
  kontrakt_ep: 'Kontraktens enhetspriser (§34.3.1)',
  justert_ep: 'Justerte enhetspriser (§34.3.2)',
  regning: 'Regningsarbeid (§30.1)',
  overslag: 'Regningsarbeid med overslag (§30.2)',
  tilbud: 'Fastpris/Tilbud (§34.2.1)',
};

// Labels for grunnlag resultat
const GRUNNLAG_RESULTAT_LABELS: Record<string, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  erkjenn_fm: 'Force Majeure (§33.3)',
  krever_avklaring: 'Krever avklaring',
  frafalt: 'Frafalt (§32.3 c)',
};

// Labels for vederlag resultat
const VEDERLAG_RESULTAT_LABELS: Record<string, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
  hold_tilbake: 'Holder tilbake (§30.2)',
};

// Labels for frist resultat
const FRIST_RESULTAT_LABELS: Record<string, string> = {
  godkjent: 'Godkjent',
  delvis_godkjent: 'Delvis godkjent',
  avslatt: 'Avslått',
};

// Labels for varsel type
const VARSEL_TYPE_LABELS: Record<string, string> = {
  noytralt: 'Nøytralt varsel (§33.4)',
  spesifisert: 'Spesifisert krav (§33.6)',
  force_majeure: 'Force Majeure (§33.3)',
};

/**
 * Helper component for displaying a labeled field
 */
function Field({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className={`py-2 ${className}`}>
      <dt className="text-sm font-medium text-field-label">{label}</dt>
      <dd className="mt-1 text-sm text-field-value">{value}</dd>
    </div>
  );
}

/**
 * Helper component for displaying varsel info
 */
function VarselInfo({ label, varsel }: { label: string; varsel?: { dato_sendt?: string; metode?: string[] } }) {
  if (!varsel || !varsel.dato_sendt) return null;
  return (
    <div className="py-2">
      <dt className="text-sm font-medium text-field-label">{label}</dt>
      <dd className="mt-1 text-sm text-field-value">
        <span>{varsel.dato_sendt}</span>
        {varsel.metode && varsel.metode.length > 0 && (
          <span className="ml-2 text-field-muted">
            ({varsel.metode.join(', ')})
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * Renders grunnlag event data
 */
function GrunnlagEventView({ data }: { data: any }) {
  const underkategorier = Array.isArray(data.underkategori)
    ? data.underkategori.map(getUnderkategoriLabel).join(', ')
    : getUnderkategoriLabel(data.underkategori);

  return (
    <dl className="divide-y divide-pkt-border-subtle">
      <Field label="Hovedkategori" value={getHovedkategoriLabel(data.hovedkategori)} />
      <Field label="Underkategori" value={underkategorier} />
      <Field label="Dato oppdaget" value={data.dato_oppdaget} />
      <VarselInfo label="Varsel sendt" varsel={data.grunnlag_varsel} />
      <Field
        label="Beskrivelse"
        value={data.beskrivelse}
        className="col-span-2"
      />
      {data.kontraktsreferanser && data.kontraktsreferanser.length > 0 && (
        <Field
          label="Kontraktsreferanser"
          value={data.kontraktsreferanser.join(', ')}
        />
      )}
    </dl>
  );
}

/**
 * Renders vederlag event data
 */
function VederlagEventView({ data }: { data: any }) {
  return (
    <dl className="divide-y divide-pkt-border-subtle">
      <Field
        label="Krevd beløp"
        value={
          data.krav_belop
            ? `kr ${data.krav_belop.toLocaleString('nb-NO')},-`
            : undefined
        }
      />
      <Field label="Oppgjørsform" value={METODE_LABELS[data.metode] || data.metode} />
      <Field label="Begrunnelse" value={data.begrunnelse} className="col-span-2" />

      {/* Rigg/drift */}
      {data.inkluderer_rigg_drift && (
        <>
          <Field
            label="Rigg/drift inkludert"
            value={
              <Badge variant="info">
                {data.rigg_drift_belop
                  ? `kr ${data.rigg_drift_belop.toLocaleString('nb-NO')},-`
                  : 'Ja'}
              </Badge>
            }
          />
          <VarselInfo label="Rigg/drift varsel" varsel={data.rigg_drift_varsel} />
        </>
      )}

      {/* Produktivitetstap */}
      {data.inkluderer_produktivitetstap && (
        <>
          <Field
            label="Produktivitetstap inkludert"
            value={
              <Badge variant="warning">
                {data.produktivitetstap_belop
                  ? `kr ${data.produktivitetstap_belop.toLocaleString('nb-NO')},-`
                  : 'Ja'}
              </Badge>
            }
          />
          <VarselInfo label="Produktivitetstap varsel" varsel={data.produktivitetstap_varsel} />
        </>
      )}

      {/* Regningsarbeid */}
      {data.krever_regningsarbeid && (
        <VarselInfo label="Regningsarbeid varsel" varsel={data.regningsarbeid_varsel} />
      )}

      {/* Justert EP */}
      {data.krever_justert_ep && (
        <VarselInfo label="Justert EP varsel" varsel={data.justert_ep_varsel} />
      )}

      <Field label="Krav fremmet dato" value={data.krav_fremmet_dato} />
    </dl>
  );
}

/**
 * Renders frist event data
 */
function FristEventView({ data }: { data: any }) {
  return (
    <dl className="divide-y divide-pkt-border-subtle">
      <Field label="Varseltype" value={VARSEL_TYPE_LABELS[data.varsel_type] || data.varsel_type} />
      <VarselInfo label="Nøytralt varsel" varsel={data.noytralt_varsel} />
      <VarselInfo label="Spesifisert varsel" varsel={data.spesifisert_varsel} />
      <Field
        label="Krevde dager"
        value={data.antall_dager ? `${data.antall_dager} dager` : undefined}
      />
      <Field label="Begrunnelse" value={data.begrunnelse} className="col-span-2" />
      <Field label="Ny sluttdato" value={data.ny_sluttdato} />
      <Field
        label="Fremdriftsdokumentasjon"
        value={data.fremdriftshindring_dokumentasjon}
      />
    </dl>
  );
}

/**
 * Renders grunnlag response data
 */
function ResponsGrunnlagView({ data }: { data: any }) {
  return (
    <dl className="divide-y divide-pkt-border-subtle">
      <Field
        label="Resultat"
        value={
          <Badge
            variant={
              data.resultat === 'godkjent'
                ? 'success'
                : data.resultat === 'avslatt'
                  ? 'danger'
                  : 'warning'
            }
          >
            {GRUNNLAG_RESULTAT_LABELS[data.resultat] || data.resultat}
          </Badge>
        }
      />
      <Field label="Begrunnelse" value={data.begrunnelse} className="col-span-2" />
      {data.akseptert_kategori && (
        <Field label="Akseptert kategori" value={data.akseptert_kategori} />
      )}
      {data.varsel_for_sent && (
        <Field
          label="Varsel for sent"
          value={<Badge variant="danger">Ja - preklusjonsrisiko</Badge>}
        />
      )}
      {data.varsel_begrunnelse && (
        <Field label="Varselbegrunnelse" value={data.varsel_begrunnelse} />
      )}
    </dl>
  );
}

/**
 * Renders vederlag response data
 */
function ResponsVederlagView({ data }: { data: any }) {
  return (
    <dl className="divide-y divide-pkt-border-subtle">
      <Field
        label="Resultat"
        value={
          <Badge
            variant={
              data.beregnings_resultat === 'godkjent'
                ? 'success'
                : data.beregnings_resultat === 'hold_tilbake'
                  ? 'warning'
                  : data.beregnings_resultat === 'avslatt'
                    ? 'danger'
                    : 'neutral'
            }
          >
            {VEDERLAG_RESULTAT_LABELS[data.beregnings_resultat] || data.beregnings_resultat}
          </Badge>
        }
      />
      {data.total_godkjent_belop !== undefined && (
        <Field
          label="Godkjent beløp"
          value={`kr ${data.total_godkjent_belop.toLocaleString('nb-NO')},-`}
        />
      )}
      <Field
        label="Oppgjørsform"
        value={METODE_LABELS[data.vederlagsmetode] || data.vederlagsmetode}
      />
      <Field label="Begrunnelse (beregning)" value={data.begrunnelse_beregning} />
      <Field label="Begrunnelse (varsel)" value={data.begrunnelse_varsel} />
      <Field label="Frist for spesifikasjon" value={data.frist_for_spesifikasjon} />

      {/* Varsel-vurderinger */}
      {data.saerskilt_varsel_rigg_drift_ok !== undefined && (
        <Field
          label="Rigg/drift varsel OK"
          value={data.saerskilt_varsel_rigg_drift_ok ? 'Ja' : 'Nei'}
        />
      )}
      {data.varsel_justert_ep_ok !== undefined && (
        <Field
          label="Justert EP varsel OK"
          value={data.varsel_justert_ep_ok ? 'Ja' : 'Nei'}
        />
      )}
      {data.varsel_start_regning_ok !== undefined && (
        <Field
          label="Regningsarbeid varsel OK"
          value={data.varsel_start_regning_ok ? 'Ja' : 'Nei'}
        />
      )}
    </dl>
  );
}

/**
 * Renders frist response data
 */
function ResponsFristView({ data }: { data: any }) {
  return (
    <dl className="divide-y divide-pkt-border-subtle">
      <Field
        label="Resultat"
        value={
          <Badge
            variant={
              data.beregnings_resultat === 'godkjent'
                ? 'success'
                : data.beregnings_resultat === 'delvis_godkjent'
                  ? 'warning'
                  : 'danger'
            }
          >
            {FRIST_RESULTAT_LABELS[data.beregnings_resultat] || data.beregnings_resultat}
          </Badge>
        }
      />
      {data.godkjent_dager !== undefined && (
        <Field label="Godkjente dager" value={`${data.godkjent_dager} dager`} />
      )}
      <Field label="Ny sluttdato" value={data.ny_sluttdato} />
      <Field label="Begrunnelse (beregning)" value={data.begrunnelse_beregning} />
      <Field label="Begrunnelse (vilkår)" value={data.begrunnelse_vilkar} />
      <Field label="Begrunnelse (varsel)" value={data.begrunnelse_varsel} />

      {/* Varsel-vurderinger */}
      {data.noytralt_varsel_ok !== undefined && (
        <Field
          label="Nøytralt varsel OK"
          value={data.noytralt_varsel_ok ? 'Ja' : 'Nei'}
        />
      )}
      {data.spesifisert_krav_ok !== undefined && (
        <Field
          label="Spesifisert krav OK"
          value={data.spesifisert_krav_ok ? 'Ja' : 'Nei'}
        />
      )}
      {data.vilkar_oppfylt !== undefined && (
        <Field
          label="Vilkår oppfylt"
          value={data.vilkar_oppfylt ? 'Ja' : 'Nei'}
        />
      )}
      {data.har_bh_etterlyst && (
        <Field
          label="BH har etterlyst"
          value={<Badge variant="warning">Ja</Badge>}
        />
      )}
      <Field label="Frist for spesifisering" value={data.frist_for_spesifisering} />
    </dl>
  );
}

/**
 * Renders forsering varsel data
 */
function ForseringVarselView({ data }: { data: any }) {
  return (
    <dl className="divide-y divide-pkt-border-subtle">
      <div className="py-3 bg-pkt-surface-faded-red -mx-4 px-4 mb-2">
        <Badge variant="danger" size="lg">Forsering iverksatt (§33.8)</Badge>
      </div>
      <Field
        label="Estimert kostnad"
        value={
          data.estimert_kostnad
            ? `kr ${data.estimert_kostnad.toLocaleString('nb-NO')},-`
            : undefined
        }
      />
      <Field label="Dato iverksettelse" value={data.dato_iverksettelse} />
      <Field label="Begrunnelse" value={data.begrunnelse} className="col-span-2" />
      <Field
        label="30%-regel bekreftet"
        value={
          data.bekreft_30_prosent ? (
            <Badge variant="success">Ja - innenfor grensen</Badge>
          ) : (
            <Badge variant="danger">Nei</Badge>
          )
        }
      />
      <Field label="Referanse fristkrav" value={data.frist_krav_id} />
    </dl>
  );
}

/**
 * Renders generic/fallback event data
 */
function GenericEventView({ data }: { data: any }) {
  if (!data || typeof data !== 'object') {
    return <p className="text-field-label italic">Ingen skjemadata tilgjengelig.</p>;
  }

  return (
    <dl className="divide-y divide-pkt-border-subtle">
      {Object.entries(data).map(([key, value]) => {
        // Skip complex objects for simple display
        if (typeof value === 'object' && value !== null) {
          return (
            <Field
              key={key}
              label={key}
              value={<pre className="text-xs bg-pkt-grays-gray-100 p-2 rounded overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>}
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

/**
 * Main modal component
 */
export function ViewSubmittedEventModal({
  open,
  onOpenChange,
  event,
}: ViewSubmittedEventModalProps) {
  const eventTypeLabel = event.event_type
    ? EVENT_TYPE_LABELS[event.event_type] || event.type
    : event.type;

  // Determine which view to render based on event_type
  const renderEventData = () => {
    if (!event.event_data) {
      return <p className="text-field-label italic">Ingen detaljert skjemadata tilgjengelig for denne hendelsen.</p>;
    }

    const data = event.event_data;
    const eventType = event.event_type;

    switch (eventType) {
      case 'grunnlag_opprettet':
      case 'grunnlag_oppdatert':
        return <GrunnlagEventView data={data} />;

      case 'vederlag_krav_sendt':
      case 'vederlag_krav_oppdatert':
        return <VederlagEventView data={data} />;

      case 'frist_krav_sendt':
      case 'frist_krav_oppdatert':
        return <FristEventView data={data} />;

      case 'respons_grunnlag':
      case 'respons_grunnlag_oppdatert':
        return <ResponsGrunnlagView data={data} />;

      case 'respons_vederlag':
      case 'respons_vederlag_oppdatert':
        return <ResponsVederlagView data={data} />;

      case 'respons_frist':
      case 'respons_frist_oppdatert':
        return <ResponsFristView data={data} />;

      case 'forsering_varsel':
        return <ForseringVarselView data={data} />;

      default:
        return <GenericEventView data={data} />;
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
      <div className="space-y-4">
        {/* Meta info */}
        <div className="flex items-center justify-between text-sm text-field-label pb-4 border-b">
          <span>
            {format(new Date(event.tidsstempel), 'PPPp', { locale: nb })}
          </span>
          {event.spor && (
            <Badge variant="neutral">{event.spor}</Badge>
          )}
        </div>

        {/* Summary */}
        <div className="bg-pkt-bg-subtle p-4 rounded border border-pkt-border-subtle">
          <p className="text-sm font-medium text-field-value">Sammendrag:</p>
          <p className="mt-1">{event.sammendrag}</p>
        </div>

        {/* Full form data */}
        <div>
          <h4 className="text-sm font-medium text-field-value mb-3">Skjemadata:</h4>
          <div className="bg-pkt-bg-card border border-pkt-border-subtle rounded p-4">
            {renderEventData()}
          </div>
        </div>

        {/* Event ID */}
        <p className="text-xs text-field-muted pt-4 border-t">
          Event ID: {event.event_id}
        </p>
      </div>
    </Modal>
  );
}
