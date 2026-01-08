import type { AttachmentFile } from '../types';

/**
 * Generate a unique ID for a file
 */
export function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Convert a File to base64 string (without data URI prefix)
 * Based on blobToBase64 pattern from pdf/generator.ts
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove "data:mime/type;base64," prefix
      resolve(base64.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Check if file is an image (for preview purposes)
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Create an AttachmentFile from a File object
 */
export async function createAttachmentFile(file: File): Promise<AttachmentFile> {
  const attachmentFile: AttachmentFile = {
    file,
    id: generateFileId(),
    name: file.name,
    size: file.size,
    type: file.type,
    status: 'encoding',
    previewUrl: isImageFile(file) ? URL.createObjectURL(file) : undefined,
  };

  try {
    attachmentFile.base64 = await fileToBase64(file);
    attachmentFile.status = 'ready';
  } catch {
    attachmentFile.status = 'error';
    attachmentFile.error = 'Kunne ikke lese filen';
  }

  return attachmentFile;
}

/**
 * Cleanup preview URLs to prevent memory leaks
 */
export function revokePreviewUrls(files: AttachmentFile[]): void {
  files.forEach((f) => {
    if (f.previewUrl) {
      URL.revokeObjectURL(f.previewUrl);
    }
  });
}
