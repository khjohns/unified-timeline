/**
 * EndringsordreRelasjonBanner Component
 *
 * Shows a banner on KOE cases when they are part of an endringsordre (change order).
 * Provides a link to navigate to the endringsordre case.
 */

import { Link } from 'react-router-dom';
import { Alert } from '../primitives/Alert';
import { Badge } from '../primitives/Badge';
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
          title={
            <span className="flex items-center gap-2">
              <FileTextIcon className="w-4 h-4" />
              Denne saken er del av en endringsordre
            </span>
          }
        >
          <div className="mt-2 space-y-3">
            {/* EO info */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{eo.eo_nummer}</span>
              {getStatusBadge(eo.status)}
            </div>

            {eo.dato_utstedt && (
              <div className="flex items-center gap-2 text-sm">
                <span>Utstedt:</span>
                <Badge variant="default" size="sm">{formatDate(eo.dato_utstedt)}</Badge>
              </div>
            )}

            {/* Link to endringsordre */}
            <Link
              to={`/endringsordre/${eo.eo_sak_id}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-badge-info-text bg-badge-info-bg hover:opacity-90 rounded transition-colors"
            >
              <span>Gå til endringsordre</span>
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </Alert>
      ))}
    </div>
  );
}
