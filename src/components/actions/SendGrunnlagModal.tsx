/**
 * SendGrunnlagModal Component
 *
 * Action modal for submitting a new grunnlag (basis/foundation) claim.
 * Uses React Hook Form + Zod for validation.
 * Now includes legacy NS 8407 categories and varsel fields.
 */

import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSubmitEvent } from '../../hooks/useSubmitEvent';
import { useState } from 'react';
import {
  HOVEDKATEGORI_OPTIONS,
  getUnderkategorier,
  VARSEL_METODER_OPTIONS,
} from '../../constants';

const grunnlagSchema = z.object({
  hovedkategori: z.string().min(1, 'Hovedkategori er påkrevd'),
  underkategori: z.array(z.string()).min(1, 'Minst én underkategori må velges'),
  beskrivelse: z.string().min(10, 'Beskrivelse må være minst 10 tegn'),
  dato_oppdaget: z.string().min(1, 'Dato oppdaget er påkrevd'),
  dato_varsel_sendt: z.string().optional(),
  varsel_metode: z.array(z.string()).optional(),
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
  const [selectedHovedkategori, setSelectedHovedkategori] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<GrunnlagFormData>({
    resolver: zodResolver(grunnlagSchema),
    defaultValues: {
      underkategori: [],
      varsel_metode: [],
    },
  });

  const mutation = useSubmitEvent(sakId, {
    onSuccess: () => {
      reset();
      setSelectedHovedkategori('');
      onOpenChange(false);
    },
  });

  // Reset underkategori when hovedkategori changes
  const handleHovedkategoriChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedHovedkategori(value);
    setValue('underkategori', []); // Clear underkategorier when hovedkategori changes
  };

  const onSubmit = (data: GrunnlagFormData) => {
    // Convert comma-separated string to array
    const kontraktsreferanser = data.kontraktsreferanser
      ? data.kontraktsreferanser.split(',').map((ref) => ref.trim())
      : [];

    mutation.mutate({
      eventType: 'grunnlag_opprettet',
      data: {
        hovedkategori: data.hovedkategori,
        underkategori: data.underkategori,
        beskrivelse: data.beskrivelse,
        dato_oppdaget: data.dato_oppdaget,
        dato_varsel_sendt: data.dato_varsel_sendt,
        varsel_metode: data.varsel_metode,
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
            Hovedkategori (NS 8407) <span className="text-error">*</span>
          </label>
          <select
            id="hovedkategori"
            {...register('hovedkategori')}
            onChange={handleHovedkategoriChange}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
            aria-required="true"
            aria-invalid={!!errors.hovedkategori}
            aria-describedby={errors.hovedkategori ? 'hovedkategori-error' : undefined}
          >
            {HOVEDKATEGORI_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.hovedkategori && (
            <p id="hovedkategori-error" className="mt-pkt-02 text-sm text-error" role="alert">
              {errors.hovedkategori.message}
            </p>
          )}
        </div>

        {/* Underkategori - Dynamic based on hovedkategori */}
        {selectedHovedkategori && getUnderkategorier(selectedHovedkategori).length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-pkt-02">
              Underkategori <span className="text-error">*</span>
            </label>
            <div className="space-y-pkt-02 max-h-48 overflow-y-auto border border-gray-300 rounded-pkt-md p-pkt-03">
              {getUnderkategorier(selectedHovedkategori).map((option) => (
                <div key={option.value} className="flex items-start">
                  <input
                    type="checkbox"
                    id={`underkategori-${option.value}`}
                    value={option.value}
                    {...register('underkategori')}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-oslo-blue focus:ring-oslo-blue"
                  />
                  <label
                    htmlFor={`underkategori-${option.value}`}
                    className="ml-pkt-02 text-sm text-gray-700"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
            {errors.underkategori && (
              <p className="mt-pkt-02 text-sm text-error" role="alert">
                {errors.underkategori.message}
              </p>
            )}
          </div>
        )}

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

        {/* Dato forhold oppdaget */}
        <div>
          <label htmlFor="dato_oppdaget" className="block text-sm font-medium text-gray-700">
            Dato forhold oppdaget <span className="text-error">*</span>
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

        {/* Dato varsel sendt */}
        <div>
          <label htmlFor="dato_varsel_sendt" className="block text-sm font-medium text-gray-700">
            Dato varsel sendt
          </label>
          <input
            id="dato_varsel_sendt"
            type="date"
            {...register('dato_varsel_sendt')}
            className="mt-pkt-02 block w-full rounded-pkt-md border-gray-300 shadow-sm focus:border-oslo-blue focus:ring-oslo-blue"
          />
          <p className="mt-pkt-02 text-xs text-gray-500">
            Når ble forholdet formelt varslet til BH? (Kan være forskjellig fra oppdaget-dato)
          </p>
        </div>

        {/* Varsel metode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-pkt-02">
            Varselmetode
          </label>
          <div className="space-y-pkt-02 border border-gray-300 rounded-pkt-md p-pkt-03">
            {VARSEL_METODER_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center">
                <input
                  type="checkbox"
                  id={`varsel-${option.value}`}
                  value={option.value}
                  {...register('varsel_metode')}
                  className="h-4 w-4 rounded border-gray-300 text-oslo-blue focus:ring-oslo-blue"
                />
                <label
                  htmlFor={`varsel-${option.value}`}
                  className="ml-pkt-02 text-sm text-gray-700"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
          <p className="mt-pkt-02 text-xs text-gray-500">
            Hvordan ble BH varslet? (Kan velge flere)
          </p>
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
