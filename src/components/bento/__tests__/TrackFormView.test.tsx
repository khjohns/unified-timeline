import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TrackFormView } from '../TrackFormView';

describe('TrackFormView', () => {
  it('renders track name and action title', () => {
    render(
      <TrackFormView
        trackName="Vederlag"
        actionTitle="Send krav"
        onCancel={() => {}}
        isDirty={false}
      >
        <div>form content</div>
      </TrackFormView>
    );
    expect(screen.getByText('Vederlag')).toBeInTheDocument();
    expect(screen.getByText('Send krav')).toBeInTheDocument();
    expect(screen.getByText('form content')).toBeInTheDocument();
  });

  it('calls onCancel when Avbryt is clicked and form is not dirty', () => {
    const onCancel = vi.fn();
    render(
      <TrackFormView trackName="Grunnlag" actionTitle="Send" onCancel={onCancel} isDirty={false}>
        <div />
      </TrackFormView>
    );
    fireEvent.click(screen.getByText('Avbryt'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows confirmation dialog when Avbryt is clicked and form is dirty', () => {
    const onCancel = vi.fn();
    render(
      <TrackFormView trackName="Grunnlag" actionTitle="Send" onCancel={onCancel} isDirty={true}>
        <div />
      </TrackFormView>
    );
    fireEvent.click(screen.getByText('Avbryt'));
    expect(screen.getByText(/ulagrede endringer/i)).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when "Forkast endringer" is clicked in confirmation', () => {
    const onCancel = vi.fn();
    render(
      <TrackFormView trackName="Frist" actionTitle="Send" onCancel={onCancel} isDirty={true}>
        <div />
      </TrackFormView>
    );
    fireEvent.click(screen.getByText('Avbryt'));
    fireEvent.click(screen.getByText('Forkast endringer'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('dismisses confirmation when "Fortsett redigering" is clicked', () => {
    const onCancel = vi.fn();
    render(
      <TrackFormView trackName="Frist" actionTitle="Send" onCancel={onCancel} isDirty={true}>
        <div />
      </TrackFormView>
    );
    fireEvent.click(screen.getByText('Avbryt'));
    expect(screen.getByText(/ulagrede endringer/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Fortsett redigering'));
    expect(screen.queryByText(/ulagrede endringer/i)).not.toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('renders hjemmel when provided', () => {
    render(
      <TrackFormView
        trackName="Vederlag"
        actionTitle="Send krav"
        hjemmel="§34"
        onCancel={() => {}}
        isDirty={false}
      >
        <div />
      </TrackFormView>
    );
    expect(screen.getByText('§34')).toBeInTheDocument();
  });
});
