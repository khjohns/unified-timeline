/**
 * OpprettProsjektPage Component
 *
 * Page for creating new projects.
 * Follows the same pattern as OpprettSakPage: PageHeader + Card + SectionContainer + FormField.
 * On success, sets the new project as active and navigates to /saker.
 */

import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
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
import { useCreateProject } from '../hooks/useProjects';
import { useProject } from '../context/ProjectContext';

// ============================================================
// Schema
// ============================================================

const opprettProsjektSchema = z.object({
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

type OpprettProsjektFormData = z.infer<typeof opprettProsjektSchema>;

// ============================================================
// Component
// ============================================================

export function OpprettProsjektPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { setActiveProject } = useProject();
  const createProjectMutation = useCreateProject();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OpprettProsjektFormData>({
    resolver: zodResolver(opprettProsjektSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = async (data: OpprettProsjektFormData) => {
    try {
      const project = await createProjectMutation.mutateAsync({
        name: data.name,
        description: data.description || undefined,
      });
      toast.success('Prosjekt opprettet', `Prosjektet "${project.name}" er nå klart.`);
      setActiveProject({ id: project.id, name: project.name });
      navigate('/saker');
    } catch (error) {
      toast.error(
        'Feil ved opprettelse',
        error instanceof Error ? error.message : 'En feil oppstod',
      );
    }
  };

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      {/* Header */}
      <PageHeader
        title="Opprett nytt prosjekt"
        subtitle="Opprett et nytt prosjekt"
        menuActions={
          <DropdownMenuItem asChild>
            <Link to="/saker">Tilbake til oversikt</Link>
          </DropdownMenuItem>
        }
      />

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-2 pt-2 pb-4 sm:px-4 sm:pt-3 sm:pb-6">
        <Card variant="outlined" padding="none">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
            {/* Seksjon: Prosjektinformasjon */}
            <SectionContainer
              title="Prosjektinformasjon"
              description="Gi prosjektet et navn og en valgfri beskrivelse"
            >
              <FormField
                label="Prosjektnavn"
                required
                error={errors.name?.message}
              >
                <Input
                  id="name"
                  data-testid="prosjekt-name"
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
                  id="description"
                  data-testid="prosjekt-description"
                  placeholder="Kort beskrivelse av prosjektet..."
                  rows={4}
                  fullWidth
                  {...register('description')}
                />
              </FormField>
            </SectionContainer>

            {/* Error Message */}
            {createProjectMutation.isError && (
              <div className="px-4 pb-4">
                <Alert variant="danger" title="Feil ved opprettelse">
                  {createProjectMutation.error instanceof Error
                    ? createProjectMutation.error.message
                    : 'En feil oppstod'}
                </Alert>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-4 border-t-2 border-pkt-border-subtle">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/saker')}
                disabled={isSubmitting || createProjectMutation.isPending}
                className="w-full sm:w-auto"
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || createProjectMutation.isPending}
                className="w-full sm:w-auto"
                data-testid="prosjekt-submit"
              >
                {createProjectMutation.isPending ? 'Oppretter...' : 'Opprett prosjekt'}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}

export default OpprettProsjektPage;
