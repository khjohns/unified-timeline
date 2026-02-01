/**
 * Unit tests for API client
 *
 * Tests the API client utilities including error handling and fetch wrapper.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, ApiError } from '@/api/client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ApiError', () => {
    it('should create an error with status, message, and data', () => {
      const error = new ApiError(400, 'Bad Request', { field: 'invalid' });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(400);
      expect(error.message).toBe('Bad Request');
      expect(error.data).toEqual({ field: 'invalid' });
      expect(error.name).toBe('ApiError');
    });

    it('should work without data parameter', () => {
      const error = new ApiError(500, 'Server Error');

      expect(error.status).toBe(500);
      expect(error.message).toBe('Server Error');
      expect(error.data).toBeUndefined();
    });
  });

  describe('apiFetch', () => {
    it('should make a GET request with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true }),
      });

      const result = await apiFetch('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual({ success: true });
    });

    it('should make a POST request with body', async () => {
      // First call is for CSRF token, second is the actual POST
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ csrfToken: 'test-csrf-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ id: 123 }),
        });

      const result = await apiFetch('/api/test', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      });

      // Second call should be the POST request
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        })
      );
      expect(result).toEqual({ id: 123 });
    });

    it('should merge custom headers with default headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await apiFetch('/api/test', {
        headers: { Authorization: 'Bearer token' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer token',
          }),
        })
      );
    });

    it('should handle text response when content-type is not JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('Plain text response'),
      });

      const result = await apiFetch('/api/test');

      expect(result).toBe('Plain text response');
    });

    it('should handle CloudEvents JSON response (application/cloudevents+json)', async () => {
      const cloudEventsData = {
        events: [{ id: '1', type: 'no.oslo.koe.test' }],
        version: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/cloudevents+json' }),
        json: () => Promise.resolve(cloudEventsData),
      });

      const result = await apiFetch('/api/test');

      expect(result).toEqual(cloudEventsData);
    });

    it('should throw ApiError on 400 response with JSON error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ message: 'Validation failed' }),
      });

      try {
        await apiFetch('/api/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(400);
        expect((error as ApiError).message).toBe('Validation failed');
      }
    });

    it('should throw ApiError on 404 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ message: 'Resource not found' }),
      });

      try {
        await apiFetch('/api/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
      }
    });

    it('should throw ApiError on 500 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ message: 'Server error' }),
      });

      try {
        await apiFetch('/api/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
      }
    });

    it('should handle error response with plain text', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('Service temporarily unavailable'),
      });

      try {
        await apiFetch('/api/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('Service temporarily unavailable');
      }
    });

    it('should handle error response without message field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: 'some error', code: 'INVALID' }),
      });

      try {
        await apiFetch('/api/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(400);
        expect((error as ApiError).message).toContain('400');
      }
    });

    it('should handle network errors (TypeError)', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network error'));

      try {
        await apiFetch('/api/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(0);
        expect((error as ApiError).message).toContain('Network error');
      }
    });

    it('should handle unknown errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Unknown error'));

      try {
        await apiFetch('/api/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
        expect((error as ApiError).message).toBe('Unknown error');
      }
    });

    it('should re-throw ApiError as-is', async () => {
      const originalError = new ApiError(403, 'Forbidden', { reason: 'Unauthorized' });
      mockFetch.mockRejectedValueOnce(originalError);

      try {
        await apiFetch('/api/test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBe(originalError);
        expect((error as ApiError).status).toBe(403);
        expect((error as ApiError).data).toEqual({ reason: 'Unauthorized' });
      }
    });

    it('should construct URL with base URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await apiFetch('/api/endpoint');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/http.*\/api\/endpoint/),
        expect.any(Object)
      );
    });
  });
});
