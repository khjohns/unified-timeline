/**
 * ProsjektInnstillingerPage
 *
 * Project settings page for editing project info, contract data, and managing project lifecycle.
 * Route: /innstillinger
 *
 * Sections:
 * - Prosjektinformasjon: Edit name/description (admin only, read-only for others)
 * - Kontraktsdata: BH/TE names, org numbers, contract sum, dagmulkt, dates (admin only)
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
import type { ProjectSettings } from '../types/project';

// ============================================================
// Schemas
// ============================================================

const prosjektInfoSchema = z.object({
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

type ProsjektInfoFormData = z.infer<typeof prosjektInfoSchema>;

const kontraktsdataSchema = z.object({
  byggherre_navn: z.string().min(1, 'Byggherre-navn er påkrevd').max(200),
  byggherre_org_nr: z.string().max(20).optional().or(z.literal('')),
  totalentreprenor_navn: z.string().min(1, 'Totalentreprenør-navn er påkrevd').max(200),
  totalentreprenor_org_nr: z.string().max(20).optional().or(z.literal('')),
  kontraktssum: z.coerce.number().min(0, 'Må være 0 eller høyere'),
  dagmulkt_sats: z.coerce.number().min(0, 'Må være 0 eller høyere'),
  kontraktstart: z.string().min(1, 'Kontraktstart er påkrevd'),
  kontraktsfrist: z.string().min(1, 'Kontraktsfrist er påkrevd'),
});

type KontraktsdataFormData = z.infer<typeof kontraktsdataSchema>;

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
  const contractMutation = useUpdateProject(projectId);
  const deactivateMutation = useDeactivateProject();
  const { data: members } = useProjectMembers(projectId);

  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  // Determine admin status from membership list
  // In dev mode (DISABLE_AUTH), backend uses test@example.com
  const authDisabled = import.meta.env.VITE_DISABLE_AUTH === 'true';
  const currentUserEmail = user?.email ?? (authDisabled ? 'test@example.com' : null);
  const currentMembership = members?.find(
    (m) => m.user_email === currentUserEmail
  );
  const isAdmin = currentMembership?.role === 'admin';

  // ============================================================
  // Project Info Form
  // ============================================================

  const infoForm = useForm<ProsjektInfoFormData>({
    resolver: zodResolver(prosjektInfoSchema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (project) {
      infoForm.reset({
        name: project.name,
        description: project.description ?? '',
      });
    }
  }, [project, infoForm.reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const onInfoSubmit = async (data: ProsjektInfoFormData) => {
    try {
      const updated = await updateMutation.mutateAsync({
        name: data.name,
        description: data.description || null,
      });
      toast.success('Prosjekt oppdatert', 'Endringene er lagret.');
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

  // ============================================================
  // Contract Data Form
  // ============================================================

  const contractForm = useForm<KontraktsdataFormData>({
    resolver: zodResolver(kontraktsdataSchema),
    defaultValues: {
      byggherre_navn: '',
      byggherre_org_nr: '',
      totalentreprenor_navn: '',
      totalentreprenor_org_nr: '',
      kontraktssum: 0,
      dagmulkt_sats: 0,
      kontraktstart: '',
      kontraktsfrist: '',
    },
  });

  useEffect(() => {
    if (project?.settings?.contract) {
      const c = project.settings.contract;
      contractForm.reset({
        byggherre_navn: c.byggherre_navn ?? '',
        byggherre_org_nr: c.byggherre_org_nr ?? '',
        totalentreprenor_navn: c.totalentreprenor_navn ?? '',
        totalentreprenor_org_nr: c.totalentreprenor_org_nr ?? '',
        kontraktssum: c.kontraktssum ?? 0,
        dagmulkt_sats: c.dagmulkt_sats ?? 0,
        kontraktstart: c.kontraktstart ?? '',
        kontraktsfrist: c.kontraktsfrist ?? '',
      });
    }
  }, [project, contractForm.reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const onContractSubmit = async (data: KontraktsdataFormData) => {
    try {
      const existingSettings = project?.settings ?? {};
      const newSettings: ProjectSettings = {
        ...existingSettings,
        contract: {
          byggherre_navn: data.byggherre_navn,
          byggherre_org_nr: data.byggherre_org_nr || undefined,
          totalentreprenor_navn: data.totalentreprenor_navn,
          totalentreprenor_org_nr: data.totalentreprenor_org_nr || undefined,
          kontraktssum: data.kontraktssum,
          dagmulkt_sats: data.dagmulkt_sats,
          kontraktstart: data.kontraktstart,
          kontraktsfrist: data.kontraktsfrist,
        },
      };
      await contractMutation.mutateAsync({ settings: newSettings });
      toast.success('Kontraktsdata lagret', 'Kontraktsinformasjonen er oppdatert.');
    } catch (err) {
      toast.error(
        'Feil ved lagring',
        err instanceof Error ? err.message : 'En feil oppstod',
      );
    }
  };

  // ============================================================
  // Deactivate Handler
  // ============================================================

  const handleDeactivate = async () => {
    try {
      await deactivateMutation.mutateAsync(projectId);
      toast.success('Prosjekt deaktivert', 'Prosjektet er nå deaktivert.');
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
                <form onSubmit={infoForm.handleSubmit(onInfoSubmit)} className="space-y-0">
                  <SectionContainer
                    title="Prosjektinformasjon"
                    description="Rediger prosjektets navn og beskrivelse"
                  >
                    <FormField
                      label="Prosjektnavn"
                      required
                      error={infoForm.formState.errors.name?.message}
                    >
                      <Input
                        id="settings-name"
                        data-testid="innstillinger-name"
                        placeholder="F.eks. Oslobygg Skoleprosjekt"
                        {...infoForm.register('name')}
                        className="w-full"
                      />
                    </FormField>

                    <FormField
                      label="Beskrivelse"
                      error={infoForm.formState.errors.description?.message}
                      helpText="Valgfri beskrivelse av prosjektet"
                    >
                      <Textarea
                        id="settings-description"
                        data-testid="innstillinger-description"
                        placeholder="Kort beskrivelse av prosjektet..."
                        rows={4}
                        fullWidth
                        {...infoForm.register('description')}
                      />
                    </FormField>
                  </SectionContainer>

                  {updateMutation.isError && (
                    <div className="px-4 pb-4">
                      <Alert variant="danger" title="Feil ved oppdatering">
                        {updateMutation.error instanceof Error
                          ? updateMutation.error.message
                          : 'En feil oppstod'}
                      </Alert>
                    </div>
                  )}

                  <div className="flex justify-end p-4 border-t-2 border-pkt-border-subtle">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={!infoForm.formState.isDirty || updateMutation.isPending}
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

            {/* Section 2: Kontraktsdata (admin only) */}
            {isAdmin ? (
              <Card variant="outlined" padding="none">
                <form onSubmit={contractForm.handleSubmit(onContractSubmit)} className="space-y-0">
                  <SectionContainer
                    title="Kontraktsdata"
                    description="Informasjon om kontraktspartene, kontraktssum og frister (NS 8407)"
                  >
                    {/* Byggherre */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        label="Byggherre (BH)"
                        required
                        error={contractForm.formState.errors.byggherre_navn?.message}
                      >
                        <Input
                          id="contract-bh-name"
                          placeholder="F.eks. Oslo kommune"
                          {...contractForm.register('byggherre_navn')}
                          className="w-full"
                        />
                      </FormField>
                      <FormField
                        label="BH org.nr."
                        error={contractForm.formState.errors.byggherre_org_nr?.message}
                      >
                        <Input
                          id="contract-bh-org"
                          placeholder="123 456 789"
                          {...contractForm.register('byggherre_org_nr')}
                          className="w-full"
                        />
                      </FormField>
                    </div>

                    {/* Totalentreprenør */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        label="Totalentreprenør (TE)"
                        required
                        error={contractForm.formState.errors.totalentreprenor_navn?.message}
                      >
                        <Input
                          id="contract-te-name"
                          placeholder="F.eks. Veidekke AS"
                          {...contractForm.register('totalentreprenor_navn')}
                          className="w-full"
                        />
                      </FormField>
                      <FormField
                        label="TE org.nr."
                        error={contractForm.formState.errors.totalentreprenor_org_nr?.message}
                      >
                        <Input
                          id="contract-te-org"
                          placeholder="987 654 321"
                          {...contractForm.register('totalentreprenor_org_nr')}
                          className="w-full"
                        />
                      </FormField>
                    </div>

                    {/* Økonomi */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        label="Kontraktssum (kr)"
                        required
                        error={contractForm.formState.errors.kontraktssum?.message}
                      >
                        <Input
                          id="contract-sum"
                          type="number"
                          min={0}
                          placeholder="150000000"
                          {...contractForm.register('kontraktssum')}
                          className="w-full"
                        />
                      </FormField>
                      <FormField
                        label="Dagmulktsats (kr/dag)"
                        required
                        error={contractForm.formState.errors.dagmulkt_sats?.message}
                      >
                        <Input
                          id="contract-dagmulkt"
                          type="number"
                          min={0}
                          placeholder="50000"
                          {...contractForm.register('dagmulkt_sats')}
                          className="w-full"
                        />
                      </FormField>
                    </div>

                    {/* Datoer */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        label="Kontraktstart"
                        required
                        error={contractForm.formState.errors.kontraktstart?.message}
                      >
                        <Input
                          id="contract-start"
                          type="date"
                          {...contractForm.register('kontraktstart')}
                          className="w-full"
                        />
                      </FormField>
                      <FormField
                        label="Kontraktsfrist"
                        required
                        error={contractForm.formState.errors.kontraktsfrist?.message}
                      >
                        <Input
                          id="contract-deadline"
                          type="date"
                          {...contractForm.register('kontraktsfrist')}
                          className="w-full"
                        />
                      </FormField>
                    </div>
                  </SectionContainer>

                  {contractMutation.isError && (
                    <div className="px-4 pb-4">
                      <Alert variant="danger" title="Feil ved lagring av kontraktsdata">
                        {contractMutation.error instanceof Error
                          ? contractMutation.error.message
                          : 'En feil oppstod'}
                      </Alert>
                    </div>
                  )}

                  <div className="flex justify-end p-4 border-t-2 border-pkt-border-subtle">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={!contractForm.formState.isDirty || contractMutation.isPending}
                    >
                      {contractMutation.isPending ? 'Lagrer...' : 'Lagre kontraktsdata'}
                    </Button>
                  </div>
                </form>
              </Card>
            ) : (
              project.settings?.contract && (
                <Card variant="outlined" padding="lg">
                  <h3 className="text-base font-semibold text-pkt-text-body-dark mb-3">
                    Kontraktsdata
                  </h3>
                  <dl className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-sm font-medium text-pkt-text-body-subtle">Byggherre</dt>
                      <dd className="mt-0.5 text-sm text-pkt-text-body-default">
                        {project.settings.contract.byggherre_navn}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-pkt-text-body-subtle">Totalentreprenør</dt>
                      <dd className="mt-0.5 text-sm text-pkt-text-body-default">
                        {project.settings.contract.totalentreprenor_navn}
                      </dd>
                    </div>
                  </dl>
                </Card>
              )
            )}

            {/* Section 3: Medlemmer */}
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

            {/* Section 4: Faresone (admin only) */}
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
