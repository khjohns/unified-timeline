/**
 * EODashboard Component
 *
 * Status dashboard for endringsordre cases.
 * Uses DashboardCard and DataList for consistent styling with ForseringDashboard.
 */

import { Badge, Button, DashboardCard, DataList, DataListItem } from '../primitives';
import {
  CheckCircledIcon,
  CrossCircledIcon,
  Pencil1Icon,
} from '@radix-ui/react-icons';
import type { EndringsordreData, EOStatus, EOKonsekvenser, VederlagsMetode } from '../../types/timeline';

interface EODashboardProps {
  eoData: EndringsordreData;
  userRole: 'TE' | 'BH';
  onAksepter?: () => void;
  onBestrid?: () => void;
  onRevider?: () => void;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

function getStatusBadge(status: EOStatus) {
  const variants: Record<EOStatus, { variant: 'default' | 'success' | 'warning' | 'danger'; label: string }> = {
    utkast: { variant: 'default', label: 'Utkast' },
    utstedt: { variant: 'warning', label: 'Utstedt' },
    akseptert: { variant: 'success', label: 'Akseptert' },
    bestridt: { variant: 'danger', label: 'Bestridt' },
    revidert: { variant: 'warning', label: 'Revidert' },
  };

  const { variant, label } = variants[status] || variants.utkast;
  return <Badge variant={variant} size="sm">{label}</Badge>;
}

function getOppgjorsformLabel(metode?: VederlagsMetode): string {
  const labels: Record<VederlagsMetode, string> = {
    ENHETSPRISER: 'Enhetspriser (§34.3)',
    REGNINGSARBEID: 'Regningsarbeid (§30.2/§34.4)',
    FASTPRIS_TILBUD: 'Fastpris / Tilbud (§34.2.1)',
  };
  return metode ? labels[metode] || metode : '-';
}

function KonsekvensChips({ konsekvenser }: { konsekvenser: EOKonsekvenser }) {
  const aktive: string[] = [];
  if (konsekvenser.sha) aktive.push('SHA');
  if (konsekvenser.kvalitet) aktive.push('Kvalitet');
  if (konsekvenser.fremdrift) aktive.push('Fremdrift');
  if (konsekvenser.pris) aktive.push('Pris');
  if (konsekvenser.annet) aktive.push('Annet');

  if (aktive.length === 0) {
    return <span className="text-pkt-text-body-subtle">Ingen</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {aktive.map((k) => (
        <Badge key={k} variant="default" size="sm">{k}</Badge>
      ))}
    </div>
  );
}

export function EODashboard({
  eoData,
  userRole,
  onAksepter,
  onBestrid,
  onRevider,
}: EODashboardProps) {
  const kanAkseptere = userRole === 'TE' && eoData.status === 'utstedt';
  const kanBestride = userRole === 'TE' && eoData.status === 'utstedt';
  const kanRevidere = userRole === 'BH' && eoData.status === 'bestridt';

  const harPriskonsekvens = eoData.konsekvenser.pris || (eoData.netto_belop !== undefined && eoData.netto_belop !== 0);
  const harFristkonsekvens = eoData.konsekvenser.fremdrift || (eoData.frist_dager !== undefined && eoData.frist_dager > 0);

  return (
    <div className="space-y-4">
      {/* Status and Details cards side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Status card */}
        <DashboardCard
          title={`Endringsordre ${eoData.eo_nummer}`}
          headerBadge={getStatusBadge(eoData.status)}
          action={(kanAkseptere || kanBestride) && (
            <div className="flex flex-wrap gap-2">
              {kanAkseptere && onAksepter && (
                <Button variant="primary" size="sm" onClick={onAksepter} className="flex-1">
                  <CheckCircledIcon className="w-4 h-4 mr-1" />
                  Aksepter
                </Button>
              )}
              {kanBestride && onBestrid && (
                <Button variant="secondary" size="sm" onClick={onBestrid} className="flex-1">
                  <CrossCircledIcon className="w-4 h-4 mr-1" />
                  Bestrid
                </Button>
              )}
            </div>
          )}
        >
          <DataList>
            <DataListItem label="Dato utstedt">
              {formatDate(eoData.dato_utstedt)}
            </DataListItem>
            {eoData.utstedt_av && (
              <DataListItem label="Utstedt av">
                {eoData.utstedt_av}
              </DataListItem>
            )}
            {eoData.revisjon_nummer > 0 && (
              <DataListItem label="Revisjon">
                {eoData.revisjon_nummer}
              </DataListItem>
            )}
            <DataListItem label="Konsekvenser">
              <KonsekvensChips konsekvenser={eoData.konsekvenser} />
            </DataListItem>
          </DataList>
        </DashboardCard>

        {/* Economic summary card */}
        <DashboardCard
          title="Oppgjør"
          headerBadge={harPriskonsekvens && eoData.netto_belop !== undefined && (
            <Badge
              variant={eoData.netto_belop >= 0 ? 'success' : 'danger'}
              size="sm"
            >
              {eoData.netto_belop >= 0 ? '+' : ''}{formatCurrency(eoData.netto_belop)}
            </Badge>
          )}
        >
          <DataList>
            {harPriskonsekvens && (
              <>
                <DataListItem label="Beregningsmetode">
                  {getOppgjorsformLabel(eoData.oppgjorsform)}
                </DataListItem>
                {eoData.kompensasjon_belop !== undefined && eoData.kompensasjon_belop > 0 && (
                  <DataListItem label="Kompensasjon">
                    <span className="text-pkt-brand-dark-green-1000 font-bold">
                      + {formatCurrency(eoData.kompensasjon_belop)}
                    </span>
                    {eoData.er_estimat && <span className="text-pkt-text-body-subtle ml-1">(estimat)</span>}
                  </DataListItem>
                )}
                {eoData.fradrag_belop !== undefined && eoData.fradrag_belop > 0 && (
                  <DataListItem label="Fradrag">
                    <span className="text-pkt-brand-red-1000 font-bold">
                      - {formatCurrency(eoData.fradrag_belop)}
                    </span>
                  </DataListItem>
                )}
              </>
            )}
            {harFristkonsekvens && (
              <DataListItem label="Fristforlengelse">
                <span className="font-bold">{eoData.frist_dager || 0} dager</span>
                {eoData.ny_sluttdato && (
                  <span className="text-pkt-text-body-subtle ml-1">
                    (ny sluttdato: {formatDate(eoData.ny_sluttdato)})
                  </span>
                )}
              </DataListItem>
            )}
            {!harPriskonsekvens && !harFristkonsekvens && (
              <DataListItem label="Status">
                <span className="text-pkt-text-body-subtle">Ingen økonomiske konsekvenser</span>
              </DataListItem>
            )}
          </DataList>
        </DashboardCard>
      </div>

      {/* Description card - full width */}
      {eoData.beskrivelse && (
        <DashboardCard
          title="Beskrivelse"
          action={kanRevidere && onRevider && (
            <Button variant="primary" size="sm" onClick={onRevider} className="w-full">
              <Pencil1Icon className="w-4 h-4 mr-2" />
              Revider EO
            </Button>
          )}
        >
          <p className="text-sm">{eoData.beskrivelse}</p>
          {eoData.konsekvens_beskrivelse && (
            <p className="text-sm text-pkt-text-body-subtle mt-2">
              {eoData.konsekvens_beskrivelse}
            </p>
          )}
        </DashboardCard>
      )}

      {/* TE Response card - only show if TE has responded */}
      {eoData.te_akseptert !== undefined && (
        <DashboardCard
          title="Totalentreprenørens respons"
          headerBadge={
            <Badge variant={eoData.te_akseptert ? 'success' : 'danger'} size="sm">
              {eoData.te_akseptert ? 'Akseptert' : 'Bestridt'}
            </Badge>
          }
        >
          {eoData.te_kommentar ? (
            <p className="text-sm">{eoData.te_kommentar}</p>
          ) : (
            <p className="text-sm text-pkt-text-body-subtle">
              {eoData.te_akseptert ? 'Endringsordren er akseptert.' : 'Endringsordren er bestridt.'}
            </p>
          )}
        </DashboardCard>
      )}
    </div>
  );
}
