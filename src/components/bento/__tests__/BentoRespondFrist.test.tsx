import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../primitives/Toast';
import { BentoRespondFrist } from '../BentoRespondFrist';
import type { FristBridgeComputed } from '../../../hooks/useFristBridge';

// Wrap with QueryClient + ToastProvider
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>
  );
}

const defaultComputed: FristBridgeComputed = {
  erPrekludert: false,
  erRedusert: false,
  erGrunnlagSubsidiaer: false,
  erGrunnlagPrekludert: false,
  erForesporselSvarForSent: false,
  harTidligereVarselITide: false,
  prinsipaltResultat: 'godkjent',
  subsidiaertResultat: undefined,
  visSubsidiaertResultat: false,
  visForsering: false,
  avslatteDager: 0,
  sendForesporsel: false,
  subsidiaerTriggers: [],
  autoBegrunnelse: '',
  dynamicPlaceholder: 'Begrunn din godkjenning...',
  godkjentDager: 10,
};

const defaultProps = {
  sakId: 'test-1',
  fristKravId: 'frist-test-1',
  computed: defaultComputed,
  buildEventData: vi.fn(() => ({})),
  onSuccess: vi.fn(),
  onCancel: vi.fn(),
};

describe('BentoRespondFrist', () => {
  it('renders begrunnelse editor', () => {
    renderWithProviders(<BentoRespondFrist {...defaultProps} />);
    expect(screen.getByText(/begrunnelse/i)).toBeInTheDocument();
  });

  it('shows submit and cancel buttons', () => {
    renderWithProviders(<BentoRespondFrist {...defaultProps} />);
    expect(screen.getByText('Send svar')).toBeInTheDocument();
    expect(screen.getByText('Avbryt')).toBeInTheDocument();
  });

  it('shows draft button when approvalEnabled', () => {
    renderWithProviders(
      <BentoRespondFrist {...defaultProps} approvalEnabled onSaveDraft={vi.fn()} />
    );
    expect(screen.getByText('Lagre utkast')).toBeInTheDocument();
  });

  it('shows forespørsel info when sendForesporsel is true', () => {
    renderWithProviders(
      <BentoRespondFrist
        {...defaultProps}
        computed={{ ...defaultComputed, sendForesporsel: true }}
      />
    );
    expect(screen.getByText(/§33.6.2/)).toBeInTheDocument();
  });

  it('disables submit when no resultat', () => {
    renderWithProviders(
      <BentoRespondFrist
        {...defaultProps}
        computed={{ ...defaultComputed, prinsipaltResultat: undefined }}
      />
    );
    expect(screen.getByText('Send svar').closest('button')).toBeDisabled();
  });
});
