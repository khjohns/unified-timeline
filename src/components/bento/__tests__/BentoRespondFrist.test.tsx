import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BentoRespondFrist } from '../BentoRespondFrist';
import type { FristEditorProps } from '../../../hooks/useFristBridge';

const defaultEditorProps: FristEditorProps = {
  begrunnelse: '',
  onBegrunnelseChange: vi.fn(),
  begrunnelseError: undefined,
  placeholder: 'Begrunn din godkjenning...',
  autoBegrunnelse: '',
  onRegenerate: vi.fn(),
  showRegenerate: false,
};

describe('BentoRespondFrist', () => {
  it('renders begrunnelse editor', () => {
    render(<BentoRespondFrist editorProps={defaultEditorProps} />);
    expect(screen.getByText(/begrunnelse/i)).toBeInTheDocument();
  });

  it('shows regenerate button when showRegenerate is true', () => {
    render(
      <BentoRespondFrist
        editorProps={{ ...defaultEditorProps, showRegenerate: true, autoBegrunnelse: 'auto' }}
      />
    );
    expect(screen.getByText('Regenerer fra valg')).toBeInTheDocument();
  });

  it('hides regenerate button when showRegenerate is false', () => {
    render(<BentoRespondFrist editorProps={defaultEditorProps} />);
    expect(screen.queryByText('Regenerer fra valg')).not.toBeInTheDocument();
  });

  it('shows validation error', () => {
    render(
      <BentoRespondFrist
        editorProps={{ ...defaultEditorProps, begrunnelseError: 'For kort' }}
      />
    );
    expect(screen.getByText('For kort')).toBeInTheDocument();
  });
});
