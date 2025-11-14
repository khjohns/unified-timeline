import React from 'react';
import { FormDataModel } from '../../types';
import { InputField, SelectField, TextareaField, CheckboxField, DateField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';
import PanelLayout from '../ui/PanelLayout';
import { PktButton } from '@oslokommune/punkt-react';
import { BH_VEDERLAGSSVAR_OPTIONS, BH_FRISTSVAR_OPTIONS } from '../../constants';

interface BhSvarPanelProps {
  formData: FormDataModel;
  setFormData: (section: 'bh_svar_revisjoner', field: string, value: any, index?: number) => void;
  errors: Record<string, string>;
  formStatus?: 'varsel' | 'krav' | 'svar';
  setFormStatus?: (status: 'varsel' | 'krav' | 'svar') => void;
  setActiveTab?: (tab: number) => void;
  setToastMessage?: (message: string) => void;
  addKoeRevisjon?: () => void;
}

const BhSvarPanel: React.FC<BhSvarPanelProps> = ({
  formData,
  setFormData,
  errors,
  formStatus = 'varsel',
  setFormStatus,
  setActiveTab,
  setToastMessage,
  addKoeRevisjon
}) => {
  const { bh_svar_revisjoner = [], koe_revisjoner = [], rolle } = formData;
  const sisteSvarIndex = bh_svar_revisjoner.length - 1;
  const sisteKravIndex = koe_revisjoner.length - 1;

  if (rolle !== 'BH') {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg border">
        <h3 className="text-lg font-semibold text-ink-dim">Svar fra Byggherre (BH)</h3>
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

    if (!sisteSvar.sign.dato_svar_bh || !sisteSvar.sign.for_byggherre) {
      setToastMessage?.('Vennligst fyll ut alle påkrevde felt (signatur) før du sender svaret');
      setTimeout(() => setToastMessage?.(''), 3000);
      return;
    }

    addKoeRevisjon?.();
    setFormStatus?.('krav');
    setActiveTab?.(2);
    setToastMessage?.('Svar sendt! TE kan nå sende et nytt krav om nødvendig.');
    setTimeout(() => setToastMessage?.(''), 3000);
  };

  return (
    <PanelLayout>
      <div className="space-y-12">
        {bh_svar_revisjoner.map((bh_svar, index) => {
          const erSisteRevisjon = index === sisteSvarIndex;
          const erLaast = !erSisteRevisjon || formStatus !== 'svar' || rolle !== 'BH';
          const tilhorendeKoe = koe_revisjoner[Math.min(index, sisteKravIndex)];

          return (
            <div
              key={index}
              className={index > 0 ? 'pt-12 border-t border-border-color' : ''}
            >
              <div className="space-y-6">
                {!tilhorendeKoe?.vederlag.krav_vederlag && !tilhorendeKoe?.frist.krav_fristforlengelse && (
                  <div className="text-center p-6 bg-gray-50 rounded-lg border">
                    <p className="text-muted">Entreprenøren har ikke fremmet spesifikke krav om vederlag eller fristforlengelse.</p>
                  </div>
                )}

                <FieldsetCard legend="Svar til Krav">
                  <InputField
                    id={`bh_svar.koe_revisjonsnr.${index}`}
                    label="Revisjonsnummer"
                    type="text"
                    value={tilhorendeKoe?.koe_revisjonsnr ?? ''}
                    onChange={() => {}}
                    readOnly
                    helpText="Automatisk hentet fra tilhørende krav"
                    className="max-w-sm"
                  />
                </FieldsetCard>

                {tilhorendeKoe?.vederlag.krav_vederlag && (
                  <FieldsetCard legend="Svar på Vederlagskrav">
                    <div className="space-y-6">
                      <CheckboxField
                        id={`bh_svar.vederlag.varsel_for_sent.${index}`}
                        label="Varselet om vederlagskrav ansees som for sent fremsatt"
                        checked={bh_svar.vederlag.varsel_for_sent}
                        onChange={e => handleChange(index, 'vederlag.varsel_for_sent', e.target.checked)}
                        disabled={erLaast}
                        hasTile={true}
                      />
                      <div className={`collapsible ${bh_svar.vederlag.varsel_for_sent ? 'open' : ''}`}>
                        <div className="collapsible-content">
                          <div className="pl-4 border-l-2 border-border-color">
                            <TextareaField
                              id={`bh_svar.vederlag.varsel_for_sent_begrunnelse.${index}`}
                              label="Begrunnelse for sen varsling"
                              value={bh_svar.vederlag.varsel_for_sent_begrunnelse}
                              onChange={e => handleChange(index, 'vederlag.varsel_for_sent_begrunnelse', e.target.value)}
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
                          error={errors['bh_svar.vederlag.bh_godkjent_vederlag_belop']}
                          formatAsNumber
                          readOnly={erLaast}
                          className="max-w-sm"
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
                        label="Varselet om fristforlengelse ansees som for sent fremsatt"
                        checked={bh_svar.frist.varsel_for_sent}
                        onChange={e => handleChange(index, 'frist.varsel_for_sent', e.target.checked)}
                        disabled={erLaast}
                        hasTile={true}
                      />
                      <div className={`collapsible ${bh_svar.frist.varsel_for_sent ? 'open' : ''}`}>
                        <div className="collapsible-content">
                          <div className="pl-4 border-l-2 border-border-color">
                            <TextareaField
                              id={`bh_svar.frist.varsel_for_sent_begrunnelse.${index}`}
                              label="Begrunnelse for sen varsling"
                              value={bh_svar.frist.varsel_for_sent_begrunnelse}
                              onChange={e => handleChange(index, 'frist.varsel_for_sent_begrunnelse', e.target.value)}
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
                          error={errors['bh_svar.frist.bh_godkjent_frist_dager']}
                          readOnly={erLaast}
                        />
                      </div>
                      <DateField
                        id={`bh_svar.frist.bh_frist_for_spesifisering.${index}`}
                        label="Frist for spesifisering (hvis aktuelt)"
                        value={bh_svar.frist.bh_frist_for_spesifisering}
                        onChange={value => handleChange(index, 'frist.bh_frist_for_spesifisering', value)}
                        className="max-w-sm"
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

                <FieldsetCard legend="Signatur (For Byggherre)">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <DateField
                      id={`bh_svar.sign.dato_svar_bh.${index}`}
                      label="Dato for BHs svar"
                      value={bh_svar.sign.dato_svar_bh}
                      onChange={value => handleChange(index, 'sign.dato_svar_bh', value)}
                      required
                      className="max-w-sm"
                      readOnly={erLaast}
                    />
                    <InputField
                      id={`bh_svar.sign.for_byggherre.${index}`}
                      label="Signatur"
                      value={bh_svar.sign.for_byggherre}
                      onChange={e => handleChange(index, 'sign.for_byggherre', e.target.value)}
                      required
                      placeholder="Navn på signatar"
                      readOnly={erLaast}
                      className="max-w-sm"
                    />
                  </div>
                </FieldsetCard>
              </div>
            </div>
          );
        })}

        {formStatus === 'svar' && rolle === 'BH' && (
          <div className="flex justify-end pt-4">
            <PktButton
              skin="primary"
              size="medium"
              onClick={handleSendSvar}
              iconName="chevron-right"
              variant="icon-right"
            >
              Send svar
            </PktButton>
          </div>
        )}
      </div>
    </PanelLayout>
  );
};

export default BhSvarPanel;
