
import React, { ChangeEvent, useState, useRef, useEffect } from 'react';
import { CheckIcon, ChevronUpDownIcon, CalendarIcon } from './icons';
import DatePicker from './DatePicker';

type InputType = 'text' | 'number';

interface FieldProps {
  id: string;
  label: string;
  type?: InputType;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  required?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  error?: string;
  className?: string;
  min?: number;
  step?: number | string;
  helpText?: string;
  formatAsNumber?: boolean;
}

interface TextareaFieldProps extends Omit<FieldProps, 'type' | 'min' | 'step' | 'readOnly' | 'formatAsNumber'> {
    value: string;
    minHeight?: string;
}

const baseInputClasses = "w-full p-2.5 rounded-lg border border-border-color bg-white text-ink focus:border-pri focus:ring-2 focus:ring-pri/20 outline-none";
const invalidClasses = "border-warn box-shadow:0 0 0 2px #e3241b22";

export const InputField: React.FC<FieldProps> = ({ id, label, type = 'text', value, onChange, required, placeholder, readOnly, error, className, min, step, helpText, formatAsNumber }) => {
    
    const handleNumericChange = (e: ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\s/g, ''); // remove spaces
        if (/^\d*\.?\d*$/.test(rawValue)) { // Allow numbers and a single decimal point
             const syntheticEvent = {
                ...e,
                target: { ...e.target, name: id, value: rawValue },
            };
            onChange(syntheticEvent as any);
        }
    };

    const displayValue = formatAsNumber && value && String(value).length > 0
        ? Number(value).toLocaleString('no-NO')
        : value;

    return (
      <div className={`grid gap-1.5 ${className}`}>
        <div className="flex items-center">
            <label htmlFor={id} className="font-semibold">{label}</label>
            {required && <span className="text-warn ml-1.5 select-none">*</span>}
        </div>
        {helpText && <p className="text-xs text-muted -mt-1">{helpText}</p>}
        <input
          id={id}
          name={id}
          type={type === 'number' && formatAsNumber ? 'text' : type}
          value={displayValue}
          onChange={formatAsNumber ? handleNumericChange : onChange}
          required={required}
          placeholder={placeholder}
          readOnly={readOnly}
          min={min}
          step={step}
          className={`${baseInputClasses} ${error ? invalidClasses : ''}`}
          inputMode={formatAsNumber ? 'numeric' : undefined}
        />
        <div className="text-warn text-xs min-h-[16px]">{error || ''}</div>
      </div>
    );
};

interface DateFieldProps {
  id: string;
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  required?: boolean;
  readOnly?: boolean;
  error?: string;
  className?: string;
  helpText?: string;
}

export const DateField: React.FC<DateFieldProps> = ({ id, label, value, onChange, required, readOnly, error, className, helpText }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [ref]);

    const handleDateChange = (date: string) => {
        onChange(date);
        setIsOpen(false);
    };

    const handleInputClick = () => {
        if (!readOnly) {
            setIsOpen(!isOpen);
        }
    };
    
    return (
        <div className={`grid gap-1.5 ${className}`} ref={ref}>
            <div className="flex items-center">
                <label htmlFor={id} className="font-semibold">{label}</label>
                {required && <span className="text-warn ml-1.5 select-none">*</span>}
            </div>
            {helpText && <p className="text-xs text-muted -mt-1">{helpText}</p>}
            <div className="relative">
                <div className="relative">
                    <input
                        id={id}
                        name={id}
                        type="text"
                        value={value}
                        onClick={handleInputClick}
                        readOnly
                        placeholder="YYYY-MM-DD"
                        className={`${baseInputClasses} ${error ? invalidClasses : ''} ${readOnly ? 'bg-gray-50' : 'cursor-pointer'}`}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <CalendarIcon className="h-5 w-5 text-gray-400" />
                    </div>
                </div>

                {isOpen && !readOnly && (
                    <div className="absolute z-10 mt-2">
                        <DatePicker
                            value={value}
                            onChange={handleDateChange}
                            onClose={() => setIsOpen(false)}
                        />
                    </div>
                )}
            </div>
             <div className="text-warn text-xs min-h-[16px]">{error || ''}</div>
        </div>
    );
};

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  error?: string;
  className?: string;
  helpText?: string;
}


