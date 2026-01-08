/**
 * ApprovalRoleSelector Component
 *
 * A dropdown selector for testing the approval workflow.
 * Only visible when in BH mode and approval workflow is enabled.
 * Allows switching between different approval roles to test the sequential chain.
 */

import { useUserRole, BHApprovalRole } from '../hooks/useUserRole';
import { APPROVAL_ROLE_LABELS } from '../constants/approvalConfig';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from './primitives/Select';

interface ApprovalRoleSelectorProps {
  /** Whether to show the selector (typically when approval workflow is enabled) */
  visible?: boolean;
  /** Optional className for the container */
  className?: string;
}

const ROLE_OPTIONS: { value: BHApprovalRole; label: string; description?: string }[] = [
  { value: 'BH', label: 'BH (standard)', description: 'Prosjektleder uten godkjenningsrolle' },
  { value: 'PL', label: `PL - ${APPROVAL_ROLE_LABELS.PL}` },
  { value: 'SL', label: `SL - ${APPROVAL_ROLE_LABELS.SL}` },
  { value: 'AL', label: `AL - ${APPROVAL_ROLE_LABELS.AL}` },
  { value: 'DU', label: `DU - ${APPROVAL_ROLE_LABELS.DU}` },
  { value: 'AD', label: `AD - ${APPROVAL_ROLE_LABELS.AD}` },
];

export function ApprovalRoleSelector({ visible = true, className }: ApprovalRoleSelectorProps) {
  const { userRole, bhApprovalRole, setBhApprovalRole } = useUserRole();

  // Only show when in BH mode and selector is visible
  if (userRole !== 'BH' || !visible) {
    return null;
  }

  return (
    <div className={className}>
      <Select value={bhApprovalRole} onValueChange={(value) => setBhApprovalRole(value as BHApprovalRole)}>
        <SelectTrigger width="sm" aria-label="Velg godkjenningsrolle">
          <SelectValue placeholder="Velg rolle" />
        </SelectTrigger>
        <SelectContent>
          {/* Standard BH option */}
          <SelectItem value="BH">BH (standard)</SelectItem>
          <SelectSeparator />
          {/* Approval roles */}
          {ROLE_OPTIONS.filter((opt) => opt.value !== 'BH').map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
