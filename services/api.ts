import { FormDataModel } from '../types';

// API base URL - will be configured via environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

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
      const url = new URL(`${API_BASE_URL}/cases/${sakId}`);
      if (modus) {
        url.searchParams.append('modus', modus);
      }

      const response = await fetch(url.toString(), {
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
      console.error('API getCase error:', error);
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
      const response = await fetch(`${API_BASE_URL}/varsel-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      console.error('API submitVarsel error:', error);
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
      const response = await fetch(`${API_BASE_URL}/koe-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      console.error('API submitKoe error:', error);
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
      const response = await fetch(`${API_BASE_URL}/svar-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      console.error('API submitSvar error:', error);
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
      console.error('API submitRevidering error:', error);
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
      console.error('API uploadAttachment error:', error);
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
      console.error('API uploadPdf error:', error);
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
      console.error('API saveDraft error:', error);
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
};

export default api;
