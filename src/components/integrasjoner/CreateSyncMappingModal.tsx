/**
 * CreateSyncMappingModal
 *
 * Modal for creating a new Dalux-Catenda sync mapping.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Modal,
  Button,
  FormField,
  Input,
  Alert,
  Checkbox,
} from '../primitives';
import { useCreateSyncMapping } from '../../hooks/useSyncMappings';
import { validateSyncConfig } from '../../api/sync';
import type { CreateSyncMappingRequest } from '../../types/integration';

const schema = z.object({
  project_id: z.string().min(1, 'Prosjekt-ID er påkrevd'),
  dalux_project_id: z.string().min(1, 'Dalux prosjekt-ID er påkrevd'),
  dalux_base_url: z
    .string()
    .url('Må være en gyldig URL')
    .refine((url) => url.endsWith('/'), 'URL må ende med /'),
  catenda_project_id: z.string().min(1, 'Catenda prosjekt-ID er påkrevd'),
  catenda_board_id: z.string().min(1, 'Catenda board-ID er påkrevd'),
  sync_interval_minutes: z.number().min(5).max(1440).default(15),
  sync_enabled: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

interface CreateSyncMappingModalProps {
  onClose: () => void;
}

export function CreateSyncMappingModal({ onClose }: CreateSyncMappingModalProps) {
  const createMutation = useCreateSyncMapping();
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    dalux_ok: boolean;
    catenda_ok: boolean;
    errors: string[];
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      dalux_base_url: 'https://node1.field.dalux.com/service/api/',
      sync_interval_minutes: 15,
      sync_enabled: true,
    },
  });

  const formValues = watch();

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationResult(null);

    try {
      const result = await validateSyncConfig({
        dalux_project_id: formValues.dalux_project_id,
        dalux_base_url: formValues.dalux_base_url,
        catenda_project_id: formValues.catenda_project_id,
        catenda_board_id: formValues.catenda_board_id,
      });
      setValidationResult(result);
    } catch (e) {
      setValidationResult({
        valid: false,
        dalux_ok: false,
        catenda_ok: false,
        errors: [e instanceof Error ? e.message : 'Validering feilet'],
      });
    } finally {
      setIsValidating(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    const request: CreateSyncMappingRequest = {
      project_id: data.project_id,
      dalux_project_id: data.dalux_project_id,
      dalux_base_url: data.dalux_base_url,
      catenda_project_id: data.catenda_project_id,
      catenda_board_id: data.catenda_board_id,
      sync_enabled: data.sync_enabled,
      sync_interval_minutes: data.sync_interval_minutes,
    };

    await createMutation.mutateAsync(request);
    onClose();
  };

  return (
    <Modal
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title="Ny synkronisering"
      description="Opprett en kobling mellom Dalux og Catenda"
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Project ID */}
        <FormField
          label="Prosjekt-ID"
          error={errors.project_id?.message}
          helpText="Intern identifikator for prosjektet"
        >
          <Input
            {...register('project_id')}
            placeholder="f.eks. stovner-skole"
          />
        </FormField>

        {/* Dalux Configuration */}
        <div className="border-t border-pkt-border-subtle pt-4">
          <h3 className="font-semibold text-sm mb-3">Dalux-konfigurasjon</h3>

          <div className="space-y-3">
            <FormField
              label="Dalux prosjekt-ID"
              error={errors.dalux_project_id?.message}
              helpText="Finner du i Dalux under prosjektinnstillinger"
            >
              <Input
                {...register('dalux_project_id')}
                placeholder="f.eks. 6070718657"
              />
            </FormField>

            <FormField
              label="Dalux API base URL"
              error={errors.dalux_base_url?.message}
              helpText="Kundespesifikk URL fra Dalux support"
            >
              <Input
                {...register('dalux_base_url')}
                placeholder="https://node1.field.dalux.com/service/api/"
              />
            </FormField>
          </div>
        </div>

        {/* Catenda Configuration */}
        <div className="border-t border-pkt-border-subtle pt-4">
          <h3 className="font-semibold text-sm mb-3">Catenda-konfigurasjon</h3>

          <div className="space-y-3">
            <FormField
              label="Catenda prosjekt-ID"
              error={errors.catenda_project_id?.message}
            >
              <Input
                {...register('catenda_project_id')}
                placeholder="Catenda prosjekt UUID"
              />
            </FormField>

            <FormField
              label="Catenda board-ID"
              error={errors.catenda_board_id?.message}
              helpText="BCF topic board UUID"
            >
              <Input
                {...register('catenda_board_id')}
                placeholder="BCF board UUID"
              />
            </FormField>
          </div>
        </div>

        {/* Sync Settings */}
        <div className="border-t border-pkt-border-subtle pt-4">
          <h3 className="font-semibold text-sm mb-3">Synk-innstillinger</h3>

          <div className="space-y-3">
            <FormField
              label="Synk-intervall (minutter)"
              error={errors.sync_interval_minutes?.message}
            >
              <Input
                type="number"
                {...register('sync_interval_minutes', { valueAsNumber: true })}
                min={5}
                max={1440}
              />
            </FormField>

            <Checkbox
              {...register('sync_enabled')}
              label="Aktiver synkronisering"
              description="Deaktiver for å pause synkronisering midlertidig"
            />
          </div>
        </div>

        {/* Validation Result */}
        {validationResult && (
          <Alert variant={validationResult.valid ? 'success' : 'danger'}>
            <div className="space-y-1">
              <div className="flex gap-4">
                <span>Dalux: {validationResult.dalux_ok ? 'OK' : 'Feilet'}</span>
                <span>Catenda: {validationResult.catenda_ok ? 'OK' : 'Feilet'}</span>
              </div>
              {validationResult.errors.length > 0 && (
                <ul className="text-sm list-disc list-inside">
                  {validationResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          </Alert>
        )}

        {/* Error from mutation */}
        {createMutation.error && (
          <Alert variant="danger">
            {createMutation.error.message}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-3 pt-4 border-t-2 border-pkt-border-subtle">
          <Button
            type="button"
            variant="secondary"
            onClick={handleValidate}
            disabled={isValidating || !formValues.dalux_project_id || !formValues.catenda_board_id}
          >
            {isValidating ? 'Validerer...' : 'Valider tilkobling'}
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || createMutation.isPending}
            >
              {isSubmitting ? 'Oppretter...' : 'Opprett'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
