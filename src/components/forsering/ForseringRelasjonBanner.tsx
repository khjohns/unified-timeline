/**
 * ForseringRelasjonBanner Component
 *
 * Shows a banner on standard cases when they are part of a forsering case.
 * Provides a link to navigate to the forsering case.
 */

import { Link } from 'react-router-dom';
import { Alert, Badge } from '../primitives';
import { RocketIcon, ArrowRightIcon } from '@radix-ui/react-icons';
import type { ForseringSomRefererer } from '../../api/forsering';

interface ForseringRelasjonBannerProps {
  forseringer: ForseringSomRefererer[];
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

export function ForseringRelasjonBanner({ forseringer }: ForseringRelasjonBannerProps) {
  if (forseringer.length === 0) return null;

  return (
    <div className="space-y-3">
      {forseringer.map((forsering) => (
        <Alert
          key={forsering.forsering_sak_id}
          variant="info"
          title={
            <span className="flex items-center gap-2">
              <RocketIcon className="w-4 h-4" />
              Denne saken inngår i en forseringssak
            </span>
          }
          action={
            <Link
              to={`/forsering/${forsering.forsering_sak_id}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-badge-info-text bg-badge-info-bg hover:opacity-90 rounded transition-colors"
            >
              <span>Gå til forseringssak</span>
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          }
        >
          <div className="mt-1 space-y-2">
            {/* Forsering info */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{forsering.forsering_sak_tittel}</span>
              {forsering.er_iverksatt && !forsering.er_stoppet && (
                <Badge variant="success" size="sm">Iverksatt</Badge>
              )}
              {forsering.er_stoppet && (
                <Badge variant="warning" size="sm">Stoppet</Badge>
              )}
              {!forsering.er_iverksatt && !forsering.er_stoppet && (
                <Badge variant="default" size="sm">Varslet</Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span>Varslet:</span>
              <Badge variant="default" size="sm">{formatDate(forsering.dato_varslet)}</Badge>
            </div>
          </div>
        </Alert>
      ))}
    </div>
  );
}
