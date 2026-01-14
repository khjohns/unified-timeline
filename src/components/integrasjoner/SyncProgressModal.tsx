/**
 * SyncProgressModal
 *
 * Modal showing real-time sync progress via SSE.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Modal,
  Button,
  Badge,
  DataList,
  DataListItem,
  Alert,
} from '../primitives';
import { useSyncProgress } from '../../hooks/useSyncProgress';
import { syncQueryKeys } from '../../hooks/useSyncMappings';

interface SyncProgressModalProps {
  mappingId: string;
  onClose: () => void;
}

export function SyncProgressModal({ mappingId, onClose }: SyncProgressModalProps) {
  const queryClient = useQueryClient();
  const { status, isConnected, progress, result, error, duration, disconnect } = useSyncProgress(mappingId);

  // Invalidate queries when sync completes
  useEffect(() => {
    if (status === 'completed' || status === 'error') {
      queryClient.invalidateQueries({ queryKey: syncQueryKeys.mapping(mappingId) });
      queryClient.invalidateQueries({ queryKey: syncQueryKeys.mappings() });
    }
  }, [status, mappingId, queryClient]);

  const handleClose = () => {
    disconnect();
    onClose();
  };

  const isFinished = status === 'completed' || status === 'error' || status === 'idle';

  return (
    <Modal
      open={true}
      onOpenChange={(open) => !open && handleClose()}
      title="Synkronisering"
      size="lg"
    >
      <div className="space-y-4">
        {/* Status indicator */}
        <div className="flex items-center gap-3">
          {!isFinished && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-oslo-blue" />
          )}
          <span className="text-sm">
            {status === 'connecting' && 'Kobler til...'}
            {status === 'running' && 'Synkroniserer...'}
            {status === 'completed' && 'Fullført'}
            {status === 'error' && 'Feilet'}
            {status === 'idle' && 'Ingen aktiv synkronisering'}
          </span>
          <div className="flex-1" />
          <Badge variant={isConnected ? 'success' : 'neutral'} size="sm">
            {isConnected ? 'Tilkoblet' : 'Frakoblet'}
          </Badge>
        </div>

        {/* Progress stats */}
        {(status === 'running' || status === 'completed') && (
          <div className="bg-pkt-bg-subtle rounded p-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-pkt-text-heading">
                  {progress.tasks_processed}
                </div>
                <div className="text-xs text-pkt-text-body-subtle">Prosessert</div>
              </div>
              <div>
                <div className="text-xl font-bold text-alert-success-text">
                  {progress.tasks_created}
                </div>
                <div className="text-xs text-pkt-text-body-subtle">Opprettet</div>
              </div>
              <div>
                <div className="text-xl font-bold text-oslo-blue">
                  {progress.tasks_updated}
                </div>
                <div className="text-xs text-pkt-text-body-subtle">Oppdatert</div>
              </div>
              <div>
                <div className="text-xl font-bold text-pkt-text-body-subtle">
                  {progress.tasks_skipped}
                </div>
                <div className="text-xs text-pkt-text-body-subtle">Hoppet over</div>
              </div>
              <div>
                <div className="text-xl font-bold text-alert-danger-text">
                  {progress.tasks_failed}
                </div>
                <div className="text-xs text-pkt-text-body-subtle">Feilet</div>
              </div>
            </div>
          </div>
        )}

        {/* Result details */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  result.status === 'success'
                    ? 'success'
                    : result.status === 'failed'
                    ? 'danger'
                    : 'warning'
                }
              >
                {result.status === 'success' && 'Vellykket'}
                {result.status === 'partial' && 'Delvis fullført'}
                {result.status === 'failed' && 'Feilet'}
              </Badge>
              {duration && (
                <span className="text-sm text-pkt-text-body-subtle">
                  Varighet: {duration.toFixed(1)}s
                </span>
              )}
            </div>

            {result.errors.length > 0 && (
              <Alert variant="warning">
                <div className="space-y-1">
                  <strong>Feil under synkronisering:</strong>
                  <ul className="list-disc list-inside text-sm">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>...og {result.errors.length - 5} flere</li>
                    )}
                  </ul>
                </div>
              </Alert>
            )}
          </div>
        )}

        {/* Error state */}
        {status === 'error' && error && (
          <Alert variant="danger">
            {error}
          </Alert>
        )}

        {/* Idle state */}
        {status === 'idle' && (
          <Alert variant="info">
            Ingen synkronisering pågår for denne mappingen.
            Klikk "Synkroniser" på kortet for å starte en ny synkronisering.
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-end pt-4 border-t border-pkt-border-subtle">
          <Button variant={isFinished ? 'primary' : 'secondary'} onClick={handleClose}>
            {isFinished ? 'Lukk' : 'Lukk (fortsetter i bakgrunnen)'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
