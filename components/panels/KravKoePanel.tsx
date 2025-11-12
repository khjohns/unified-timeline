import React from 'react';
import { FormDataModel } from '../../types';
import { InputField, SelectField, TextareaField, CheckboxField, DateField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';
import { PktAccordion, PktAccordionItem, PktButton } from '@oslokommune/punkt-react';

interface KravKoePanelProps {
  formData: FormDataModel;
  setFormData: (section: 'koe_revisjoner', field: string, value: any, index?: number) => void;
  errors: Record<string, string>;
  disabled?: boolean;
  formStatus?: 'varsel' | 'krav' | 'svar';
  setFormStatus?: (status: 'varsel' | 'krav' | 'svar') => void;
  setActiveTab?: (tab: number) => void;
  setToastMessage?: (message: string) => void;
  addBhSvarRevisjon?: () => void;
}

const KravKoePanel: React.FC<KravKoePanelProps> = ({
  formData,
  setFormData,
  errors,
  disabled,
  formStatus = 'varsel',
  setFormStatus,
  setActiveTab,
  setToastMessage,
  addBhSvarRevisjon
}) => {
  const { koe_revisjoner = [], bh_svar_revisjoner = [], rolle } = formData;
  const sisteKravIndex = koe_revisjoner.length - 1;

  // Safety check: ensure we have at least one revision
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

    // Validate the latest revision
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

    // Add a new BH svar revision
    addBhSvarRevisjon?.();

    // Change status and navigate
    setFormStatus?.('svar');
    setActiveTab?.(3); // Go to BH Svar tab
    setToastMessage?.('Krav sendt! Byggherre kan nå svare på kravet.');
    setTimeout(() => setToastMessage?.(''), 3000);
  };

  return (
    <div className="space-y-6">
      <PktAccordion skin="outlined">
        {koe_revisjoner.map((koe, index) => {
          const erSisteRevisjon = index === sisteKravIndex;
          // Panel is locked if it's not the last revision, OR if status is not 'krav', OR if role is not 'TE'
          const erLaast = !erSisteRevisjon || formStatus !== 'krav' || rolle !== 'TE' || disabled;

          return (
            <PktAccordionItem
              key={index}
              id={`krav-revisjon-${index}`}
              title={`Krav (Revisjon ${koe.koe_revisjonsnr})`}
              defaultOpen={erSisteRevisjon}
            >
              <div className="space-y-6 p-4">
                <FieldsetCard legend="Generelt om Kravet">
                  <div className="grid grid-cols-1 gap-y-4">
                    <InputField
                      id={`koe.koe_revisjonsnr.${index}`}
                      label="Revisjonsnummer"
                      type="number"
                      min={0}
                      step={1}
                      value={koe.koe_revisjonsnr}
                      onChange={e => handleChange(index, 'koe_revisjonsnr', e.target.value)}
                      required
                      placeholder="f.eks. 0 for første innsending"
                      error={errors[`koe_revisjoner.koe_revisjonsnr`]}
                      helpText="Angir versjonen av kravet. Start med 0."
                      readOnly={erLaast}
                      className="max-w-sm"
                    />
                    <div className="pt-2 space-y-4">
                      <CheckboxField
                        id={`koe.vederlag.krav_vederlag.${index}`}
                        label="Krav om vederlagsjustering (kap. 34)"
                        checked={koe.vederlag.krav_vederlag}
                        onChange={e => handleChange(index, 'vederlag.krav_vederlag', e.target.checked)}
                        disabled={erLaast}
                      />
                      <CheckboxField
                        id={`koe.frist.krav_fristforlengelse.${index}`}
                        label="Krav om fristforlengelse (kap. 33)"
                        checked={koe.frist.krav_fristforlengelse}
                        onChange={e => handleChange(index, 'frist.krav_fristforlengelse', e.target.checked)}
                        disabled={erLaast}
                      />
                    </div>
                  </div>
                </FieldsetCard>

                <div className={`collapsible ${koe.vederlag.krav_vederlag ? 'open' : ''}`}>
                  <div className="collapsible-content">
                    <FieldsetCard legend="Detaljer om Vederlagsjustering">
                      <div className="space-y-4">
                        <div className="space-y-4">
                          <CheckboxField
                            id={`koe.vederlag.krav_produktivitetstap.${index}`}
                            label="Krav om produktivitetstap (§ 34.1.3)"
                            checked={koe.vederlag.krav_produktivitetstap}
                            onChange={e => handleChange(index, 'vederlag.krav_produktivitetstap', e.target.checked)}
                            disabled={erLaast}
                          />
                          <CheckboxField
                            id={`koe.vederlag.saerskilt_varsel_rigg_drift.${index}`}
                            label="Særskilt rigg/drift (§34.1.3)"
                            checked={koe.vederlag.saerskilt_varsel_rigg_drift}
                            onChange={e => handleChange(index, 'vederlag.saerskilt_varsel_rigg_drift', e.target.checked)}
                            disabled={erLaast}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-y-6">
                          <SelectField
                            id={`koe.vederlag.krav_vederlag_metode.${index}`}
                            label="Oppgjørsmetode"
                            value={koe.vederlag.krav_vederlag_metode}
                            onChange={value => handleChange(index, 'vederlag.krav_vederlag_metode', value)}
                            options={[
                              {value:"", label:"— Velg —"},
                              {value:"Entreprenørens tilbud (§34.2.1)", label:"Entreprenørens tilbud (§34.2.1)"},
                              {value:"Kontraktens enhetspriser (§34.3.1)", label:"Kontraktens enhetspriser (§34.3.1)"},
                              {value:"Justerte enhetspriser (§34.3.2)", label:"Justerte enhetspriser (§34.3.2)"},
                              {value:"Regningsarbeid (§30.1)", label:"Regningsarbeid (§30.1)"}
                            ]}
                            readOnly={erLaast}
                          />
                          <InputField
                            id={`koe.vederlag.krav_vederlag_belop.${index}`}
                            label="Beløp (NOK)"
                            type="number"
                            value={koe.vederlag.krav_vederlag_belop}
                            onChange={e => handleChange(index, 'vederlag.krav_vederlag_belop', e.target.value)}
                            error={errors[`koe.vederlag.krav_vederlag_belop`]}
                            formatAsNumber
                            readOnly={erLaast}
                          />
                          <TextareaField
                            id={`koe.vederlag.krav_vederlag_begrunnelse.${index}`}
                            label="Begrunnelse/kalkyle"
                            value={koe.vederlag.krav_vederlag_begrunnelse}
                            onChange={e => handleChange(index, 'vederlag.krav_vederlag_begrunnelse', e.target.value)}
                            readOnly={erLaast}
                          />
                        </div>
                      </div>
                    </FieldsetCard>
                  </div>
                </div>

                <div className={`collapsible ${koe.frist.krav_fristforlengelse ? 'open' : ''}`}>
                  <div className="collapsible-content">
                    <FieldsetCard legend="Detaljer om Fristforlengelse">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-y-6">
                          <SelectField
                            id={`koe.frist.krav_frist_type.${index}`}
                            label="Fristtype"
                            value={koe.frist.krav_frist_type}
                            onChange={value => handleChange(index, 'frist.krav_frist_type', value)}
                            options={[
                              {value:"", label:"— Velg —"},
                              {value:"Foreløpig varsel (§33.4)", label:"Foreløpig varsel (§33.4)"},
                              {value:"Spesifisert krav (§33.6.1)", label:"Spesifisert krav (§33.6.1)"},
                              {value:"Tilleggsfrist ved force majeure (§33.3)", label:"Tilleggsfrist ved force majeure (§33.3)"},
                              {value:"Endelig oppsummering (§39.1) [Prosess ved sluttoppgjør]", label:"Endelig oppsummering (§39.1) [Prosess ved sluttoppgjør]"}
                            ]}
                            readOnly={erLaast}
                          />
                          <InputField
                            id={`koe.frist.krav_frist_antall_dager.${index}`}
                            label="Antall dager"
                            type="number"
                            min={0}
                            step={1}
                            value={koe.frist.krav_frist_antall_dager}
                            onChange={e => handleChange(index, 'frist.krav_frist_antall_dager', e.target.value)}
                            error={errors[`koe.frist.krav_frist_antall_dager`]}
                            readOnly={erLaast}
                            className="max-w-sm"
                          />
                          <CheckboxField
                            id={`koe.frist.forsinkelse_kritisk_linje.${index}`}
                            label="Forsinkelse påvirker kritisk linje?"
                            checked={koe.frist.forsinkelse_kritisk_linje}
                            onChange={e => handleChange(index, 'frist.forsinkelse_kritisk_linje', e.target.checked)}
                            disabled={erLaast}
                          />
                          <TextareaField
                            id={`koe.frist.krav_frist_begrunnelse.${index}`}
                            label="Begrunnelse (årsakssammenheng)"
                            value={koe.frist.krav_frist_begrunnelse}
                            onChange={e => handleChange(index, 'frist.krav_frist_begrunnelse', e.target.value)}
                            readOnly={erLaast}
                          />
                        </div>
                      </div>
                    </FieldsetCard>
                  </div>
                </div>

                <FieldsetCard legend="Signatur (For Entreprenør)">
                  <div className="grid grid-cols-1 gap-y-6">
                    <DateField
                      id={`koe.dato_krav_sendt.${index}`}
                      label="Dato krav sendt"
                      value={koe.dato_krav_sendt}
                      onChange={value => handleChange(index, 'dato_krav_sendt', value)}
                      required
                      readOnly={erLaast}
                      className="max-w-sm"
                    />
                    <InputField
                      id={`koe.for_entreprenor.${index}`}
                      label="Signatur"
                      value={koe.for_entreprenor}
                      onChange={e => handleChange(index, 'for_entreprenor', e.target.value)}
                      placeholder="Navn på signatar"
                      readOnly={erLaast}
                    />
                  </div>
                </FieldsetCard>
              </div>
            </PktAccordionItem>
          );
        })}
      </PktAccordion>

      {formStatus === 'krav' && rolle === 'TE' && !disabled && (
        <div className="flex justify-end pt-4">
          <PktButton
            skin="primary"
            size="medium"
            onClick={handleSendKrav}
            iconName="chevron-right"
            variant="icon-right"
          >
            Send krav (Revisjon {koe_revisjoner[sisteKravIndex].koe_revisjonsnr})
          </PktButton>
        </div>
      )}
    </div>
  );
};

export default KravKoePanel;
