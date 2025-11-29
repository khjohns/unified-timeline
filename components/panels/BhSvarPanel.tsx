import React, { useState, useEffect } from 'react';
import { FormDataModel } from '../../types';
import { InputField, SelectField, TextareaField, CheckboxField, DateField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';
import PanelLayout from '../ui/PanelLayout';
import { PktButton, PktTag } from '@oslokommune/punkt-react';
import { BH_VEDERLAGSSVAR_OPTIONS, BH_FRISTSVAR_OPTIONS } from '../../constants';
import { getSvarStatusLabel, getSvarStatusSkin } from '../../utils/statusHelpers';
import { useFileUpload } from '../../hooks/useFileUpload';
import FileUploadField from '../ui/FileUploadField';
import { showToast } from '../../utils/toastHelpers';
import { focusOnField } from '../../utils/focusHelpers';
import { api } from '../../services/api';

interface BhSvarPanelProps {
  formData: FormDataModel;
  setFormData: (section: 'bh_svar_revisjoner' | 'sak' | 'koe_revisjoner', field: string, value: any, index?: number) => void;
  errors: Record<string, string>;
  setActiveTab?: (tab: number) => void;
  setToastMessage?: (message: string) => void;
  addKoeRevisjon?: () => void;
}

const BhSvarPanel: React.FC<BhSvarPanelProps> = ({
  formData,
  setFormData,
  errors,
  setActiveTab,
  setToastMessage,
  addKoeRevisjon
}) => {
  const { bh_svar_revisjoner = [], koe_revisjoner = [], rolle, sak } = formData;
  const sisteSvarIndex = bh_svar_revisjoner.length - 1;
  const sisteKravIndex = koe_revisjoner.length - 1;

  // State for e-post validering
  const [signerEmail, setSignerEmail] = useState('');
  const [signerName, setSignerName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [validationTimer, setValidationTimer] = useState<NodeJS.Timeout | null>(null);

  // Initialize signer name from formData if it exists
  useEffect(() => {
    const sisteSvar = bh_svar_revisjoner[sisteSvarIndex];
    if (sisteSvar?.sign?.for_byggherre) {
      setSignerName(sisteSvar.sign.for_byggherre);
    }
  }, [bh_svar_revisjoner, sisteSvarIndex]);

  // Cleanup validation timer on unmount
  useEffect(() => {
    return () => {
      if (validationTimer) {
        clearTimeout(validationTimer);
      }
    };
  }, [validationTimer]);

  // Valider e-post mot Catenda API
  const handleEmailValidation = async (email: string) => {
    if (!email || !email.includes('@')) {
      setValidationError('');
      setSignerName('');
      return;
    }

    setIsValidating(true);
    setValidationError('');

    try {
      const response = await api.validateUser(sak.sak_id_display || '', email);

      if (response.success && response.data) {
        const validatedName = response.data.name;
        setSignerName(validatedName);
        setValidationError('');

        // Lagre validert navn til formData for bruk ved submit
        setFormData('bh_svar_revisjoner', 'sign.for_byggherre', validatedName, sisteSvarIndex);

        showToast(setToastMessage, `Bruker validert: ${validatedName}`);
      } else {
        setSignerName('');
        setValidationError(response.error || 'Brukeren er ikke medlem i Catenda-prosjektet');
        showToast(setToastMessage, response.error || 'Brukeren er ikke medlem i Catenda-prosjektet');
      }
    } catch (error) {
      setSignerName('');
      setValidationError('Feil ved validering');
      showToast(setToastMessage, 'Feil ved validering av bruker');
    } finally {
      setIsValidating(false);
    }
  };

  // Debounced validering for onChange (venter 800ms etter siste tastetrykk)
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setSignerEmail(email);

    // Clear existing timer
    if (validationTimer) {
      clearTimeout(validationTimer);
    }

    // Only start validation timer if email contains '@'
    if (email && email.includes('@')) {
      const timer = setTimeout(() => {
        handleEmailValidation(email);
      }, 800); // 800ms debounce
      setValidationTimer(timer);
    } else {
      // Clear validation state if email is incomplete
      setSignerName('');
      setValidationError('');
    }
  };

  // File upload hook
  const { fileInputRef, uploadedFiles, handleFileUploadClick, handleFileChange, handleRemoveFile } =
    useFileUpload((fileNames) => {
      setFormData('bh_svar_revisjoner', 'vedlegg', fileNames, sisteSvarIndex);
    });

  if (rolle !== 'BH') {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg border">
        <h3 className="text-base font-semibold text-ink-dim">Svar fra Byggherre (BH)</h3>
        <p className="mt-2 text-muted">Disse feltene fylles ut av Byggherre. Bytt til BH-rollen for å redigere.</p>
      </div>
    );
  }

  if (bh_svar_revisjoner.length === 0 || koe_revisjoner.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg border">
        <p className="text-muted">Ingen svar funnet. Vennligst oppfrisk siden.</p>
      </div>
    );
  }

  const handleChange = (index: number, field: string, value: any) => {
    setFormData('bh_svar_revisjoner', field, value, index);
  };

  const handleSendSvar = () => {
    const sisteSvar = bh_svar_revisjoner[sisteSvarIndex];
    const sisteKrav = koe_revisjoner[sisteKravIndex];

    if (!sisteSvar.sign.dato_svar_bh || !sisteSvar.sign.for_byggherre) {
      showToast(setToastMessage, 'Vennligst fyll ut alle påkrevde felt (signatur) før du sender svaret');
      // Fokuser på det første tomme påkrevde feltet
      if (!sisteSvar.sign.dato_svar_bh) {
        focusOnField('bh_svar_revisjoner.sign.dato_svar_bh');
      } else if (!sisteSvar.sign.for_byggherre) {
        focusOnField('bh_svar_revisjoner.sign.for_byggherre');
      }
      return;
    }

    // Oppdater statuser
    setFormData('koe_revisjoner', 'status', '200000001', sisteKravIndex); // Besvart
    // Oppdater BH svar status basert på svar-valg
    let bhSvarStatus = '300000002'; // Delvis Godkjent (default)
    if (sisteSvar.vederlag.bh_svar_vederlag === '100000000' && sisteSvar.frist.bh_svar_frist === '100000000') {
      bhSvarStatus = '100000004'; // Godkjent
    } else if (sisteSvar.vederlag.bh_svar_vederlag === '100000001' || sisteSvar.frist.bh_svar_frist === '100000001') {
      bhSvarStatus = '100000006'; // Avslått (Uenig)
    } else if (sisteSvar.vederlag.varsel_for_sent || sisteSvar.frist.varsel_for_sent) {
      bhSvarStatus = '100000010'; // Avslått (For sent)
    }
    setFormData('bh_svar_revisjoner', 'status', bhSvarStatus, sisteSvarIndex);

    addKoeRevisjon?.();
    setActiveTab?.(2);
    showToast(setToastMessage, 'Svar sendt! TE kan nå sende et nytt krav om nødvendig.');
  };

  const sisteSvar = bh_svar_revisjoner[sisteSvarIndex];
  const sisteSvarErUtkast = !sisteSvar?.status || sisteSvar?.status === '300000001';

  // Determine which revisions to show: utkast first, then last sent
  const visningsRevisjoner: number[] = [];

  // Always show the latest revision first (usually utkast)
  visningsRevisjoner.push(sisteSvarIndex);

  // If there's a previous revision (sent), show it after utkast
  if (sisteSvarIndex > 0) {
    visningsRevisjoner.push(sisteSvarIndex - 1);
  }

  const harFlereRevisjoner = bh_svar_revisjoner.length > 2;

  return (
    <PanelLayout>
      {harFlereRevisjoner && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            💡 Denne fanen viser kun siste sendte svar og nytt svar under arbeid.
            Se alle {bh_svar_revisjoner.length} svar i <strong>Test-fanen</strong>.
          </p>
        </div>
      )}

      <div className="space-y-12">
        {visningsRevisjoner.map((index, displayOrder) => {
          const bh_svar = bh_svar_revisjoner[index];
          const erSisteRevisjon = index === sisteSvarIndex;
          const svarErUtkast = !bh_svar.status || bh_svar.status === '300000001';
          const erLaast = !erSisteRevisjon || !svarErUtkast || rolle !== 'BH';
          const tilhorendeKoe = koe_revisjoner[Math.min(index, sisteKravIndex)];

          return (
            <div
              key={index}
              className={displayOrder > 0 ? 'pt-12 border-t border-border-color' : ''}
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-semibold">Byggherrens svar</h3>
                  <PktTag skin="grey">Revisjon {tilhorendeKoe?.koe_revisjonsnr ?? index}</PktTag>
                  <PktTag skin={getSvarStatusSkin(bh_svar.status)}>
                    {getSvarStatusLabel(bh_svar.status)}
                  </PktTag>
                </div>

                {!tilhorendeKoe?.vederlag.krav_vederlag && !tilhorendeKoe?.frist.krav_fristforlengelse && (
                  <div className="text-center p-6 bg-gray-50 rounded-lg border">
                    <p className="text-muted">Entreprenøren har ikke fremmet spesifikke krav om vederlag eller fristforlengelse.</p>
                  </div>
                )}

                {tilhorendeKoe?.vederlag.krav_vederlag && (
                  <FieldsetCard legend="Svar på Vederlagskrav">
                    <div className="space-y-6">
                      <CheckboxField
                        id={`bh_svar.vederlag.varsel_for_sent.${index}`}
                        label="Vederlagskrav er varslet for sent"
                        checked={bh_svar.vederlag.varsel_for_sent}
                        onChange={e => handleChange(index, 'vederlag.varsel_for_sent', e.target.checked)}
                        disabled={erLaast}
                        hasTile={true}
                      />
                      <div className={`collapsible ${bh_svar.vederlag.varsel_for_sent ? 'open' : ''}`}>
                        <div className="collapsible-content">
                          <div className="pl-4">
                            <TextareaField
                              id={`bh_svar.vederlag.varsel_for_sent_begrunnelse.${index}`}
                              label="Begrunnelse for sen varsling"
                              value={bh_svar.vederlag.varsel_for_sent_begrunnelse}
                              onChange={e => handleChange(index, 'vederlag.varsel_for_sent_begrunnelse', e.target.value)}
                              helpText="Dokumenter hvorfor varselet kom for sent"
                              required={bh_svar.vederlag.varsel_for_sent}
                              readOnly={erLaast}
                              fullwidth
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-6 border-t border-border-color space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SelectField
                          id={`bh_svar.vederlag.bh_svar_vederlag.${index}`}
                          label="Svar på krav om vederlag"
                          value={bh_svar.vederlag.bh_svar_vederlag}
                          onChange={value => handleChange(index, 'vederlag.bh_svar_vederlag', value)}
                          options={BH_VEDERLAGSSVAR_OPTIONS}
                          readOnly={erLaast}
                        />
                        <InputField
                          id={`bh_svar.vederlag.bh_godkjent_vederlag_belop.${index}`}
                          label="Godkjent beløp (NOK)"
                          type="number"
                          value={bh_svar.vederlag.bh_godkjent_vederlag_belop}
                          onChange={e => handleChange(index, 'vederlag.bh_godkjent_vederlag_belop', e.target.value)}
                          helpText="Oppgi godkjent beløp i hele kroner"
                          error={errors['bh_svar.vederlag.bh_godkjent_vederlag_belop']}
                          formatAsNumber
                          readOnly={erLaast}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="off"
                          className="w-full md:max-w-xs"
                        />
                      </div>
                      <TextareaField
                        id={`bh_svar.vederlag.bh_begrunnelse_vederlag.${index}`}
                        label="Begrunnelse for svar"
                        value={bh_svar.vederlag.bh_begrunnelse_vederlag}
                        onChange={e => handleChange(index, 'vederlag.bh_begrunnelse_vederlag', e.target.value)}
                        readOnly={erLaast}
                        fullwidth
                      />
                    </div>
                  </FieldsetCard>
                )}

                {tilhorendeKoe?.frist.krav_fristforlengelse && (
                  <FieldsetCard legend="Svar på Fristforlengelse">
                    <div className="space-y-6">
                      <CheckboxField
                        id={`bh_svar.frist.varsel_for_sent.${index}`}
                        label="Fristforlengelse er varslet for sent"
                        checked={bh_svar.frist.varsel_for_sent}
                        onChange={e => handleChange(index, 'frist.varsel_for_sent', e.target.checked)}
                        disabled={erLaast}
                        hasTile={true}
                      />
                      <div className={`collapsible ${bh_svar.frist.varsel_for_sent ? 'open' : ''}`}>
                        <div className="collapsible-content">
                          <div className="pl-4">
                            <TextareaField
                              id={`bh_svar.frist.varsel_for_sent_begrunnelse.${index}`}
                              label="Begrunnelse for sen varsling"
                              value={bh_svar.frist.varsel_for_sent_begrunnelse}
                              onChange={e => handleChange(index, 'frist.varsel_for_sent_begrunnelse', e.target.value)}
                              helpText="Dokumenter hvorfor varselet kom for sent"
                              required={bh_svar.frist.varsel_for_sent}
                              readOnly={erLaast}
                              fullwidth
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-6 border-t border-border-color space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SelectField
                          id={`bh_svar.frist.bh_svar_frist.${index}`}
                          label="Svar på krav om frist"
                          value={bh_svar.frist.bh_svar_frist}
                          onChange={value => handleChange(index, 'frist.bh_svar_frist', value)}
                          options={BH_FRISTSVAR_OPTIONS}
                          readOnly={erLaast}
                        />
                        <InputField
                          id={`bh_svar.frist.bh_godkjent_frist_dager.${index}`}
                          label="Godkjente dager"
                          type="number"
                          min={0}
                          value={bh_svar.frist.bh_godkjent_frist_dager}
                          onChange={e => handleChange(index, 'frist.bh_godkjent_frist_dager', e.target.value)}
                          helpText="Antall godkjente kalenderdager"
                          error={errors['bh_svar.frist.bh_godkjent_frist_dager']}
                          readOnly={erLaast}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="off"
                          className="w-full md:max-w-xs"
                        />
                      </div>
                      <DateField
                        id={`bh_svar.frist.bh_frist_for_spesifisering.${index}`}
                        label="Frist for spesifisering (hvis aktuelt)"
                        value={bh_svar.frist.bh_frist_for_spesifisering}
                        onChange={value => handleChange(index, 'frist.bh_frist_for_spesifisering', value)}
                        helpText="Frist for ytterligere dokumentasjon"
                        className="w-full md:max-w-sm"
                        readOnly={erLaast}
                      />
                      <TextareaField
                        id={`bh_svar.frist.bh_begrunnelse_frist.${index}`}
                        label="Begrunnelse for svar"
                        value={bh_svar.frist.bh_begrunnelse_frist}
                        onChange={e => handleChange(index, 'frist.bh_begrunnelse_frist', e.target.value)}
                        readOnly={erLaast}
                        fullwidth
                      />
                    </div>
                  </FieldsetCard>
                )}

                <FieldsetCard legend="Innsending">
                  {/* E-post validering */}
                  {erSisteRevisjon && svarErUtkast && rolle === 'BH' && (
                    <div className="space-y-4 mb-6">
                      <InputField
                        id={`bh_svar.signerende_epost.${index}`}
                        label="E-post for signering"
                        type="email"
                        value={signerEmail}
                        onChange={handleEmailChange}
                        onBlur={e => handleEmailValidation(e.target.value)}
                        helpText="Skriv inn e-postadressen til personen som sender svaret"
                        required={true}
                        error={validationError}
                        readOnly={isValidating}
                        className="w-full md:max-w-md"
                      />
                      {isValidating && (
                        <div className="text-sm text-blue-600">
                          ⏳ Validerer bruker...
                        </div>
                      )}
                      {signerName && !validationError && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-sm text-green-800">
                            ✅ <strong>Validert bruker:</strong> {signerName}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vis automatisk genererte verdier */}
                  {bh_svar.sign.dato_svar_bh || bh_svar.sign.for_byggherre ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-green-900 mb-2">Sendt</h4>
                      <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="font-medium text-green-800">Dato sendt:</dt>
                          <dd className="text-green-700">{bh_svar.sign.dato_svar_bh || 'Ikke sendt'}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-green-800">Sendt av:</dt>
                          <dd className="text-green-700">{bh_svar.sign.for_byggherre || 'Ukjent'}</dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        💡 Dato og signatur settes automatisk når svaret sendes
                      </p>
                    </div>
                  )}
                </FieldsetCard>

                <FieldsetCard legend="Vedlegg">
                  <FileUploadField
                    fileInputRef={fileInputRef}
                    uploadedFiles={uploadedFiles}
                    onFileUploadClick={handleFileUploadClick}
                    onFileChange={handleFileChange}
                    onRemoveFile={handleRemoveFile}
                    disabled={erLaast}
                  />
                </FieldsetCard>
              </div>
            </div>
          );
        })}

        {/* Send-knapp fjernet - bruk knappen i bottom bar i stedet */}
      </div>
    </PanelLayout>
  );
};

export default BhSvarPanel;
