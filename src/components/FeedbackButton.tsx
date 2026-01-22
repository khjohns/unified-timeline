/**
 * FeedbackButton Component
 *
 * Provides a feedback button in the header that opens a modal for users
 * to submit feedback about the application.
 */

import { useState } from 'react';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { clsx } from 'clsx';
import { Modal, Button, Textarea, useToast } from './primitives';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type FeedbackType = 'bug' | 'feature' | 'general';

interface FeedbackFormData {
  type: FeedbackType;
  message: string;
  email: string;
}

const feedbackTypeLabels: Record<FeedbackType, string> = {
  bug: 'Feil/Bug',
  feature: 'Ny funksjon',
  general: 'Generell tilbakemelding',
};

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FeedbackFormData>({
    type: 'general',
    message: '',
    email: '',
  });
  const { success, error: showError } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.message.trim()) {
      showError('Vennligst fyll inn en melding');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase er ikke konfigurert');
      }

      const { error } = await supabase.from('feedback').insert({
        type: formData.type,
        message: formData.message.trim(),
        email: formData.email.trim() || null,
        page_url: window.location.href,
        user_agent: navigator.userAgent,
      });

      if (error) {
        throw error;
      }

      success('Takk for tilbakemeldingen!', 'Din tilbakemelding er sendt.');
      setIsOpen(false);
      setFormData({ type: 'general', message: '', email: '' });
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      showError(
        'Kunne ikke sende tilbakemelding',
        'Prøv igjen senere eller kontakt support.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={clsx(
          'p-2 rounded',
          'text-pkt-text-body-subtle hover:text-pkt-text-body-default',
          'hover:bg-pkt-surface-light-beige',
          'focus:outline-none focus:ring-4 focus:ring-pkt-brand-purple-1000/30',
          'transition-colors duration-200'
        )}
        aria-label="Gi tilbakemelding"
        title="Gi tilbakemelding"
      >
        <ChatBubbleIcon className="w-5 h-5" />
      </button>

      <Modal
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Gi tilbakemelding"
        description="Hjelp oss med å forbedre applikasjonen"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Feedback Type Selection */}
          <div>
            <label className="block text-sm font-medium text-pkt-text-body-dark mb-2">
              Type tilbakemelding
            </label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(feedbackTypeLabels) as FeedbackType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, type })}
                  className={clsx(
                    'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                    'border-2',
                    formData.type === type
                      ? 'bg-pkt-surface-strong-dark-blue text-pkt-text-body-light border-pkt-surface-strong-dark-blue'
                      : 'bg-pkt-bg-card text-pkt-text-body-dark border-pkt-border-default hover:border-pkt-border-hover'
                  )}
                >
                  {feedbackTypeLabels[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label
              htmlFor="feedback-message"
              className="block text-sm font-medium text-pkt-text-body-dark mb-2"
            >
              Din tilbakemelding *
            </label>
            <Textarea
              id="feedback-message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder={
                formData.type === 'bug'
                  ? 'Beskriv feilen og hva du prøvde å gjøre...'
                  : formData.type === 'feature'
                    ? 'Beskriv funksjonen du ønsker...'
                    : 'Skriv din tilbakemelding her...'
              }
              rows={5}
              fullWidth
              required
            />
          </div>

          {/* Email (optional) */}
          <div>
            <label
              htmlFor="feedback-email"
              className="block text-sm font-medium text-pkt-text-body-dark mb-2"
            >
              E-post
              <span
                className="ml-2 inline-flex items-center px-1.5 py-0.5 text-xs font-normal rounded bg-pkt-bg-subtle text-pkt-text-body-subtle border border-pkt-border-subtle"
                aria-label="valgfritt felt"
              >
                valgfritt
              </span>
            </label>
            <input
              id="feedback-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="din@epost.no"
              className={clsx(
                'w-full px-4 py-3 text-base',
                'bg-pkt-bg-default border-2 border-pkt-border-default rounded',
                'focus:outline-none focus:ring-4 focus:ring-pkt-brand-purple-1000/30 focus:border-pkt-border-focus',
                'hover:border-pkt-border-hover',
                'placeholder:text-pkt-text-placeholder',
                'transition-colors duration-200'
              )}
            />
            <p className="mt-1 text-xs text-pkt-text-body-subtle">
              Oppgi e-post hvis du ønsker svar på tilbakemeldingen
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Avbryt
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              Send tilbakemelding
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
