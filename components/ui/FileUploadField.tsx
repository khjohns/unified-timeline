import React, { RefObject, ChangeEvent } from 'react';
import { PktButton } from '@oslokommune/punkt-react';
import { ACCEPTED_FILE_TYPES } from '../../constants';

interface FileUploadFieldProps {
  uploadedFiles: File[];
  onFileUploadClick: () => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  disabled?: boolean;
  buttonText?: string;
}

/**
 * Reusable file upload component with file list and remove functionality
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
  buttonText = 'Last opp vedlegg',
}) => {
  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={onFileChange}
        className="hidden"
        accept={ACCEPTED_FILE_TYPES}
        disabled={disabled}
      />
      <PktButton
        skin="secondary"
        size="medium"
        iconName="attachment"
        variant="icon-left"
        onClick={onFileUploadClick}
        disabled={disabled}
      >
        {buttonText}
      </PktButton>
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
                  onClick={() => onRemoveFile(index)}
                  className="text-sm text-red-600 hover:text-red-700 hover:underline"
                  disabled={disabled}
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
