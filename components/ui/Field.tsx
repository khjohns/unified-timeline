
import React, { ChangeEvent } from 'react';
import { PktTextinput, PktTextarea, PktCheckbox, PktDatepicker, PktSelect } from '@oslokommune/punkt-react';

type InputType = 'text' | 'number';

interface FieldProps {
  id: string;
  label: string;
  type?: InputType;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  error?: string;
  className?: string;
  min?: number;
  step?: number | string;
  helpText?: string;
  formatAsNumber?: boolean;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  autoComplete?: string;
  pattern?: string;
}

interface TextareaFieldProps extends Omit<FieldProps, 'type' | 'min' | 'step' | 'formatAsNumber'> {
    value: string;
    minHeight?: string;
    fullwidth?: boolean;
}

export const InputField: React.FC<FieldProps> = ({ id, label, type = 'text', value, onChange, required, optional, placeholder, readOnly, error, className, min, step, helpText, formatAsNumber, inputMode, autoComplete, pattern }) => {

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
          optionalTag={optional}
          placeholder={placeholder}
          readOnly={readOnly}
          min={min}
          step={step}
          helptext={helpText}
          hasError={!!error}
          errorMessage={error}
          useWrapper={true}
          inputMode={inputMode}
          autoComplete={autoComplete}
          pattern={pattern}
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
  optional?: boolean;
  readOnly?: boolean;
  error?: string;
  className?: string;
  helpText?: string;
  fullwidth?: boolean;
}

export const DateField: React.FC<DateFieldProps> = ({ id, label, value, onChange, required, optional, readOnly, error, className, helpText, fullwidth }) => {

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
                optionalTag={optional}
                disabled={readOnly}
                helptext={helpText}
                hasError={!!error}
                errorMessage={error}
                useWrapper={true}
                dateformat="yyyy-MM-dd"
                fullwidth={fullwidth}
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
  optional?: boolean;
  error?: string;
  className?: string;
  helpText?: string;
  readOnly?: boolean;
  fullwidth?: boolean;
}


export const SelectField: React.FC<SelectFieldProps> = ({ id, label, value, onChange, options, required, optional, error, className, helpText, readOnly, fullwidth }) => {

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
        optionalTag={optional}
        helptext={helpText}
        hasError={!!error}
        errorMessage={error}
        useWrapper={true}
        disabled={readOnly}
        fullwidth={fullwidth}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </PktSelect>
    </div>
  );
};

export const TextareaField: React.FC<TextareaFieldProps> = ({ id, label, value, onChange, required, optional, placeholder, error, className, minHeight="90px", helpText, readOnly, fullwidth }) => (
  <div className={className}>
    <PktTextarea
      id={id}
      name={id}
      label={label}
      value={value}
      onChange={onChange}
      optionalTag={optional}
      placeholder={placeholder}
      helptext={helpText}
      hasError={!!error}
      errorMessage={error}
      style={{ minHeight }}
      useWrapper={true}
      readOnly={readOnly}
      fullwidth={fullwidth}
    />
  </div>
);

interface CheckboxFieldProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
  hasTile?: boolean;
  checkHelptext?: string | React.ReactNode;
  hasError?: boolean;
  // fullwidth-prop er ikke lenger nødvendig her, da vi styrer det med className="w-full"
}

export const CheckboxField: React.FC<CheckboxFieldProps> = ({
  id,
  label,
  checked,
  onChange,
  className,
  disabled,
  hasTile = false,
  checkHelptext,
  hasError = false
}) => {
  // Hvis hasTile er true, bruk den nye egendefinerte flis-layouten
  if (hasTile) {
    return (
      <div 
        className={`w-full rounded-lg border bg-white p-4 transition-colors hover:bg-gray-50 ${
          checked ? 'border-pri' : 'border-border-color'
        } ${disabled ? 'bg-gray-50 opacity-70' : ''} ${className || ''}`}
      >
        <PktCheckbox
          id={id}
          name={id}
          label={label}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          hasError={hasError}
          // Vi sender IKKE hasTile-propen til PktCheckbox, siden vi lager flisen selv
        />
        {checkHelptext && (
          <p className="pl-8 pt-1 text-sm text-muted">
            {checkHelptext}
          </p>
        )}
      </div>
    );
  }

  // Hvis hasTile er false (eller ikke satt), bruk standard PktCheckbox
  return (
    <div className={className}>
      <PktCheckbox
        id={id}
        name={id}
        label={label}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        hasTile={false} // Send 'false' videre
        checkHelptext={checkHelptext} // Send hjelpetekst hit
        hasError={hasError}
        className="w-full" // Sørger for at standard-sjekkbokser også kan ta full bredde
      />
    </div>
  );
};
