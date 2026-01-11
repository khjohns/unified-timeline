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
          icon={<RocketIcon className="w-5 h-5" />}
          title={
            <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 w-full min-w-0">
              <span className="truncate">{forsering.forsering_sak_tittel}</span>
              <span className="shrink-0 sm:ml-auto">
                {forsering.er_iverksatt && !forsering.er_stoppet && (
                  <Badge variant="success">Iverksatt</Badge>
                )}
                {forsering.er_stoppet && (
                  <Badge variant="warning">Stoppet</Badge>
                )}
              </span>
            </span>
          }
          footer={
            <>
              <span className="text-alert-info-text/80">
                Varslet {formatDate(forsering.dato_varslet)}
              </span>
              <Link
                to={`/forsering/${forsering.forsering_sak_id}`}
                className="inline-flex items-center gap-1.5 font-medium text-badge-info-text hover:underline"
              >
                Gå til forseringssak
                <ArrowRightIcon className="w-3.5 h-3.5" />
              </Link>
            </>
          }
        />
      ))}
    </div>
  );
}
