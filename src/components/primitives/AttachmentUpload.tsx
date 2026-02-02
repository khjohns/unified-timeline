import { useCallback, useEffect, useId, Ref } from 'react';
import { useDropzone, Accept, FileRejection, ErrorCode } from 'react-dropzone';
import clsx from 'clsx';
import { Cross2Icon, UploadIcon, FileTextIcon, ImageIcon } from '@radix-ui/react-icons';
import type { AttachmentFile } from '../../types';
import {
  createAttachmentFile,
  formatFileSize,
  revokePreviewUrls,
  isImageFile,
} from '../../utils/fileUtils';

export interface AttachmentUploadProps {
  /** Current files (controlled) */
  value: AttachmentFile[];
  /** Callback when files change */
  onChange: (files: AttachmentFile[]) => void;
  /** Allow multiple file selection */
  multiple?: boolean;
  /** Maximum number of files (only applies when multiple=true) */
  maxFiles?: number;
  /** Maximum file size in bytes (default: 10MB) */
  maxSize?: number;
  /** Accepted file types (react-dropzone Accept format) */
  accept?: Accept;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Error state */
  error?: boolean;
  /** Help text for accepted formats (displayed in dropzone) */
  acceptedFormatsText?: string;
  /** Custom dropzone text */
  dropzoneText?: string;
  /** ID for accessibility */
  id?: string;
  /** Additional className */
  className?: string;
  /** Callback for validation errors */
  onError?: (errors: string[]) => void;
  /** Ref to the container element */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Translate react-dropzone error codes to Norwegian
 */
function getErrorMessage(code: ErrorCode | string, file: File, maxSize?: number): string {
  switch (code) {
    case 'file-too-large':
      return `${file.name} er for stor (maks ${formatFileSize(maxSize ?? 10 * 1024 * 1024)})`;
    case 'file-invalid-type':
      return `${file.name} har ugyldig filtype`;
    case 'too-many-files':
      return 'For mange filer valgt';
    default:
      return `${file.name} kunne ikke lastes opp`;
  }
}

/**
 * AttachmentUpload component with Punkt design system styling
 * - Drag-and-drop file upload using react-dropzone
 * - Multiple file support
 * - Image preview thumbnails
 * - Base64 encoding for backend submission
 */
export function AttachmentUpload({
  value,
  onChange,
  multiple = true,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024,
  accept,
  disabled,
  error,
  acceptedFormatsText,
  dropzoneText = 'Dra og slipp filer her, eller klikk for å velge',
  id,
  className,
  onError,
  ref,
}: AttachmentUploadProps) {
    const generatedId = useId();
    const fieldId = id || generatedId;

    // Cleanup preview URLs on unmount
    useEffect(() => {
      return () => revokePreviewUrls(value);
      // Only run cleanup on unmount, not on value change
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handle file drop/selection
    const onDrop = useCallback(
      async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
        // Handle rejections
        if (rejectedFiles.length > 0 && onError) {
          const errors = rejectedFiles.flatMap((rejection) =>
            rejection.errors.map((err) => getErrorMessage(err.code, rejection.file, maxSize))
          );
          onError(errors);
        }

        if (acceptedFiles.length === 0) return;

        // Limit files if multiple
        const filesToProcess = multiple
          ? acceptedFiles.slice(0, maxFiles - value.length)
          : acceptedFiles.slice(0, 1);

        // Process files in parallel
        const newFiles = await Promise.all(filesToProcess.map(createAttachmentFile));

        // Update state
        if (multiple) {
          onChange([...value, ...newFiles]);
        } else {
          // Single file mode: replace existing
          revokePreviewUrls(value);
          onChange(newFiles);
        }
      },
      [value, onChange, multiple, maxFiles, maxSize, onError]
    );

    // Handle file removal
    const handleRemove = useCallback(
      (fileId: string) => {
        const fileToRemove = value.find((f) => f.id === fileId);
        if (fileToRemove?.previewUrl) {
          URL.revokeObjectURL(fileToRemove.previewUrl);
        }
        onChange(value.filter((f) => f.id !== fileId));
      },
      [value, onChange]
    );

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
      onDrop,
      multiple,
      maxFiles: multiple ? maxFiles : 1,
      maxSize,
      accept,
      disabled,
    });

