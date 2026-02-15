import { clsx } from 'clsx';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';

export interface InlineYesNoProps {
  label: string;
  subtitle?: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  showPrekludert?: boolean;
  showRedusert?: boolean;
  badge?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function InlineYesNo({
  label,
  subtitle,
  value,
  onChange,
  showPrekludert,
  showRedusert,
  badge,
  disabled,
  className,
}: InlineYesNoProps) {
  return (
    <div className={clsx('flex justify-between items-center gap-2', className)}>
      <div className="flex items-baseline gap-1 min-w-0">
        <span className="text-[11px] text-pkt-text-body-subtle truncate">{label}</span>
        {subtitle && (
          <span className="text-[10px] text-pkt-text-body-muted flex-shrink-0">{subtitle}</span>
        )}
        {badge}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {showPrekludert && value === false && (
          <span className="bg-pkt-brand-red-1000/10 text-pkt-brand-red-1000 rounded-sm text-[9px] px-1 py-0.5 font-bold uppercase tracking-wide mr-1">
            PREKLUDERT
          </span>
        )}
        {showRedusert && value === false && (
          <span className="bg-pkt-brand-yellow-1000/10 text-pkt-brand-yellow-1000 rounded-sm text-[9px] px-1 py-0.5 font-bold uppercase tracking-wide mr-1">
            REDUSERT
          </span>
        )}
        <button
          type="button"
          data-value="true"
          disabled={disabled}
          onClick={() => !disabled && onChange(true)}
          className={clsx(
            'flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all',
            !disabled && 'cursor-pointer',
            disabled && 'cursor-not-allowed opacity-40',
            value === true
              ? 'border-pkt-brand-dark-green-1000 bg-pkt-brand-dark-green-1000/5 text-pkt-brand-dark-green-1000'
              : 'border-pkt-border-default bg-pkt-bg-subtle text-pkt-text-body-default',
            value !== undefined && value !== true && !disabled && 'opacity-50',
          )}
        >
          <CheckIcon className="w-3 h-3" />
          Ja
        </button>
        <button
          type="button"
          data-value="false"
          disabled={disabled}
          onClick={() => !disabled && onChange(false)}
          className={clsx(
            'flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all',
            !disabled && 'cursor-pointer',
            disabled && 'cursor-not-allowed opacity-40',
            value === false
              ? 'border-pkt-brand-red-1000 bg-pkt-brand-red-1000/5 text-pkt-brand-red-1000'
              : 'border-pkt-border-default bg-pkt-bg-subtle text-pkt-text-body-default',
            value !== undefined && value !== false && !disabled && 'opacity-50',
          )}
        >
          <Cross2Icon className="w-3 h-3" />
          Nei
        </button>
      </div>
    </div>
  );
}
