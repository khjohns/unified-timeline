# Opprett-knapper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add role-filtered "create case" buttons to ProjectIdentityTile, create a new OpprettEndringsordre page, and extract a shared EndringsordreForm component from UtstEndringsordreModal.

**Architecture:** ProjectIdentityTile gets a CTA button (BH→"Ny endringsordre", TE→"Nytt krav om endring"). A new `EndringsordreForm` component is extracted from `UtstEndringsordreModal` (same pattern as `GrunnlagForm`). A new `OpprettEndringsordre` page uses this shared form. The modal is refactored to consume the shared form.

**Tech Stack:** React 19, TypeScript 5.8, react-hook-form + zod, react-router-dom, TanStack Query, Punkt design system (Tailwind CSS v4)

---

### Task 1: Add CTA button to ProjectIdentityTile

**Files:**
- Modify: `src/components/dashboard/ProjectIdentityTile.tsx`

**Step 1: Add Link import and CTA button**

Add `Link` import from react-router-dom and `PlusIcon` from radix-ui. Then add the button after the pending-count section (or after BH/TE info if no pending), with a `border-t` separator.

```tsx
// Add to imports:
import { Link } from 'react-router-dom';
import { PlusIcon } from '@radix-ui/react-icons';
```

Add this JSX block at the end of the `<div className="p-4">`, after the pendingCount block (before the closing `</div>` of `p-4`):

```tsx
{/* Create action */}
<div className="mt-2 pt-2 border-t border-pkt-border-subtle">
  <Link
    to={userRole === 'BH' ? '/endringsordre/ny' : '/saker/ny'}
    className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium text-pkt-text-action-active hover:bg-pkt-bg-subtle rounded-md transition-colors"
  >
    <PlusIcon className="w-3.5 h-3.5" />
    {userRole === 'BH' ? 'Ny endringsordre' : 'Nytt krav om endring'}
  </Link>
</div>
```

**Step 2: Verify in browser**

Run: `npm run dev`
Check: Navigate to `/saker`, verify the button appears in ProjectIdentityTile with correct label based on role.

**Step 3: Commit**

```bash
git add src/components/dashboard/ProjectIdentityTile.tsx
git commit -m "feat: add role-filtered create button to ProjectIdentityTile"
```

---

### Task 2: Extract shared EndringsordreForm schema and types

**Files:**
- Create: `src/components/forms/EndringsordreForm.tsx`
- Modify: `src/components/forms/index.ts`

**Step 1: Create the shared form component with schema**

Create `src/components/forms/EndringsordreForm.tsx`. This extracts the schema, types, constants, and form field sections from `UtstEndringsordreModal.tsx`.

The shared form component takes a `UseFormReturn` instance (same pattern as `GrunnlagForm`) and renders the form sections. It does NOT include wizard navigation, submit handlers, or modal-specific logic.

