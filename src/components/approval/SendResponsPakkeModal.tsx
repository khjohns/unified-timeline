/**
 * SendResponsPakkeModal Component
 *
 * Modal for submitting a combined BH response package to the approval workflow.
 * Groups all response tracks (grunnlag, vederlag, frist) into a single approval unit.
 * Calculates combined amount for threshold determination.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  Button,
  CurrencyInput,
  Label,
  Badge,
  Textarea,
  SectionContainer,
  Alert,
  RadioGroup,
  RadioItem,
} from '../primitives';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../primitives/Select';
import type { DraftResponseData, ApprovalRole } from '../../types/approval';
import type { SakState } from '../../types/timeline';
import {
  APPROVAL_THRESHOLDS,
  getRequiredApprovers,
  createApprovalStepsExcludingSubmitter,
  APPROVAL_ROLE_LABELS,
  getPersonsAtRole,
  type MockPerson,
} from '../../constants/approvalConfig';
import { formatCurrency } from '../../utils/formatters';
import { Tabs } from '../primitives';
import { PdfPreview } from '../pdf/PdfPreview';
import { generateContractorClaimPdf } from '../../pdf/generator';
import { mergeDraftsIntoState } from '../../utils/mergeDraftsIntoState';

interface SendResponsPakkeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grunnlagDraft?: DraftResponseData;
  vederlagDraft?: DraftResponseData;
  fristDraft?: DraftResponseData;
  onSubmit: (dagmulktsats: number, comment?: string) => void;
  defaultDagmulktsats?: number;
  currentMockUser: MockPerson;
  currentMockManager?: MockPerson;
  /** SakState for PDF generation */
  sakState?: SakState;
}

