import React, { useState } from 'react';
import { FormDataModel } from '../../types';
import { DateField, SelectField, TextareaField, InputField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';
import PanelLayout from '../ui/PanelLayout';
import { HOVEDKATEGORI_OPTIONS, UNDERKATEGORI_MAP } from '../../constants';
import { PktButton, PktAlert, PktCheckbox, PktRadioButton } from '@oslokommune/punkt-react';
import { useFileUpload } from '../../hooks/useFileUpload';
import FileUploadField from '../ui/FileUploadField';
import { showToast } from '../../utils/toastHelpers';

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
  const [erTidligereVarslet, setErTidligereVarslet] = useState<'nei' | 'ja'>('nei');
  const [varselMetoder, setVarselMetoder] = useState<string[]>([]);

  // File upload hook
  const { fileInputRef, uploadedFiles, handleFileUploadClick, handleFileChange, handleRemoveFile } =
    useFileUpload((fileNames) => {
      handleChange('vedlegg', fileNames);
    });

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
  const isLocked = formStatus !== 'varsel' || disabled;

  const handleMetodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    let nyeMetoder: string[];

    if (checked) {
      nyeMetoder = [...varselMetoder, value];
    } else {
      nyeMetoder = varselMetoder.filter(m => m !== value);
      // Fjern også "annet"-spesifikasjon hvis "Annet" avkrysses
      if (value === 'Annet') {
        handleChange('varsel_metode_annet', '');
      }
    }

    setVarselMetoder(nyeMetoder);
    // Lagre som kommaseparert string for Dataverse
    handleChange('varsel_metode', nyeMetoder.join(', '));
  };

  const handleSendVarsel = () => {
    if (!varsel.dato_forhold_oppdaget || !varsel.hovedkategori) {
      showToast(setToastMessage, 'Vennligst fyll ut alle påkrevde felt før du sender varselet');
      return;
    }

    // Sjekk at varsel-felt er fylt ut hvis dette er tidligere varslet
    if (erTidligereVarslet === 'ja') {
      if (!varsel.dato_varsel_sendt) {
        showToast(setToastMessage, 'Vennligst oppgi når varselet ble sendt');
        return;
      }
      if (varselMetoder.length === 0) {
        showToast(setToastMessage, 'Vennligst velg minst én metode for varsling');
        return;
      }
      if (varselMetoder.includes('Annet') && !varsel.varsel_metode_annet) {
        showToast(setToastMessage, 'Vennligst spesifiser annen metode');
        return;
      }
    }

    setFormStatus?.('krav');
    setActiveTab?.(2);
    showToast(setToastMessage, 'Varsel sendt! Nå kan du spesifisere kravet.');
  };

  // Metoder for varsling som checkboxes
  const METODE_CHECKBOXES = [
    { value: 'E-post', label: 'E-post' },
    { value: 'Brev', label: 'Brev' },
    { value: 'Byggemøte', label: 'Byggemøte' },
    { value: 'Muntlig', label: 'Muntlig' },
    { value: 'Annet', label: 'Annet' },
  ];

  return (
    <PanelLayout>
      <div className="space-y-6">
        <PktAlert skin="info" compact>
          Dette er det første formelle steget (Trinn 1) etter NS 8407. Her dokumenteres selve hendelsen og at varsel er sendt. Selve kravet spesifiseres i neste fane.
        </PktAlert>

        <FieldsetCard legend="Forholdet som varsles">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SelectField
              id="varsel.hovedkategori"
              label="Hovedkategori (NS 8407)"
              value={varsel.hovedkategori}
              onChange={handleHovedkategoriChange}
              options={HOVEDKATEGORI_OPTIONS}
              error={errors['varsel.hovedkategori']}
              readOnly={isLocked}
              helpText="Velg primær årsak til endringen"
              className="w-full md:col-span-2"
            />
            
            <DateField
              id="varsel.dato_forhold_oppdaget"
              label="Dato forholdet ble oppdaget"
              value={varsel.dato_forhold_oppdaget}
              onChange={value => handleChange('dato_forhold_oppdaget', value)}
              error={errors['varsel.dato_forhold_oppdaget']}
              readOnly={isLocked}
              helpText="Velg dato forholdet ble kjent"
              className="w-full md:max-w-sm"
            />
          </div>
          <div className="space-y-6">
            {varsel.hovedkategori && underkategoriOptions.length > 0 && (
              <div className="w-full rounded-lg border bg-white p-4 border-border-color">
                <label className="block text-sm font-semibold text-ink-dim mb-1">
                  Velg underkategori
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
              label="Beskrivelse av forholdet"
              value={varsel.varsel_beskrivelse}
              onChange={e => handleChange('varsel_beskrivelse', e.target.value)}
              helpText="Beskriv hva som skjedde og hvorfor det utløser krav"
              readOnly={isLocked}
              optional
              fullwidth
            />
          </div>
        </FieldsetCard>

        <FieldsetCard legend="Varsling til byggherre">
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-ink-dim">
                Hvordan varsles byggherre?
              </label>
              <div className="space-y-3">
                <div
                  className={`w-full rounded-lg border bg-white p-4 transition-colors hover:bg-gray-50 ${
                    erTidligereVarslet === 'nei' ? 'border-pri' : 'border-border-color'
                  } ${isLocked ? 'bg-gray-50 opacity-70' : ''}`}
                >
                  <PktRadioButton
                    id="varsel-nytt"
                    name="varsling_type"
                    label="Varselet sendes via dette skjemaet"
                    value="nei"
                    checked={erTidligereVarslet === 'nei'}
                    onChange={() => setErTidligereVarslet('nei')}
                    disabled={isLocked}
                  />
                  <p className="pl-8 pt-1 text-sm text-muted">
                    Varselet dateres automatisk til i dag
                  </p>
                </div>
                <div
                  className={`w-full rounded-lg border bg-white p-4 transition-colors hover:bg-gray-50 ${
                    erTidligereVarslet === 'ja' ? 'border-pri' : 'border-border-color'
                  } ${isLocked ? 'bg-gray-50 opacity-70' : ''}`}
                >
                  <PktRadioButton
                    id="varsel-tidligere"
                    name="varsling_type"
                    label="Forholdet er tidligere varslet"
                    value="ja"
                    checked={erTidligereVarslet === 'ja'}
                    onChange={() => setErTidligereVarslet('ja')}
                    disabled={isLocked}
                  />
                  <p className="pl-8 pt-1 text-sm text-muted">
                    Du må oppgi når og hvordan det ble varslet
                  </p>
                </div>
              </div>
            </div>

            {erTidligereVarslet === 'nei' && (
              <PktAlert skin="success" compact>
                ✓ Varselet blir automatisk datert {new Date().toLocaleDateString('no-NO')} og sendt via dette digitale skjemaet.
              </PktAlert>
            )}

            {erTidligereVarslet === 'ja' && (
              <div className="space-y-6 pt-4 border-t border-border-color">
                <DateField
                  id="varsel.dato_varsel_sendt"
                  label="Dato tidligere varsel ble sendt"
                  value={varsel.dato_varsel_sendt}
                  onChange={value => handleChange('dato_varsel_sendt', value)}
                  error={errors['varsel.dato_varsel_sendt']}
                  readOnly={isLocked}
                  helpText="Når ble byggherre opprinnelig varslet om forholdet?"
                  required
                  className="w-full md:max-w-sm"
                />

                <div className="w-full rounded-lg border bg-white p-4 border-border-color">
                  <label className="block text-sm font-semibold text-ink-dim mb-1">
                    Metode(r) for tidligere varsling
                  </label>
                  <p className="text-sm text-muted mb-3">
                    Du kan velge flere metoder hvis varselet ble sendt på ulike måter
                  </p>
                  <div className="space-y-3">
                    {METODE_CHECKBOXES.map((metode) => (
                      <PktCheckbox
                        key={metode.value}
                        id={`metode-${metode.value.toLowerCase()}`}
                        name="varsel_metode"
                        label={metode.label}
                        value={metode.value}
                        checked={varselMetoder.includes(metode.value)}
                        onChange={handleMetodeChange}
                        disabled={isLocked}
                      />
                    ))}
                  </div>
                </div>

                {varselMetoder.includes('Annet') && (
                  <InputField
                    id="varsel.varsel_metode_annet"
                    label="Spesifiser annen metode"
                    value={varsel.varsel_metode_annet || ''}
                    onChange={e => handleChange('varsel_metode_annet', e.target.value)}
                    helpText="F.eks. 'SMS til prosjektleder' eller 'Teams-melding'"
                    required
                    readOnly={isLocked}
                    className="w-full md:max-w-md"
                  />
                )}
              </div>
            )}
          </div>
        </FieldsetCard>

        <FieldsetCard legend="Vedlegg">
          <FileUploadField
            fileInputRef={fileInputRef}
            uploadedFiles={uploadedFiles}
            onFileUploadClick={handleFileUploadClick}
            onFileChange={handleFileChange}
            onRemoveFile={handleRemoveFile}
            disabled={isLocked}
          />
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