```tsx
/**
 * EndringsordreForm - Shared form sections for creating/editing endringsordre.
 *
 * Used by both OpprettEndringsordre page and UtstEndringsordreModal.
 * Follows the same composition pattern as GrunnlagForm.
 */

import { Controller, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import {
  Alert,
  Badge,
  Checkbox,
  CurrencyInput,
  DatePicker,
  FormField,
  Input,
  SectionContainer,
  Textarea,
} from '../primitives';

import type { VederlagsMetode, EOKonsekvenser } from '../../types/timeline';
import type { KandidatKOE } from '../../api/endringsordre';

// ============================================================================
// SCHEMA
// ============================================================================

export const endringsordreFormSchema = z.object({
  eo_nummer: z.string().min(1, 'EO-nummer er påkrevd'),
  tittel: z.string().min(3, 'Tittel må være minst 3 tegn').max(100, 'Tittel kan ikke være lengre enn 100 tegn'),
  beskrivelse: z.string().min(1, 'Beskrivelse er påkrevd'),
  konsekvenser_sha: z.boolean(),
  konsekvenser_kvalitet: z.boolean(),
  konsekvenser_fremdrift: z.boolean(),
  konsekvenser_pris: z.boolean(),
  konsekvenser_annet: z.boolean(),
  konsekvens_beskrivelse: z.string().optional(),
  oppgjorsform: z.enum(['ENHETSPRISER', 'REGNINGSARBEID', 'FASTPRIS_TILBUD']).optional(),
  kompensasjon_belop: z.number().min(0).optional().nullable(),
  fradrag_belop: z.number().min(0).optional().nullable(),
  er_estimat: z.boolean(),
  frist_dager: z.number().min(0).optional().nullable(),
  ny_sluttdato: z.string().optional(),
});

export type EndringsordreFormData = z.infer<typeof endringsordreFormSchema>;

// ============================================================================
// CONSTANTS
// ============================================================================

interface OppgjorsformOption {
  value: VederlagsMetode;
  label: string;
  paragraf: string;
  indeksregulering: 'full' | 'delvis' | 'ingen';
  description: string;
}

export const OPPGJORSFORM_OPTIONS: OppgjorsformOption[] = [
  {
    value: 'ENHETSPRISER',
    label: 'Enhetspriser',
    paragraf: '§34.3',
    indeksregulering: 'full',
    description: 'Kontraktens eller justerte enhetspriser. Gjenstand for indeksregulering.',
  },
  {
    value: 'REGNINGSARBEID',
    label: 'Regningsarbeid',
    paragraf: '§30.2, §34.4',
    indeksregulering: 'delvis',
    description: 'Oppgjør etter medgått tid og materialer. Endelig beløp fastsettes ved sluttoppgjør.',
  },
  {
    value: 'FASTPRIS_TILBUD',
    label: 'Fastpris / Tilbud',
    paragraf: '§34.2.1',
    indeksregulering: 'ingen',
    description: 'Entreprenørens tilbud. Fast beløp, ikke gjenstand for indeksregulering.',
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function IndeksreguleringsInfo({ indeks }: { indeks: 'full' | 'delvis' | 'ingen' }) {
  const variants: Record<string, 'success' | 'warning' | 'default'> = {
    full: 'success',
    delvis: 'warning',
    ingen: 'default',
  };
  const labels = {
    full: 'Full indeksreg.',
    delvis: 'Delvis indeksreg.',
    ingen: 'Ingen indeksreg.',
  };
  return <Badge variant={variants[indeks]}>{labels[indeks]}</Badge>;
}

export function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface EndringsordreFormProps<T extends EndringsordreFormData> {
  form: UseFormReturn<T>;
  /** KOE candidate selection */
  kandidatSaker?: KandidatKOE[];
  kandidaterLoading?: boolean;
  selectedKoeIds?: string[];
  onToggleKoeSelection?: (koeId: string) => void;
  /** Computed totals from selected KOE */
  totalFromKOE?: number;
  totalDagerFromKOE?: number;
  /** Which sections to show */
  showIdentifikasjon?: boolean;
  showKoeSelection?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EndringsordreForm<T extends EndringsordreFormData>({
  form,
  kandidatSaker = [],
  kandidaterLoading = false,
  selectedKoeIds = [],
  onToggleKoeSelection,
  totalFromKOE = 0,
  totalDagerFromKOE = 0,
  showIdentifikasjon = true,
  showKoeSelection = true,
}: EndringsordreFormProps<T>) {
  const {
    register,
    control,
    formState: { errors },
    watch,
  } = form;

  const formValues = watch();

  const harKonsekvens =
    formValues.konsekvenser_sha ||
    formValues.konsekvenser_kvalitet ||
    formValues.konsekvenser_fremdrift ||
    formValues.konsekvenser_pris ||
    formValues.konsekvenser_annet;

  const nettoBelop = (formValues.kompensasjon_belop || 0) - (formValues.fradrag_belop || 0);

  return (
    <>
      {/* Identifikasjon + Beskrivelse */}
      {showIdentifikasjon && (
        <SectionContainer
          title="Identifikasjon"
          description="EO-nummer og tittel for enkel identifikasjon"
        >
          <FormField
            label="EO-nummer"
            required
            error={errors.eo_nummer?.message as string | undefined}
            helpText="Unik identifikator for endringsordren"
          >
            <Input
              {...register('eo_nummer' as any)}
              error={!!errors.eo_nummer}
              width="md"
            />
          </FormField>

          <FormField
            label="Tittel"
            required
            error={errors.tittel?.message as string | undefined}
            helpText="Kort beskrivende tittel for enkel identifikasjon"
          >
            <Input
              {...register('tittel' as any)}
              error={!!errors.tittel}
              fullWidth
            />
          </FormField>

          <FormField
            label="Beskrivelse"
            required
            error={errors.beskrivelse?.message as string | undefined}
            helpText="Beskriv hva endringen innebærer"
          >
            <Textarea
              {...register('beskrivelse' as any)}
              rows={4}
              fullWidth
              error={!!errors.beskrivelse}
            />
          </FormField>
        </SectionContainer>
      )}

      {/* KOE-saker */}
      {showKoeSelection && (
        <SectionContainer
          title="Relaterte KOE-saker"
          description="Velg KOE-saker som skal inkluderes i endringsordren, eller fortsett uten for proaktiv EO"
        >
          {kandidaterLoading ? (
            <div className="flex items-center gap-3 py-4 text-pkt-text-body-muted">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">Henter kandidatsaker...</span>
            </div>
          ) : kandidatSaker.length === 0 ? (
            <p className="text-pkt-text-body-subtle text-sm py-2">
              Ingen KOE-saker er klare for endringsordre. Du kan fortsette med en proaktiv EO.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-pkt-border-subtle">
              <div className="divide-y divide-pkt-border-subtle">
                {kandidatSaker.map((koe) => {
                  const isSelected = selectedKoeIds.includes(koe.sak_id);
                  return (
                    <div
                      key={koe.sak_id}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => onToggleKoeSelection?.(koe.sak_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onToggleKoeSelection?.(koe.sak_id);
                        }
                      }}
                      className={`flex items-start gap-2 p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-pkt-surface-light-beige'
                          : 'hover:bg-pkt-surface-subtle'
                      }`}
                    >
                      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
                      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleKoeSelection?.(koe.sak_id)}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{koe.tittel}</p>
                        <p className="text-xs text-pkt-text-body-subtle">
                          {koe.overordnet_status}
                        </p>
                        <div className="flex gap-3 mt-1 text-xs">
                          <span className="font-mono text-pkt-brand-dark-green-1000">
                            {koe.sum_godkjent !== undefined
                              ? formatCurrency(koe.sum_godkjent)
                              : '-'}
                          </span>
                          {koe.godkjent_dager !== undefined && koe.godkjent_dager > 0 && (
                            <span className="text-pkt-text-body-subtle">
                              {koe.godkjent_dager} dager
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedKoeIds.length > 0 && (
                <div className="border-t-2 border-pkt-border-default bg-pkt-surface-subtle p-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold">Totalt ({selectedKoeIds.length} valgt)</span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-pkt-brand-dark-green-1000">
                        {formatCurrency(totalFromKOE)}
                      </span>
                      {totalDagerFromKOE > 0 && (
                        <span className="text-pkt-text-body-subtle ml-2">
                          / {totalDagerFromKOE} dager
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionContainer>
      )}

      {/* Konsekvenser */}
      <SectionContainer
        title="Konsekvenser"
        description="Kryss av for konsekvenser endringen medfører"
      >
        <div className="space-y-3">
          <Controller
            name={'konsekvenser_sha' as any}
            control={control}
            render={({ field }) => (
              <Checkbox
                id="konsekvenser_sha"
                checked={field.value}
                onCheckedChange={field.onChange}
                label="SHA-konsekvens"
                description="Endringen påvirker sikkerhet, helse eller arbeidsmiljø"
              />
            )}
          />
          <Controller
            name={'konsekvenser_kvalitet' as any}
            control={control}
            render={({ field }) => (
              <Checkbox
                id="konsekvenser_kvalitet"
                checked={field.value}
                onCheckedChange={field.onChange}
                label="Kvalitetskonsekvens"
                description="Endringen påvirker kvalitet eller spesifikasjoner"
              />
            )}
          />
          <Controller
            name={'konsekvenser_fremdrift' as any}
            control={control}
            render={({ field }) => (
              <Checkbox
                id="konsekvenser_fremdrift"
                checked={field.value}
                onCheckedChange={field.onChange}
                label="Fremdriftskonsekvens"
                description="Endringen gir rett til fristforlengelse"
              />
            )}
          />
          <Controller
            name={'konsekvenser_pris' as any}
            control={control}
            render={({ field }) => (
              <Checkbox
                id="konsekvenser_pris"
                checked={field.value}
                onCheckedChange={field.onChange}
                label="Priskonsekvens"
                description="Endringen gir rett til vederlagsjustering"
              />
            )}
          />
          <Controller
            name={'konsekvenser_annet' as any}
            control={control}
            render={({ field }) => (
              <Checkbox
                id="konsekvenser_annet"
                checked={field.value}
                onCheckedChange={field.onChange}
                label="Andre konsekvenser"
                description="Endringen har andre konsekvenser som bør dokumenteres"
              />
            )}
          />
        </div>

        {harKonsekvens && (
          <FormField label="Utdypende beskrivelse">
            <Textarea
              {...register('konsekvens_beskrivelse' as any)}
              rows={3}
              fullWidth
            />
          </FormField>
        )}

        {!harKonsekvens && (
          <Alert variant="warning" title="Ingen konsekvenser valgt">
            Er du sikker på at endringen ikke har konsekvenser?
          </Alert>
        )}
      </SectionContainer>

      {/* Oppgjør — kun hvis pris eller fremdrift */}
      {(formValues.konsekvenser_pris || formValues.konsekvenser_fremdrift) && (
        <SectionContainer
          title="Oppgjør"
          description="Spesifiser vederlag og/eller fristforlengelse"
        >
          {formValues.konsekvenser_pris && (
            <div className="space-y-3 sm:space-y-4">
              <FormField
                label="Beregningsmetode"
                required
                error={!formValues.oppgjorsform ? 'Velg beregningsmetode' : undefined}
              >
                <div className="space-y-2">
                  {OPPGJORSFORM_OPTIONS.map((opt) => (
                    <Controller
                      key={opt.value}
                      name={'oppgjorsform' as any}
                      control={control}
                      render={({ field }) => (
                        <button
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          className={`w-full p-3 border rounded-none text-left transition-colors ${
                            field.value === opt.value
                              ? 'border-pkt-brand-purple-1000 bg-pkt-surface-light-beige'
                              : 'border-pkt-border-default hover:border-pkt-border-focus'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">
                                {opt.label}{' '}
                                <span className="text-pkt-text-body-subtle">({opt.paragraf})</span>
                              </p>
                              <p className="text-xs text-pkt-text-body-subtle mt-0.5">
                                {opt.description}
                              </p>
                            </div>
                            <IndeksreguleringsInfo indeks={opt.indeksregulering} />
                          </div>
                        </button>
                      )}
                    />
                  ))}
                </div>
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Kompensasjon (tillegg)"
                  helpText={totalFromKOE > 0 ? `Fra valgte KOE: ${formatCurrency(totalFromKOE)}` : 'Beløp som tilkjennes TE'}
                >
                  <Controller
                    name={'kompensasjon_belop' as any}
                    control={control}
                    render={({ field }) => (
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        allowNegative={false}
                      />
                    )}
                  />
                </FormField>

                <FormField label="Fradrag" helpText="Eventuelt motregningsbeløp">
                  <Controller
                    name={'fradrag_belop' as any}
                    control={control}
                    render={({ field }) => (
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        allowNegative={false}
                      />
                    )}
                  />
                </FormField>
              </div>

              <div className="p-3 bg-pkt-surface-subtle border border-pkt-border-subtle rounded-none">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Netto beløp:</span>
                  <span className={`font-bold text-base ${nettoBelop < 0 ? 'text-pkt-brand-red-1000' : ''}`}>
                    {formatCurrency(nettoBelop)}
                  </span>
                </div>
              </div>

              {formValues.oppgjorsform === 'REGNINGSARBEID' && (
                <Alert variant="info" title="Oppgjør ved sluttoppgjør">
                  Endelig beløp fastsettes basert på dokumenterte kostnader.
                </Alert>
              )}
            </div>
          )}

          {formValues.konsekvenser_fremdrift && (
            <div className={`space-y-4 ${formValues.konsekvenser_pris ? 'pt-4 border-t-2 border-pkt-border-subtle' : ''}`}>
              {formValues.konsekvenser_pris && (
                <h4 className="font-medium text-sm">Fristforlengelse</h4>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Antall dager"
                  helpText={totalDagerFromKOE > 0 ? `Fra valgte KOE: ${totalDagerFromKOE} dager` : 'Fristforlengelse i kalenderdager'}
                >
                  <Controller
                    name={'frist_dager' as any}
                    control={control}
                    render={({ field }) => (
                      <Input
                        type="number"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)
                        }
                        width="xs"
                      />
                    )}
                  />
                </FormField>

                <FormField label="Ny sluttdato" helpText="Justert kontraktsfrist">
                  <Controller
                    name={'ny_sluttdato' as any}
                    control={control}
                    render={({ field }) => (
                      <DatePicker id="ny_sluttdato" value={field.value} onChange={field.onChange} />
                    )}
                  />
                </FormField>
              </div>
            </div>
          )}
        </SectionContainer>
      )}
    </>
  );
}
```

**Step 2: Export from forms index**

Add to `src/components/forms/index.ts`:

```ts
export {
  EndringsordreForm,
  endringsordreFormSchema,
  OPPGJORSFORM_OPTIONS,
  formatCurrency,
  type EndringsordreFormData,
} from './EndringsordreForm';
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to EndringsordreForm.

