/**
 * TokenExpiredAlert Component
 *
 * Modal shown when the user's magic link token has expired.
 * Informs the user that their data is saved locally and provides
 * instructions for getting a new link.
 */

import { Modal } from '../primitives/Modal';
import { Alert } from '../primitives/Alert';
import { Button } from '../primitives/Button';

interface TokenExpiredAlertProps {
  open: boolean;
  onClose: () => void;
}

export function TokenExpiredAlert({ open, onClose }: TokenExpiredAlertProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title="Lenken har utløpt"
      description="Din tilgang har utløpt. For å fortsette må du åpne en ny lenke fra Catenda."
      size="md"
    >
      <div className="space-y-6">
        <Alert variant="success" title="Dataene dine er lagret">
          <p>
            Alt du har fylt ut er lagret på denne enheten. Når du åpner en ny lenke
            vil du få mulighet til å fortsette der du slapp.
          </p>
        </Alert>

        <div>
          <p className="text-sm font-semibold mb-2">Slik fortsetter du:</p>
          <ol className="list-decimal pl-5 text-sm space-y-1 text-pkt-text-body-subtle">
            <li>Gå til saken i Catenda Hub</li>
            <li>Klikk på lenken i siste kommentar</li>
            <li>Velg &ldquo;Gjenopprett&rdquo; når du blir spurt</li>
          </ol>
        </div>

        <div className="flex justify-end pt-4 border-t border-pkt-border-subtle">
          <Button variant="primary" onClick={onClose}>
            Lukk
          </Button>
        </div>
      </div>
    </Modal>
  );
}
