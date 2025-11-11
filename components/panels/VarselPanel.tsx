import React, { useRef, useState } from 'react';
import { FormDataModel } from '../../types';
import { DateField, SelectField, TextareaField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';
import { HOVEDKATEGORI_OPTIONS, UNDERKATEGORI_MAP } from '../../constants';
import { PktButton } from '@oslokommune/punkt-react';

interface VarselPanelProps {
  formData: FormDataModel;
  setFormData: (section: 'varsel', field: string, value: any) => void;
  errors: Record<string, string>;
  disabled?: boolean;
}

const VarselPanel: React.FC<VarselPanelProps> = ({ formData, setFormData, errors, disabled }) => {
  const { varsel } = formData;
  const handleChange = (field: string, value: any) => setFormData('varsel', field, value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleHovedkategoriChange = (value: string) => {
    handleChange('hovedkategori', value);
    handleChange('underkategori', ''); // Reset underkategori
  };

  const underkategoriOptions = [
      {value:"", label: varsel.hovedkategori ? "— Velg —" : "— Velg hovedkategori først —"},
      ...(UNDERKATEGORI_MAP[varsel.hovedkategori] || []).map(o => ({ value: o, label: o }))
  ];

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setUploadedFiles(prev => [...prev, ...Array.from(files)]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <FieldsetCard legend="Dato">
        <div className="flex flex-col md:flex-row gap-x-6 gap-y-4">
          <DateField id="varsel.dato_forhold_oppdaget" label="Dato forhold oppdaget" value={varsel.dato_forhold_oppdaget} onChange={value => handleChange('dato_forhold_oppdaget', value)} required error={errors['varsel.dato_forhold_oppdaget']} className="max-w-xs" readOnly={disabled} />
          <DateField id="varsel.dato_varsel_sendt" label="Dato varsel sendt" value={varsel.dato_varsel_sendt} onChange={value => handleChange('dato_varsel_sendt', value)} required error={errors['varsel.dato_varsel_sendt']} className="max-w-xs" readOnly={disabled} />
        </div>
      </FieldsetCard>

      <FieldsetCard legend="Klassifisering">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <SelectField id="varsel.hovedkategori" label="Hovedkategori (NS 8407)" value={varsel.hovedkategori} onChange={handleHovedkategoriChange} options={HOVEDKATEGORI_OPTIONS} required error={errors['varsel.hovedkategori']} readOnly={disabled} />
          <SelectField id="varsel.underkategori" label="Underkategori" value={varsel.underkategori} onChange={value => handleChange('underkategori', value)} options={underkategoriOptions} readOnly={disabled} />
        </div>
      </FieldsetCard>

      <FieldsetCard legend="Beskrivelse og Referanser">
        <div className="grid grid-cols-1 gap-y-4">
          <TextareaField id="varsel.varsel_beskrivelse" label="Beskrivelse (vis til vedlegg)" value={varsel.varsel_beskrivelse} onChange={e => handleChange('varsel_beskrivelse', e.target.value)} readOnly={disabled} />
          <TextareaField id="varsel.referansedokumenter" label="Referansedokumenter / tidligere korrespondanse" value={varsel.referansedokumenter} onChange={e => handleChange('referansedokumenter', e.target.value)} readOnly={disabled} />
        </div>
      </FieldsetCard>

      <FieldsetCard legend="Vedlegg">
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            disabled={disabled}
          />
          <PktButton
            skin="secondary"
            size="medium"
            iconName="attachment"
            variant="icon-left"
            onClick={handleFileUploadClick}
            disabled={disabled}
          >
            Last opp vedlegg
          </PktButton>
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-ink">Opplastede filer:</p>
              <ul className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <li key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-border-color">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-ink">{file.name}</span>
                      <span className="text-xs text-muted">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="text-sm text-red-600 hover:text-red-700 hover:underline"
                    >
                      Fjern
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </FieldsetCard>
    </div>
  );
};

export default VarselPanel;