export function SendResponsPakkeModal({
  open,
  onOpenChange,
  grunnlagDraft,
  vederlagDraft,
  fristDraft,
  onSubmit,
  defaultDagmulktsats = 50_000,
  currentMockUser,
  currentMockManager,
  sakState,
}: SendResponsPakkeModalProps) {
  const [dagmulktsats, setDagmulktsats] = useState(defaultDagmulktsats);
  const [comment, setComment] = useState('');
  const [approverSelection, setApproverSelection] = useState<'manager' | 'other'>('manager');
  const [selectedOtherApprover, setSelectedOtherApprover] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Calculate amounts
  const vederlagBelop = vederlagDraft?.belop ?? 0;
  const fristDager = fristDraft?.dager ?? 0;
  const fristBelop = fristDager * dagmulktsats;
  const samletBelop = vederlagBelop + fristBelop;

  // Get required approvers (based on amount threshold)
  const requiredApprovers = useMemo(() => getRequiredApprovers(samletBelop), [samletBelop]);

  // Check if approval is actually required based on submitter's role
  const approvalSteps = useMemo(
    () => createApprovalStepsExcludingSubmitter(samletBelop, currentMockUser.rolle),
    [samletBelop, currentMockUser.rolle]
  );
  const noApprovalRequired = approvalSteps.length === 0;

  // The first approver is always the manager (simulating real Entra ID workflow)
  // The manager's role determines who can be selected as alternative approvers
  const firstApproverRole: ApprovalRole | undefined = currentMockManager?.rolle;
  const firstApproverLabel = firstApproverRole ? APPROVAL_ROLE_LABELS[firstApproverRole] : 'Godkjenner';

  // Get all persons at the manager's role level (for "Velg annen godkjenner")
  const personsAtManagerRole = useMemo(
    () => (firstApproverRole ? getPersonsAtRole(firstApproverRole) : []),
    [firstApproverRole]
  );

  // Filter out the manager from other approvers list (since they have their own option)
  const otherApprovers = useMemo(
    () => personsAtManagerRole.filter((p) => p.id !== currentMockManager?.id),
    [personsAtManagerRole, currentMockManager]
  );

  // Find which threshold applies
  const currentThresholdIndex = useMemo(
    () => APPROVAL_THRESHOLDS.findIndex((t) => samletBelop <= t.maxAmount),
    [samletBelop]
  );

  // Memoize drafts object to prevent infinite re-renders
  const drafts = useMemo(() => ({
    grunnlagDraft,
    vederlagDraft,
    fristDraft,
  }), [grunnlagDraft, vederlagDraft, fristDraft]);

  // Handle switching to preview tab and generating PDF
  const handlePreviewTab = useCallback(() => {
    if (activeTab === 'preview') return;

    // Set loading state BEFORE switching tabs to avoid flash of "no PDF"
    if (sakState && !pdfBlob) {
      setIsGeneratingPdf(true);
      setPdfError(null);
    }

    setActiveTab('preview');

    if (!sakState || pdfBlob) return;

    const stateToRender = mergeDraftsIntoState(sakState, drafts);
    generateContractorClaimPdf(stateToRender)
      .then(({ blob }) => setPdfBlob(blob))
      .catch((err) => setPdfError(err instanceof Error ? err.message : 'Ukjent feil'))
      .finally(() => setIsGeneratingPdf(false));
  }, [activeTab, sakState, pdfBlob, drafts]);

  const handleTabChange = (tabId: string) => {
    if (tabId === 'preview') {
      handlePreviewTab();
    } else {
      setActiveTab('form');
    }
  };

  // Count included tracks
  const includedTracks = [grunnlagDraft, vederlagDraft, fristDraft].filter(Boolean).length;

  const handleSubmit = () => {
    onSubmit(dagmulktsats, comment || undefined);
    setComment('');
    setApproverSelection('manager');
    setSelectedOtherApprover('');
    setActiveTab('form');
    setPdfBlob(null);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setComment('');
    setApproverSelection('manager');
    setSelectedOtherApprover('');
    setActiveTab('form');
    setPdfBlob(null);
    onOpenChange(false);
  };

  if (includedTracks === 0) {
    return null;
  }

  // Build summary text
  const summaryParts: string[] = [];
  if (grunnlagDraft) summaryParts.push('ansvarsgrunnlag');
  if (vederlagDraft) summaryParts.push(`vederlag (${formatCurrency(vederlagDraft.belop ?? 0)})`);
  if (fristDraft) summaryParts.push(`frist (${fristDraft.dager ?? 0} dager)`);

  const formatSummaryList = (parts: string[]): string => {
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0]!;
    if (parts.length === 2) return `${parts[0]} og ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')} og ${parts[parts.length - 1]}`;
  };

  // Dynamic modal title based on whether approval is required
  const modalTitle = noApprovalRequired ? 'Godkjenn og send respons' : 'Send til godkjenning';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={modalTitle}
      size="lg"
    >
      {/* Tabs header - only show if we have sakState for PDF preview */}
      {sakState && (
        <Tabs
          tabs={[
            { id: 'form', label: 'Godkjenning' },
            { id: 'preview', label: 'Forhåndsvis PDF' },
          ]}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          className="mb-4"
        />
      )}

      {/* Tab content */}
      {activeTab === 'form' ? (
        <div className="space-y-4">
          {/* Intro with guidance */}
          {noApprovalRequired ? (
            <Alert variant="success" title="Du har fullmakt">
              Som {APPROVAL_ROLE_LABELS[currentMockUser.rolle]} har du fullmakt til å godkjenne
              beløp opp til denne størrelsen. Svaret på {formatSummaryList(summaryParts)} vil
              bli godkjent direkte og sendt til entreprenør.
            </Alert>
          ) : (
            <Alert variant="info" title="Intern godkjenning kreves">
              Du sender svar på {formatSummaryList(summaryParts)} til godkjenning.
              Svaret må godkjennes internt før det sendes til entreprenør.
              Godkjenningsnivå avhenger av samlet økonomisk eksponering.
            </Alert>
          )}

        {/* Amount Calculation */}
        <SectionContainer title="Beløpsberegning">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Vederlag</span>
              <span className="font-mono">{formatCurrency(vederlagBelop)}</span>
            </div>
            <div className="flex justify-between">
              <span>Frist ({fristDager} dager × {formatCurrency(dagmulktsats)}/dag)</span>
              <span className="font-mono">{formatCurrency(fristBelop)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-pkt-border-default font-bold">
              <span>Samlet eksponering</span>
              <span className="font-mono">{formatCurrency(samletBelop)}</span>
            </div>
          </div>

          <div className="pt-2">
            <Label htmlFor="dagmulktsats" className="text-xs text-pkt-text-body-muted">
              Dagmulktsats (per dag)
            </Label>
            <CurrencyInput
              id="dagmulktsats"
              value={dagmulktsats}
              onChange={(value) => setDagmulktsats(value ?? 0)}
              width="sm"
              className="mt-1"
              allowNegative={false}
            />
          </div>
        </SectionContainer>

        {/* Required Approval Chain */}
        <SectionContainer title="Godkjenningskjede">
          {noApprovalRequired ? (
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="success">
                  {APPROVAL_ROLE_LABELS[currentMockUser.rolle]} (deg)
                </Badge>
                <span className="text-sm text-pkt-text-success">✓ Har fullmakt</span>
              </div>
              <p className="text-xs text-pkt-text-body-muted mt-2">
                Du har fullmakt for beløp opp til dette nivået. Ingen ytterligere godkjenning kreves.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {approvalSteps.map((step, index) => (
                  <div key={step.role} className="flex items-center gap-2">
                    <Badge variant={index === 0 ? 'warning' : 'default'}>
                      {step.roleName}
                    </Badge>
                    {index < approvalSteps.length - 1 && (
                      <span className="text-pkt-text-body-muted">→</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-pkt-text-body-muted mt-2">
                Basert på samlet eksponering {formatCurrency(samletBelop)}
              </p>
            </div>
          )}
        </SectionContainer>

        {/* Amount Thresholds - Collapsible */}
        <SectionContainer
          title="Beløpsgrenser"
          variant="subtle"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-pkt-text-body-muted">
                <th className="pb-2 font-medium">Beløp</th>
                <th className="pb-2 font-medium">Kjede</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pkt-border-subtle">
              {APPROVAL_THRESHOLDS.map((threshold, index) => (
                <tr
                  key={threshold.label}
                  className={index === currentThresholdIndex ? 'bg-pkt-surface-light-yellow' : ''}
                >
                  <td className="py-2">
                    {threshold.label}
                    {index === currentThresholdIndex && (
                      <span className="ml-1 text-xs">←</span>
                    )}
                  </td>
                  <td className="py-2 text-pkt-text-body-muted">
                    {threshold.requiredRoles.map((r) => APPROVAL_ROLE_LABELS[r]).join(' → ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionContainer>

        {/* Approver Selection - only show when approval is required */}
        {!noApprovalRequired && (
          <SectionContainer title="Godkjenner">
            {/* Current user info */}
            <div className="text-sm text-pkt-text-body-muted">
              Du er innlogget som:{' '}
              <span className="font-medium text-pkt-text-body-default">
                {currentMockUser.navn}
              </span>
              {' '}({APPROVAL_ROLE_LABELS[currentMockUser.rolle]})
            </div>

            {/* Required role info */}
            <div className="text-sm">
              <span className="text-pkt-text-body-muted">Første godkjenner:</span>{' '}
              <span className="font-medium">{firstApproverLabel}</span>
            </div>

            {/* Approver selection */}
            <RadioGroup
              value={approverSelection}
              onValueChange={(value) => setApproverSelection(value as 'manager' | 'other')}
            >
              <RadioItem
                value="manager"
                label="Min nærmeste leder"
                description={
                  currentMockManager
                    ? `${currentMockManager.navn} (${APPROVAL_ROLE_LABELS[currentMockManager.rolle]}, ${currentMockManager.enhet})`
                    : 'Ingen leder registrert'
                }
                disabled={!currentMockManager}
              />
              <RadioItem
                value="other"
                label="Velg annen godkjenner"
                description={`Velg fra alle ${firstApproverLabel.toLowerCase()}e i organisasjonen`}
              />
            </RadioGroup>

            {/* Other approver dropdown (shown when "other" is selected) */}
            {approverSelection === 'other' && (
              <div className="ml-9">
                <Select value={selectedOtherApprover} onValueChange={setSelectedOtherApprover}>
                  <SelectTrigger width="full">
                    <SelectValue placeholder={`Velg ${firstApproverLabel.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {otherApprovers.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.navn} ({person.enhet})
                      </SelectItem>
                    ))}
                    {/* Include manager in dropdown if they exist */}
                    {currentMockManager && (
                      <SelectItem value={currentMockManager.id}>
                        {currentMockManager.navn} ({currentMockManager.enhet})
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Comment field */}
            <div className="pt-2">
              <Label htmlFor="pakke-comment" className="text-sm mb-1 block" optional>
                Kommentar
              </Label>
              <Textarea
                id="pakke-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Legg til en kommentar til godkjenneren..."
                rows={3}
                fullWidth
              />
            </div>
          </SectionContainer>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-pkt-border-subtle">
          <Button variant="secondary" onClick={handleCancel}>
            Avbryt
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {noApprovalRequired ? 'Godkjenn og send' : 'Send til godkjenning'}
          </Button>
        </div>
      </div>
      ) : (
        <PdfPreview
          blob={pdfBlob}
          isLoading={isGeneratingPdf}
          error={pdfError ?? undefined}
          height="calc(85dvh - 240px)"
          filename={`BH-respons_${sakState?.sak_id ?? 'dokument'}.pdf`}
          onClose={() => setActiveTab('form')}
        />
      )}
    </Modal>
  );
}
