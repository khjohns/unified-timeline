/**
 * ProjectIdentityTile - Project name, BH/TE, health indicator, and "venter" pulse.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, GearIcon } from '@radix-ui/react-icons';
import { BentoCard } from './BentoCard';
import type { ContractSettings } from '../../types/project';
import type { CaseListItem } from '../../types/api';

const CLOSED_STATUSES = new Set(['OMFORENT', 'LUKKET', 'LUKKET_TRUKKET']);
const BH_PENDING_STATUSES = new Set(['SENDT', 'UNDER_BEHANDLING']);
const TE_PENDING_STATUSES = new Set(['VENTER_PAA_SVAR']);

function getHealthColor(cases: CaseListItem[]): { color: string; label: string } {
  if (cases.length === 0) return { color: 'bg-pkt-grays-gray-400', label: 'Ingen saker' };
  const openCount = cases.filter(c => !CLOSED_STATUSES.has(c.cached_status?.toUpperCase() ?? '')).length;
  const ratio = openCount / cases.length;
  if (ratio > 0.7) return { color: 'bg-pkt-brand-red-1000', label: 'Mange åpne saker' };
  if (ratio > 0.4) return { color: 'bg-pkt-brand-yellow-1000', label: 'Moderat' };
  return { color: 'bg-pkt-brand-dark-green-1000', label: 'God kontroll' };
}

interface ProjectIdentityTileProps {
  projectName: string;
  contract: ContractSettings | null;
  cases: CaseListItem[];
  userRole: 'BH' | 'TE';
}

export function ProjectIdentityTile({ projectName, contract, cases, userRole }: ProjectIdentityTileProps) {
  const health = useMemo(() => getHealthColor(cases), [cases]);

  const pendingCount = useMemo(() => {
    const pendingStatuses = userRole === 'BH' ? BH_PENDING_STATUSES : TE_PENDING_STATUSES;
    return cases.filter(c => {
      const status = c.cached_status?.toUpperCase() ?? '';
      return !CLOSED_STATUSES.has(status) && pendingStatuses.has(status);
    }).length;
  }, [cases, userRole]);

  return (
    <BentoCard colSpan="col-span-12 sm:col-span-6 lg:col-span-4" delay={0}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full ${health.color} animate-pulse`} />
          <span className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide">
            {health.label}
          </span>
          {pendingCount > 0 && (
            <>
              <span className="text-pkt-text-body-subtle text-bento-label">&middot;</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-pkt-brand-yellow-1000 animate-pulse" />
                <span className="text-bento-label font-medium text-pkt-text-body-default">
                  {pendingCount} venter
                </span>
              </span>
            </>
          )}
        </div>
        <h2 className="text-base font-bold text-pkt-text-body-dark leading-tight mb-2 truncate" title={projectName}>
          {projectName}
        </h2>
        {contract ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-bento-micro font-semibold uppercase tracking-wider text-pkt-text-body-subtle w-5">BH</span>
              <span className="text-bento-body text-pkt-text-body-default truncate">{contract.byggherre_navn}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-bento-micro font-semibold uppercase tracking-wider text-pkt-text-body-subtle w-5">TE</span>
              <span className="text-bento-body text-pkt-text-body-default truncate">{contract.totalentreprenor_navn}</span>
            </div>
          </div>
        ) : (
          <p className="text-bento-body text-pkt-text-body-subtle">NS 8407 Endringsregister</p>
        )}

        {/* Actions */}
        <div className="mt-2 pt-2 border-t border-pkt-border-subtle flex gap-1">
          <Link
            to={userRole === 'BH' ? '/endringsordre/ny' : '/saker/ny'}
            className="flex items-center justify-center gap-1.5 flex-1 px-3 py-1.5 text-bento-body font-medium text-pkt-text-action-active hover:bg-pkt-bg-subtle rounded-md transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            {userRole === 'BH' ? 'Ny endringsordre' : 'Nytt krav om endring'}
          </Link>
          {userRole === 'BH' && (
            <Link
              to="/innstillinger"
              className="flex items-center justify-center px-2 py-1.5 text-bento-body text-pkt-text-body-subtle hover:text-pkt-text-action-active hover:bg-pkt-bg-subtle rounded-md transition-colors"
              title="Prosjektinnstillinger"
            >
              <GearIcon className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    </BentoCard>
  );
}
