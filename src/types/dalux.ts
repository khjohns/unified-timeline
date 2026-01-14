/**
 * Dalux Data Types for frontend display.
 *
 * These types represent the data structure returned from Dalux API
 * endpoints for tasks and forms.
 */

export interface DaluxTask {
  data: {
    taskId: string;
    number?: string;
    subject?: string;
    type?: { name: string };
    status?: string;
    workflow?: { name: string };
    assignedTo?: { email?: string; userId?: string };
    createdBy?: { userId?: string };
    created?: string;
    deadline?: string;
    modified?: string;
    location?: {
      building?: { name: string };
      level?: { name: string };
    };
  };
}

export interface DaluxForm {
  data: {
    formId: string;
    number?: string;
    type?: string;
    template?: { name: string };
    status?: string;
    created?: string;
    createdBy?: { userId?: string };
    modified?: string;
  };
}

export interface DaluxTasksResponse {
  tasks: DaluxTask[];
  total: number;
}

export interface DaluxFormsResponse {
  forms: DaluxForm[];
  total: number;
}