**Step 4: Commit**

```bash
git add src/components/forms/EndringsordreForm.tsx src/components/forms/index.ts
git commit -m "feat: extract shared EndringsordreForm component from modal"
```

---

### Task 3: Create OpprettEndringsordre page

**Files:**
- Create: `src/pages/OpprettEndringsordre.tsx`
- Modify: `src/App.tsx`

**Step 1: Create the page**

Create `src/pages/OpprettEndringsordre.tsx` following the `OpprettSakPage` pattern. Uses `EndringsordreForm` for all form sections. Includes the same auto-fill and KOE-selection logic currently in the modal, but in a page context.

```tsx
/**
 * OpprettEndringsordre Page
 *
 * Page for BH to create a new Endringsordre (Change Order) per NS 8407 §31.3.
 * Uses the shared EndringsordreForm component for consistent UI with UtstEndringsordreModal.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  DropdownMenuItem,
  useToast,
} from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import {
  EndringsordreForm,
  endringsordreFormSchema,
  type EndringsordreFormData,
} from '../components/forms';
import {
  opprettEndringsordre,
  fetchKandidatKOESaker,
  fetchNesteEONummer,
  type OpprettEORequest,
} from '../api/endringsordre';
import { endringsordreKeys } from '../queries';
import { STALE_TIME } from '../constants/queryConfig';

export function OpprettEndringsordre() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const pendingToastId = useRef<string | null>(null);

  // KOE selection state
  const [selectedKoeIds, setSelectedKoeIds] = useState<string[]>([]);

  // Form
  const form = useForm<EndringsordreFormData>({
    resolver: zodResolver(endringsordreFormSchema),
    mode: 'onTouched',
    defaultValues: {
      eo_nummer: '',
      tittel: '',
      beskrivelse: '',
      konsekvenser_sha: false,
      konsekvenser_kvalitet: false,
      konsekvenser_fremdrift: false,
      konsekvenser_pris: false,
      konsekvenser_annet: false,
      konsekvens_beskrivelse: '',
      er_estimat: false,
      kompensasjon_belop: null,
      fradrag_belop: null,
      frist_dager: null,
    },
  });

  const { handleSubmit, setValue, watch, formState: { isSubmitting } } = form;
  const formValues = watch();

  // Fetch candidate KOE cases
  const { data: kandidaterData, isLoading: kandidaterLoading } = useQuery({
    queryKey: endringsordreKeys.kandidater(),
    queryFn: fetchKandidatKOESaker,
    staleTime: STALE_TIME.DEFAULT,
  });
  const kandidatSaker = kandidaterData?.kandidat_saker ?? [];

  // Fetch next EO number
  const { data: nesteNummerData } = useQuery({
    queryKey: endringsordreKeys.nesteNummer(),
    queryFn: fetchNesteEONummer,
    staleTime: STALE_TIME.DEFAULT,
  });

  // Auto-fill EO-nummer
  const hasAutoFilled = useRef(false);
  useEffect(() => {
    if (nesteNummerData?.neste_nummer && !hasAutoFilled.current && !formValues.eo_nummer) {
      setValue('eo_nummer', nesteNummerData.neste_nummer);
      hasAutoFilled.current = true;
    }
  }, [nesteNummerData, formValues.eo_nummer, setValue]);

  // Computed KOE totals
  const totalFromKOE = useMemo(() => {
    return kandidatSaker
      .filter((k) => selectedKoeIds.includes(k.sak_id))
      .reduce((sum, k) => sum + (k.sum_godkjent || 0), 0);
  }, [kandidatSaker, selectedKoeIds]);

  const totalDagerFromKOE = useMemo(() => {
    return kandidatSaker
      .filter((k) => selectedKoeIds.includes(k.sak_id))
      .reduce((sum, k) => sum + (k.godkjent_dager || 0), 0);
  }, [kandidatSaker, selectedKoeIds]);

  // Auto-fill from KOE selection
  useEffect(() => {
    if (totalFromKOE > 0 && !formValues.konsekvenser_pris) {
      setValue('konsekvenser_pris', true);
    }
    if (totalDagerFromKOE > 0 && !formValues.konsekvenser_fremdrift) {
      setValue('konsekvenser_fremdrift', true);
    }
    if (totalFromKOE > 0 && !formValues.kompensasjon_belop) {
      setValue('kompensasjon_belop', totalFromKOE);
    }
    if (totalDagerFromKOE > 0 && !formValues.frist_dager) {
      setValue('frist_dager', totalDagerFromKOE);
    }
  }, [totalFromKOE, totalDagerFromKOE, formValues.konsekvenser_pris, formValues.konsekvenser_fremdrift, formValues.kompensasjon_belop, formValues.frist_dager, setValue]);

  // Auto-set er_estimat based on oppgjorsform
  useEffect(() => {
    if (formValues.oppgjorsform === 'FASTPRIS_TILBUD') {
      setValue('er_estimat', false);
    } else if (formValues.oppgjorsform) {
      setValue('er_estimat', true);
    }
  }, [formValues.oppgjorsform, setValue]);

  // Toggle KOE
  const toggleKoeSelection = (koeId: string) => {
    setSelectedKoeIds((prev) =>
      prev.includes(koeId) ? prev.filter((id) => id !== koeId) : [...prev, koeId]
    );
  };

  // Create mutation
  const createEOMutation = useMutation({
    mutationFn: (data: OpprettEORequest) => opprettEndringsordre(data),
    onSuccess: (response) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      queryClient.invalidateQueries({ queryKey: endringsordreKeys.nesteNummer() });
      toast.success('Endringsordre opprettet', 'Du blir nå videresendt.');
      navigate(`/endringsordre/${response.sak_id}`);
    },
    onError: (error) => {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = null;
      }
      toast.error('Feil ved opprettelse', error instanceof Error ? error.message : 'En feil oppstod');
    },
  });

  const onSubmit = (data: EndringsordreFormData) => {
    pendingToastId.current = toast.pending('Oppretter endringsordre...', 'Vennligst vent.');
    const request: OpprettEORequest = {
      eo_nummer: data.eo_nummer,
      tittel: data.tittel,
      beskrivelse: data.beskrivelse,
      koe_sak_ids: selectedKoeIds.length > 0 ? selectedKoeIds : undefined,
      konsekvenser: {
        sha: data.konsekvenser_sha,
        kvalitet: data.konsekvenser_kvalitet,
        fremdrift: data.konsekvenser_fremdrift,
        pris: data.konsekvenser_pris,
        annet: data.konsekvenser_annet,
      },
      konsekvens_beskrivelse: data.konsekvens_beskrivelse || undefined,
      oppgjorsform: data.oppgjorsform || undefined,
      kompensasjon_belop: data.kompensasjon_belop ?? undefined,
      fradrag_belop: data.fradrag_belop ?? undefined,
      er_estimat: data.er_estimat,
      frist_dager: data.frist_dager ?? undefined,
      ny_sluttdato: data.ny_sluttdato || undefined,
    };
    createEOMutation.mutate(request);
  };

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      <PageHeader
        title="Opprett endringsordre"
        subtitle="Utsted en formell endringsordre (EO) etter NS 8407 §31.3"
        menuActions={
          <DropdownMenuItem asChild>
            <Link to="/saker">Tilbake til oversikt</Link>
          </DropdownMenuItem>
        }
      />

      <main className="max-w-3xl mx-auto px-2 pt-2 pb-4 sm:px-4 sm:pt-3 sm:pb-6">
        <Card variant="outlined" padding="none">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
            <EndringsordreForm
              form={form}
              kandidatSaker={kandidatSaker}
              kandidaterLoading={kandidaterLoading}
              selectedKoeIds={selectedKoeIds}
              onToggleKoeSelection={toggleKoeSelection}
              totalFromKOE={totalFromKOE}
              totalDagerFromKOE={totalDagerFromKOE}
            />

            {/* Guidance */}
            <div className="p-4">
              <Alert variant="info" title="Hva skjer videre?">
                Etter at endringsordren er opprettet kan TE akseptere eller bestride den.
                Du kan også revidere endringsordren om nødvendig.
              </Alert>
            </div>

            {/* Error */}
            {createEOMutation.isError && (
              <div className="px-4 pb-4">
                <Alert variant="danger" title="Feil ved opprettelse">
                  {createEOMutation.error instanceof Error
                    ? createEOMutation.error.message
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
                disabled={isSubmitting || createEOMutation.isPending}
                className="w-full sm:w-auto"
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || createEOMutation.isPending}
                className="w-full sm:w-auto"
              >
                {createEOMutation.isPending ? 'Oppretter...' : 'Opprett endringsordre'}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}

export default OpprettEndringsordre;
```

