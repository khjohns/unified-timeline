/**
 * RevisionHistory Component
 *
 * Displays revision history for each track with categorical grouping.
 * Shows TE claims and BH responses in a clear, scannable format.
 */

import { useParams } from 'react-router-dom';
import { StackIcon, ClockIcon, ReloadIcon } from '@radix-ui/react-icons';
import { Card } from '../primitives';
import {
  useHistorikk,
  getTeEntries,
  getBhEntries,
  formatHistorikkBelop,
  formatHistorikkDager,
  formatRevisionDate,
} from '../../hooks/useRevisionHistory';
import { VederlagHistorikkEntry, FristHistorikkEntry } from '../../types/api';

export function RevisionHistory() {
  const { sakId } = useParams<{ sakId: string }>();
  const { vederlag, frist, isLoading, error, refetch } = useHistorikk(sakId || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-pkt-bg-subtle border border-pkt-grays-gray-300">
        <ReloadIcon className="w-5 h-5 animate-spin mr-2 text-pkt-grays-gray-500" />
        <span className="text-pkt-grays-gray-600">Laster revisjonshistorikk...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-pkt-surface-subtle-light-red border border-pkt-border-red">
        <p className="text-pkt-brand-red-1000 mb-2">Kunne ikke laste revisjonshistorikk</p>
        <button
          onClick={refetch}
          className="text-sm text-pkt-brand-red-1000 hover:underline flex items-center justify-center gap-1 mx-auto"
        >
          <ReloadIcon className="w-4 h-4" />
          Prøv igjen
        </button>
      </div>
    );
  }

  const hasVederlag = vederlag.length > 0;
  const hasFrist = frist.length > 0;

  if (!hasVederlag && !hasFrist) {
    return (
      <div className="text-center p-8 bg-pkt-bg-subtle border border-pkt-grays-gray-300">
        <p className="text-pkt-grays-gray-600">Ingen krav er fremsatt ennå.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {hasVederlag && <VederlagHistorikkTable entries={vederlag} />}
      {hasFrist && <FristHistorikkTable entries={frist} />}
    </div>
  );
}

/** Format version label - 0 = Opprinnelig, 1+ = Rev. N */
function formatVersionLabel(version: number): string {
  return version === 0 ? 'Opprinnelig' : `Rev. ${version}`;
}

// ============ VEDERLAG TABLE ============

interface VederlagHistorikkTableProps {
  entries: VederlagHistorikkEntry[];
}

