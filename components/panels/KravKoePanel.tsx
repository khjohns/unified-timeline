import React from 'react';
import { FormDataModel } from '../../types';
import { InputField, SelectField, TextareaField, CheckboxField, DateField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';
import PanelLayout from '../ui/PanelLayout';
import { PktButton, PktCheckbox, PktTag } from '@oslokommune/punkt-react';
import { VEDERLAGSMETODER_OPTIONS } from '../../constants';
import { getKravStatusLabel, getKravStatusSkin } from '../../utils/statusHelpers';

interface KravKoePanelProps {
  formData: FormDataModel;
  setFormData: (section: 'koe_revisjoner' | 'sak', field: string, value: any, index?: number) => void;
  errors: Record<string, string>;
  disabled?: boolean;
  setActiveTab?: (tab: number) => void;
  setToastMessage?: (message: string) => void;
  addBhSvarRevisjon?: () => void;
}

const KravKoePanel: React.FC<KravKoePanelProps> = ({
  formData,
  setFormData,
  errors,
  disabled,
  setActiveTab,
  setToastMessage,
  addBhSvarRevisjon
}) => {
  const { koe_revisjoner = [], bh_svar_revisjoner = [], rolle } = formData;
  const sisteKravIndex = koe_revisjoner.length - 1;

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

  const handleSendKrav = () => {
    const sisteKrav = koe_revisjoner[sisteKravIndex];

    if (!sisteKrav.koe_revisjonsnr || !sisteKrav.dato_krav_sendt) {
      setToastMessage?.('Vennligst fyll ut alle påkrevde felt før du sender kravet');
      setTimeout(() => setToastMessage?.(''), 3000);
      return;
    }

    if (!sisteKrav.vederlag.krav_vederlag && !sisteKrav.frist.krav_fristforlengelse) {
      setToastMessage?.('Du må velge minst ett krav (vederlag eller fristforlengelse)');
      setTimeout(() => setToastMessage?.(''), 3000);
      return;
    }

    // Oppdater statuser
    setFormData('koe_revisjoner', 'status', '100000002', sisteKravIndex); // Sendt til BH
    setFormData('sak', 'status', '100000002'); // Venter på svar

    addBhSvarRevisjon?.();
    setActiveTab?.(3);
    setToastMessage?.('Krav sendt! Byggherre kan nå svare på kravet.');
    setTimeout(() => setToastMessage?.(''), 3000);
  };

  const sisteKoe = koe_revisjoner[sisteKravIndex];
  const sisteKoeErUtkast = !sisteKoe?.status || sisteKoe?.status === '100000001';

  return (
    <PanelLayout>
      <div className="space-y-12">
        {koe_revisjoner.map((koe, index) => {
          const erSisteRevisjon = index === sisteKravIndex;
          const koeErUtkast = !koe.status || koe.status === '100000001';
          const erLaast = !erSisteRevisjon || !koeErUtkast || rolle !== 'TE' || disabled;

          return (
            <div
              key={index}
              className={index > 0 ? 'pt-12 border-t border-border-color' : ''}
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-semibold">Entreprenørens krav</h3>
                  <PktTag skin="grey">Revisjon {koe.koe_revisjonsnr ?? '0'}</PktTag>
                  <PktTag skin={getKravStatusSkin(koe.status)}>
                    {getKravStatusLabel(koe.status)}
                  </PktTag>
                </div>

                <FieldsetCard legend="Vederlagskrav">
                  <CheckboxField
                    id={`koe.vederlag.krav_vederlag.${index}`}
                    label="Krav om vederlagsjustering"
                    checkHelptext="For denne endringsordren"
                    checked={koe.vederlag.krav_vederlag}
                    onChange={e => handleChange(index, 'vederlag.krav_vederlag', e.target.checked)}
                    disabled={erLaast}
                    hasTile={true}
                  />

                  <div className={`collapsible ${koe.vederlag.krav_vederlag ? 'open' : ''}`}>
                    <div className="collapsible-content">
                      <div className="pl-4 space-y-6">
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
                          helpText="Dokumenter kostnader og grunnlag for kravet"
                          required={koe.vederlag.krav_vederlag}
                          readOnly={erLaast}
                          fullwidth
                        />
                      </div>
                    </div>
                  </div>
                </FieldsetCard>

                <FieldsetCard legend="Fristforlengelse">
                  <CheckboxField
                    id={`koe.frist.krav_fristforlengelse.${index}`}
                    label="Krav om fristforlengelse"
                    checkHelptext="For denne endringsordren"
                    checked={koe.frist.krav_fristforlengelse}
                    onChange={e => handleChange(index, 'frist.krav_fristforlengelse', e.target.checked)}
                    disabled={erLaast}
                    hasTile={true}
                  />

                  <div className={`collapsible ${koe.frist.krav_fristforlengelse ? 'open' : ''}`}>
                    <div className="collapsible-content">
                      <div className="pl-4 space-y-6">
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
                        />
                      </div>
                    </div>
                  </div>
                </FieldsetCard>

                <FieldsetCard legend="Innsending">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <DateField
                      id={`koe.dato_krav_sendt.${index}`}
                      label="Dato krav sendt"
                      value={koe.dato_krav_sendt}
                      onChange={value => handleChange(index, 'dato_krav_sendt', value)}
                      required
                      helpText="Dato for innsending av denne revisjonen"
                      readOnly={erLaast}
                      className="w-full md:max-w-sm"
                    />
                    <InputField
                      id={`koe.for_entreprenor.${index}`}
                      label="Signatur (For entreprenør)"
                      value={koe.for_entreprenor}
                      onChange={e => handleChange(index, 'for_entreprenor', e.target.value)}
                      helpText="Fullt navn på signatar"
                      required
                      readOnly={erLaast}
                      autoComplete="name"
                      className="w-full md:max-w-sm"
                    />
                  </div>
                </FieldsetCard>
              </div>
            </div>
          );
        })}

        {sisteKoeErUtkast && rolle === 'TE' && !disabled && (
          <div className="pt-6 border-t border-border-color flex justify-end">
            <PktButton
              skin="primary"
              onClick={handleSendKrav}
            >
              Send krav til byggherre
            </PktButton>
          </div>
        )}
      </div>
    </PanelLayout>
  );
};

export default KravKoePanel;