**Step 2: Add route to App.tsx**

Add lazy import and route for `/endringsordre/ny` in `src/App.tsx`. The route must be placed BEFORE the existing `/endringsordre/:sakId` route so it matches first.

```tsx
// Add lazy import (after OpprettSakPage):
const OpprettEndringsordre = lazy(() => import('./pages/OpprettEndringsordre'));

// Add route BEFORE /endringsordre/:sakId:
<Route
  path="/endringsordre/ny"
  element={
    <ProtectedRoute>
      <OpprettEndringsordre />
    </ProtectedRoute>
  }
/>
```

**Step 3: Verify in browser**

Run: `npm run dev`
Check: Navigate to `/endringsordre/ny`, verify the full form renders with all sections.

**Step 4: Commit**

```bash
git add src/pages/OpprettEndringsordre.tsx src/App.tsx
git commit -m "feat: add OpprettEndringsordre page with shared form"
```

---

### Task 4: Refactor UtstEndringsordreModal to use shared EndringsordreForm

**Files:**
- Modify: `src/components/endringsordre/UtstEndringsordreModal.tsx`

**Step 1: Replace duplicated form sections with EndringsordreForm**

The modal keeps its wizard navigation, step indicator, summary step, and submission logic. Steps 1 and 2 are replaced with `<EndringsordreForm>` sections controlled by `currentStep`. The shared component is rendered inside the wizard steps.

