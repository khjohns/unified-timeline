import { FormDataModel } from '../types';

// API base URL - will be configured via environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

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
export type Modus = 'koe' | 'eo' | 'revidering';

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
   * Submit KOE form data (initial submission by entrepreneur)
   */
  submitKoe: async (formData: FormDataModel, topicGuid?: string): Promise<ApiResponse<SubmitResponse>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/koe-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formData,
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
   * Submit EO response (BH response to KOE)
   */
  submitEo: async (formData: FormDataModel, sakId: string): Promise<ApiResponse<SubmitResponse>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/eo-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formData,
          sakId,
          modus: 'eo',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Failed to submit EO: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API submitEo error:', error);
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
