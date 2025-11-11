

import React from 'react';
import { FormDataModel } from '../../types';
import { InputField, SelectField, TextareaField, CheckboxField, DateField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';

interface KravKoePanelProps {
  formData: FormDataModel;
  setFormData: (section: 'koe', field: string, value: any) => void;
  errors: Record<string, string>;
  disabled?: boolean;
}

const KravKoePanel: React.FC<KravKoePanelProps> = ({ formData, setFormData, errors, disabled }) => {
  const { koe } = formData;
  const handleChange = (field: string, value: any) => setFormData('koe', field, value);

  return (
    <div className="space-y-6">
      <FieldsetCard legend="Generelt om Kravet">
        <div className="grid grid-cols-1 gap-y-4">
            <InputField
                id="koe.koe_revisjonsnr"
                label="Revisjonsnummer"
                type="number"
                min={0}
                step={1}
                value={koe.koe_revisjonsnr}
                onChange={e => handleChange('koe_revisjonsnr', e.target.value)}
                required
                placeholder="f.eks. 0 for første innsending"
                error={errors['koe.koe_revisjonsnr']}
                helpText="Angir versjonen av kravet. Start med 0."
                readOnly={disabled}
                className="max-w-sm"
            />
            <div className="pt-2 space-y-4">
                <CheckboxField
                    id="koe.vederlag.krav_vederlag"
                    label="Krav om vederlagsjustering (kap. 34)"
                    checked={koe.vederlag.krav_vederlag}
                    onChange={e => handleChange('vederlag.krav_vederlag', e.target.checked)}
                    disabled={disabled}
                />
                <CheckboxField
                    id="koe.frist.krav_fristforlengelse"
                    label="Krav om fristforlengelse (kap. 33)"
                    checked={koe.frist.krav_fristforlengelse}
                    onChange={e => handleChange('frist.krav_fristforlengelse', e.target.checked)}
                    disabled={disabled}
                />
            </div>
        </div>
      </FieldsetCard>
      
      <div className={`collapsible ${koe.vederlag.krav_vederlag ? 'open' : ''}`}>
        <div className="collapsible-content">
          <FieldsetCard legend="Detaljer om Vederlagsjustering">
              <div className="space-y-4">
                <div className="space-y-4">
                    <CheckboxField id="koe.vederlag.krav_produktivitetstap" label="Krav om produktivitetstap (§ 34.1.3)" checked={koe.vederlag.krav_produktivitetstap} onChange={e => handleChange('vederlag.krav_produktivitetstap', e.target.checked)} disabled={disabled} />
                    <CheckboxField id="koe.vederlag.saerskilt_varsel_rigg_drift" label="Særskilt rigg/drift (§34.1.3)" checked={koe.vederlag.saerskilt_varsel_rigg_drift} onChange={e => handleChange('vederlag.saerskilt_varsel_rigg_drift', e.target.checked)} disabled={disabled} />
                </div>
                <div className="grid grid-cols-1 gap-y-6">
                    <SelectField id="koe.vederlag.krav_vederlag_metode" label="Oppgjørsmetode" value={koe.vederlag.krav_vederlag_metode} onChange={value => handleChange('vederlag.krav_vederlag_metode', value)} options={[{value:"", label:"— Velg —"}, {value:"Entreprenørens tilbud (§34.2.1)", label:"Entreprenørens tilbud (§34.2.1)"}, {value:"Kontraktens enhetspriser (§34.3.1)", label:"Kontraktens enhetspriser (§34.3.1)"}, {value:"Justerte enhetspriser (§34.3.2)", label:"Justerte enhetspriser (§34.3.2)"}, {value:"Regningsarbeid (§30.1)", label:"Regningsarbeid (§30.1)"}]} readOnly={disabled} />
                    <InputField id="koe.vederlag.krav_vederlag_belop" label="Beløp (NOK)" type="number" value={koe.vederlag.krav_vederlag_belop} onChange={e => handleChange('vederlag.krav_vederlag_belop', e.target.value)} error={errors['koe.vederlag.krav_vederlag_belop']} formatAsNumber readOnly={disabled} />
                    <TextareaField id="koe.vederlag.krav_vederlag_begrunnelse" label="Begrunnelse/kalkyle" value={koe.vederlag.krav_vederlag_begrunnelse} onChange={e => handleChange('vederlag.krav_vederlag_begrunnelse', e.target.value)} readOnly={disabled} />
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
                    <SelectField id="koe.frist.krav_frist_type" label="Fristtype" value={koe.frist.krav_frist_type} onChange={value => handleChange('frist.krav_frist_type', value)} options={[{value:"", label:"— Velg —"}, {value:"Foreløpig varsel (§33.4)", label:"Foreløpig varsel (§33.4)"}, {value:"Spesifisert krav (§33.6.1)", label:"Spesifisert krav (§33.6.1)"}, {value:"Tilleggsfrist ved force majeure (§33.3)", label:"Tilleggsfrist ved force majeure (§33.3)"}, {value:"Endelig oppsummering (§39.1) [Prosess ved sluttoppgjør]", label:"Endelig oppsummering (§39.1) [Prosess ved sluttoppgjør]"}]} readOnly={disabled} />
                    <InputField id="koe.frist.krav_frist_antall_dager" label="Antall dager" type="number" min={0} step={1} value={koe.frist.krav_frist_antall_dager} onChange={e => handleChange('frist.krav_frist_antall_dager', e.target.value)} error={errors['koe.frist.krav_frist_antall_dager']} readOnly={disabled} className="max-w-sm" />
                    <CheckboxField id="koe.frist.forsinkelse_kritisk_linje" label="Forsinkelse påvirker kritisk linje?" checked={koe.frist.forsinkelse_kritisk_linje} onChange={e => handleChange('frist.forsinkelse_kritisk_linje', e.target.checked)} disabled={disabled} />
                    <TextareaField id="koe.frist.krav_frist_begrunnelse" label="Begrunnelse (årsakssammenheng)" value={koe.frist.krav_frist_begrunnelse} onChange={e => handleChange('frist.krav_frist_begrunnelse', e.target.value)} readOnly={disabled} />
                </div>
              </div>
          </FieldsetCard>
        </div>
      </div>

      <FieldsetCard legend="Signatur (For Entreprenør)">
        <div className="grid grid-cols-1 gap-y-6">
            <DateField
                id="koe.dato_krav_sendt"
                label="Dato krav sendt"
                value={koe.dato_krav_sendt}
                onChange={value => handleChange('dato_krav_sendt', value)}
                required
                readOnly={disabled}
                className="max-w-sm"
            />
             <InputField
                id="koe.for_entreprenor"
                label="Signatur"
                value={koe.for_entreprenor}
                onChange={e => handleChange('for_entreprenor', e.target.value)}
                placeholder="Navn på signatar"
                readOnly={disabled}
            />
        </div>
      </FieldsetCard>
    </div>
  );
};

export default KravKoePanel;