/**
 * RelaterteSakerCard - Compact card showing related forsering and endringsordre cases.
 *
 * Replaces the full-width Alert banners with a bento-integrated card
 * in the left column (above BimCard).
 */

import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { RocketIcon, FileTextIcon, ArrowRightIcon } from '@radix-ui/react-icons';
import { Badge } from '../primitives';
import type { ForseringSomRefererer } from '../../api/forsering';
import type { EOSomRefererer } from '../../api/endringsordre';

interface RelaterteSakerCardProps {
  forseringer: ForseringSomRefererer[];
  endringsordrer: EOSomRefererer[];
  className?: string;
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

function getEOStatusBadge(status: string) {
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

export function RelaterteSakerCard({ forseringer, endringsordrer, className }: RelaterteSakerCardProps) {
  const hasAny = forseringer.length > 0 || endringsordrer.length > 0;

  if (!hasAny) return null;

  return (
    <div className={clsx('bg-pkt-bg-card rounded', className)}>
      <div className="px-3 py-2 border-b border-pkt-border-subtle">
        <h3 className="text-xs font-semibold text-pkt-text-body-subtle uppercase tracking-wide">
          Relaterte saker
        </h3>
      </div>
      <div className="divide-y divide-pkt-border-subtle">
        {endringsordrer.map((eo) => (
          <Link
            key={eo.eo_sak_id}
            to={`/endringsordre/${eo.eo_sak_id}`}
            className="flex items-center gap-2 px-3 py-2.5 hover:bg-pkt-bg-subtle transition-colors group"
          >
            <FileTextIcon className="w-4 h-4 text-badge-info-text shrink-0" />
            <span className="text-sm font-medium text-pkt-text-body-default truncate">
              {eo.eo_nummer}
            </span>
            {getEOStatusBadge(eo.status)}
            {eo.dato_utstedt && (
              <span className="text-xs text-pkt-text-body-subtle hidden sm:inline ml-auto shrink-0">
                {formatDate(eo.dato_utstedt)}
              </span>
            )}
            <ArrowRightIcon className="w-3.5 h-3.5 text-pkt-text-body-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto" />
          </Link>
        ))}
        {forseringer.map((f) => (
          <Link
            key={f.forsering_sak_id}
            to={`/forsering/${f.forsering_sak_id}`}
            className="flex items-center gap-2 px-3 py-2.5 hover:bg-pkt-bg-subtle transition-colors group"
          >
            <RocketIcon className="w-4 h-4 text-badge-warning-text shrink-0" />
            <span className="text-sm font-medium text-pkt-text-body-default truncate">
              {f.forsering_sak_tittel}
            </span>
            {f.er_iverksatt && !f.er_stoppet && (
              <Badge variant="success" size="sm">Iverksatt</Badge>
            )}
            {f.er_stoppet && (
              <Badge variant="warning" size="sm">Stoppet</Badge>
            )}
            {!f.er_iverksatt && !f.er_stoppet && (
              <span className="text-xs text-pkt-text-body-subtle hidden sm:inline shrink-0">
                Varslet {formatDate(f.dato_varslet)}
              </span>
            )}
            <ArrowRightIcon className="w-3.5 h-3.5 text-pkt-text-body-subtle opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto" />
          </Link>
        ))}
      </div>
    </div>
  );
}
