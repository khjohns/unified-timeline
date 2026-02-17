/**
 * MembersTile - Shows project members as avatar circles grouped by role.
 */

import { Link } from 'react-router-dom';
import { GearIcon } from '@radix-ui/react-icons';
import { BentoCard } from './BentoCard';
import type { ProjectMembership } from '../../types/membership';

function getInitials(member: ProjectMembership): string {
  if (member.display_name) {
    return member.display_name
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return member.user_email.slice(0, 2).toUpperCase();
}

function getDisplayName(member: ProjectMembership): string {
  return member.display_name || member.user_email;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-pkt-brand-blue-1000 text-white',
  member: 'bg-pkt-brand-warm-blue-1000 text-white',
  viewer: 'bg-pkt-grays-gray-400 text-white',
};

const MAX_SHOWN = 6;

interface MembersTileProps {
  members: ProjectMembership[];
}

export function MembersTile({ members }: MembersTileProps) {
  const shown = members.slice(0, MAX_SHOWN);
  const overflow = members.length - MAX_SHOWN;

  return (
    <BentoCard colSpan="col-span-12 sm:col-span-6 lg:col-span-5" delay={350}>
      <div className="p-4">
        <p className="text-bento-label font-medium text-pkt-text-body-subtle uppercase tracking-wide mb-3">
          Medlemmer
        </p>

        <div className="flex flex-wrap gap-2">
          {shown.map((member) => (
            <div key={member.id} className="group relative">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-bento-body font-semibold ${
                  ROLE_COLORS[member.role] ?? ROLE_COLORS.viewer
                }`}
                title={`${getDisplayName(member)} (${member.role})`}
              >
                {getInitials(member)}
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-pkt-brand-dark-blue-1000 text-white text-bento-label whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {getDisplayName(member)}
              </div>
            </div>
          ))}
          {overflow > 0 && (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-bento-body font-semibold bg-pkt-grays-gray-200 text-pkt-text-body-subtle">
              +{overflow}
            </div>
          )}
        </div>

        <p className="text-bento-body text-pkt-text-body-subtle mt-3">
          {members.length} {members.length === 1 ? 'medlem' : 'medlemmer'}
        </p>

        {/* Manage action */}
        <div className="mt-2 pt-2 border-t border-pkt-border-subtle">
          <Link
            to="/medlemmer"
            className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-bento-body font-medium text-pkt-text-action-active hover:bg-pkt-bg-subtle rounded-md transition-colors"
          >
            <GearIcon className="w-3.5 h-3.5" />
            Administrer medlemmer
          </Link>
        </div>
      </div>
    </BentoCard>
  );
}
