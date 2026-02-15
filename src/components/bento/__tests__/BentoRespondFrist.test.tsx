import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../primitives/Toast';
import { BentoRespondFrist } from '../BentoRespondFrist';

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

const defaultProps = {
  sakId: 'test-1',
  fristKravId: 'frist-test-1',
  krevdDager: 10,
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
});