Key changes:
1. Remove duplicated schema — import `endringsordreFormSchema` from forms
2. Remove duplicated OPPGJORSFORM_OPTIONS — import from forms
3. Remove duplicated `IndeksreguleringsInfo` and `formatCurrency` — import from forms
4. Replace step 1 JSX (Identifikasjon + KOE selection) with `<EndringsordreForm showIdentifikasjon={true} showKoeSelection={true} />`
5. Replace step 2 JSX (Konsekvenser + Oppgjør) with `<EndringsordreForm showIdentifikasjon={false} showKoeSelection={false} />`
6. Keep step 3 (summary) and navigation/submission logic as-is

However, since the modal splits the form across wizard steps, the cleanest approach is:
- Import the schema and constants from the shared module
- Keep the modal's own JSX for now (it renders fields conditionally per step)
- Only share schema, types, constants, and helper functions

This avoids over-engineering the step-split rendering while still eliminating duplication of business logic.

Replace these in `UtstEndringsordreModal.tsx`:
1. Delete `utstEndringsordreSchema` — use `endringsordreFormSchema`
2. Delete `UtstEndringsordreFormData` — use `EndringsordreFormData`
3. Delete `OPPGJORSFORM_OPTIONS` and `OppgjorsformOption` — import from forms
4. Delete `IndeksreguleringsInfo` — import from forms
5. Delete `formatCurrency` — import from forms

