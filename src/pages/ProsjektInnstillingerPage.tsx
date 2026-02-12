/**
 * ProsjektInnstillingerPage
 *
 * Project settings page for editing project info and managing project lifecycle.
 * Route: /innstillinger
 *
 * Sections:
 * - Prosjektinformasjon: Edit name/description (admin only, read-only for others)
 * - Medlemmer: Link to /medlemmer for member management
 * - Faresone: Deactivate project (admin only)
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  AlertDialog,
  Button,
  Card,
  DropdownMenuItem,
  FormField,
  Input,
  SectionContainer,
  Textarea,
  useToast,
} from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import { InlineLoading } from '../components/PageStateHelpers';
import { useProject, DEFAULT_PROJECT } from '../context/ProjectContext';
import { useSupabaseAuth } from '../context/SupabaseAuthContext';
import { useProjectDetail, useUpdateProject, useDeactivateProject } from '../hooks/useProjects';
import { useProjectMembers } from '../hooks/useProjectMembers';

// ============================================================
// Schema
// ============================================================

const prosjektInnstillingerSchema = z.object({
  name: z
    .string()
    .min(1, 'Prosjektnavn er påkrevd')
    .max(200, 'Maksimalt 200 tegn'),
  description: z
    .string()
    .max(2000, 'Maksimalt 2000 tegn')
    .optional()
    .or(z.literal('')),
});

type ProsjektInnstillingerFormData = z.infer<typeof prosjektInnstillingerSchema>;

// ============================================================
// Component
// ============================================================

export function ProsjektInnstillingerPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { projectId, activeProject, setActiveProject } = useProject();
  const { user } = useSupabaseAuth();
  const { data: project, isLoading, error } = useProjectDetail(projectId);
  const updateMutation = useUpdateProject(projectId);
  const deactivateMutation = useDeactivateProject();
  const { data: members } = useProjectMembers(projectId);

  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  // Determine admin status from membership list
  const currentUserEmail = user?.email ?? null;
  const currentMembership = members?.find(
    (m) => m.user_email === currentUserEmail
  );
  const isAdmin = currentMembership?.role === 'admin';

  // Form setup with values populated from the fetched project
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProsjektInnstillingerFormData>({
    resolver: zodResolver(prosjektInnstillingerSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // Populate form when project data loads
  useEffect(() => {
    if (project) {
      reset({
        name: project.name,
        description: project.description ?? '',
      });
    }
  }, [project, reset]);

  // ============================================================
  // Handlers
  // ============================================================

  const onSubmit = async (data: ProsjektInnstillingerFormData) => {
    try {
      const updated = await updateMutation.mutateAsync({
        name: data.name,
        description: data.description || null,
      });
      toast.success('Prosjekt oppdatert', `Endringene er lagret.`);
      // Update active project context if name changed
      if (updated.name !== activeProject.name) {
        setActiveProject({ id: updated.id, name: updated.name });
      }
    } catch (err) {
      toast.error(
        'Feil ved oppdatering',
        err instanceof Error ? err.message : 'En feil oppstod',
      );
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivateMutation.mutateAsync(projectId);
      toast.success('Prosjekt deaktivert', 'Prosjektet er nå deaktivert.');
      // Switch to default project and navigate away
      setActiveProject(DEFAULT_PROJECT);
      navigate('/saker');
    } catch (err) {
      toast.error(
        'Feil ved deaktivering',
        err instanceof Error ? err.message : 'En feil oppstod',
      );
    }
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      {/* Header */}
      <PageHeader
        title={activeProject.name}
        subtitle="Prosjektinnstillinger"
        menuActions={
          <DropdownMenuItem asChild>
            <Link to="/saker">Tilbake til oversikt</Link>
          </DropdownMenuItem>
        }
      />

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-2 pt-2 pb-4 sm:px-4 sm:pt-3 sm:pb-6 space-y-6">
        {/* Loading State */}
        {isLoading && (
          <Card variant="outlined" padding="lg">
            <InlineLoading message="Laster prosjektinnstillinger..." />
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="danger" title="Kunne ikke laste prosjekt">
            {error.message}
          </Alert>
        )}

        {/* Content (when loaded) */}
        {!isLoading && !error && project && (
          <>
            {/* Section 1: Prosjektinformasjon */}
            {isAdmin ? (
              <Card variant="outlined" padding="none">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
                  <SectionContainer
                    title="Prosjektinformasjon"
                    description="Rediger prosjektets navn og beskrivelse"
                  >
                    <FormField
                      label="Prosjektnavn"
                      required
                      error={errors.name?.message}
                    >
                      <Input
                        id="settings-name"
                        data-testid="innstillinger-name"
                        placeholder="F.eks. Oslobygg Skoleprosjekt"
                        {...register('name')}
                        className="w-full"
                      />
                    </FormField>

                    <FormField
                      label="Beskrivelse"
                      error={errors.description?.message}
                      helpText="Valgfri beskrivelse av prosjektet"
                    >
                      <Textarea
                        id="settings-description"
                        data-testid="innstillinger-description"
                        placeholder="Kort beskrivelse av prosjektet..."
                        rows={4}
                        fullWidth
                        {...register('description')}
                      />
                    </FormField>
                  </SectionContainer>

                  {/* Error Message */}
                  {updateMutation.isError && (
                    <div className="px-4 pb-4">
                      <Alert variant="danger" title="Feil ved oppdatering">
                        {updateMutation.error instanceof Error
                          ? updateMutation.error.message
                          : 'En feil oppstod'}
                      </Alert>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end p-4 border-t-2 border-pkt-border-subtle">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={!isDirty || updateMutation.isPending}
                      data-testid="innstillinger-submit"
                    >
                      {updateMutation.isPending ? 'Lagrer...' : 'Lagre endringer'}
                    </Button>
                  </div>
                </form>
              </Card>
            ) : (
              <Card variant="outlined" padding="lg">
                <h3 className="text-base font-semibold text-pkt-text-body-dark mb-3">
                  Prosjektinformasjon
                </h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-pkt-text-body-subtle">
                      Prosjektnavn
                    </dt>
                    <dd className="mt-0.5 text-sm text-pkt-text-body-default">
                      {project.name}
                    </dd>
                  </div>
                  {project.description && (
                    <div>
                      <dt className="text-sm font-medium text-pkt-text-body-subtle">
                        Beskrivelse
                      </dt>
                      <dd className="mt-0.5 text-sm text-pkt-text-body-default">
                        {project.description}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="mt-4">
                  <Alert variant="info" size="sm">
                    Kun administratorer kan redigere prosjektinnstillinger.
                  </Alert>
                </div>
              </Card>
            )}

            {/* Section 2: Medlemmer */}
            <Card variant="outlined" padding="lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-pkt-text-body-dark">
                    Medlemmer
                  </h3>
                  <p className="mt-1 text-sm text-pkt-text-body-subtle">
                    Administrer hvem som har tilgang til prosjektet og deres roller.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/medlemmer')}
                >
                  Administrer medlemmer
                </Button>
              </div>
            </Card>

            {/* Section 3: Faresone (admin only) */}
            {isAdmin && (
              <Card variant="outlined" padding="lg" className="border-red-300 dark:border-red-700">
                <h3 className="text-base font-semibold text-red-700 dark:text-red-400 mb-1">
                  Faresone
                </h3>
                <p className="text-sm text-pkt-text-body-subtle mb-4">
                  Handlinger her kan ikke angres. Vennligst vær sikker.
                </p>

                <div className="flex items-center justify-between rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
                  <div>
                    <p className="text-sm font-medium text-pkt-text-body-default">
                      Deaktiver prosjekt
                    </p>
                    <p className="text-sm text-pkt-text-body-subtle mt-0.5">
                      Prosjektet vil bli deaktivert og utilgjengelig for alle medlemmer.
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeactivateDialog(true)}
                    disabled={deactivateMutation.isPending}
                    data-testid="innstillinger-deactivate"
                  >
                    {deactivateMutation.isPending ? 'Deaktiverer...' : 'Deaktiver'}
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog
        open={showDeactivateDialog}
        onOpenChange={setShowDeactivateDialog}
        title="Deaktiver prosjekt"
        description={`Er du sikker på at du vil deaktivere prosjektet "${activeProject.name}"? Prosjektet vil bli utilgjengelig for alle medlemmer. Denne handlingen kan ikke angres.`}
        confirmLabel="Deaktiver"
        cancelLabel="Avbryt"
        variant="danger"
        onConfirm={handleDeactivate}
      />
    </div>
  );
}

export default ProsjektInnstillingerPage;