    const canAddMore = multiple ? value.length < maxFiles : value.length === 0;

    return (
      <div ref={ref} className={className}>
        {/* Dropzone Area - only show if can add more files */}
        {canAddMore && (
          <div
            {...getRootProps()}
            className={clsx(
              // Base styles
              'border-2 rounded transition-colors duration-200',
              'p-6 cursor-pointer',
              'flex flex-col items-center justify-center gap-3',
              'min-h-[120px]',

              // Default state - dashed border
              !error && !disabled && !isDragActive && 'border-pkt-border-default border-dashed',
              !error && !disabled && !isDragActive && 'bg-pkt-bg-default',

              // Drag active state
              isDragActive && !isDragReject && 'border-pkt-border-focus bg-pkt-surface-light-beige',
              isDragReject && 'border-pkt-border-red bg-red-50',

              // Error state
              error && !isDragActive && 'border-pkt-border-red border-dashed',

              // Disabled state
              disabled && 'border-pkt-border-disabled bg-pkt-surface-gray cursor-not-allowed',

              // Hover state
              !disabled && 'hover:border-pkt-border-hover',

              // Focus state
              !disabled && 'focus-within:outline-none focus-within:ring-4',
              !disabled &&
                (error
                  ? 'focus-within:ring-pkt-brand-red-400/50'
                  : 'focus-within:ring-pkt-brand-purple-1000/30')
            )}
          >
            <input {...getInputProps()} id={fieldId} />
            <UploadIcon className="w-8 h-8 text-pkt-text-placeholder" />
            <p className="text-sm text-pkt-text-body-default text-center">
              {isDragActive ? 'Slipp filene her...' : dropzoneText}
            </p>
            {acceptedFormatsText && (
              <p className="text-xs text-pkt-text-placeholder">{acceptedFormatsText}</p>
            )}
          </div>
        )}

        {/* File List */}
        {value.length > 0 && (
          <ul className={clsx('space-y-2', canAddMore && 'mt-3')}>
            {value.map((file) => (
              <FileListItem
                key={file.id}
                file={file}
                onRemove={handleRemove}
                disabled={disabled}
              />
            ))}
          </ul>
        )}
      </div>
    );
}

// Internal component for file list items
interface FileListItemProps {
  file: AttachmentFile;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

function FileListItem({ file, onRemove, disabled }: FileListItemProps) {
  const FileIconComponent = isImageFile(file.file) ? ImageIcon : FileTextIcon;

  return (
    <li
      className={clsx(
        'flex items-center gap-3 p-3',
        'border-2 border-pkt-border-default rounded',
        'bg-pkt-bg-card'
      )}
    >
      {/* Preview thumbnail for images */}
      {file.previewUrl ? (
        <img
          src={file.previewUrl}
          alt=""
          className="w-10 h-10 object-cover rounded border border-pkt-border-subtle flex-shrink-0"
        />
      ) : (
        <FileIconComponent className="w-6 h-6 text-pkt-text-placeholder flex-shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-pkt-text-body-default truncate">{file.name}</p>
        <p className="text-xs text-pkt-text-placeholder">
          {formatFileSize(file.size)}
          {file.status === 'encoding' && ' - Behandler...'}
          {file.status === 'error' && ` - ${file.error}`}
        </p>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(file.id)}
        disabled={disabled}
        className={clsx(
          'p-2 rounded transition-colors flex-shrink-0',
          'text-pkt-text-placeholder hover:text-pkt-text-body-default',
          'hover:bg-pkt-surface-light-beige',
          'focus:outline-none focus:ring-2 focus:ring-pkt-brand-purple-1000/30',
          disabled && 'cursor-not-allowed opacity-50'
        )}
        aria-label={`Fjern ${file.name}`}
      >
        <Cross2Icon className="w-4 h-4" />
      </button>
    </li>
  );
}