Add imports:
```tsx
import {
  endringsordreFormSchema,
  type EndringsordreFormData,
  OPPGJORSFORM_OPTIONS,
  formatCurrency,
} from '../forms';
```

Update the form type from `UtstEndringsordreFormData` to `EndringsordreFormData` and the resolver from `utstEndringsordreSchema` to `endringsordreFormSchema`.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Verify modal still works in browser**

Run: `npm run dev`
Check: Open a KOE case, trigger the "Utsted Endringsordre" modal, verify all 3 steps work correctly.

**Step 4: Commit**

```bash
git add src/components/endringsordre/UtstEndringsordreModal.tsx
git commit -m "refactor: use shared schema and constants from EndringsordreForm in modal"
```

---

### Task 5: Update PageHeader menu and EmptyProjectState for role awareness

**Files:**
- Modify: `src/pages/SaksoversiktPage.tsx`

**Step 1: Update PageHeader menu link**

The "Opprett ny sak" menu link should also be role-aware. Update:

```tsx
<DropdownMenuItem asChild>
  <Link to={userRole === 'BH' ? '/endringsordre/ny' : '/saker/ny'}>
    {userRole === 'BH' ? 'Opprett endringsordre' : 'Opprett ny sak'}
  </Link>
</DropdownMenuItem>
```

