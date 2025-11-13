import React, { useRef, useState } from 'react';
import { FormDataModel } from '../../types';
import { InputField, SelectField, TextareaField, DateField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';
import PanelLayout from '../ui/PanelLayout';
import SidePanel from '../ui/SidePanel';
import { PktAccordion, PktAccordionItem, PktButton, PktAlert } from '@oslokommune/punkt-react';
import { HOVEDKATEGORI_OPTIONS, UNDERKATEGORI_MAP } from '../../constants';

interface TestSakPanelProps {
  formData: FormDataModel;
  setFormData: (section: 'sak' | 'varsel', field: string, value: any) => void;
  errors: Record<string, string>;
  disabled?: boolean;
  formStatus?: 'varsel' | 'krav' | 'svar';
  setFormStatus?: (status: 'varsel' | 'krav' | 'svar') => void;
  setActiveTab?: (tab: number) => void;
  setToastMessage?: (message: string) => void;
}

const TestSakPanel: React.FC<TestSakPanelProps> = ({
  formData,
  setFormData,
  errors,
  disabled,
  formStatus = 'varsel',
  setFormStatus,
  setActiveTab,
  setToastMessage
}) => {
  const { sak, varsel, rolle } = formData;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleSakChange = (field: string, value: any) => setFormData('sak', field, value);
  const handleVarselChange = (field: string, value: any) => setFormData('varsel', field, value);

  const handleHovedkategoriChange = (value: string) => {
    handleVarselChange('hovedkategori', value);
    handleVarselChange('underkategori', '');
  };

  const underkategoriOptions = [
    { value: "", label: varsel.hovedkategori ? "— Velg —" : "— Velg hovedkategori først —" },
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

  const isVarselLocked = formStatus !== 'varsel' || disabled;
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
    <PanelLayout sidePanel={<SidePanel sak={sak} />}>
      <PktAccordion skin="outlined">
        {/* 1. Grunninfo */}
        <PktAccordionItem
          id="test-grunninfo"
          title="1. Grunninfo"
          defaultOpen
        >
          <div className="space-y-6 p-4">
            <FieldsetCard legend="Saksdetaljer">
              <div className="space-y-6">
                <InputField
                  id="sak.sakstittel"
                  label="Sakstittel"
                  value={sak.sakstittel}
                  onChange={e => handleSakChange('sakstittel', e.target.value)}
                  placeholder=""
                  error={errors['sak.sakstittel']}
                  readOnly={disabled}
                />
                <InputField
                  id="sak.sak_id_display"
                  label="Sak-ID"
                  value={sak.sak_id_display}
                  onChange={e => handleSakChange('sak_id_display', e.target.value)}
                  placeholder="f.eks. KOE-2025-0001"
                  error={errors['sak.sak_id_display']}
                  readOnly={disabled}
                  className="max-w-sm"
                  optional
                />
                <InputField
                  id="sak.opprettet_av"
                  label="Opprettet av"
                  value={sak.opprettet_av}
                  onChange={e => handleSakChange('opprettet_av', e.target.value)}
                  placeholder="Navn"
                  error={errors['sak.opprettet_av']}
                  readOnly={disabled}
                  className="max-w-sm"
                />
                <DateField
                  id="sak.opprettet_dato"
                  label="Opprettet dato"
                  value={sak.opprettet_dato}
                  onChange={() => {}}
                  readOnly
                  className="max-w-sm"
                />
              </div>
            </FieldsetCard>

            <FieldsetCard legend="Prosjekt">
              <div className="space-y-6">
                <InputField
                  id="sak.prosjekt_navn"
                  label="Prosjekt"
                  value={sak.prosjekt_navn}
                  onChange={e => handleSakChange('prosjekt_navn', e.target.value)}
                  error={errors['sak.prosjekt_navn']}
                  readOnly={disabled}
                />
                <InputField
                  id="sak.kontrakt_referanse"
                  label="Prosjektnummer"
                  value={sak.kontrakt_referanse}
                  onChange={e => handleSakChange('kontrakt_referanse', e.target.value)}
                  error={errors['sak.kontrakt_referanse']}
                  readOnly={disabled}
                  className="max-w-sm"
                />
                <InputField
                  id="sak.entreprenor"
                  label="Entreprenør (TE)"
                  value={sak.entreprenor}
                  onChange={e => handleSakChange('entreprenor', e.target.value)}
                  error={errors['sak.entreprenor']}
                  readOnly={disabled}
                />
                <InputField
                  id="sak.byggherre"
                  label="Byggherre (BH)"
                  value={sak.byggherre}
                  onChange={e => handleSakChange('byggherre', e.target.value)}
                  error={errors['sak.byggherre']}
                  readOnly={disabled}
                />
              </div>
            </FieldsetCard>
          </div>
        </PktAccordionItem>

        {/* 2. Varsel */}
        <PktAccordionItem
          id="test-varsel"
          title="2. Varsel"
        >
          <div className="space-y-6 p-4">
            <PktAlert skin="info" compact>
              Dette er det første formelle steget (Trinn 1) etter NS 8407. Her dokumenteres selve hendelsen og at varsel er sendt. Selve kravet spesifiseres i neste fane.
            </PktAlert>

            <FieldsetCard legend="Når skjedde det?">
              <div className="space-y-6">
                <DateField
                  id="varsel.dato_forhold_oppdaget"
                  label="Dato forhold oppdaget"
                  value={varsel.dato_forhold_oppdaget}
                  onChange={value => handleVarselChange('dato_forhold_oppdaget', value)}
                  error={errors['varsel.dato_forhold_oppdaget']}
                  readOnly={isVarselLocked}
                  helpText="Når inntraff hendelsen?"
                  className="max-w-sm"
                />
                <DateField
                  id="varsel.dato_varsel_sendt"
                  label="Dato varsel sendt"
                  value={varsel.dato_varsel_sendt}
                  onChange={value => handleVarselChange('dato_varsel_sendt', value)}
                  error={errors['varsel.dato_varsel_sendt']}
                  readOnly={isVarselLocked}
                  helpText="Når ble BH formelt varslet?"
                  className="max-w-sm"
                />
                <SelectField
                  id="varsel.varsel_metode"
                  label="Metode for varsling"
                  value={varsel.varsel_metode}
                  onChange={value => handleVarselChange('varsel_metode', value)}
                  options={varselMetodeOptions}
                  readOnly={isVarselLocked}
                  helpText="Hvordan ble varselet kommunisert?"
                  className="max-w-sm"
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
                  readOnly={isVarselLocked}
                  className="max-w-sm"
                />
                <SelectField
                  id="varsel.underkategori"
                  label="Underkategori"
                  value={varsel.underkategori}
                  onChange={value => handleVarselChange('underkategori', value)}
                  options={underkategoriOptions}
                  readOnly={isVarselLocked}
                  optional
                  className="max-w-sm"
                />
                <TextareaField
                  id="varsel.varsel_beskrivelse"
                  label="Beskrivelse (vis til vedlegg)"
                  value={varsel.varsel_beskrivelse}
                  onChange={e => handleVarselChange('varsel_beskrivelse', e.target.value)}
                  readOnly={isVarselLocked}
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
                  disabled={isVarselLocked}
                />
                <PktButton
                  skin="secondary"
                  size="medium"
                  iconName="attachment"
                  variant="icon-left"
                  onClick={handleFileUploadClick}
                  disabled={isVarselLocked}
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
                            disabled={isVarselLocked}
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
        </PktAccordionItem>
      </PktAccordion>
    </PanelLayout>
  );
};

export default TestSakPanel;
