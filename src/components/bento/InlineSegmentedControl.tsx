import { clsx } from 'clsx';

export interface SegmentOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface InlineSegmentedControlProps {
  options: SegmentOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function InlineSegmentedControl({
  options,
  value,
  onChange,
  disabled,
  className,
}: InlineSegmentedControlProps) {
  return (
    <div className={clsx('flex items-center gap-1', className)}>
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const isDisabled = disabled || opt.disabled;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(opt.value)}
            className={clsx(
              'flex-1 px-2 py-1 rounded-md border text-bento-caption font-medium transition-all text-center',
              !isDisabled && 'cursor-pointer',
              isDisabled && 'cursor-not-allowed opacity-40',
              isSelected
                ? 'border-pkt-brand-dark-green-1000 bg-pkt-brand-dark-green-1000/5 text-pkt-brand-dark-green-1000'
                : 'border-pkt-border-default bg-pkt-bg-subtle text-pkt-text-body-default',
              value !== undefined && !isSelected && !isDisabled && 'opacity-50',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
