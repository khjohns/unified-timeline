/**
 * EditSyncMappingModal
 *
 * Modal for editing an existing Dalux-Catenda sync mapping.
 * Only allows editing modifiable fields (enabled, interval, board).
 */

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
  DataList,
  DataListItem,
} from '../primitives';
import { useUpdateSyncMapping } from '../../hooks/useSyncMappings';
import type { SyncMapping } from '../../types/integration';

const schema = z.object({
  catenda_board_id: z.string().min(1, 'Catenda board-ID er påkrevd'),
  sync_interval_minutes: z.number().min(5).max(1440),
  sync_enabled: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface EditSyncMappingModalProps {
  mapping: SyncMapping;
  onClose: () => void;
}

export function EditSyncMappingModal({ mapping, onClose }: EditSyncMappingModalProps) {
  const updateMutation = useUpdateSyncMapping();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      catenda_board_id: mapping.catenda_board_id,
      sync_interval_minutes: mapping.sync_interval_minutes,
      sync_enabled: mapping.sync_enabled,
    },
  });

  const onSubmit = async (data: FormData) => {
    await updateMutation.mutateAsync({
      id: mapping.id!,
      updates: {
        catenda_board_id: data.catenda_board_id,
        sync_interval_minutes: data.sync_interval_minutes,
        sync_enabled: data.sync_enabled,
      },
    });
    onClose();
  };

  return (
    <Modal
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title="Rediger synkronisering"
      description={`Prosjekt: ${mapping.project_id}`}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Read-only info */}
        <div className="bg-pkt-bg-subtle rounded p-3">
          <h4 className="text-xs font-semibold text-pkt-text-body-subtle mb-2 uppercase">
            Konfigurasjon (skrivebeskyttet)
          </h4>
          <DataList variant="list">
            <DataListItem label="Dalux prosjekt">
              {mapping.dalux_project_id}
            </DataListItem>
            <DataListItem label="Dalux URL">
              <span className="font-mono text-xs break-all">{mapping.dalux_base_url}</span>
            </DataListItem>
            <DataListItem label="Catenda prosjekt">
              {mapping.catenda_project_id}
            </DataListItem>
          </DataList>
        </div>

        {/* Editable fields */}
        <div className="space-y-4 pt-2">
          <FormField
            label="Catenda board-ID"
            error={errors.catenda_board_id?.message}
            helpText="BCF topic board UUID (kan endres ved behov)"
          >
            <Input
              {...register('catenda_board_id')}
              className="font-mono text-sm"
            />
          </FormField>

          <FormField
            label="Synk-intervall (minutter)"
            error={errors.sync_interval_minutes?.message}
            helpText="Hvor ofte synkronisering skal kjøres automatisk"
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
            label="Synkronisering aktivert"
            description="Deaktiver for å pause synkronisering midlertidig"
          />
        </div>

        {/* Error from mutation */}
        {updateMutation.error && (
          <Alert variant="danger">
            {updateMutation.error.message}
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-pkt-border-subtle">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || updateMutation.isPending || !isDirty}
          >
            {isSubmitting ? 'Lagrer...' : 'Lagre endringer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
