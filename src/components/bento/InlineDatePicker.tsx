import { clsx } from 'clsx';
import { DatePicker } from '../primitives';

export interface InlineDatePickerProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function InlineDatePicker({
  label,
  value,
  onChange,
  helperText,
  error,
  disabled,
  className,
}: InlineDatePickerProps) {
  return (
    <div className={clsx('space-y-1', className)}>
      <div className="flex justify-between items-center">
        <span className="text-bento-caption text-pkt-text-body-subtle">{label}</span>
        <DatePicker
          value={value}
          onChange={onChange}
          error={!!error}
          disabled={disabled}
          width="sm"
        />
      </div>
      {helperText && !error && (
        <p className="text-bento-label text-pkt-text-body-muted text-right">{helperText}</p>
      )}
      {error && (
        <p className="text-bento-label text-pkt-brand-red-1000 text-right">{error}</p>
      )}
    </div>
  );
}
