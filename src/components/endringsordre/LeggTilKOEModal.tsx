/**
 * LeggTilKOEModal Component
 *
 * Modal for selecting KOE cases to add to an endringsordre.
 * Shows candidate KOE cases that can be included in the EO.
 */

import { useState, useMemo } from 'react';
import { Alert, Badge, Button, Checkbox, Modal } from '../primitives';
import { PlusIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import type { KandidatKOE } from '../../api/endringsordre';

interface LeggTilKOEModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** KOE case IDs already related to the EO */
  eksisterendeKOE: string[];
  /** All available KOE candidate cases */
  kandidatSaker: KandidatKOE[];
  /** Callback when a case is selected */
  onLeggTil: (sakId: string) => void;
  isLoading?: boolean;
}

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

function getStatusBadge(status: string): { variant: 'success' | 'warning' | 'default'; label: string } {
  switch (status) {
    case 'godkjent':
      return { variant: 'success', label: 'Godkjent' };
    case 'delvis_godkjent':
      return { variant: 'warning', label: 'Delvis godkjent' };
    case 'under_behandling':
      return { variant: 'default', label: 'Under behandling' };
    default:
      return { variant: 'default', label: status };
  }
}

export function LeggTilKOEModal({
  open,
  onOpenChange,
  eksisterendeKOE,
  kandidatSaker,
  onLeggTil,
  isLoading = false,
}: LeggTilKOEModalProps) {
  const [valgtSak, setValgtSak] = useState<string | null>(null);
  const [sokeTekst, setSokeTekst] = useState('');

  // Filter out already related cases
  const eksisterendeIds = useMemo(
    () => new Set(eksisterendeKOE),
    [eksisterendeKOE]
  );

  // Filter candidates by search and exclude existing
  const filtrerteKandidater = useMemo(() => {
    return kandidatSaker
      .filter((sak) => !eksisterendeIds.has(sak.sak_id))
      .filter((sak) => {
        if (!sokeTekst) return true;
        const sokeOrd = sokeTekst.toLowerCase();
        return (
          sak.sak_id.toLowerCase().includes(sokeOrd) ||
          sak.tittel.toLowerCase().includes(sokeOrd)
        );
      });
  }, [kandidatSaker, eksisterendeIds, sokeTekst]);

  const handleSelect = (sakId: string) => {
    setValgtSak(sakId === valgtSak ? null : sakId);
  };

  const handleLeggTil = () => {
    if (valgtSak) {
      onLeggTil(valgtSak);
      setValgtSak(null);
      setSokeTekst('');
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    setValgtSak(null);
    setSokeTekst('');
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Legg til KOE-sak"
      size="lg"
    >
      <div className="space-y-4">
        {/* Info */}
        <Alert variant="info" title="Velg KOE-sak">
          Velg en KOE-sak som skal inkluderes i endringsordren.
          Kun saker med godkjent eller delvis godkjent grunnlag vises.
        </Alert>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pkt-text-body-subtle" />
          <input
            type="text"
            placeholder="Sok etter sak-ID eller tittel..."
            value={sokeTekst}
            onChange={(e) => setSokeTekst(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-pkt-bg-card border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus"
          />
        </div>

        {/* Case list */}
        {filtrerteKandidater.length === 0 ? (
          <div className="py-8 text-center text-pkt-text-body-subtle">
            <p>Ingen tilgjengelige KOE-saker funnet.</p>
            {sokeTekst && (
              <p className="text-sm mt-1">Prov et annet sokeord.</p>
            )}
          </div>
        ) : (
          <div className="border border-pkt-border-default rounded-none max-h-80 overflow-y-auto">
            <ul className="divide-y divide-pkt-border-subtle">
              {filtrerteKandidater.map((sak) => {
                const erValgt = valgtSak === sak.sak_id;

                return (
                  <li
                    key={sak.sak_id}
                    className={`p-3 cursor-pointer transition-colors ${
                      erValgt
                        ? 'bg-pkt-surface-subtle'
                        : 'hover:bg-pkt-surface-subtle/50'
                    }`}
                    onClick={() => handleSelect(sak.sak_id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={erValgt}
                        onCheckedChange={() => handleSelect(sak.sak_id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-pkt-text-body-subtle">
                            {sak.sak_id}
                          </span>
                          {(() => {
                            const status = getStatusBadge(sak.overordnet_status);
                            return <Badge variant={status.variant}>{status.label}</Badge>;
                          })()}
                        </div>
                        <p className="text-sm font-medium truncate mt-1">
                          {sak.tittel}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-pkt-text-body-subtle">
                          {sak.sum_godkjent !== undefined && (
                            <span>Godkjent: {formatCurrency(sak.sum_godkjent)}</span>
                          )}
                          {sak.godkjent_dager !== undefined && (
                            <span>{sak.godkjent_dager} dager godkjent</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t-2 border-pkt-border-subtle">
          <Button variant="ghost" onClick={handleClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            onClick={handleLeggTil}
            disabled={!valgtSak || isLoading}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            {isLoading ? 'Legger til...' : 'Legg til'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
