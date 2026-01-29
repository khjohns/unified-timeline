/**
 * LeggTilRelatertSakModal Component
 *
 * Modal for selecting additional related cases to add to a forsering case.
 * Shows cases with rejected frist that can be included in the forsering.
 */

import { useState, useMemo } from 'react';
import { Alert, Badge, Button, Checkbox, Modal } from '../primitives';
import { PlusIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import type { SakRelasjon } from '../../types/timeline';
import type { KandidatSak } from '../../api/forsering';

interface LeggTilRelatertSakModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cases already related to the forsering */
  eksisterendeRelasjoner: SakRelasjon[];
  /** All available cases with rejected frist */
  kandidatSaker: KandidatSak[];
  /** Callback when cases are selected */
  onLeggTil: (sakIds: string[]) => void;
  isLoading?: boolean;
}

function getAvslatteDager(sak: KandidatSak): number {
  if (!sak.frist_krevd_dager) return 0;

  // If frist is directly rejected
  if (sak.frist_bh_resultat === 'avslatt') {
    return sak.frist_krevd_dager;
  }

  // If frist is partially approved
  if (sak.frist_bh_resultat === 'delvis_godkjent') {
    return sak.frist_krevd_dager - (sak.frist_godkjent_dager || 0);
  }

  // If grunnlag is rejected, frist is effectively denied (even if BH agrees subsidiarily)
  // Per NS 8407 §33.8 - forsering is relevant when BH rejects grunnlag
  if (sak.grunnlag_bh_resultat === 'avslatt') {
    return sak.frist_krevd_dager;
  }

  return 0;
}

function getStatusBadge(sak: KandidatSak): { variant: 'danger' | 'warning'; label: string } {
  if (sak.grunnlag_bh_resultat === 'avslatt') {
    return { variant: 'danger', label: 'Ansvarsgrunnlag avslått' };
  }
  if (sak.frist_bh_resultat === 'avslatt') {
    return { variant: 'danger', label: 'Frist avslått' };
  }
  if (sak.frist_bh_resultat === 'delvis_godkjent') {
    return { variant: 'warning', label: 'Frist delvis' };
  }
  return { variant: 'danger', label: 'Avslått' };
}

export function LeggTilRelatertSakModal({
  open,
  onOpenChange,
  eksisterendeRelasjoner,
  kandidatSaker,
  onLeggTil,
  isLoading = false,
}: LeggTilRelatertSakModalProps) {
  const [valgteSaker, setValgteSaker] = useState<Set<string>>(new Set());
  const [sokeTekst, setSokeTekst] = useState('');

  // Filter out already related cases
  const eksisterendeIds = useMemo(
    () => new Set(eksisterendeRelasjoner.map((r) => r.relatert_sak_id)),
    [eksisterendeRelasjoner]
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
          sak.sakstittel.toLowerCase().includes(sokeOrd)
        );
      });
  }, [kandidatSaker, eksisterendeIds, sokeTekst]);

  // Calculate total rejected days for selected cases
  const totalAvslatteDager = useMemo(() => {
    return filtrerteKandidater
      .filter((sak) => valgteSaker.has(sak.sak_id))
      .reduce((sum, sak) => sum + getAvslatteDager(sak), 0);
  }, [filtrerteKandidater, valgteSaker]);

  const handleToggle = (sakId: string) => {
    setValgteSaker((prev) => {
      const next = new Set(prev);
      if (next.has(sakId)) {
        next.delete(sakId);
      } else {
        next.add(sakId);
      }
      return next;
    });
  };

  const handleLeggTil = () => {
    onLeggTil(Array.from(valgteSaker));
    setValgteSaker(new Set());
    setSokeTekst('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setValgteSaker(new Set());
    setSokeTekst('');
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Legg til relaterte saker"
      size="lg"
    >
      <div className="space-y-3 sm:space-y-4">
        {/* Info */}
        <Alert variant="info" title="Velg saker med avslått fristforlengelse">
          Velg én eller flere saker som skal inngå i forseringsgrunnlaget.
          Kun saker med avslått eller delvis godkjent frist vises.
        </Alert>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pkt-text-body-subtle" />
          <input
            type="text"
            placeholder="Søk etter sak-ID eller tittel..."
            value={sokeTekst}
            onChange={(e) => setSokeTekst(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-pkt-bg-card border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus"
          />
        </div>

        {/* Case list */}
        {filtrerteKandidater.length === 0 ? (
          <div className="py-8 text-center text-pkt-text-body-subtle">
            <p>Ingen tilgjengelige saker funnet.</p>
            {sokeTekst && (
              <p className="text-sm mt-1">Prøv et annet søkeord.</p>
            )}
          </div>
        ) : (
          <div className="border border-pkt-border-default rounded-none max-h-80 overflow-y-auto">
            <ul className="divide-y divide-pkt-border-subtle">
              {filtrerteKandidater.map((sak) => {
                const avslatteDager = getAvslatteDager(sak);
                const erValgt = valgteSaker.has(sak.sak_id);

                return (
                  <li
                    key={sak.sak_id}
                    className={`p-3 cursor-pointer transition-colors ${
                      erValgt
                        ? 'bg-pkt-surface-subtle'
                        : 'hover:bg-pkt-surface-subtle/50'
                    }`}
                    onClick={() => handleToggle(sak.sak_id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={erValgt}
                        onCheckedChange={() => handleToggle(sak.sak_id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-pkt-text-body-subtle">
                            {sak.sak_id}
                          </span>
                          {(() => {
                            const status = getStatusBadge(sak);
                            return <Badge variant={status.variant}>{status.label}</Badge>;
                          })()}
                        </div>
                        <p className="text-sm font-medium truncate mt-1">
                          {sak.sakstittel}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-pkt-text-body-subtle">
                          {sak.grunnlag_hovedkategori && (
                            <span>{sak.grunnlag_hovedkategori}</span>
                          )}
                          <span className="font-medium text-pkt-brand-red-1000">
                            {avslatteDager} dager avslått
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Summary */}
        {valgteSaker.size > 0 && (
          <div className="p-3 bg-pkt-surface-subtle border border-pkt-border-default rounded-none">
            <div className="flex justify-between items-center">
              <span className="text-sm">
                <strong>{valgteSaker.size}</strong> sak(er) valgt
              </span>
              <span className="text-sm font-bold text-pkt-brand-red-1000">
                +{totalAvslatteDager} dager
              </span>
            </div>
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
            disabled={valgteSaker.size === 0 || isLoading}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            {isLoading ? 'Legger til...' : `Legg til ${valgteSaker.size} sak(er)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
