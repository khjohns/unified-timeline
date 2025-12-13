/**
 * Unit tests for Events API
 *
 * Tests event submission functionality including mock mode.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitEvent, EventSubmitResponse } from '@/src/api/events';
import * as clientModule from '@/src/api/client';

// Mock the client module
vi.mock('@/src/api/client', async () => {
  const actual = await vi.importActual('@/src/api/client');
  return {
    ...actual,
    apiFetch: vi.fn(),
    mockDelay: vi.fn(() => Promise.resolve()),
  };
});

describe('Events API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('submitEvent', () => {
    describe('with mock API enabled', () => {
      beforeEach(() => {
        // Set USE_MOCK_API to true
        vi.spyOn(clientModule, 'USE_MOCK_API', 'get').mockReturnValue(true);
      });

      it('should return mock success response', async () => {
        const result = await submitEvent('SAK-001', 'grunnlag_opprettet', {
          hovedkategori: 'SVIKT',
          underkategori: 'GRUNN',
          beskrivelse: 'Test',
        });

        expect(result.success).toBe(true);
        expect(result.event_id).toMatch(/^evt-mock-/);
        expect(result.tidsstempel).toBeDefined();
        expect(result.message).toBe('Mock event submitted successfully');
      });

      it('should indicate pdf_uploaded when pdfBase64 is provided', async () => {
        const result = await submitEvent(
          'SAK-001',
          'vederlag_krav_sendt',
          { krav_belop: 100000 },
          { pdfBase64: 'base64data' }
        );

        expect(result.pdf_uploaded).toBe(true);
        expect(result.pdf_source).toBe('client');
      });

      it('should not indicate pdf_uploaded when no PDF provided', async () => {
        const result = await submitEvent('SAK-001', 'vederlag_krav_sendt', {
          krav_belop: 100000,
        });

        expect(result.pdf_uploaded).toBe(false);
        expect(result.pdf_source).toBeUndefined();
      });

      it('should increment version number', async () => {
        const result = await submitEvent(
          'SAK-001',
          'grunnlag_opprettet',
          { hovedkategori: 'test' },
          { expectedVersion: 5 }
        );

        expect(result.new_version).toBe(6);
      });

      it('should use 0 as default expected version', async () => {
        const result = await submitEvent('SAK-001', 'grunnlag_opprettet', {
          hovedkategori: 'test',
        });

        expect(result.new_version).toBe(1);
      });

      it('should call mockDelay for simulated network latency', async () => {
        await submitEvent('SAK-001', 'grunnlag_opprettet', { hovedkategori: 'test' });

        expect(clientModule.mockDelay).toHaveBeenCalledWith(800);
      });
    });

    describe('with real API', () => {
      beforeEach(() => {
        vi.spyOn(clientModule, 'USE_MOCK_API', 'get').mockReturnValue(false);
      });

      it('should call apiFetch with correct endpoint', async () => {
        const mockResponse: EventSubmitResponse = {
          event_id: 'evt-123',
          tidsstempel: '2025-01-01T10:00:00Z',
          success: true,
          new_version: 2,
        };

        vi.mocked(clientModule.apiFetch).mockResolvedValueOnce(mockResponse);

        const result = await submitEvent('SAK-001', 'vederlag_krav_sendt', {
          krav_belop: 500000,
        });

        expect(clientModule.apiFetch).toHaveBeenCalledWith(
          '/api/events',
          expect.objectContaining({
            method: 'POST',
          })
        );
        expect(result).toEqual(mockResponse);
      });

      it('should include sak_id in request body', async () => {
        vi.mocked(clientModule.apiFetch).mockResolvedValueOnce({
          event_id: 'evt-123',
          tidsstempel: '2025-01-01T10:00:00Z',
          success: true,
        });

        await submitEvent('SAK-2025-001', 'grunnlag_opprettet', {
          hovedkategori: 'test',
        });

        const callArgs = vi.mocked(clientModule.apiFetch).mock.calls[0];
        const body = JSON.parse(callArgs[1]?.body as string);

        expect(body.sak_id).toBe('SAK-2025-001');
      });

      it('should include event type and data in request body', async () => {
        vi.mocked(clientModule.apiFetch).mockResolvedValueOnce({
          event_id: 'evt-123',
          tidsstempel: '2025-01-01T10:00:00Z',
          success: true,
        });

        await submitEvent('SAK-001', 'vederlag_krav_sendt', {
          krav_belop: 250000,
          metode: 'REGNINGSARBEID',
        });

        const callArgs = vi.mocked(clientModule.apiFetch).mock.calls[0];
        const body = JSON.parse(callArgs[1]?.body as string);

        expect(body.event.event_type).toBe('vederlag_krav_sendt');
        expect(body.event.data.krav_belop).toBe(250000);
        expect(body.event.data.metode).toBe('REGNINGSARBEID');
      });

      it('should include expected_version when provided', async () => {
        vi.mocked(clientModule.apiFetch).mockResolvedValueOnce({
          event_id: 'evt-123',
          tidsstempel: '2025-01-01T10:00:00Z',
          success: true,
        });

        await submitEvent(
          'SAK-001',
          'grunnlag_oppdatert',
          { beskrivelse: 'Updated' },
          { expectedVersion: 3 }
        );

        const callArgs = vi.mocked(clientModule.apiFetch).mock.calls[0];
        const body = JSON.parse(callArgs[1]?.body as string);

        expect(body.expected_version).toBe(3);
      });

      it('should use 0 as default expected_version', async () => {
        vi.mocked(clientModule.apiFetch).mockResolvedValueOnce({
          event_id: 'evt-123',
          tidsstempel: '2025-01-01T10:00:00Z',
          success: true,
        });

        await submitEvent('SAK-001', 'grunnlag_opprettet', { hovedkategori: 'test' });

        const callArgs = vi.mocked(clientModule.apiFetch).mock.calls[0];
        const body = JSON.parse(callArgs[1]?.body as string);

        expect(body.expected_version).toBe(0);
      });

      it('should include catenda_topic_id when provided', async () => {
        vi.mocked(clientModule.apiFetch).mockResolvedValueOnce({
          event_id: 'evt-123',
          tidsstempel: '2025-01-01T10:00:00Z',
          success: true,
        });

        await submitEvent(
          'SAK-001',
          'grunnlag_opprettet',
          { hovedkategori: 'test' },
          { catendaTopicId: 'topic-guid-123' }
        );

        const callArgs = vi.mocked(clientModule.apiFetch).mock.calls[0];
        const body = JSON.parse(callArgs[1]?.body as string);

        expect(body.catenda_topic_id).toBe('topic-guid-123');
      });

      it('should include PDF data when provided', async () => {
        vi.mocked(clientModule.apiFetch).mockResolvedValueOnce({
          event_id: 'evt-123',
          tidsstempel: '2025-01-01T10:00:00Z',
          success: true,
          pdf_uploaded: true,
        });

        await submitEvent(
          'SAK-001',
          'vederlag_krav_sendt',
          { krav_belop: 100000 },
          {
            pdfBase64: 'JVBERi0xLjQK...',
            pdfFilename: 'krav-v1.pdf',
          }
        );

        const callArgs = vi.mocked(clientModule.apiFetch).mock.calls[0];
        const body = JSON.parse(callArgs[1]?.body as string);

        expect(body.pdf_base64).toBe('JVBERi0xLjQK...');
        expect(body.pdf_filename).toBe('krav-v1.pdf');
      });

      it('should handle all event types', async () => {
        const eventTypes = [
          'sak_opprettet',
          'grunnlag_opprettet',
          'grunnlag_oppdatert',
          'grunnlag_trukket',
          'vederlag_krav_sendt',
          'vederlag_krav_oppdatert',
          'vederlag_krav_trukket',
          'frist_krav_sendt',
          'frist_krav_oppdatert',
          'frist_krav_trukket',
          'respons_grunnlag',
          'respons_vederlag',
          'respons_frist',
          'eo_utstedt',
        ];

        for (const eventType of eventTypes) {
          vi.mocked(clientModule.apiFetch).mockResolvedValueOnce({
            event_id: `evt-${eventType}`,
            tidsstempel: '2025-01-01T10:00:00Z',
            success: true,
          });

          const result = await submitEvent('SAK-001', eventType as any, { test: true });

          expect(result.success).toBe(true);
          expect(result.event_id).toBe(`evt-${eventType}`);
        }
      });

      it('should propagate API errors', async () => {
        const apiError = new clientModule.ApiError(409, 'Version conflict');
        vi.mocked(clientModule.apiFetch).mockRejectedValueOnce(apiError);

        await expect(
          submitEvent(
            'SAK-001',
            'grunnlag_oppdatert',
            { beskrivelse: 'test' },
            { expectedVersion: 1 }
          )
        ).rejects.toThrow('Version conflict');
      });
    });
  });
});
