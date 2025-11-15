import React, { useRef, useState } from 'react';
import { FormDataModel } from '../../types';
import { DateField, SelectField, TextareaField, InputField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';
import PanelLayout from '../ui/PanelLayout';
import { HOVEDKATEGORI_OPTIONS, UNDERKATEGORI_MAP } from '../../constants';
import { PktButton, PktAlert, PktCheckbox } from '@oslokommune/punkt-react';

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
  const { varsel, rolle, sak } = formData;
  const handleChange = (field: string, value: any) => setFormData('varsel', field, value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleHovedkategoriChange = (value: string) => {
    handleChange('hovedkategori', value);
    handleChange('underkategori', []); // Reset underkategori til tom array
  };

  const handleUnderkategoriChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    const naaVerdier = varsel.underkategori || [];

    let nyeVerdier: string[];
    if (checked) {
      nyeVerdier = [...naaVerdier, value]; // Legg til
    } else {
      nyeVerdier = naaVerdier.filter(item => item !== value); // Fjern
    }
    handleChange('underkategori', nyeVerdier);
  };

  const underkategoriOptions = UNDERKATEGORI_MAP[varsel.hovedkategori] || [];

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
    if (!varsel.dato_forhold_oppdaget || !varsel.dato_varsel_sendt || !varsel.hovedkategori) {
      setToastMessage?.('Vennligst fyll ut alle påkrevde felt før du sender varselet');
      setTimeout(() => setToastMessage?.(''), 3000);
      return;
    }

    setFormStatus?.('krav');
    setActiveTab?.(2);
    setToastMessage?.('Varsel sendt! Nå kan du spesifisere kravet.');
    setTimeout(() => setToastMessage?.(''), 3000);
  };

  const isLocked = formStatus !== 'varsel' || disabled;
  const varselMetodeOptions = [
    { value: "Denne saken", label: "Denne saken" },
    { value: "", label: "— Velg —" },
    { value: "E-post", label: "E-post" },
    { value: "Brev", label: "Brev" },
    { value: "Byggemøte", label: "Byggemøte" },
    { value: "Muntlig", label: "Muntlig" },
    { value: "Annet", label: "Annet" },
  ];

  return (
    <PanelLayout>
      <div className="space-y-6">
        <PktAlert skin="info" compact>
          Dette er det første formelle steget (Trinn 1) etter NS 8407. Her dokumenteres selve hendelsen og at varsel er sendt. Selve kravet spesifiseres i neste fane.
        </PktAlert>

        <FieldsetCard legend="Når skjedde det?">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DateField
                id="varsel.dato_forhold_oppdaget"
                label="Dato forhold oppdaget"
                value={varsel.dato_forhold_oppdaget}
                onChange={value => handleChange('dato_forhold_oppdaget', value)}
                error={errors['varsel.dato_forhold_oppdaget']}
                readOnly={isLocked}
                helpText="Når inntraff hendelsen?"
                className="w-full md:max-w-sm"
              />
              <DateField
                id="varsel.dato_varsel_sendt"
                label="Dato varsel sendt"
                value={varsel.dato_varsel_sendt}
                onChange={value => handleChange('dato_varsel_sendt', value)}
                error={errors['varsel.dato_varsel_sendt']}
                readOnly={isLocked}
                helpText="Når ble varselet sendt til BH?"
                className="w-full md:max-w-sm"
              />
            </div>
            <SelectField
              id="varsel.varsel_metode"
              label="Metode for varsling"
              value={varsel.varsel_metode}
              onChange={value => handleChange('varsel_metode', value)}
              options={varselMetodeOptions}
              readOnly={isLocked}
              helpText="F.eks. 'E-post til prosjektleder'"
              className="w-full md:max-w-md"
            />
          </div>
        </FieldsetCard>

        <FieldsetCard legend="Hva gjelder det?">
          <div className="space-y-6">
            <SelectField
              id="varsel.hovedkategori"
              label="Hovedkategori (NS 8407)"
              value={varsel.hovedkategori}
              onChange={handleHovedkategoriChange}
              options={HOVEDKATEGORI_OPTIONS}
              error={errors['varsel.hovedkategori']}
              readOnly={isLocked}
              className="max-w-md"
            />

            {varsel.hovedkategori && underkategoriOptions.length > 0 && (
              <div className="w-full rounded-lg border bg-white p-4 border-border-color">
                <label className="block text-sm font-semibold text-ink-dim mb-1">
                  Velg underkategori (valgfritt, flere valg er mulig)
                </label>
                <p className="text-sm text-muted mb-3">Du kan velge flere underkategorier</p>
                <div className="space-y-4">
                  {underkategoriOptions.map((opt) => (
                    <PktCheckbox
                      key={opt.value}
                      id={`underkategori-${opt.value}`}
                      name="underkategori"
                      label={opt.label}
                      value={opt.value}
                      checked={varsel.underkategori.includes(opt.value)}
                      onChange={handleUnderkategoriChange}
                      disabled={isLocked}
                    />
                  ))}
                </div>
              </div>
            )}

            <TextareaField
              id="varsel.varsel_beskrivelse"
              label="Beskrivelse (vis til vedlegg)"
              value={varsel.varsel_beskrivelse}
              onChange={e => handleChange('varsel_beskrivelse', e.target.value)}
              helpText="Beskriv hva som skjedde og hvorfor det utløser krav"
              readOnly={isLocked}
              optional
              fullwidth
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
    </PanelLayout>
  );
};

export default VarselPanel;
