import { clsx } from 'clsx';
import { CheckIcon, Cross2Icon, ResetIcon } from '@radix-ui/react-icons';

export interface VerdictOption {
  value: string;
  label: string;
  description: string;
  icon: 'check' | 'cross' | 'undo';
  colorScheme: 'green' | 'red' | 'gray';
}

interface VerdictCardsProps {
  value: string | undefined;
  onChange: (value: string) => void;
  options: VerdictOption[];
  error?: boolean;
}

const iconMap = {
  check: CheckIcon,
  cross: Cross2Icon,
  undo: ResetIcon,
};

const colorStyles = {
  green: {
    selected: 'border-pkt-brand-dark-green-1000 bg-pkt-brand-dark-green-1000/5',
    icon: 'text-pkt-brand-dark-green-1000',
  },
  red: {
    selected: 'border-pkt-brand-red-1000 bg-pkt-brand-red-1000/5',
    icon: 'text-pkt-brand-red-1000',
  },
  gray: {
    selected: 'border-pkt-grays-gray-500 bg-pkt-grays-gray-100',
    icon: 'text-pkt-text-body-subtle',
  },
};

export function VerdictCards({ value, onChange, options, error }: VerdictCardsProps) {
  const hasSelection = value !== undefined;

  return (
    <div
      data-verdict-cards
      className={clsx(
        'grid gap-3',
        options.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
        error && !hasSelection && 'ring-2 ring-pkt-brand-red-1000/30 rounded-lg p-1',
      )}
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        const Icon = iconMap[option.icon];
        const colors = colorStyles[option.colorScheme];

        return (
          <button
            key={option.value}
            type="button"
            data-verdict-card
            data-selected={isSelected ? 'true' : 'false'}
            onClick={() => onChange(option.value)}
            className={clsx(
              'flex flex-col items-start p-4 rounded-lg border-2 text-left',
              'transition-all duration-150 cursor-pointer',
              'hover:scale-[1.01] hover:shadow-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pkt-border-focus',
              isSelected
                ? colors.selected
                : 'border-pkt-border-default bg-pkt-bg-subtle',
              hasSelection && !isSelected && 'opacity-50',
            )}
          >
            <Icon className={clsx('w-5 h-5 mb-2', isSelected ? colors.icon : 'text-pkt-text-body-muted')} />
            <span className={clsx('text-sm font-semibold', isSelected ? 'text-pkt-text-body-dark' : 'text-pkt-text-body-default')}>
              {option.label}
            </span>
            <span className="text-[11px] text-pkt-text-body-subtle mt-1 leading-tight">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