export const SelectField: React.FC<SelectFieldProps> = ({ id, label, value, onChange, options, required, error, className, helpText }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };
  
  return (
    <div className={`grid gap-1.5 ${className}`} ref={ref}>
      <div className="flex items-center">
        <label id={`${id}-label`} className="font-semibold">{label}</label>
         {required && <span className="text-warn ml-1.5 select-none">*</span>}
      </div>
      {helpText && <p className="text-xs text-muted -mt-1">{helpText}</p>}
      <div className="relative">
        <button
          type="button"
          id={id}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={`${id}-label`}
          onClick={() => setIsOpen(!isOpen)}
          className={`${baseInputClasses} text-left flex justify-between items-center ${error ? invalidClasses : ''}`}
        >
          <span className="truncate">{selectedOption?.label || '— Velg —'}</span>
          <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
        </button>
        {isOpen && (
          <ul
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="absolute z-10 mt-1 w-full bg-card-bg shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
          >
            {options.map((opt) => (
              <li
                key={opt.value}
                id={`${id}-option-${opt.value}`}
                role="option"
                aria-selected={value === opt.value}
                onClick={() => handleSelect(opt.value)}
                className="group text-ink-dim cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-pri-light hover:text-ink transition-colors duration-100"
              >
                <span className={`block truncate ${value === opt.value ? 'font-semibold' : 'font-normal'}`}>
                  {opt.label}
                </span>
                {value === opt.value && (
                  <span className="text-pri group-hover:text-ink absolute inset-y-0 right-0 flex items-center pr-4">
                    <CheckIcon className="h-5 w-5" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="text-warn text-xs min-h-[16px]">{error || ''}</div>
    </div>
  );
};

export const TextareaField: React.FC<TextareaFieldProps> = ({ id, label, value, onChange, required, placeholder, error, className, minHeight="90px", helpText }) => (
  <div className={`grid gap-1.5 ${className}`}>
     <div className="flex items-center">
        <label htmlFor={id} className="font-semibold">{label}</label>
        {required && <span className="text-warn ml-1.5 select-none">*</span>}
    </div>
    {helpText && <p className="text-xs text-muted -mt-1">{helpText}</p>}
    <textarea
      id={id}
      name={id}
      value={value}
      onChange={onChange}
      required={required}
      placeholder={placeholder}
      className={`${baseInputClasses} ${error ? invalidClasses : ''} resize-vertical`}
      style={{ minHeight }}
    />
    <div className="text-warn text-xs min-h-[16px]">{error || ''}</div>
  </div>
);

interface CheckboxFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

export const CheckboxField: React.FC<CheckboxFieldProps> = ({ id, label, checked, onChange, className }) => (
  <label htmlFor={id} className={`inline-flex items-center gap-3 cursor-pointer group ${className}`}>
    <input 
      id={id} 
      name={id} 
      type="checkbox" 
      checked={checked} 
      onChange={onChange} 
      className="sr-only peer"
    />
    <span className={`
      w-5 h-5 rounded border flex items-center justify-center transition-all duration-150
      bg-white border-border-color 
      group-hover:border-pri/70
      peer-checked:bg-pri peer-checked:border-pri
      peer-focus:ring-2 peer-focus:ring-pri/30
    `}>
      <CheckIcon className={`
        w-3 h-3 text-white transition-opacity duration-100
        ${checked ? 'opacity-100' : 'opacity-0'}
      `} />
    </span>
    <span className="text-ink select-none">{label}</span>
  </label>
);

interface RadioButtonProps {
    name: string;
    value: string;
    label: string;
    checked: boolean;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const RadioButton: React.FC<RadioButtonProps> = ({ name, value, label, checked, onChange }) => (
    <label className="inline-flex items-center gap-2">
        <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="transform translate-y-px" />
        {label}
    </label>
);