/**
 * RelaterteSakerListe Component
 *
 * Displays a list of related cases for a forsering case.
 * Each case is clickable and shows key status info.
 */

import { Link } from 'react-router-dom';
import { Card } from '../primitives/Card';
import { Badge } from '../primitives/Badge';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import type { SakRelasjon, SakState } from '../../types/timeline';

interface RelatertSakInfo extends SakRelasjon {
  state?: SakState;
}

interface RelaterteSakerListeProps {
  relaterteSaker: RelatertSakInfo[];
  sakStates?: Record<string, SakState>;
}

function getGrunnlagBadge(state?: SakState) {
  if (!state?.grunnlag?.bh_resultat) return null;

  const variants: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
    godkjent: 'success',
    delvis_godkjent: 'warning',
    avslatt: 'danger',
    erkjenn_fm: 'success',
  };

  const labels: Record<string, string> = {
    godkjent: 'Grunnlag godkjent',
    delvis_godkjent: 'Grunnlag delvis',
    avslatt: 'Grunnlag avslått',
    erkjenn_fm: 'Force Majeure',
  };

  const variant = variants[state.grunnlag.bh_resultat] || 'default';
  const label = labels[state.grunnlag.bh_resultat] || state.grunnlag.bh_resultat;

  return <Badge variant={variant} size="sm">{label}</Badge>;
}

function getFristBadge(state?: SakState) {
  if (!state?.frist?.bh_resultat) return null;

  const variants: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
    godkjent: 'success',
    delvis_godkjent: 'warning',
    avslatt: 'danger',
  };

  const labels: Record<string, string> = {
    godkjent: 'Frist godkjent',
    delvis_godkjent: 'Frist delvis',
    avslatt: 'Frist avslått',
  };

  const variant = variants[state.frist.bh_resultat] || 'default';
  const label = labels[state.frist.bh_resultat] || state.frist.bh_resultat;

  return <Badge variant={variant} size="sm">{label}</Badge>;
}

export function RelaterteSakerListe({ relaterteSaker, sakStates = {} }: RelaterteSakerListeProps) {
  if (relaterteSaker.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-pkt-text-body-subtle text-sm">
          Ingen relaterte saker funnet.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 bg-pkt-surface-subtle border-b-2 border-pkt-border-subtle">
        <h3 className="font-bold text-sm">
          Relaterte saker ({relaterteSaker.length})
        </h3>
        <p className="text-xs text-pkt-text-body-subtle mt-1">
          Avslåtte fristforlengelser som forseringen er basert på
        </p>
      </div>

      <ul className="divide-y-2 divide-pkt-border-subtle">
        {relaterteSaker.map((sak) => {
          const state = sakStates[sak.relatert_sak_id] || sak.state;

          return (
            <li key={sak.relatert_sak_id}>
              <Link
                to={`/sak/${sak.relatert_sak_id}`}
                className="block p-4 hover:bg-pkt-surface-subtle transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title and number */}
                    <div className="flex items-center gap-2">
                      {sak.bimsync_issue_number && (
                        <span className="text-xs font-mono text-pkt-text-body-subtle">
                          #{sak.bimsync_issue_number}
                        </span>
                      )}
                      <span className="font-medium truncate">
                        {sak.relatert_sak_tittel || state?.sakstittel || 'Ukjent sak'}
                      </span>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {getGrunnlagBadge(state)}
                      {getFristBadge(state)}
                      {state?.frist?.krevd_dager && (
                        <Badge variant="default" size="sm">
                          {state.frist.krevd_dager} dager krevd
                        </Badge>
                      )}
                    </div>

                    {/* Grunnlag category if available */}
                    {state?.grunnlag?.hovedkategori && (
                      <p className="text-xs text-pkt-text-body-subtle mt-2">
                        {state.grunnlag.hovedkategori}
                      </p>
                    )}
                  </div>

                  {/* Link icon */}
                  <ExternalLinkIcon className="w-4 h-4 text-pkt-text-body-subtle group-hover:text-pkt-text-brand transition-colors flex-shrink-0 mt-1" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
