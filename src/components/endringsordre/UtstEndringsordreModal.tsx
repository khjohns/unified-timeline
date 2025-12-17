/**
 * UtstEndringsordreModal Component
 *
 * Multi-step wizard modal for BH to issue an Endringsordre (Change Order).
 * Based on NS 8407 §31.3 and the Endringsordre template.
 *
 * Steps:
 * 1. Basic info (EO-nummer, beskrivelse)
 * 2. Select KOE cases to include
 * 3. Consequences (SHA, kvalitet, fremdrift, pris, annet)
 * 4. Settlement (oppgjørsform, beløp, frist)
 * 5. Review and submit
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../primitives/Modal';
import { Button } from '../primitives/Button';
import { Alert } from '../primitives/Alert';
import { DatePicker } from '../primitives/DatePicker';
import {
  CheckIcon,
  Cross2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoCircledIcon,
} from '@radix-ui/react-icons';
import {
  opprettEndringsordre,
  fetchKandidatKOESaker,
  type OpprettEORequest,
  type KandidatKOE,
} from '../../api/endringsordre';
import type { VederlagsMetode, EOKonsekvenser } from '../../types/timeline';

interface UtstEndringsordreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sakId: string;
  preselectedKoeIds?: string[];
}

type WizardStep = 'basic' | 'koe' | 'konsekvenser' | 'oppgjor' | 'review';

const WIZARD_STEPS: WizardStep[] = ['basic', 'koe', 'konsekvenser', 'oppgjor', 'review'];

const STEP_TITLES: Record<WizardStep, string> = {
  basic: 'Grunnleggende info',
  koe: 'Velg KOE-saker',
  konsekvenser: 'Konsekvenser',
  oppgjor: 'Oppgjør',
  review: 'Bekreft',
};

interface OppgjorsformOption {
  value: VederlagsMetode;
  label: string;
  paragraf: string;
  indeksregulering: 'full' | 'delvis' | 'ingen';
  description: string;
}

const OPPGJORSFORM_OPTIONS: OppgjorsformOption[] = [
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
    description: 'Oppgjør etter medgått tid og materialer. Timerater indeksreguleres.',
  },
  {
    value: 'FASTPRIS_TILBUD',
    label: 'Fastpris / Tilbud',
    paragraf: '§34.2.1',
    indeksregulering: 'ingen',
    description: 'Entreprenørens tilbud. Ikke gjenstand for indeksregulering.',
  },
];

function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('nb-NO')} kr`;
}

function IndeksreguleringsInfo({ indeks }: { indeks: 'full' | 'delvis' | 'ingen' }) {
  const colors = {
    full: 'text-badge-success-text bg-badge-success-bg',
    delvis: 'text-badge-warning-text bg-badge-warning-bg',
    ingen: 'text-pkt-text-body-subtle bg-pkt-surface-subtle',
  };
  const labels = {
    full: 'Full indeksregulering',
    delvis: 'Delvis indeksregulering',
    ingen: 'Ingen indeksregulering',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium ${colors[indeks]}`}>
      {labels[indeks]}
    </span>
  );
}

export function UtstEndringsordreModal({
  open,
  onOpenChange,
  sakId,
  preselectedKoeIds = [],
}: UtstEndringsordreModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic');

  // Form state
  const [eoNummer, setEoNummer] = useState('');
  const [beskrivelse, setBeskrivelse] = useState('');
  const [selectedKoeIds, setSelectedKoeIds] = useState<string[]>(preselectedKoeIds);
  const [konsekvenser, setKonsekvenser] = useState<EOKonsekvenser>({
    sha: false,
    kvalitet: false,
    fremdrift: false,
    pris: false,
    annet: false,
  });
  const [konsekvensBeskrivelse, setKonsekvensBeskrivelse] = useState('');
  const [oppgjorsform, setOppgjorsform] = useState<VederlagsMetode | ''>('');
  const [kompensasjonBelop, setKompensasjonBelop] = useState('');
  const [fradragBelop, setFradragBelop] = useState('');
  const [erEstimat, setErEstimat] = useState(false);
  const [fristDager, setFristDager] = useState('');
  const [nySluttdato, setNySluttdato] = useState<Date | undefined>(undefined);

  // Fetch candidate KOE cases
  const { data: kandidaterData, isLoading: kandidaterLoading } = useQuery({
    queryKey: ['endringsordre', 'kandidater'],
    queryFn: fetchKandidatKOESaker,
    enabled: open,
    staleTime: 30_000,
  });

  const kandidatSaker = kandidaterData?.kandidat_saker ?? [];

  // Create EO mutation
  const createEOMutation = useMutation({
    mutationFn: (data: OpprettEORequest) => opprettEndringsordre(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['case', sakId] });
      queryClient.invalidateQueries({ queryKey: ['timeline', sakId] });
      handleClose();
      // Navigate to the new EO page
      navigate(`/endringsordre/${response.sak_id}`);
    },
  });

  // Computed values
  const nettoBelop = useMemo(() => {
    const komp = parseFloat(kompensasjonBelop) || 0;
    const frad = parseFloat(fradragBelop) || 0;
    return komp - frad;
  }, [kompensasjonBelop, fradragBelop]);

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

  // Validation
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'basic':
        return eoNummer.trim() !== '' && beskrivelse.trim() !== '';
      case 'koe':
        return true; // KOE selection is optional
      case 'konsekvenser':
        return true; // At least one consequence should ideally be selected, but not required
      case 'oppgjor':
        // If pris consequence, oppgjørsform is required
        if (konsekvenser.pris && !oppgjorsform) return false;
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  }, [currentStep, eoNummer, beskrivelse, konsekvenser.pris, oppgjorsform]);

  // Navigation
  const currentStepIndex = WIZARD_STEPS.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  const goNext = () => {
    if (!isLastStep && canProceed) {
      setCurrentStep(WIZARD_STEPS[currentStepIndex + 1]);
    }
  };

  const goBack = () => {
    if (!isFirstStep) {
      setCurrentStep(WIZARD_STEPS[currentStepIndex - 1]);
    }
  };

  const handleSubmit = () => {
    const request: OpprettEORequest = {
      eo_nummer: eoNummer,
      beskrivelse,
      koe_sak_ids: selectedKoeIds.length > 0 ? selectedKoeIds : undefined,
      konsekvenser,
      konsekvens_beskrivelse: konsekvensBeskrivelse || undefined,
      oppgjorsform: oppgjorsform || undefined,
      kompensasjon_belop: kompensasjonBelop ? parseFloat(kompensasjonBelop) : undefined,
      fradrag_belop: fradragBelop ? parseFloat(fradragBelop) : undefined,
      er_estimat: erEstimat,
      frist_dager: fristDager ? parseInt(fristDager, 10) : undefined,
      ny_sluttdato: nySluttdato ? nySluttdato.toISOString().split('T')[0] : undefined,
    };

    createEOMutation.mutate(request);
  };

  const handleClose = () => {
    // Reset form
    setCurrentStep('basic');
    setEoNummer('');
    setBeskrivelse('');
    setSelectedKoeIds(preselectedKoeIds);
    setKonsekvenser({
      sha: false,
      kvalitet: false,
      fremdrift: false,
      pris: false,
      annet: false,
    });
    setKonsekvensBeskrivelse('');
    setOppgjorsform('');
    setKompensasjonBelop('');
    setFradragBelop('');
    setErEstimat(false);
    setFristDager('');
    setNySluttdato(undefined);
    onOpenChange(false);
  };

  const toggleKoeSelection = (koeId: string) => {
    setSelectedKoeIds((prev) =>
      prev.includes(koeId) ? prev.filter((id) => id !== koeId) : [...prev, koeId]
    );
  };

  const toggleKonsekvens = (key: keyof EOKonsekvenser) => {
    setKonsekvenser((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Utsted Endringsordre"
      description={`Steg ${currentStepIndex + 1} av ${WIZARD_STEPS.length}: ${STEP_TITLES[currentStep]}`}
      size="lg"
    >
      {/* Progress indicator */}
      <div className="flex items-center gap-1 mb-6">
        {WIZARD_STEPS.map((step, index) => (
          <div
            key={step}
            className={`flex-1 h-1.5 ${
              index <= currentStepIndex
                ? 'bg-pkt-brand-purple-1000'
                : 'bg-pkt-border-subtle'
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[300px]">
        {/* Step 1: Basic info */}
        {currentStep === 'basic' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                EO-nummer <span className="text-alert-danger-text">*</span>
              </label>
              <input
                type="text"
                value={eoNummer}
                onChange={(e) => setEoNummer(e.target.value)}
                placeholder="f.eks. EO-001"
                className="w-full px-3 py-2 bg-pkt-bg-card border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Beskrivelse av tillegg eller endring <span className="text-alert-danger-text">*</span>
              </label>
              <textarea
                value={beskrivelse}
                onChange={(e) => setBeskrivelse(e.target.value)}
                placeholder="Beskriv endringen som denne endringsordren gjelder..."
                rows={4}
                className="w-full px-3 py-2 bg-pkt-bg-card border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 2: Select KOE cases */}
        {currentStep === 'koe' && (
          <div className="space-y-4">
            <Alert variant="info" title="Velg relaterte KOE-saker">
              Velg KOE-saker (krav om endringsordre) som skal inkluderes i denne endringsordren.
              Du kan også utstede en endringsordre uten tilknyttede KOE-saker.
            </Alert>

            {kandidaterLoading ? (
              <p className="text-pkt-text-body-subtle text-sm">Laster kandidatsaker...</p>
            ) : kandidatSaker.length === 0 ? (
              <p className="text-pkt-text-body-subtle text-sm">
                Ingen KOE-saker er klare for endringsordre.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {kandidatSaker.map((koe) => (
                  <button
                    key={koe.sak_id}
                    type="button"
                    onClick={() => toggleKoeSelection(koe.sak_id)}
                    className={`w-full p-3 border-2 rounded-none text-left transition-colors ${
                      selectedKoeIds.includes(koe.sak_id)
                        ? 'border-pkt-brand-purple-1000 bg-pkt-surface-light-beige'
                        : 'border-pkt-border-default hover:border-pkt-border-focus'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{koe.tittel}</p>
                        <p className="text-xs text-pkt-text-body-subtle mt-1">
                          Status: {koe.overordnet_status}
                        </p>
                        <div className="flex gap-4 text-xs text-pkt-text-body-subtle mt-1">
                          {koe.sum_godkjent !== undefined && (
                            <span>Godkjent: {formatCurrency(koe.sum_godkjent)}</span>
                          )}
                          {koe.godkjent_dager !== undefined && (
                            <span>Dager: {koe.godkjent_dager}</span>
                          )}
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 border-2 flex items-center justify-center ${
                          selectedKoeIds.includes(koe.sak_id)
                            ? 'bg-pkt-brand-purple-1000 border-pkt-brand-purple-1000'
                            : 'border-pkt-border-default'
                        }`}
                      >
                        {selectedKoeIds.includes(koe.sak_id) && (
                          <CheckIcon className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedKoeIds.length > 0 && (
              <div className="p-3 bg-pkt-surface-subtle border-2 border-pkt-border-subtle rounded-none">
                <p className="text-sm font-medium">
                  {selectedKoeIds.length} sak(er) valgt
                </p>
                <div className="flex gap-6 text-xs text-pkt-text-body-subtle mt-1">
                  <span>Totalt godkjent beløp: {formatCurrency(totalFromKOE)}</span>
                  <span>Totalt godkjente dager: {totalDagerFromKOE}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Consequences */}
        {currentStep === 'konsekvenser' && (
          <div className="space-y-4">
            <p className="text-sm text-pkt-text-body-subtle">
              Angi hvilke konsekvenser endringen har. Kryss av for de som <strong>ikke</strong> påvirkes.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(['sha', 'kvalitet', 'fremdrift', 'pris', 'annet'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleKonsekvens(key)}
                  className={`p-3 border-2 rounded-none text-left transition-colors ${
                    !konsekvenser[key]
                      ? 'border-badge-success-text bg-badge-success-bg'
                      : 'border-pkt-border-default hover:border-pkt-border-focus'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {!konsekvenser[key] ? (
                      <CheckIcon className="w-4 h-4 text-badge-success-text" />
                    ) : (
                      <Cross2Icon className="w-4 h-4 text-pkt-text-body-subtle" />
                    )}
                    <span className="text-sm font-medium capitalize">
                      {key === 'sha' ? 'SHA' : key}
                    </span>
                  </div>
                  <p className="text-xs text-pkt-text-body-subtle mt-1">
                    {!konsekvenser[key] ? 'Ingen konsekvens' : 'Har konsekvens'}
                  </p>
                </button>
              ))}
            </div>

            {(konsekvenser.sha || konsekvenser.kvalitet || konsekvenser.fremdrift || konsekvenser.pris || konsekvenser.annet) && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Beskrivelse av konsekvenser
                </label>
                <textarea
                  value={konsekvensBeskrivelse}
                  onChange={(e) => setKonsekvensBeskrivelse(e.target.value)}
                  placeholder="Beskriv konsekvensene for de avkryssede områdene..."
                  rows={3}
                  className="w-full px-3 py-2 bg-pkt-bg-card border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus resize-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 4: Settlement */}
        {currentStep === 'oppgjor' && (
          <div className="space-y-4">
            {/* Oppgjørsform */}
            {konsekvenser.pris && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Oppgjørsform ved priskonsekvens <span className="text-alert-danger-text">*</span>
                  </label>
                  <div className="space-y-2">
                    {OPPGJORSFORM_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setOppgjorsform(opt.value)}
                        className={`w-full p-3 border-2 rounded-none text-left transition-colors ${
                          oppgjorsform === opt.value
                            ? 'border-pkt-brand-purple-1000 bg-pkt-surface-light-beige'
                            : 'border-pkt-border-default hover:border-pkt-border-focus'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">
                              {opt.label} <span className="text-pkt-text-body-subtle">({opt.paragraf})</span>
                            </p>
                            <p className="text-xs text-pkt-text-body-subtle mt-0.5">{opt.description}</p>
                          </div>
                          <IndeksreguleringsInfo indeks={opt.indeksregulering} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Beløp */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Kompensasjon (kr)
                    </label>
                    <input
                      type="number"
                      value={kompensasjonBelop}
                      onChange={(e) => setKompensasjonBelop(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-pkt-bg-card border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Fradrag (kr)
                    </label>
                    <input
                      type="number"
                      value={fradragBelop}
                      onChange={(e) => setFradragBelop(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-pkt-bg-card border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus"
                    />
                  </div>
                </div>

                {/* Netto */}
                <div className="p-3 bg-pkt-surface-subtle border-2 border-pkt-border-subtle rounded-none">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Netto beløp:</span>
                    <span className={`font-bold ${nettoBelop >= 0 ? '' : 'text-alert-danger-text'}`}>
                      {formatCurrency(nettoBelop)}
                    </span>
                  </div>
                </div>

                {/* Estimat checkbox */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={erEstimat}
                    onChange={(e) => setErEstimat(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Beløpet er et estimat</span>
                </label>
              </>
            )}

            {/* Fristforlengelse */}
            {konsekvenser.fremdrift && (
              <div className="space-y-4 pt-4 border-t-2 border-pkt-border-subtle">
                <h4 className="font-medium text-sm">Fristforlengelse</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Antall dager
                    </label>
                    <input
                      type="number"
                      value={fristDager}
                      onChange={(e) => setFristDager(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-pkt-bg-card border-2 border-pkt-border-default rounded-none text-sm focus:outline-none focus:border-pkt-border-focus"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Ny sluttdato
                    </label>
                    <DatePicker
                      selected={nySluttdato}
                      onChange={(date) => setNySluttdato(date)}
                      placeholderText="Velg dato"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Info when neither pris nor fremdrift */}
            {!konsekvenser.pris && !konsekvenser.fremdrift && (
              <Alert variant="info" title="Ingen pris- eller fristkonsekvens">
                Siden endringsordren ikke har pris- eller fremdriftskonsekvens, trengs ingen oppgjørsinfo.
              </Alert>
            )}
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 'review' && (
          <div className="space-y-4">
            <Alert variant="info" title="Gjennomgå før utsendelse">
              Kontroller at all informasjon er korrekt før du utsteder endringsordren.
            </Alert>

            {/* Summary */}
            <div className="space-y-3">
              <div className="p-3 bg-pkt-surface-subtle border-2 border-pkt-border-subtle rounded-none">
                <h4 className="font-medium text-sm mb-2">Grunnleggende info</h4>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-pkt-text-body-subtle">EO-nummer:</dt>
                  <dd className="font-medium">{eoNummer}</dd>
                  <dt className="text-pkt-text-body-subtle">Beskrivelse:</dt>
                  <dd className="col-span-2 font-medium">{beskrivelse}</dd>
                </dl>
              </div>

              {selectedKoeIds.length > 0 && (
                <div className="p-3 bg-pkt-surface-subtle border-2 border-pkt-border-subtle rounded-none">
                  <h4 className="font-medium text-sm mb-2">Relaterte KOE-saker</h4>
                  <p className="text-sm">{selectedKoeIds.length} sak(er) inkludert</p>
                  <p className="text-xs text-pkt-text-body-subtle mt-1">
                    Totalt godkjent: {formatCurrency(totalFromKOE)} / {totalDagerFromKOE} dager
                  </p>
                </div>
              )}

              <div className="p-3 bg-pkt-surface-subtle border-2 border-pkt-border-subtle rounded-none">
                <h4 className="font-medium text-sm mb-2">Konsekvenser</h4>
                <div className="flex flex-wrap gap-2">
                  {!konsekvenser.sha && (
                    <span className="px-2 py-0.5 text-xs bg-badge-success-bg text-badge-success-text">
                      Ingen SHA-konsekvens
                    </span>
                  )}
                  {!konsekvenser.kvalitet && (
                    <span className="px-2 py-0.5 text-xs bg-badge-success-bg text-badge-success-text">
                      Ingen kvalitetskonsekvens
                    </span>
                  )}
                  {!konsekvenser.fremdrift && (
                    <span className="px-2 py-0.5 text-xs bg-badge-success-bg text-badge-success-text">
                      Ingen fremdriftskonsekvens
                    </span>
                  )}
                  {!konsekvenser.pris && (
                    <span className="px-2 py-0.5 text-xs bg-badge-success-bg text-badge-success-text">
                      Ingen priskonsekvens
                    </span>
                  )}
                  {konsekvenser.pris && (
                    <span className="px-2 py-0.5 text-xs bg-badge-warning-bg text-badge-warning-text">
                      Har priskonsekvens
                    </span>
                  )}
                  {konsekvenser.fremdrift && (
                    <span className="px-2 py-0.5 text-xs bg-badge-warning-bg text-badge-warning-text">
                      Har fremdriftskonsekvens
                    </span>
                  )}
                </div>
              </div>

              {(konsekvenser.pris || konsekvenser.fremdrift) && (
                <div className="p-3 bg-pkt-surface-subtle border-2 border-pkt-border-subtle rounded-none">
                  <h4 className="font-medium text-sm mb-2">Oppgjør</h4>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    {konsekvenser.pris && (
                      <>
                        <dt className="text-pkt-text-body-subtle">Oppgjørsform:</dt>
                        <dd className="font-medium">
                          {OPPGJORSFORM_OPTIONS.find((o) => o.value === oppgjorsform)?.label || '-'}
                        </dd>
                        <dt className="text-pkt-text-body-subtle">Netto beløp:</dt>
                        <dd className="font-medium">
                          {formatCurrency(nettoBelop)}
                          {erEstimat && ' (estimat)'}
                        </dd>
                      </>
                    )}
                    {konsekvenser.fremdrift && (
                      <>
                        <dt className="text-pkt-text-body-subtle">Fristforlengelse:</dt>
                        <dd className="font-medium">{fristDager || '-'} dager</dd>
                        {nySluttdato && (
                          <>
                            <dt className="text-pkt-text-body-subtle">Ny sluttdato:</dt>
                            <dd className="font-medium">
                              {nySluttdato.toLocaleDateString('nb-NO')}
                            </dd>
                          </>
                        )}
                      </>
                    )}
                  </dl>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {createEOMutation.isError && (
        <Alert variant="error" title="Kunne ikke opprette endringsordre" className="mt-4">
          {(createEOMutation.error as Error)?.message || 'En uventet feil oppstod'}
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-6 border-t-2 border-pkt-border-subtle mt-6">
        <Button variant="ghost" type="button" onClick={handleClose}>
          Avbryt
        </Button>

        <div className="flex gap-3">
          {!isFirstStep && (
            <Button variant="secondary" type="button" onClick={goBack}>
              <ChevronLeftIcon className="w-4 h-4 mr-1" />
              Tilbake
            </Button>
          )}

          {!isLastStep && (
            <Button
              variant="primary"
              type="button"
              onClick={goNext}
              disabled={!canProceed}
            >
              Neste
              <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Button>
          )}

          {isLastStep && (
            <Button
              variant="primary"
              type="button"
              onClick={handleSubmit}
              disabled={createEOMutation.isPending}
            >
              {createEOMutation.isPending ? 'Oppretter...' : 'Utsted endringsordre'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
