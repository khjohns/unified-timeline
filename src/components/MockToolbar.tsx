/**
 * MockToolbar Component
 *
 * A dedicated toolbar for mock/test controls in BH mode.
 * Displays approval workflow toggle and role selector.
 * Clearly labeled as test mode to distinguish from production UI.
 */

import { MixerHorizontalIcon } from '@radix-ui/react-icons';
import { Checkbox } from './primitives/Checkbox';
import { ApprovalRoleSelector } from './ApprovalRoleSelector';

interface MockToolbarProps {
  /** Whether approval workflow is enabled */
  approvalEnabled: boolean;
  /** Callback when approval workflow is toggled */
  onApprovalEnabledChange: (enabled: boolean) => void;
}

export function MockToolbar({
  approvalEnabled,
  onApprovalEnabledChange,
}: MockToolbarProps) {
  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-3xl mx-auto px-4 py-2 sm:px-8">
        <div className="flex items-center gap-4">
          {/* Label */}
          <div className="flex items-center gap-1.5 text-amber-700">
            <MixerHorizontalIcon className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Test-modus</span>
          </div>

          {/* Divider */}
          <div className="h-4 w-px bg-amber-300" />

          {/* Controls */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-amber-800 cursor-pointer">
              <Checkbox
                checked={approvalEnabled}
                onCheckedChange={(checked) => onApprovalEnabledChange(checked === true)}
                aria-label="Aktiver godkjenningsflyt"
              />
              <span>Godkjenningsflyt</span>
            </label>

            {approvalEnabled && (
              <ApprovalRoleSelector visible={true} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
