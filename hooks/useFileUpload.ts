import { useRef, useState, ChangeEvent } from 'react';

/**
 * Custom hook for handling file uploads
 *
 * @param onFilesChange - Callback function called when files are added or removed
 * @returns Object containing file upload state and handlers
 *
 * @example
 * ```tsx
 * const { fileInputRef, uploadedFiles, handleFileUploadClick, handleFileChange, handleRemoveFile } =
 *   useFileUpload((fileNames) => {
 *     setFormData('varsel', 'vedlegg', fileNames);
 *   });
 * ```
 */
export const useFileUpload = (onFilesChange: (fileNames: string[]) => void) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setUploadedFiles(prev => {
        const updated = [...prev, ...newFiles];
        // Notify parent component with file names
        onFilesChange(updated.map(f => f.name));
        return updated;
      });
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Notify parent component with updated file names
      onFilesChange(updated.map(f => f.name));
      return updated;
    });
  };

  return {
    fileInputRef,
    uploadedFiles,
    handleFileUploadClick,
    handleFileChange,
    handleRemoveFile,
  };
};
