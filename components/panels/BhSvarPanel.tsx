import React from 'react';
import { FormDataModel } from '../../types';
import { InputField, SelectField, TextareaField, CheckboxField, DateField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';

interface BhSvarPanelProps {
  formData: FormDataModel;
  setFormData: (section: 'bh_svar', field: string, value: any) => void;
  errors: Record<string, string>;
}

const BhSvarPanel: React.FC<BhSvarPanelProps> = ({ formData, setFormData, errors }) => {
  const { bh_svar, koe, rolle } = formData;

  const handleChange = (field: string, value: any) => {
    if (rolle === 'BH') {
      setFormData('bh_svar', field, value);
    }
  };

  const vederlagSvarOptions = [
    { value: "", label: "— Velg —" },
    { value: "Godkjent i sin helhet", label: "Godkjent i sin helhet" },
    { value: "Delvis godkjent", label: "Delvis godkjent" },
    { value: "Avvist", label: "Avvist" },
    { value: "Utsatt", label: "Utsatt" },
  ];

  const fristSvarOptions = [
    { value: "", label: "— Velg —" },
    { value: "Godkjent", label: "Godkjent" },
    { value: "Delvis godkjent", label: "Delvis godkjent" },
    { value: "Avvist", label: "Avvist" },
    { value: "Avventer spesifisering", label: "Avventer spesifisering" },
  ];

  if (rolle !== 'BH') {
    return (
        <div className="text-center p-8 bg-gray-50 rounded-lg border">
            <h3 className="text-lg font-semibold text-ink-dim">Svar fra Byggherre (BH)</h3>
            <p className="mt-2 text-muted">Disse feltene fylles ut av Byggherre. Bytt til BH-rollen for å redigere.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
       {!koe.vederlag.krav_vederlag && !koe.frist.krav_fristforlengelse && (
          <div className="text-center p-6 bg-gray-50 rounded-lg border">
              <p className="text-muted">Entreprenøren har ikke fremmet spesifikke krav om vederlag eller fristforlengelse.</p>
          </div>
      )}

      <FieldsetCard legend="Byggherremøte om KOE" isBhPanel>
         <div className="pkt-grid">
            <DateField className="pkt-cell pkt-cell--span6-tablet-up" id="bh_svar.mote_dato" label="Dato for møte" value={bh_svar.mote_dato} onChange={value => handleChange('mote_dato', value)} />
            <TextareaField className="pkt-cell" id="bh_svar.mote_referat" label="Referanse til møtereferat" value={bh_svar.mote_referat} onChange={e => handleChange('mote_referat', e.target.value)} minHeight="60px" />
         </div>
      </FieldsetCard>

      {koe.vederlag.krav_vederlag && (
        <FieldsetCard legend="Svar på Vederlagskrav" isBhPanel>
          <CheckboxField 
            id="bh_svar.vederlag.varsel_for_sent" 
            label="Varselet om vederlagskrav ansees som for sent fremsatt"
            checked={bh_svar.vederlag.varsel_for_sent} 
            onChange={e => handleChange('vederlag.varsel_for_sent', e.target.checked)} 
          />
          <div className={`collapsible ${bh_svar.vederlag.varsel_for_sent ? 'open' : ''}`}>
            <div className="collapsible-content">
              <div className="mt-4 pt-4 pl-4 border-l-2 border-border-color">
                <TextareaField className="pkt-cell" id="bh_svar.vederlag.varsel_for_sent_begrunnelse" label="Begrunnelse for sen varsling" value={bh_svar.vederlag.varsel_for_sent_begrunnelse} onChange={e => handleChange('vederlag.varsel_for_sent_begrunnelse', e.target.value)} required={bh_svar.vederlag.varsel_for_sent} />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border-color">
            <div className="pkt-grid">
              <SelectField className="pkt-cell pkt-cell--span6-tablet-up" id="bh_svar.vederlag.bh_svar_vederlag" label="Svar på krav om vederlag" value={bh_svar.vederlag.bh_svar_vederlag} onChange={value => handleChange('vederlag.bh_svar_vederlag', value)} options={vederlagSvarOptions} />
              <InputField className="pkt-cell pkt-cell--span6-tablet-up" id="bh_svar.vederlag.bh_godkjent_vederlag_belop" label="Godkjent beløp (NOK)" type="number" value={bh_svar.vederlag.bh_godkjent_vederlag_belop} onChange={e => handleChange('vederlag.bh_godkjent_vederlag_belop', e.target.value)} error={errors['bh_svar.vederlag.bh_godkjent_vederlag_belop']} formatAsNumber />
            </div>
            <div className="mt-4">
                <TextareaField className="pkt-cell" id="bh_svar.vederlag.bh_begrunnelse_vederlag" label="Begrunnelse for svar" value={bh_svar.vederlag.bh_begrunnelse_vederlag} onChange={e => handleChange('vederlag.bh_begrunnelse_vederlag', e.target.value)} />
            </div>
          </div>
        </FieldsetCard>
      )}

      {koe.frist.krav_fristforlengelse && (
        <FieldsetCard legend="Svar på Fristforlengelse" isBhPanel>
            <CheckboxField 
              id="bh_svar.frist.varsel_for_sent" 
              label="Varselet om fristforlengelse ansees som for sent fremsatt"
              checked={bh_svar.frist.varsel_for_sent} 
              onChange={e => handleChange('frist.varsel_for_sent', e.target.checked)} 
            />
            <div className={`collapsible ${bh_svar.frist.varsel_for_sent ? 'open' : ''}`}>
                <div className="collapsible-content">
                  <div className="mt-4 pt-4 pl-4 border-l-2 border-border-color">
                    <TextareaField className="pkt-cell" id="bh_svar.frist.varsel_for_sent_begrunnelse" label="Begrunnelse for sen varsling" value={bh_svar.frist.varsel_for_sent_begrunnelse} onChange={e => handleChange('frist.varsel_for_sent_begrunnelse', e.target.value)} required={bh_svar.frist.varsel_for_sent} />
                  </div>
                </div>
            </div>
            <div className="mt-6 pt-6 border-t border-border-color">
                <div className="pkt-grid">
                    <SelectField className="pkt-cell pkt-cell--span6-tablet-up" id="bh_svar.frist.bh_svar_frist" label="Svar på krav om frist" value={bh_svar.frist.bh_svar_frist} onChange={value => handleChange('frist.bh_svar_frist', value)} options={fristSvarOptions} />
                    <InputField className="pkt-cell pkt-cell--span6-tablet-up" id="bh_svar.frist.bh_godkjent_frist_dager" label="Godkjente dager" type="number" min={0} value={bh_svar.frist.bh_godkjent_frist_dager} onChange={e => handleChange('frist.bh_godkjent_frist_dager', e.target.value)} error={errors['bh_svar.frist.bh_godkjent_frist_dager']} />
                    <DateField className="pkt-cell pkt-cell--span6-tablet-up" id="bh_svar.frist.bh_frist_for_spesifisering" label="Frist for spesifisering (hvis aktuelt)" value={bh_svar.frist.bh_frist_for_spesifisering} onChange={value => handleChange('frist.bh_frist_for_spesifisering', value)} />
                </div>
                <div className="mt-4">
                    <TextareaField className="pkt-cell" id="bh_svar.frist.bh_begrunnelse_frist" label="Begrunnelse for svar" value={bh_svar.frist.bh_begrunnelse_frist} onChange={e => handleChange('frist.bh_begrunnelse_frist', e.target.value)} />
                </div>
            </div>
        </FieldsetCard>
      )}

      <FieldsetCard legend="Signatur (For Byggherre)" isBhPanel>
         <div className="pkt-grid">
            <DateField className="pkt-cell pkt-cell--span6-tablet-up" id="bh_svar.sign.dato_svar_bh" label="Dato for BHs svar" value={bh_svar.sign.dato_svar_bh} onChange={value => handleChange('sign.dato_svar_bh', value)} required />
            <InputField className="pkt-cell pkt-cell--span6-tablet-up" id="bh_svar.sign.for_byggherre" label="Signatur" value={bh_svar.sign.for_byggherre} onChange={e => handleChange('sign.for_byggherre', e.target.value)} required placeholder="Navn på signatar" />
         </div>
      </FieldsetCard>
    </div>
  );
};

export default BhSvarPanel;