function VederlagHistorikkTable({ entries }: VederlagHistorikkTableProps) {
  const teEntries = getTeEntries(entries);
  const bhEntries = getBhEntries(entries);

  // Get unique versions for columns, sorted
  const versions = [...new Set(teEntries.map((e) => e.versjon))].sort((a, b) => a - b);

  // Map entries by version for quick lookup
  const teByVersion = new Map<number, VederlagHistorikkEntry>();
  for (const te of teEntries) {
    teByVersion.set(te.versjon, te);
  }

  const bhByVersion = new Map<number, VederlagHistorikkEntry>();
  for (const bh of bhEntries) {
    bhByVersion.set(bh.versjon, bh);
  }

  return (
    <Card className="p-3 overflow-x-auto">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-pkt-text-body-default mb-3">
        <StackIcon className="w-4 h-4" />
        Vederlag
      </h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-pkt-border-subtle">
            <th className="sticky left-0 z-10 bg-pkt-bg-card text-left py-1.5 px-2 font-medium w-[160px]">
              Felt
            </th>
            {versions.map((v) => {
              const te = teByVersion.get(v);
              return (
                <th key={v} className="text-center py-1.5 px-2 min-w-[140px]">
                  <div className="font-semibold text-pkt-text-body-default">
                    {formatVersionLabel(v)}
                  </div>
                  <div className="text-xs text-pkt-grays-gray-500 font-normal mt-0.5">
                    {te && formatRevisionDate(te.tidsstempel)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {/* KRAV (TE) Section */}
          <GroupHeader label="Krav (TE)" colSpan={versions.length + 1} color="green" />
          <DataRow
            label="Beløp"
            versions={versions}
            getValue={(v) => formatHistorikkBelop(teByVersion.get(v)?.krav_belop)}
            isNumeric
          />
          <DataRow
            label="Beregningsmetode"
            versions={versions}
            getValue={(v) => teByVersion.get(v)?.metode_label || '—'}
          />
          <DataRow
            label="Rigg/drift"
            versions={versions}
            getValue={(v) => {
              const te = teByVersion.get(v);
              return te?.inkluderer_rigg_drift ? '✓' : '—';
            }}
          />
          <DataRow
            label="Produktivitetstap"
            versions={versions}
            getValue={(v) => {
              const te = teByVersion.get(v);
              return te?.inkluderer_produktivitet ? '✓' : '—';
            }}
          />

          {/* RESPONS (BH) Section */}
          <GroupHeader label="Respons (BH)" colSpan={versions.length + 1} color="yellow" />
          <DataRow
            label="Resultat"
            versions={versions}
            getValue={(v) => bhByVersion.get(v)?.bh_resultat_label || '—'}
            highlight
          />
          <DataRow
            label="Godkjent beløp"
            versions={versions}
            getValue={(v) => formatHistorikkBelop(bhByVersion.get(v)?.godkjent_belop)}
            highlight
            isNumeric
            isApproved
          />
        </tbody>
      </table>
    </Card>
  );
}

// ============ FRIST TABLE ============

interface FristHistorikkTableProps {
  entries: FristHistorikkEntry[];
}

function FristHistorikkTable({ entries }: FristHistorikkTableProps) {
  const teEntries = getTeEntries(entries);
  const bhEntries = getBhEntries(entries);

  // Get unique versions for columns, sorted
  const versions = [...new Set(teEntries.map((e) => e.versjon))].sort((a, b) => a - b);

  // Map entries by version for quick lookup
  const teByVersion = new Map<number, FristHistorikkEntry>();
  for (const te of teEntries) {
    teByVersion.set(te.versjon, te);
  }

  const bhByVersion = new Map<number, FristHistorikkEntry>();
  for (const bh of bhEntries) {
    bhByVersion.set(bh.versjon, bh);
  }

  return (
    <Card className="p-3 overflow-x-auto">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-pkt-text-body-default mb-3">
        <ClockIcon className="w-4 h-4" />
        Frist
      </h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-pkt-border-subtle">
            <th className="sticky left-0 z-10 bg-pkt-bg-card text-left py-1.5 px-2 font-medium w-[160px]">
              Felt
            </th>
            {versions.map((v) => {
              const te = teByVersion.get(v);
              return (
                <th key={v} className="text-center py-1.5 px-2 min-w-[140px]">
                  <div className="font-semibold text-pkt-text-body-default">
                    {formatVersionLabel(v)}
                  </div>
                  <div className="text-xs text-pkt-grays-gray-500 font-normal mt-0.5">
                    {te && formatRevisionDate(te.tidsstempel)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {/* KRAV (TE) Section */}
          <GroupHeader label="Krav (TE)" colSpan={versions.length + 1} color="green" />
          <DataRow
            label="Antall dager"
            versions={versions}
            getValue={(v) => formatHistorikkDager(teByVersion.get(v)?.krav_dager)}
            isNumeric
          />
          <DataRow
            label="Varseltype"
            versions={versions}
            getValue={(v) => teByVersion.get(v)?.varsel_type_label || '—'}
          />
          <DataRow
            label="Ny sluttdato"
            versions={versions}
            getValue={(v) => teByVersion.get(v)?.ny_sluttdato || '—'}
          />

          {/* RESPONS (BH) Section */}
          <GroupHeader label="Respons (BH)" colSpan={versions.length + 1} color="yellow" />
          <DataRow
            label="Resultat"
            versions={versions}
            getValue={(v) => bhByVersion.get(v)?.bh_resultat_label || '—'}
            highlight
          />
          <DataRow
            label="Godkjent dager"
            versions={versions}
            getValue={(v) => formatHistorikkDager(bhByVersion.get(v)?.godkjent_dager)}
            highlight
            isNumeric
            isApproved
          />
        </tbody>
      </table>
    </Card>
  );
}

// ============ SHARED COMPONENTS ============

interface GroupHeaderProps {
  label: string;
  colSpan: number;
  color: 'green' | 'yellow';
}

function GroupHeader({ label, colSpan, color }: GroupHeaderProps) {
  // Simplified design: left border accent only, no background
  const borderColor = color === 'green' ? 'border-l-row-te-border' : 'border-l-row-bh-border';

  return (
    <tr>
      <td
        className={`sticky left-0 z-10 bg-pkt-bg-card py-1.5 px-2 text-xs font-semibold uppercase tracking-wide border-y border-pkt-border-subtle border-l-4 ${borderColor}`}
      >
        {label}
      </td>
      <td
        colSpan={colSpan - 1}
        className="py-1.5 px-2 border-y border-pkt-border-subtle"
      />
    </tr>
  );
}

interface DataRowProps {
  label: string;
  versions: number[];
  getValue: (version: number) => string;
  highlight?: boolean;
  /** Use monospace font for numeric values */
  isNumeric?: boolean;
  /** Use green color for positive/approved values */
  isApproved?: boolean;
}

function DataRow({ label, versions, getValue, highlight = false, isNumeric = false, isApproved = false }: DataRowProps) {
  let prevValue: string | null = null;

  return (
    <tr className="border-b border-pkt-border-subtle last:border-b-0 hover:bg-pkt-surface-subtle transition-colors">
      <td className="sticky left-0 z-10 bg-pkt-bg-card py-2 px-2 text-pkt-grays-gray-600">
        {label}
      </td>
      {versions.map((v) => {
        const value = getValue(v);
        const isChanged = prevValue !== null && value !== prevValue && value !== '—';
        prevValue = value;

        // Build class string
        const baseClasses = 'py-2 px-2 text-center';
        const fontClasses = isNumeric ? 'font-mono' : '';
        const weightClasses = highlight ? 'font-semibold' : '';
        const colorClasses = isChanged
          ? 'text-pkt-brand-warm-blue-1000 font-bold'
          : isApproved && value !== '—'
          ? 'text-pkt-brand-dark-green-1000'
          : 'text-pkt-text-body-default';

        return (
          <td
            key={v}
            className={`${baseClasses} ${fontClasses} ${weightClasses} ${colorClasses}`}
          >
            {value}
          </td>
        );
      })}
    </tr>
  );
}