**Step 2: Update EmptyProjectState for BH**

The empty state should also be role-aware. Update the `onCreateCase` callback and label:

```tsx
{allCases.length === 0 ? (
  <EmptyProjectState
    projectName={activeProject.name}
    userRole={userRole}
    onCreateCase={() => navigate(userRole === 'BH' ? '/endringsordre/ny' : '/saker/ny')}
  />
) : (
```

Update the `EmptyProjectState` component to accept `userRole` and show appropriate text:

```tsx
function EmptyProjectState({
  projectName,
  userRole,
  onCreateCase,
}: {
  projectName: string;
  userRole: 'BH' | 'TE';
  onCreateCase: () => void;
}) {
  const isEO = userRole === 'BH';
  // ...
  // Update button text:
  <Button variant="primary" onClick={onCreateCase}>
    <PlusIcon className="w-4 h-4 mr-1.5" />
    {isEO ? 'Opprett første endringsordre' : 'Opprett første sak'}
  </Button>
  // Update description:
  <p className="text-sm text-pkt-text-body-subtle mb-8 leading-relaxed">
    {isEO
      ? 'Opprett din første endringsordre for å starte digital håndtering etter NS 8407.'
      : 'Opprett din første KOE-sak for å starte digital håndtering av endringsordrer etter NS 8407.'}
  </p>
```

