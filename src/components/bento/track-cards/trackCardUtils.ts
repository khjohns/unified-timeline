import type { SporStatus } from '../../../types/timeline';
import { getSporStatusStyle } from '../../../constants/statusStyles';

const ACCENT_MAP: Record<SporStatus, string> = {
  ikke_relevant: 'border-t-pkt-grays-gray-300',
  utkast: 'border-t-pkt-grays-gray-400',
  sendt: 'border-t-pkt-brand-warm-blue-1000',
  under_behandling: 'border-t-pkt-brand-warm-blue-1000',
  godkjent: 'border-t-pkt-brand-dark-green-1000',
  delvis_godkjent: 'border-t-pkt-brand-yellow-1000',
  avslatt: 'border-t-pkt-brand-red-1000',
  under_forhandling: 'border-t-pkt-brand-yellow-1000',
  trukket: 'border-t-pkt-grays-gray-400',
  laast: 'border-t-pkt-brand-dark-green-1000',
};

const DOT_MAP: Record<SporStatus, string> = {
  ikke_relevant: 'bg-pkt-grays-gray-300',
  utkast: 'bg-pkt-grays-gray-400',
  sendt: 'bg-pkt-brand-warm-blue-1000',
  under_behandling: 'bg-pkt-brand-warm-blue-1000',
  godkjent: 'bg-pkt-brand-dark-green-1000',
  delvis_godkjent: 'bg-pkt-brand-yellow-1000',
  avslatt: 'bg-pkt-brand-red-1000',
  under_forhandling: 'bg-pkt-brand-yellow-1000',
  trukket: 'bg-pkt-grays-gray-400',
  laast: 'bg-pkt-brand-dark-green-1000',
};

export function getAccentBorderClass(status: SporStatus): string {
  return ACCENT_MAP[status] ?? 'border-t-pkt-grays-gray-300';
}

export function getStatusDotClass(status: SporStatus): string {
  return DOT_MAP[status] ?? 'bg-pkt-grays-gray-300';
}

export function getStatusLabel(status: SporStatus): string {
  return getSporStatusStyle(status).label;
}

/** Approval grade color: >=70% green, 40-69% amber, <40% red */
export function getGradColor(grad: number): string {
  if (grad >= 70) return 'text-pkt-brand-dark-green-1000';
  if (grad >= 40) return 'text-pkt-brand-yellow-1000';
  return 'text-pkt-brand-red-1000';
}

/** Whether the status represents a resolved/terminal state */
export function isResolved(status: SporStatus): boolean {
  return status === 'godkjent' || status === 'laast' || status === 'trukket';
}
