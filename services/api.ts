import { FormDataModel } from '../types';
import { logger } from '../utils/logger';

// API base URL - will be configured via environment variable
let rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
// Make robust against missing protocol
if (rawApiBaseUrl && !/^https?:\/\//i.test(rawApiBaseUrl)) {
  rawApiBaseUrl = 'http://' + rawApiBaseUrl;
}
// Sanitize the base URL to remove any trailing slashes, making it more robust
const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, '');

// Debug: Log the API URL being used (only in development)
logger.log('API Base URL:', API_BASE_URL);

/**
 * Helper function to build URL with query parameters
 * Uses string concatenation instead of URL constructor for better compatibility
 */
function buildUrl(base: string, path: string, params?: Record<string, string>): string {
  let url = `${base}${path}`;
  if (params && Object.keys(params).length > 0) {
    const queryString = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  return url;
}

// ===================================================================
// CSRF Token Management
// ===================================================================

/**
 * CSRF (Cross-Site Request Forgery) beskyttelse.
 *
 * Beskytter mot angrep hvor ondsinnede nettsider får brukerens browser
 * til å utføre uønskede handlinger.
 *
 * Flow:
 * 1. Frontend henter CSRF-token fra backend
 * 2. Token lagres i memory (ikke localStorage for sikkerhet)
 * 3. Token sendes i X-CSRF-Token header på alle POST/PUT/DELETE requests
 * 4. Backend validerer token før operasjon utføres
 */

let csrfToken: string | null = null;
let csrfTokenExpiry: number | null = null;

/**
 * Hent CSRF-token fra backend.
 * Token er gyldig i 1 time og må fornyes etter det.
 */
async function fetchCsrfToken(): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/csrf-token`);

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.statusText}`);
    }

    const data = await response.json();
    csrfToken = data.csrfToken;
    csrfTokenExpiry = Date.now() + (data.expiresIn * 1000); // Convert to milliseconds

    logger.log('✓ CSRF token hentet');
    return csrfToken;
  } catch (error) {
    logger.error('Feil ved henting av CSRF-token:', error);
    throw error;
  }
}

/**
 * Få CSRF-token (hent ny hvis ikke eksisterer eller er utløpt).
 */
async function getCsrfToken(): Promise<string> {
  // Hvis token eksisterer og ikke er utløpt, bruk den
  if (csrfToken && csrfTokenExpiry && Date.now() < csrfTokenExpiry) {
    return csrfToken;
  }

  // Ellers hent ny token
  return fetchCsrfToken();
}

