/**
 * SendGrunnlagModal Component
 *
 * Action modal for submitting a new grunnlag (basis/foundation) claim.
 * Uses React Hook Form + Zod for validation.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';

const grunnlagSchema = z.object({
  hovedkategori: z.string().min(1, 'Hovedkategori er påkrevd'),
  underkategori: z.string().min(1, 'Underkategori er påkrevd'),
  beskrivelse: z.string().min(10, 'Beskrivelse må være minst 10 tegn'),
  dato_oppdaget: z.string().min(1, 'Dato er påkrevd'),
  kontraktsreferanser: z.string().optional(),
});

type GrunnlagFormData = z.infer<typeof grunnlagSchema>;

interface SendGrunnlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
}

export function SendGrunnlagModal({
  open,
  onOpenChange,
  sakId,
}: SendGrunnlagModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<GrunnlagFormData>({
    resolver: zodResolver(grunnlagSchema),
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      onOpenChange(false);
    },
  });

  const onSubmit = (data: GrunnlagFormData) => {
    // Convert comma-separated string to array
    const kontraktsreferanser = data.kontraktsreferanser
      ? data.kontraktsreferanser.split(',').map((ref) => ref.trim())
      : [];

    mutation.mutate({
      eventType: 'grunnlag_opprettet',
      data: {
        ...data,
        kontraktsreferanser,
      },
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Send grunnlag"
      description="Fyll ut informasjon om grunnlaget for endringsmeldingen."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-pkt-05">
        {/* Hovedkategori */}
        <div>
          <label htmlFor="hovedkategori" className="block text-sm font-medium text-gray-700">
            Hovedkategori <span className="text-error">*</span>
          </label>
          <select
            id="hovedkategori"
            {...register('hovedkategori')}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            aria-required="true"
            aria-invalid={!!errors.hovedkategori}
            aria-describedby={errors.hovedkategori ? 'hovedkategori-error' : undefined}
          >
            <option value="">Velg kategori</option>
            <option value="endret_arbeidsomfang">Endret arbeidsomfang</option>
            <option value="uforutsette_forhold">Uforutsette forhold</option>
            <option value="feil_mangel">Feil/mangel i prosjekteringsgrunnlag</option>
            <option value="byggherre_endringsordre">Byggherres endringsordre</option>
            <option value="force_majeure">Force majeure</option>
          </select>
          {errors.hovedkategori && (
            <p id="hovedkategori-error" className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.hovedkategori.message}
            </p>
          )}
        </div>

        {/* Underkategori */}
        <div>
          <label htmlFor="underkategori" className="block text-sm font-medium text-gray-700">
            Underkategori <span className="text-error">*</span>
          </label>
          <input
            id="underkategori"
            type="text"
            {...register('underkategori')}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            placeholder="F.eks. 'Grunnforhold', 'Terrengendringer'"
            aria-required="true"
            aria-invalid={!!errors.underkategori}
            aria-describedby={errors.underkategori ? 'underkategori-error' : undefined}
          />
          {errors.underkategori && (
            <p id="underkategori-error" className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.underkategori.message}
            </p>
          )}
        </div>

        {/* Beskrivelse */}
        <div>
          <label htmlFor="beskrivelse" className="block text-sm font-medium text-gray-700">
            Beskrivelse <span className="text-error">*</span>
          </label>
          <textarea
            id="beskrivelse"
            {...register('beskrivelse')}
            rows={4}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            placeholder="Beskriv grunnlaget for endringsmeldingen..."
            aria-required="true"
            aria-invalid={!!errors.beskrivelse}
            aria-describedby={errors.beskrivelse ? 'beskrivelse-error' : undefined}
          />
          {errors.beskrivelse && (
            <p id="beskrivelse-error" className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.beskrivelse.message}
            </p>
          )}
        </div>

        {/* Dato oppdaget */}
        <div>
          <label htmlFor="dato_oppdaget" className="block text-sm font-medium text-gray-700">
            Dato oppdaget <span className="text-error">*</span>
          </label>
          <input
            id="dato_oppdaget"
            type="date"
            {...register('dato_oppdaget')}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            aria-required="true"
            aria-invalid={!!errors.dato_oppdaget}
            aria-describedby={errors.dato_oppdaget ? 'dato_oppdaget-error' : undefined}
          />
          {errors.dato_oppdaget && (
            <p id="dato_oppdaget-error" className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.dato_oppdaget.message}
            </p>
          )}
        </div>

        {/* Kontraktsreferanser */}
        <div>
          <label htmlFor="kontraktsreferanser" className="block text-sm font-medium text-gray-700">
            Kontraktsreferanser
          </label>
          <input
            id="kontraktsreferanser"
            type="text"
            {...register('kontraktsreferanser')}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            placeholder="F.eks. '§3.2, §4.1' (kommaseparert)"
          />
          <p className="mt-pkt-02 text-xs text-gray-500">
            Separer flere referanser med komma
          </p>
        </div>

        {/* Error Message */}
        {mutation.isError && (
          <div
            className="p-pkt-04 bg-error-100 border border-error-500 rounded-pkt-md"
            role="alert"
          >
            <p className="text-sm text-error-700">
              {mutation.error instanceof Error ? mutation.error.message : 'En feil oppstod'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-pkt-03 pt-pkt-04 border-t border-gray-200">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Sender...' : 'Send grunnlag'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
