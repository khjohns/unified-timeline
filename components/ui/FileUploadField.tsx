import React, { RefObject, ChangeEvent, useState, useCallback } from 'react';
import { ACCEPTED_FILE_TYPES } from '../../constants';

interface FileUploadFieldProps {
  uploadedFiles: File[];
  onFileUploadClick: () => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  disabled?: boolean;
}

/**
 * Reusable file upload component with drag-and-drop support and file list
 *
 * @example
 * ```tsx
 * const { fileInputRef, uploadedFiles, handleFileUploadClick, handleFileChange, handleRemoveFile } =
 *   useFileUpload((fileNames) => setFormData('varsel', 'vedlegg', fileNames));
 *
 * <FileUploadField
 *   fileInputRef={fileInputRef}
 *   uploadedFiles={uploadedFiles}
 *   onFileUploadClick={handleFileUploadClick}
 *   onFileChange={handleFileChange}
 *   onRemoveFile={handleRemoveFile}
 *   disabled={isLocked}
 * />
 * ```
 */
const FileUploadField: React.FC<FileUploadFieldProps> = ({
  uploadedFiles,
  onFileUploadClick,
  onFileChange,
  onRemoveFile,
  fileInputRef,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!disabled) {
        onFileUploadClick();
      }
    }
  }, [disabled, onFileUploadClick]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0 && fileInputRef.current) {
      // Create a DataTransfer to set files on the input
      const dataTransfer = new DataTransfer();
      Array.from(files).forEach(file => {
        dataTransfer.items.add(file);
      });
      fileInputRef.current.files = dataTransfer.files;

      // Trigger onChange with the files
      const syntheticEvent = {
        target: fileInputRef.current,
        currentTarget: fileInputRef.current,
      } as ChangeEvent<HTMLInputElement>;

      onFileChange(syntheticEvent);
    }
  }, [disabled, fileInputRef, onFileChange]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      onFileUploadClick();
    }
  }, [disabled, onFileUploadClick]);

  return (
    <div className="space-y-4">
      <div
        className={`
          flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md
          transition-colors duration-200
          ${disabled
            ? 'bg-gray-50 opacity-70 cursor-not-allowed'
            : 'cursor-pointer'
          }
          ${isDragging && !disabled
            ? 'border-pri bg-pri-light/20'
            : 'border-border-color hover:border-pri/50'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label="Last opp vedlegg. Trykk Enter eller Space for å velge fil, eller dra og slipp fil her"
        aria-disabled={disabled}
      >
        <div className="space-y-1 text-center">
          <svg
            className={`mx-auto h-12 w-12 transition-colors duration-200 ${isDragging && !disabled ? 'text-pri' : 'text-muted'}`}
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="flex text-sm text-ink-dim justify-center">
            <span className="font-medium text-pri">Last opp vedlegg</span>
            <p className="pl-1">eller dra og slipp</p>
          </div>
          <p className="text-xs text-muted">
            PDF, DOC, XLS, JPG, PNG opp til 10MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={onFileChange}
            className="sr-only"
            accept={ACCEPTED_FILE_TYPES}
            disabled={disabled}
          />
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">Opplastede filer:</p>
          <ul className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <li
                key={index}
                className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-border-color"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink">{file.name}</span>
                  <span className="text-xs text-muted">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFile(index);
                  }}
                  className="text-sm text-red-600 hover:text-red-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={disabled}
                  aria-label={`Fjern ${file.name}`}
                >
                  Fjern
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUploadField;