// Types for API responses
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CaseResponse {
  sakId: string;
  topicGuid: string;
  formData: FormDataModel;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitResponse {
  sakId: string;
  topicGuid: string;
  status: string;
  pdfUrl?: string;
  message: string;
}

export interface AttachmentResponse {
  attachmentId: string;
  filename: string;
  url: string;
  uploadedAt: string;
}

// Modus types for POC workflow
// varsel: TE sends initial warning
// koe: TE sends claim (Krav om Endringsordre)
// svar: BH responds to claim (Svar på krav)
// revidering: TE revises claim after BH response
export type Modus = 'varsel' | 'koe' | 'svar' | 'revidering';

/**
 * API service for KOE/EO form communication with backend
 */
export const api = {
  /**
   * Get existing case data by sakId
   * Used when loading form from URL parameters
   */
  getCase: async (sakId: string, modus?: Modus): Promise<ApiResponse<CaseResponse>> => {
    try {
      const params: Record<string, string> = {};
      if (modus) {
        params.modus = modus;
      }
      const url = buildUrl(API_BASE_URL, `/cases/${sakId}`, params);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Failed to fetch case: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error('API getCase error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  /**
   * Submit Varsel (initial warning by entrepreneur)
   */
  submitVarsel: async (formData: FormDataModel, topicGuid?: string, sakId?: string): Promise<ApiResponse<SubmitResponse>> => {
    try {
      // Hent CSRF-token (beskyttelse mot CSRF-angrep)
      const token = await getCsrfToken();

      const response = await fetch(`${API_BASE_URL}/varsel-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,  // ✅ CSRF beskyttelse
        },
        body: JSON.stringify({
          sakId,
          formData,
          topicGuid,
          modus: 'varsel',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Failed to submit varsel: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error('API submitVarsel error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  /**
   * Submit KOE form data (claim by entrepreneur)
   */
  submitKoe: async (formData: FormDataModel, sakId?: string, topicGuid?: string): Promise<ApiResponse<SubmitResponse>> => {
    try {
      // Hent CSRF-token
      const token = await getCsrfToken();

      const response = await fetch(`${API_BASE_URL}/koe-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,  // ✅ CSRF beskyttelse
        },
        body: JSON.stringify({
          formData,
          sakId,
          topicGuid,
          modus: 'koe',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Failed to submit KOE: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error('API submitKoe error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  /**
   * Submit Svar (BH response to KOE claim)
   */
  submitSvar: async (formData: FormDataModel, sakId: string, topicGuid?: string): Promise<ApiResponse<SubmitResponse>> => {
    try {
      // Hent CSRF-token
      const token = await getCsrfToken();

      const response = await fetch(`${API_BASE_URL}/svar-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,  // ✅ CSRF beskyttelse
        },
        body: JSON.stringify({
          sakId,
          formData,
          topicGuid,
          modus: 'svar',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Failed to submit svar: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error('API submitSvar error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  /**
   * Submit revision (revidering) to existing case
   */
  submitRevidering: async (formData: FormDataModel, sakId: string): Promise<ApiResponse<SubmitResponse>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/cases/${sakId}/revidering`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formData,
          modus: 'revidering',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Failed to submit revidering: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error('API submitRevidering error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  /**
   * Upload attachment file to a case
   */
  uploadAttachment: async (sakId: string, file: File, category: string): Promise<ApiResponse<AttachmentResponse>> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category); // 'varsel', 'koe', 'bh_svar'

      const response = await fetch(`${API_BASE_URL}/cases/${sakId}/attachments`, {
        method: 'POST',
        body: formData,
        // Note: Don't set Content-Type header for FormData, browser will set it with boundary
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Failed to upload attachment: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error('API uploadAttachment error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  /**
   * Upload PDF to backend for Catenda upload
   * PDF is generated by React app and sent as base64
   */
  uploadPdf: async (sakId: string, pdfBlob: Blob, filename: string, modus: string, topicGuid?: string): Promise<ApiResponse<{ documentGuid?: string; filename: string }>> => {
    try {
      // Convert blob to base64
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const response = await fetch(`${API_BASE_URL}/cases/${sakId}/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfBase64: base64,
          filename,
          topicGuid,
          modus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Failed to upload PDF: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error('API uploadPdf error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  /**
   * Auto-save form data (for draft persistence)
   */
  saveDraft: async (formData: FormDataModel, sakId?: string): Promise<ApiResponse<{ sakId: string }>> => {
    try {
      const endpoint = sakId
        ? `${API_BASE_URL}/cases/${sakId}/draft`
        : `${API_BASE_URL}/drafts`;

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ formData }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Failed to save draft: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error('API saveDraft error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  /**
   * Check API health/connectivity
   */
  healthCheck: async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  /**
   * Verify a magic link token
   */
  verifyMagicToken: async (token: string): Promise<ApiResponse<{ sakId: string }>> => {
    try {
      const url = buildUrl(API_BASE_URL, `/magic-link/verify`, { token });
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.detail || `Invalid token: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error('API verifyMagicToken error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },

  /**
   * Validate a user's email against Catenda project members
   */
  validateUser: async (sakId: string, email: string): Promise<ApiResponse<{ name: string; email: string; company: string }>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/validate-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sakId, email }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `Validation failed: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.error('API validateUser error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  },
};

export default api;
