/**
 * ProjectMembersContent
 *
 * Main content component for managing project members.
 * Lists members, supports add/remove/update role operations.
 * Admin-only controls with "last admin" protection.
 */

import { useState } from 'react';
import {
  Card,
  Button,
  Badge,
  Alert,
  AlertDialog,
  Input,
  FormField,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './primitives';
import type { BadgeVariant } from './primitives';
import { InlineLoading } from './PageStateHelpers';
import { useProject } from '../context/ProjectContext';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import {
  useProjectMembers,
  useAddMember,
  useRemoveMember,
  useUpdateMemberRole,
} from '../hooks/useProjectMembers';
import type { ProjectMembership, ProjectRole } from '../types/membership';

// ============================================================
// Constants
// ============================================================

const ROLE_LABELS: Record<ProjectRole, string> = {
  admin: 'Administrator',
  member: 'Medlem',
  viewer: 'Lesetilgang',
};

const ROLE_BADGE_VARIANTS: Record<ProjectRole, BadgeVariant> = {
  admin: 'info',
  member: 'success',
  viewer: 'neutral',
};

// ============================================================
// Helper Components
// ============================================================

function RoleBadge({ role }: { role: ProjectRole }) {
  return (
    <Badge variant={ROLE_BADGE_VARIANTS[role]} size="sm">
      {ROLE_LABELS[role]}
    </Badge>
  );
}

// ============================================================
// Add Member Form
// ============================================================

interface AddMemberFormProps {
  projectId: string;
  onError: (message: string) => void;
  onSuccess: () => void;
}

function AddMemberForm({ projectId, onError, onSuccess }: AddMemberFormProps) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<ProjectRole>('member');
  const addMutation = useAddMember(projectId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      onError('E-postadresse er paakrevd.');
      return;
    }

    try {
      await addMutation.mutateAsync({
        email: trimmedEmail,
        role,
        displayName: displayName.trim() || undefined,
      });
      setEmail('');
      setDisplayName('');
      setRole('member');
      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Kunne ikke legge til medlem.';
      onError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="E-postadresse" id="add-member-email">
          <Input
            id="add-member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="bruker@eksempel.no"
            width="full"
            required
          />
        </FormField>
        <FormField label="Visningsnavn" id="add-member-name" optional>
          <Input
            id="add-member-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ola Nordmann"
            width="full"
          />
        </FormField>
      </div>
      <div className="flex items-end gap-4">
        <FormField label="Rolle" id="add-member-role">
          <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
            <SelectTrigger width="md" id="add-member-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
              <SelectItem value="member">{ROLE_LABELS.member}</SelectItem>
              <SelectItem value="viewer">{ROLE_LABELS.viewer}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <div className="mb-4">
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={addMutation.isPending}
          >
            Legg til medlem
          </Button>
        </div>
      </div>
    </form>
  );
}

// ============================================================
// Member Row
// ============================================================

interface MemberRowProps {
  member: ProjectMembership;
  isCurrentUser: boolean;
  isAdmin: boolean;
  isLastAdmin: boolean;
  projectId: string;
  onError: (message: string) => void;
}

