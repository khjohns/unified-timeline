import React, { useState, useEffect } from 'react';
import { FormDataModel } from '../../types';
import { InputField, SelectField, TextareaField, CheckboxField, DateField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';
import PanelLayout from '../ui/PanelLayout';
import { PktButton, PktCheckbox, PktTag, PktRadioButton } from '@oslokommune/punkt-react';
import { VEDERLAGSMETODER_OPTIONS } from '../../constants';
import { getKravStatusLabel, getKravStatusSkin, KOE_STATUS, SAK_STATUS } from '../../utils/statusHelpers';
import { useFileUpload } from '../../hooks/useFileUpload';
import FileUploadField from '../ui/FileUploadField';
import { showToast } from '../../utils/toastHelpers';
import { focusOnField } from '../../utils/focusHelpers';
import { api } from '../../services/api';

interface KravKoePanelProps {
  formData: FormDataModel;
  setFormData: (section: 'koe_revisjoner' | 'sak', field: string, value: any, index?: number) => void;
  errors: Record<string, string>;
  disabled?: boolean;
  setActiveTab?: (tab: number) => void;
  setToastMessage?: (message: string) => void;
  addBhSvarRevisjon?: () => void;
}

type Kravstype = '' | 'vederlag' | 'frist' | 'begge';

const KravKoePanel: React.FC<KravKoePanelProps> = ({
  formData,
  setFormData,
  errors,
  disabled,
  setActiveTab,
  setToastMessage,
  addBhSvarRevisjon
}) => {
  const { koe_revisjoner = [], bh_svar_revisjoner = [], rolle, sak } = formData;
  const sisteKravIndex = koe_revisjoner.length - 1;

  // State for e-post validering
  const [signerEmail, setSignerEmail] = useState('');
  const [signerName, setSignerName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Initialize signer name from formData if it exists
  useEffect(() => {
    const sisteKoe = koe_revisjoner[sisteKravIndex];
    if (sisteKoe?.for_entreprenor) {
      setSignerName(sisteKoe.for_entreprenor);
    }
  }, [koe_revisjoner, sisteKravIndex]);

  // File upload hook
  const { fileInputRef, uploadedFiles, handleFileUploadClick, handleFileChange, handleRemoveFile } =
    useFileUpload((fileNames) => {
      setFormData('koe_revisjoner', 'vedlegg', fileNames, sisteKravIndex);
    });

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
        setFormData('koe_revisjoner', 'for_entreprenor', validatedName, sisteKravIndex);

        showToast(setToastMessage, `✅ Bruker validert: ${validatedName}`);
      } else {
        setSignerName('');
        setValidationError(response.error || 'Brukeren er ikke medlem i Catenda-prosjektet');
        showToast(setToastMessage, `❌ ${response.error}`);
      }
    } catch (error) {
      setSignerName('');
      setValidationError('Feil ved validering');
      showToast(setToastMessage, '❌ Feil ved validering av bruker');
    } finally {
      setIsValidating(false);
    }
  };

  if (koe_revisjoner.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg border">
        <p className="text-muted">Ingen krav funnet. Vennligst oppfrisk siden.</p>
      </div>
    );
  }

  const handleChange = (index: number, field: string, value: any) => {
    setFormData('koe_revisjoner', field, value, index);
  };

  const handleKravstypeChange = (index: number, newType: Kravstype) => {
    // Update boolean fields based on selected kravstype
    switch (newType) {
      case 'vederlag':
        handleChange(index, 'vederlag.krav_vederlag', true);
        handleChange(index, 'frist.krav_fristforlengelse', false);
        break;
      case 'frist':
        handleChange(index, 'vederlag.krav_vederlag', false);
        handleChange(index, 'frist.krav_fristforlengelse', true);
        break;
      case 'begge':
        handleChange(index, 'vederlag.krav_vederlag', true);
        handleChange(index, 'frist.krav_fristforlengelse', true);
        break;
      default:
        handleChange(index, 'vederlag.krav_vederlag', false);
        handleChange(index, 'frist.krav_fristforlengelse', false);
    }
  };

  const handleSendKrav = () => {
    const sisteKrav = koe_revisjoner[sisteKravIndex];

    if (!sisteKrav.koe_revisjonsnr) {
      showToast(setToastMessage, 'Vennligst fyll ut revisjonsnummer');
      focusOnField('koe_revisjoner.koe_revisjonsnr');
      return;
    }

    if (!sisteKrav.vederlag.krav_vederlag && !sisteKrav.frist.krav_fristforlengelse) {
      showToast(setToastMessage, 'Du må velge minst ett krav (vederlag eller fristforlengelse)');
      // Fokuser på første krav-valg (vederlag radio button)
      focusOnField('krav_type_vederlag');
      return;
    }

    // Oppdater statuser
    setFormData('koe_revisjoner', 'status', KOE_STATUS.SENDT_TIL_BH, sisteKravIndex); // Sendt til BH
    setFormData('sak', 'status', SAK_STATUS.VENTER_PAA_SVAR); // Venter på svar

    addBhSvarRevisjon?.();
    setActiveTab?.(3);
    showToast(setToastMessage, 'Krav sendt! Byggherre kan nå svare på kravet.');
  };

  const sisteKoe = koe_revisjoner[sisteKravIndex];
  const sisteKoeErUtkast = !sisteKoe?.status || sisteKoe?.status === KOE_STATUS.UTKAST;

  // Determine which revisions to show: utkast first, then last sent
  const visningsRevisjoner: number[] = [];

  // Always show the latest revision first (usually utkast)
  visningsRevisjoner.push(sisteKravIndex);

  // If there's a previous revision (sent), show it after utkast
  if (sisteKravIndex > 0) {
    visningsRevisjoner.push(sisteKravIndex - 1);
  }

  const harFlereRevisjoner = koe_revisjoner.length > 2;

  return (
    <PanelLayout>
      {harFlereRevisjoner && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            💡 Denne fanen viser kun siste sendte revisjon og ny revisjon under arbeid.
            Se alle {koe_revisjoner.length} revisjoner i <strong>Test-fanen</strong>.
          </p>
        </div>
      )}

      <div className="space-y-12">
        {visningsRevisjoner.map((index, displayOrder) => {
          const koe = koe_revisjoner[index];
          const erSisteRevisjon = index === sisteKravIndex;
          const koeErUtkast = !koe.status || koe.status === '100000001';
          const erLaast = !erSisteRevisjon || !koeErUtkast || rolle !== 'TE' || disabled;

          // Calculate kravstype for this specific revision
          const harVederlag = koe.vederlag.krav_vederlag;
          const harFrist = koe.frist.krav_fristforlengelse;
          let denneKravstype: Kravstype = '';
          if (harVederlag && harFrist) {
            denneKravstype = 'begge';
          } else if (harVederlag) {
            denneKravstype = 'vederlag';
          } else if (harFrist) {
            denneKravstype = 'frist';
          }

          return (
            <div
              key={index}
              className={displayOrder > 0 ? 'pt-12 border-t border-border-color' : ''}
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-semibold">Entreprenørens krav</h3>
                  <PktTag skin="grey">Revisjon {koe.koe_revisjonsnr ?? '0'}</PktTag>
                  <PktTag skin={getKravStatusSkin(koe.status)}>
                    {getKravStatusLabel(koe.status)}
                  </PktTag>
                </div>

                <FieldsetCard legend="Kravstype">
                  <p className="text-sm text-muted mb-4">
                    Angi krav som følger av det varslede forholdet
                  </p>
                  <div className="space-y-3">
                    <div
                      className={`w-full rounded-lg border bg-white p-4 transition-colors hover:bg-gray-50 ${
                        denneKravstype === 'vederlag' ? 'border-pri' : 'border-border-color'
                      } ${erLaast ? 'bg-gray-50 opacity-70' : ''}`}
                    >
                      <PktRadioButton
                        id={`kravstype-vederlag-${index}`}
                        name={`kravstype-${index}`}
                        label="Vederlagsjustering"
                        value="vederlag"
                        checked={denneKravstype === 'vederlag'}
                        onChange={() => handleKravstypeChange(index, 'vederlag')}
                        disabled={erLaast}
                      />
                    </div>
                    <div
                      className={`w-full rounded-lg border bg-white p-4 transition-colors hover:bg-gray-50 ${
                        denneKravstype === 'frist' ? 'border-pri' : 'border-border-color'
                      } ${erLaast ? 'bg-gray-50 opacity-70' : ''}`}
                    >
                      <PktRadioButton
                        id={`kravstype-frist-${index}`}
                        name={`kravstype-${index}`}
                        label="Fristforlengelse"
                        value="frist"
                        checked={denneKravstype === 'frist'}
                        onChange={() => handleKravstypeChange(index, 'frist')}
                        disabled={erLaast}
                      />
                    </div>
                    <div
                      className={`w-full rounded-lg border bg-white p-4 transition-colors hover:bg-gray-50 ${
                        denneKravstype === 'begge' ? 'border-pri' : 'border-border-color'
                      } ${erLaast ? 'bg-gray-50 opacity-70' : ''}`}
                    >
                      <PktRadioButton
                        id={`kravstype-begge-${index}`}
                        name={`kravstype-${index}`}
                        label="Vederlagsjustering og fristforlengelse"
                        value="begge"
                        checked={denneKravstype === 'begge'}
                        onChange={() => handleKravstypeChange(index, 'begge')}
                        disabled={erLaast}
                      />
                    </div>
                  </div>
                </FieldsetCard>

                {(denneKravstype === 'vederlag' || denneKravstype === 'begge') && (
                  <FieldsetCard legend="Vederlagskrav">
                    <div className="space-y-6">
                      <CheckboxField
                        id={`koe.vederlag.krav_produktivitetstap.${index}`}
                        label="Kravet inkluderer produktivitetstap"
                        checked={koe.vederlag.krav_produktivitetstap}
                        onChange={e => handleChange(index, 'vederlag.krav_produktivitetstap', e.target.checked)}
                        disabled={erLaast}
                        hasTile={true}
                      />
                      <CheckboxField
                        id={`koe.vederlag.saerskilt_varsel_rigg_drift.${index}`}
                        label="Særskilt varsel for rigg/drift"
                        checked={koe.vederlag.saerskilt_varsel_rigg_drift}
                        onChange={e => handleChange(index, 'vederlag.saerskilt_varsel_rigg_drift', e.target.checked)}
                        disabled={erLaast}
                        hasTile={true}
                      />
                      <SelectField
                        id={`koe.vederlag.krav_vederlag_metode.${index}`}
                        label="Oppgjørsmetode"
                        value={koe.vederlag.krav_vederlag_metode}
                        onChange={value => handleChange(index, 'vederlag.krav_vederlag_metode', value)}
                        options={VEDERLAGSMETODER_OPTIONS}
                        required={koe.vederlag.krav_vederlag}
                        readOnly={erLaast}
                        className="max-w-sm"
                      />
                      <InputField
                        id={`koe.vederlag.krav_vederlag_belop.${index}`}
                        label="Krevd beløp (NOK)"
                        type="number"
                        value={koe.vederlag.krav_vederlag_belop}
                        onChange={e => handleChange(index, 'vederlag.krav_vederlag_belop', e.target.value)}
                        helpText="Oppgi beløp i hele kroner uten mellomrom"
                        required={koe.vederlag.krav_vederlag}
                        error={errors['koe.vederlag.krav_vederlag_belop']}
                        formatAsNumber
                        readOnly={erLaast}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        className="w-full md:max-w-xs"
                      />
                      <TextareaField
                        id={`koe.vederlag.krav_vederlag_begrunnelse.${index}`}
                        label="Begrunnelse for vederlagskrav"
                        value={koe.vederlag.krav_vederlag_begrunnelse}
                        onChange={e => handleChange(index, 'vederlag.krav_vederlag_begrunnelse', e.target.value)}
                        helpText="Dokumenter kostnader og grunnlag for kravet, eller hvis til vedlegg"
                        required={koe.vederlag.krav_vederlag}
                        readOnly={erLaast}
                        fullwidth
                        rows="8"
                      />
                    </div>
                  </FieldsetCard>
                )}

                {(denneKravstype === 'frist' || denneKravstype === 'begge') && (
                  <FieldsetCard legend="Fristforlengelse">
                    <div className="space-y-6">
                      <SelectField
                        id={`koe.frist.krav_frist_type.${index}`}
                        label="Type fristkrav"
                        value={koe.frist.krav_frist_type}
                        onChange={value => handleChange(index, 'frist.krav_frist_type', value)}
                        options={[
                          { value: '', label: '— Velg —' },
                          { value: 'Uspesifisert krav (§33.6.2)', label: 'Uspesifisert krav (§33.6.2)' },
                          { value: 'Spesifisert krav (§33.6.1)', label: 'Spesifisert krav (§33.6.1)' },
                        ]}
                        required={koe.frist.krav_fristforlengelse}
                        readOnly={erLaast}
                        className="max-w-sm"
                      />
                      <InputField
                        id={`koe.frist.krav_frist_antall_dager.${index}`}
                        label="Antall dager fristforlengelse"
                        type="number"
                        min={0}
                        value={koe.frist.krav_frist_antall_dager}
                        onChange={e => handleChange(index, 'frist.krav_frist_antall_dager', e.target.value)}
                        helpText="Antall kalenderdager"
                        required={koe.frist.krav_fristforlengelse}
                        error={errors['koe.frist.krav_frist_antall_dager']}
                        readOnly={erLaast}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        className="w-full md:max-w-xs"
                      />
                      <CheckboxField
                        id={`koe.frist.forsinkelse_kritisk_linje.${index}`}
                        label="Forsinkelsen påvirker kritisk linje"
                        checked={koe.frist.forsinkelse_kritisk_linje}
                        onChange={e => handleChange(index, 'frist.forsinkelse_kritisk_linje', e.target.checked)}
                        disabled={erLaast}
                        hasTile={true}
                      />
                      <TextareaField
                        id={`koe.frist.krav_frist_begrunnelse.${index}`}
                        label="Begrunnelse for fristforlengelse"
                        value={koe.frist.krav_frist_begrunnelse}
                        onChange={e => handleChange(index, 'frist.krav_frist_begrunnelse', e.target.value)}
                        helpText="Dokumenter forsinkelsens årsak og påvirkning"
                        required={koe.frist.krav_fristforlengelse}
                        readOnly={erLaast}
                        fullwidth
                        rows="8"
                      />
                    </div>
                  </FieldsetCard>
                )}

                <FieldsetCard legend="Innsending">
                  {/* E-post validering */}
                  {erSisteRevisjon && koeErUtkast && rolle === 'TE' && !disabled && (
                    <div className="space-y-4 mb-6">
                      <InputField
                        id={`koe.signerende_epost.${index}`}
                        label="E-post for signering"
                        type="email"
                        value={signerEmail}
                        onChange={e => setSignerEmail(e.target.value)}
                        onBlur={e => handleEmailValidation(e.target.value)}
                        helpText="Skriv inn e-postadressen til personen som sender kravet"
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

                  {/* Vis automatisk genererte verdier - kun hvis krav faktisk er sendt */}
                  {koe.dato_krav_sendt && koe.dato_krav_sendt.trim() !== '' ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-green-900 mb-2">Sendt</h4>
                      <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="font-medium text-green-800">Dato sendt:</dt>
                          <dd className="text-green-700">{koe.dato_krav_sendt || 'Ikke sendt'}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-green-800">Sendt av:</dt>
                          <dd className="text-green-700">{koe.for_entreprenor || 'Ukjent'}</dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800">
                        💡 Dato og signatur settes automatisk når kravet sendes
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

export default KravKoePanel;
