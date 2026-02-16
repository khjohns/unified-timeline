import { clsx } from 'clsx';

export interface InlineNumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  min?: number;
  error?: string;
  referenceLabel?: string;
  referenceValue?: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
}

export function InlineNumberInput({
  label,
  value,
  onChange,
  suffix,
  min,
  error,
  referenceLabel,
  referenceValue,
  helperText,
  disabled,
  className,
}: InlineNumberInputProps) {
  return (
    <div className={clsx('space-y-1', className)}>
      {referenceLabel && referenceValue && (
        <div className="flex justify-between items-baseline">
          <span className="text-bento-label text-pkt-text-body-muted">{referenceLabel}</span>
          <span className="text-bento-label font-mono tabular-nums text-pkt-text-body-muted">{referenceValue}</span>
        </div>
      )}
      <div className="flex justify-between items-center">
        <span className="text-bento-caption text-pkt-text-body-subtle">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            min={min}
            disabled={disabled}
            className={clsx(
              'w-20 px-2 py-0.5 text-bento-body font-mono tabular-nums text-right rounded-md border bg-pkt-bg-default transition-colors',
              error
                ? 'border-pkt-brand-red-1000 focus:ring-pkt-brand-red-1000/20'
                : 'border-pkt-border-default focus:border-pkt-brand-warm-blue-1000 focus:ring-pkt-brand-warm-blue-1000/20',
              'focus:outline-none focus:ring-2',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          />
          {suffix && (
            <span className="text-bento-caption text-pkt-text-body-subtle font-mono">{suffix}</span>
          )}
        </div>
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