function MemberRow({
  member,
  isCurrentUser,
  isAdmin,
  isLastAdmin,
  projectId,
  onError,
}: MemberRowProps) {
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const removeMutation = useRemoveMember(projectId);
  const updateRoleMutation = useUpdateMemberRole(projectId);

  const isMemberAdmin = member.role === 'admin';
  const canRemove = isAdmin && !isCurrentUser && !(isMemberAdmin && isLastAdmin);
  const canChangeRole = isAdmin && !(isMemberAdmin && isLastAdmin);

  const handleRoleChange = async (newRole: string) => {
    // Prevent demoting the last admin
    if (isMemberAdmin && isLastAdmin && newRole !== 'admin') {
      onError('Kan ikke endre rollen til siste administrator.');
      return;
    }

    try {
      await updateRoleMutation.mutateAsync({
        userEmail: member.user_email,
        role: newRole,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Kunne ikke oppdatere rolle.';
      onError(message);
    }
  };

  const handleRemove = async () => {
    try {
      await removeMutation.mutateAsync(member.user_email);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Kunne ikke fjerne medlem.';
      onError(message);
    }
  };

  return (
    <>
      <tr className="hover:bg-pkt-surface-subtle transition-colors">
        {/* Email */}
        <td className="px-4 py-3 text-sm text-pkt-text-body-default">
          <div className="flex items-center gap-2">
            <span className="truncate">{member.user_email}</span>
            {isCurrentUser && (
              <Badge variant="neutral" size="sm">deg</Badge>
            )}
          </div>
        </td>

        {/* Display name */}
        <td className="px-4 py-3 text-sm text-pkt-text-body-default">
          {member.display_name || (
            <span className="text-pkt-text-body-subtle italic">Ikke angitt</span>
          )}
        </td>

        {/* Role */}
        <td className="px-4 py-3 text-sm">
          {canChangeRole ? (
            <Select
              value={member.role}
              onValueChange={handleRoleChange}
              disabled={updateRoleMutation.isPending}
            >
              <SelectTrigger width="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                <SelectItem value="member">{ROLE_LABELS.member}</SelectItem>
                <SelectItem value="viewer">{ROLE_LABELS.viewer}</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <RoleBadge role={member.role} />
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-sm text-right">
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRemoveDialog(true)}
              disabled={removeMutation.isPending}
            >
              Fjern
            </Button>
          )}
          {isMemberAdmin && isLastAdmin && isAdmin && (
            <span className="text-xs text-pkt-text-body-subtle">
              Siste admin
            </span>
          )}
        </td>
      </tr>

      {/* Remove Confirmation Dialog */}
      <AlertDialog
        open={showRemoveDialog}
        onOpenChange={setShowRemoveDialog}
        title="Fjern medlem"
        description={`Er du sikker pa at du vil fjerne ${member.display_name || member.user_email} fra prosjektet?`}
        confirmLabel="Fjern"
        cancelLabel="Avbryt"
        variant="danger"
        onConfirm={handleRemove}
      />
    </>
  );
}

// ============================================================
// Main Component
// ============================================================

export function ProjectMembersContent() {
  const { projectId, activeProject } = useProject();
  const { user } = useSupabaseAuth();
  const { data: members, isLoading, error } = useProjectMembers(projectId);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentUserEmail = user?.email ?? null;

  // Find current user's membership to determine admin status
  const currentMembership = members?.find(
    (m) => m.user_email === currentUserEmail
  );
  const isAdmin = currentMembership?.role === 'admin';

  // Count admins for "last admin" protection
  const adminCount = members?.filter((m) => m.role === 'admin').length ?? 0;
  const isLastAdmin = adminCount <= 1;

  const handleFormError = (message: string) => {
    setFormError(message);
    setSuccessMessage(null);
  };

  const handleFormSuccess = () => {
    setFormError(null);
    setSuccessMessage('Medlem lagt til.');
    // Clear success after 3 seconds
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <main className="max-w-5xl mx-auto px-2 pt-2 pb-4 sm:px-4 sm:pt-3 sm:pb-6 space-y-6">
      {/* Section Header */}
      <div className="border-b border-pkt-border-subtle pb-4">
        <h2 className="text-lg font-semibold text-pkt-text-body-dark">
          Medlemmer
        </h2>
        <p className="mt-1 text-sm text-pkt-text-body-subtle">
          Administrer hvem som har tilgang til prosjektet {activeProject.name}.
        </p>
      </div>

      {/* Error / Success Messages */}
      {formError && (
        <Alert variant="danger" size="sm">
          {formError}
        </Alert>
      )}
      {successMessage && (
        <Alert variant="success" size="sm">
          {successMessage}
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card variant="outlined" padding="lg">
          <InlineLoading message="Laster medlemmer..." />
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="danger">
          Kunne ikke laste medlemmer: {error.message}
        </Alert>
      )}

      {/* Members Table */}
      {!isLoading && !error && members && (
        <Card variant="outlined" padding="none">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-pkt-border-subtle bg-pkt-surface-strong-gray">
                  <th
                    scope="col"
                    className="px-4 py-3 text-sm font-medium text-pkt-text-body-subtle text-left"
                  >
                    E-post
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-sm font-medium text-pkt-text-body-subtle text-left"
                  >
                    Navn
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-sm font-medium text-pkt-text-body-subtle text-left"
                  >
                    Rolle
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-sm font-medium text-pkt-text-body-subtle text-right"
                  >
                    {isAdmin ? 'Handlinger' : ''}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pkt-border-subtle">
                {members.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-pkt-text-body-subtle"
                    >
                      Ingen medlemmer i prosjektet enna.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      isCurrentUser={member.user_email === currentUserEmail}
                      isAdmin={isAdmin}
                      isLastAdmin={isLastAdmin}
                      projectId={projectId}
                      onError={handleFormError}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Member Form (admin only) */}
      {isAdmin && !isLoading && !error && (
        <Card variant="outlined" padding="lg">
          <h3 className="text-base font-semibold text-pkt-text-body-dark mb-4">
            Legg til nytt medlem
          </h3>
          <AddMemberForm
            projectId={projectId}
            onError={handleFormError}
            onSuccess={handleFormSuccess}
          />
        </Card>
      )}

      {/* Info for non-admin users */}
      {!isAdmin && !isLoading && currentMembership && (
        <Alert variant="info" size="sm">
          Du har rollen <strong>{ROLE_LABELS[currentMembership.role]}</strong> i
          dette prosjektet. Kontakt en administrator for a endre medlemmer.
        </Alert>
      )}
    </main>
  );
}
