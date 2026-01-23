/**
 * MockToolbar Component
 *
 * A dedicated toolbar for mock/test controls in BH mode.
 * Displays approval workflow toggle and role selector.
 * Clearly labeled as test mode to distinguish from production UI.
 */

import { MixerHorizontalIcon } from '@radix-ui/react-icons';
import { Switch } from './primitives/Switch';
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
    <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-2">
      <div className="bg-alert-warning-bg border border-alert-warning-border px-3 py-1.5 rounded-sm">
        <div className="flex items-center gap-3">
          {/* Label */}
          <div className="flex items-center gap-1.5 text-alert-warning-text">
            <MixerHorizontalIcon className="w-3 h-3" />
            <span className="text-xs font-medium">Test</span>
          </div>

          {/* Divider */}
          <div className="h-3 w-px bg-alert-warning-border opacity-50" />

          {/* Controls */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-alert-warning-text cursor-pointer">
              <Switch
                checked={approvalEnabled}
                onCheckedChange={(checked) => onApprovalEnabledChange(checked === true)}
                aria-label="Aktiver godkjenningsflyt"
              />
              <span>Godkjenning</span>
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
