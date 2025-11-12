import React, { useRef, useState } from 'react';
import { FormDataModel } from '../../types';
import { DateField, SelectField, TextareaField, InputField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';
import { HOVEDKATEGORI_OPTIONS, UNDERKATEGORI_MAP } from '../../constants';
import { PktButton, PktAlert, PktDatepicker } from '@oslokommune/punkt-react';

interface VarselPanelProps {
  formData: FormDataModel;
  setFormData: (section: 'varsel', field: string, value: any) => void;
  errors: Record<string, string>;
  disabled?: boolean;
  formStatus?: 'varsel' | 'krav' | 'svar';
  setFormStatus?: (status: 'varsel' | 'krav' | 'svar') => void;
  setActiveTab?: (tab: number) => void;
  setToastMessage?: (message: string) => void;
}

const VarselPanel: React.FC<VarselPanelProps> = ({
  formData,
  setFormData,
  errors,
  disabled,
  formStatus = 'varsel',
  setFormStatus,
  setActiveTab,
  setToastMessage
}) => {
  const { varsel, rolle } = formData;
  const handleChange = (field: string, value: any) => setFormData('varsel', field, value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleDateChange = (event: CustomEvent<string[]>) => {
    const dates = event.detail.sort(); // Sorter datoene (eldste først)

    // Sett den første datoen (eller en tom streng hvis ingen er valgt)
    handleChange('dato_forhold_oppdaget', dates[0] || '');

    // Sett den andre datoen. Hvis bare én er valgt, bruk den første datoen for begge.
    handleChange('dato_varsel_sendt', (dates.length > 1 ? dates[1] : dates[0]) || '');
  };

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

  const handleSendVarsel = () => {
    // Validate varsel fields
    if (!varsel.dato_forhold_oppdaget || !varsel.dato_varsel_sendt || !varsel.hovedkategori) {
      setToastMessage?.('Vennligst fyll ut alle påkrevde felt før du sender varselet');
      setTimeout(() => setToastMessage?.(''), 3000);
      return;
    }

    // Move to krav status
    setFormStatus?.('krav');
    setActiveTab?.(2); // Go to Krav (KOE) tab
    setToastMessage?.('Varsel sendt! Nå kan du spesifisere kravet.');
    setTimeout(() => setToastMessage?.(''), 3000);
  };

  const isLocked = formStatus !== 'varsel' || disabled;
  const varselMetodeOptions = [
    { value: "", label: "— Velg —" },
    { value: "E-post", label: "E-post" },
    { value: "Brev", label: "Brev" },
    { value: "Byggemøte", label: "Byggemøte" },
    { value: "Telefonsamtale + e-post", label: "Telefonsamtale + e-post" },
    { value: "Annet", label: "Annet" },
  ];

  return (
    <div className="space-y-6">
      <PktAlert skin="info" compact>
        Dette er det første formelle steget (Trinn 1) etter NS 8407. Her dokumenteres selve hendelsen og at varsel er sendt. Selve kravet spesifiseres i neste fane.
      </PktAlert>

      <FieldsetCard legend="Varseldetaljer (Trinn 1)">
        {/* Bruk 2-kolonners grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {/* CELLE 1: Datovelger */}
          <PktDatepicker
            id="varsel.datoer"
            label="Dato forhold oppdaget / Dato varsel sendt"
            value={[varsel.dato_forhold_oppdaget, varsel.dato_varsel_sendt].filter(Boolean)}
            onValueChange={handleDateChange}
            multiple={true}
            disabled={isLocked}
            helptext="Velg to datoer: 1. Når hendelsen skjedde. 2. Når BH ble varslet."
            hasError={!!errors['varsel.dato_forhold_oppdaget'] || !!errors['varsel.dato_varsel_sendt']}
            errorMessage={errors['varsel.dato_forhold_oppdaget'] || errors['varsel.dato_varsel_sendt']}
            useWrapper
          />

          {/* CELLE 2: Metode for varsling */}
          <SelectField
            id="varsel.varsel_metode"
            label="Metode for varsling"
            value={varsel.varsel_metode}
            onChange={value => handleChange('varsel_metode', value)}
            options={varselMetodeOptions}
            readOnly={isLocked}
            helpText="Hvordan ble varselet kommunisert?"
          />

          {/* CELLE 3: Hovedkategori */}
          <SelectField
            id="varsel.hovedkategori"
            label="Hovedkategori (NS 8407)"
            value={varsel.hovedkategori}
            onChange={handleHovedkategoriChange}
            options={HOVEDKATEGORI_OPTIONS}
            error={errors['varsel.hovedkategori']}
            readOnly={isLocked}
          />

          {/* CELLE 4: Underkategori */}
          <SelectField
            id="varsel.underkategori"
            label="Underkategori"
            value={varsel.underkategori}
            onChange={value => handleChange('underkategori', value)}
            options={underkategoriOptions}
            readOnly={isLocked}
            optional
          />
        </div>
      </FieldsetCard>

      <FieldsetCard legend="Beskrivelse og Referanser">
        <div className="grid grid-cols-1 gap-y-4">
          <TextareaField
            id="varsel.varsel_beskrivelse"
            label="Beskrivelse (vis til vedlegg)"
            value={varsel.varsel_beskrivelse}
            onChange={e => handleChange('varsel_beskrivelse', e.target.value)}
            readOnly={isLocked}
            optional
          />
          <TextareaField
            id="varsel.referansedokumenter"
            label="Referansedokumenter / tidligere korrespondanse"
            value={varsel.referansedokumenter}
            onChange={e => handleChange('referansedokumenter', e.target.value)}
            readOnly={isLocked}
            optional
          />
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
            disabled={isLocked}
          />
          <PktButton
            skin="secondary"
            size="medium"
            iconName="attachment"
            variant="icon-left"
            onClick={handleFileUploadClick}
            disabled={isLocked}
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
                      disabled={isLocked}
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

      <FieldsetCard legend="Signatur (For Totalentreprenør)">
        <div className="grid grid-cols-1 gap-y-6">
          <InputField
            id="varsel.signatur_te"
            label="Signatur"
            value={varsel.signatur_te}
            onChange={e => handleChange('signatur_te', e.target.value)}
            placeholder="Navn på signatar"
            readOnly={isLocked}
            helpText="Navnet til personen som sender varselet"
          />
        </div>
      </FieldsetCard>

      {formStatus === 'varsel' && rolle === 'TE' && !disabled && (
        <div className="flex justify-end pt-4">
          <PktButton
            skin="primary"
            size="medium"
            onClick={handleSendVarsel}
            iconName="chevron-right"
            variant="icon-right"
          >
            Send varsel og fortsett til krav
          </PktButton>
        </div>
      )}
    </div>
  );
};

export default VarselPanel;