**Step 3: Verify in browser**

Check both BH and TE roles see correct menu items and empty state text.

**Step 4: Commit**

```bash
git add src/pages/SaksoversiktPage.tsx
git commit -m "feat: make PageHeader menu and EmptyProjectState role-aware"
```

---

### Task 6: Run tests and verify

**Files:**
- No new files

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Clean compile, no errors.

**Step 2: Run unit tests**

Run: `npm run test`
Expected: All existing tests pass.

**Step 3: Run linting**

Run: `npm run lint`
Expected: No errors (warnings are acceptable).

**Step 4: Manual verification checklist**

- [ ] TE user sees "Nytt krav om endring" button in ProjectIdentityTile → navigates to `/saker/ny`
- [ ] BH user sees "Ny endringsordre" button in ProjectIdentityTile → navigates to `/endringsordre/ny`
- [ ] OpprettEndringsordre page loads with auto-filled EO-nummer
- [ ] KOE candidate selection works (checkboxes, totals calculated)
- [ ] Konsekvenser checkboxes toggle oppgjør/frist sections correctly
- [ ] Form submission creates EO and navigates to detail page
- [ ] UtstEndringsordreModal still works correctly (wizard steps, submission)
- [ ] Empty project state shows role-appropriate text
- [ ] PageHeader menu shows role-appropriate link

**Step 5: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address test/lint issues from opprett-sak implementation"
```
