/**
 * EndringsordreRelasjonBanner Component
 *
 * Shows a banner on KOE cases when they are part of an endringsordre (change order).
 * Provides a link to navigate to the endringsordre case.
 */

import { Link } from 'react-router-dom';
import { Alert, Badge } from '../primitives';
import { FileTextIcon, ArrowRightIcon } from '@radix-ui/react-icons';
import type { EOSomRefererer } from '../../api/endringsordre';

interface EndringsordreRelasjonBannerProps {
  endringsordrer: EOSomRefererer[];
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

function getStatusBadge(status: string) {
  switch (status) {
    case 'akseptert':
      return <Badge variant="success" size="sm">Akseptert</Badge>;
    case 'utstedt':
      return <Badge variant="info" size="sm">Utstedt</Badge>;
    case 'bestridt':
      return <Badge variant="warning" size="sm">Bestridt</Badge>;
    case 'revidert':
      return <Badge variant="default" size="sm">Revidert</Badge>;
    default:
      return <Badge variant="default" size="sm">{status}</Badge>;
  }
}

export function EndringsordreRelasjonBanner({ endringsordrer }: EndringsordreRelasjonBannerProps) {
  if (endringsordrer.length === 0) return null;

  return (
    <div className="space-y-3">
      {endringsordrer.map((eo) => (
        <Alert
          key={eo.eo_sak_id}
          variant="info"
          icon={<FileTextIcon className="w-5 h-5" />}
          title={
            <span className="flex items-center gap-2 w-full">
              <span className="truncate">{eo.eo_nummer}</span>
              <span className="ml-auto shrink-0">
                {getStatusBadge(eo.status)}
              </span>
            </span>
          }
        >
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-alert-info-text/80">
              {eo.dato_utstedt ? `Utstedt ${formatDate(eo.dato_utstedt)}` : 'Ikke utstedt'}
            </span>
            <Link
              to={`/endringsordre/${eo.eo_sak_id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-badge-info-text hover:underline"
            >
              Gå til endringsordre
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Alert>
      ))}
    </div>
  );
}
