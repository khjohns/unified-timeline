/**
 * Tests for PDF Preview Components
 *
 * Tests PdfPreview, PdfPreviewModal, and PDF buttons in approval modals.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PdfPreview } from '@/components/pdf/PdfPreview';
import { PdfPreviewModal } from '@/components/pdf/PdfPreviewModal';
import type { SakState } from '@/types/timeline';

// Mock react-pdf to avoid worker issues in tests
vi.mock('react-pdf', () => ({
  Document: ({ children, onLoadSuccess, onLoadError, loading }: any) => {
    // Simulate successful load after a tick
    setTimeout(() => onLoadSuccess?.({ numPages: 3 }), 0);
    return <div data-testid="pdf-document">{children || loading}</div>;
  },
  Page: ({ pageNumber }: any) => (
    <div data-testid="pdf-page">Page {pageNumber}</div>
  ),
  pdfjs: {
    GlobalWorkerOptions: { workerSrc: '' },
  },
}));

// Mock PDF generator
vi.mock('@/pdf/generator', () => ({
  generateContractorClaimPdf: vi.fn().mockResolvedValue({
    blob: new Blob(['test pdf content'], { type: 'application/pdf' }),
    filename: 'test.pdf',
  }),
  downloadContractorClaimPdf: vi.fn().mockResolvedValue({
    blob: new Blob(['test pdf content'], { type: 'application/pdf' }),
    filename: 'test.pdf',
  }),
  downloadPdfWithDrafts: vi.fn().mockResolvedValue(undefined),
}));

// Mock mergeDraftsIntoState
vi.mock('@/utils/mergeDraftsIntoState', () => ({
  mergeDraftsIntoState: vi.fn((state) => state),
}));

// Create a minimal mock state for testing
const createMockSakState = (overrides: Partial<SakState> = {}): SakState => ({
  sak_id: 'TEST-001',
  sakstittel: 'Test Case',
  grunnlag: {
    status: 'sendt',
    kontraktsreferanser: [],
    laast: false,
    antall_versjoner: 1,
  },
  vederlag: {
    status: 'sendt',
    antall_versjoner: 1,
    belop_direkte: 100000,
  },
  frist: {
    status: 'sendt',
    antall_versjoner: 1,
    krevd_dager: 30,
  },
  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: '',
  visningsstatus_frist: '',
  overordnet_status: 'UNDER_BEHANDLING',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'BH',
    handling: 'Svar på krav',
    spor: 'vederlag',
  },
  sum_krevd: 100000,
  sum_godkjent: 0,
  antall_events: 3,
  ...overrides,
});

describe('PDF Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  describe('PdfPreview', () => {
    it('should show loading state when isLoading is true', () => {
      render(<PdfPreview blob={null} isLoading={true} />);

      expect(screen.getByText('Genererer PDF...')).toBeInTheDocument();
    });

    it('should show error message when error prop is provided', () => {
      render(<PdfPreview blob={null} isLoading={false} error="Test error message" />);

      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('should show "Ingen PDF tilgjengelig" when no blob and not loading', () => {
      render(<PdfPreview blob={null} isLoading={false} />);

      expect(screen.getByText('Ingen PDF tilgjengelig')).toBeInTheDocument();
    });

    it('should render PDF document when blob is provided', async () => {
      const blob = new Blob(['test'], { type: 'application/pdf' });
      render(<PdfPreview blob={blob} isLoading={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('pdf-document')).toBeInTheDocument();
      });
    });

    it('should show page count when PDF is loaded', async () => {
      const blob = new Blob(['test'], { type: 'application/pdf' });
      render(<PdfPreview blob={blob} isLoading={false} />);

      await waitFor(() => {
        expect(screen.getByText(/3 sider/)).toBeInTheDocument();
      });
    });

    it('should show download button', async () => {
      const blob = new Blob(['test'], { type: 'application/pdf' });
      render(<PdfPreview blob={blob} isLoading={false} />);

      await waitFor(() => {
        expect(screen.getByText('Last ned PDF')).toBeInTheDocument();
      });
    });

    it('should render all pages when PDF is loaded', async () => {
      const blob = new Blob(['test'], { type: 'application/pdf' });
      render(<PdfPreview blob={blob} isLoading={false} />);

      // Wait for document to load (numPages to be set)
      await waitFor(() => {
        expect(screen.getByText(/3 sider/)).toBeInTheDocument();
      }, { timeout: 2000 });

      // All 3 pages should be rendered
      const pages = screen.getAllByTestId('pdf-page');
      expect(pages).toHaveLength(3);
    });

    it('should show close button when onClose is provided', async () => {
      const blob = new Blob(['test'], { type: 'application/pdf' });
      const handleClose = vi.fn();
      render(<PdfPreview blob={blob} isLoading={false} onClose={handleClose} />);

      await waitFor(() => {
        expect(screen.getByText('Lukk')).toBeInTheDocument();
      });
    });

    it('should not show close button when onClose is not provided', async () => {
      const blob = new Blob(['test'], { type: 'application/pdf' });
      render(<PdfPreview blob={blob} isLoading={false} />);

      await waitFor(() => {
        expect(screen.getByText('Last ned PDF')).toBeInTheDocument();
      });

      expect(screen.queryByText('Lukk')).not.toBeInTheDocument();
    });
  });

  describe('PdfPreviewModal', () => {
    it('should not render content when closed', () => {
      const mockState = createMockSakState();
      render(
        <PdfPreviewModal
          open={false}
          onOpenChange={() => {}}
          sakState={mockState}
        />
      );

      expect(screen.queryByText('Krav om endringsordre')).not.toBeInTheDocument();
    });

    it('should render modal with title when open', async () => {
      const mockState = createMockSakState();
      render(
        <PdfPreviewModal
          open={true}
          onOpenChange={() => {}}
          sakState={mockState}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Krav om endringsordre')).toBeInTheDocument();
      });
    });

    it('should use custom title when provided', async () => {
      const mockState = createMockSakState();
      render(
        <PdfPreviewModal
          open={true}
          onOpenChange={() => {}}
          sakState={mockState}
          title="Custom Title"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Custom Title')).toBeInTheDocument();
      });
    });

    it('should show close button', async () => {
      const mockState = createMockSakState();
      render(
        <PdfPreviewModal
          open={true}
          onOpenChange={() => {}}
          sakState={mockState}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Lukk')).toBeInTheDocument();
      });
    });

    it('should call onOpenChange when close button is clicked', async () => {
      const user = userEvent.setup();
      const mockState = createMockSakState();
      const handleOpenChange = vi.fn();

      render(
        <PdfPreviewModal
          open={true}
          onOpenChange={handleOpenChange}
          sakState={mockState}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Lukk')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Lukk'));

      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it('should generate PDF when modal opens', async () => {
      const { generateContractorClaimPdf } = await import('@/pdf/generator');
      const mockState = createMockSakState();

      render(
        <PdfPreviewModal
          open={true}
          onOpenChange={() => {}}
          sakState={mockState}
        />
      );

      await waitFor(() => {
        expect(generateContractorClaimPdf).toHaveBeenCalledWith(mockState);
      });
    });

    it('should merge drafts when provided', async () => {
      const { mergeDraftsIntoState } = await import('@/utils/mergeDraftsIntoState');
      const mockState = createMockSakState();
      const drafts = {
        grunnlagDraft: { sporType: 'grunnlag' as const, resultat: 'godkjent' as const, begrunnelse: 'Test' },
      };

      render(
        <PdfPreviewModal
          open={true}
          onOpenChange={() => {}}
          sakState={mockState}
          drafts={drafts}
        />
      );

      await waitFor(() => {
        expect(mergeDraftsIntoState).toHaveBeenCalledWith(mockState, drafts);
      });
    });
  });

  describe('downloadPdfWithDrafts', () => {
    it('should be exported from generator', async () => {
      const { downloadPdfWithDrafts } = await import('@/pdf/generator');
      expect(downloadPdfWithDrafts).toBeDefined();
      expect(typeof downloadPdfWithDrafts).toBe('function');
    });

    it('should be callable with state and drafts', async () => {
      const { downloadPdfWithDrafts } = await import('@/pdf/generator');
      const mockState = createMockSakState();
      const drafts = {
        vederlagDraft: { sporType: 'vederlag' as const, resultat: 'delvis_godkjent' as const, belop: 50000, begrunnelse: 'Test' },
      };

      await downloadPdfWithDrafts(mockState, drafts);

      expect(downloadPdfWithDrafts).toHaveBeenCalledWith(mockState, drafts);
    });
  });
});
