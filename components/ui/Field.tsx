
import React, { ChangeEvent, useState, useRef, useEffect } from 'react';
import { PktTextinput, PktTextarea, PktCheckbox, PktDatepicker, PktSelect } from '@oslokommune/punkt-react';
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
        : String(value || '');

    return (
      <div className={className}>
        <PktTextinput
          id={id}
          name={id}
          label={label}
          type={type === 'number' && formatAsNumber ? 'text' : type}
          value={displayValue}
          onChange={formatAsNumber ? handleNumericChange : onChange}
          requiredTag={required}
          placeholder={placeholder}
          readOnly={readOnly}
          min={min}
          step={step}
          helptext={helpText}
          hasError={!!error}
          errorMessage={error}
          useWrapper={true}
        />
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

    const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
        // PktDatepicker returnerer event, så vi må hente value derfra
        onChange(e.target.value);
    };

    return (
        <div className={className}>
            <PktDatepicker
                id={id}
                name={id}
                label={label}
                value={value}
                onChange={handleDateChange}
                requiredTag={required}
                disabled={readOnly}
                helptext={helpText}
                hasError={!!error}
                errorMessage={error}
                useWrapper={true}
                dateformat="yyyy-MM-dd"
            />
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

  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={className}>
      <PktSelect
        id={id}
        name={id}
        label={label}
        value={value}
        onChange={handleSelectChange}
        options={options}
        requiredTag={required}
        helptext={helpText}
        hasError={!!error}
        errorMessage={error}
        useWrapper={true}
      />
    </div>
  );
};

export const TextareaField: React.FC<TextareaFieldProps> = ({ id, label, value, onChange, required, placeholder, error, className, minHeight="90px", helpText }) => (
  <div className={className}>
    <PktTextarea
      id={id}
      name={id}
      label={label}
      value={value}
      onChange={onChange}
      requiredTag={required}
      placeholder={placeholder}
      helptext={helpText}
      hasError={!!error}
      errorMessage={error}
      style={{ minHeight }}
      useWrapper={true}
    />
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
  <div className={className}>
    <PktCheckbox
      id={id}
      name={id}
      label={label}
      checked={checked}
      onChange={onChange}
    />
  </div>
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