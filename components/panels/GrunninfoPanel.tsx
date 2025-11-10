import React from 'react';
import { FormDataModel } from '../../types';
import { InputField, DateField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';

interface GrunninfoPanelProps {
  formData: FormDataModel;
  setFormData: (section: 'sak', field: string, value: any) => void;
  errors: Record<string, string>;
}

const GrunninfoPanel: React.FC<GrunninfoPanelProps> = ({ formData, setFormData, errors }) => {
  const { sak } = formData;
  const handleChange = (field: string, value: any) => setFormData('sak', field, value);

  return (
    <div className="space-y-6">
      <FieldsetCard legend="Saksdetaljer">
        <div className="pkt-grid">
          <InputField
            className="pkt-cell pkt-cell--span6-tablet-up"
            id="sak.sakstittel"
            label="Sakstittel"
            value={sak.sakstittel}
            onChange={e => handleChange('sakstittel', e.target.value)}
            required
            placeholder=""
            error={errors['sak.sakstittel']}
          />
          <InputField
            className="pkt-cell pkt-cell--span6-tablet-up"
            id="sak.sak_id_display"
            label="Sak-ID"
            value={sak.sak_id_display}
            onChange={e => handleChange('sak_id_display', e.target.value)}
            placeholder="f.eks. KOE-2025-0001"
            error={errors['sak.sak_id_display']}
          />
          <InputField
            className="pkt-cell pkt-cell--span6-tablet-up"
            id="sak.opprettet_av"
            label="Opprettet av"
            value={sak.opprettet_av}
            onChange={e => handleChange('opprettet_av', e.target.value)}
            required
            placeholder="Navn"
            error={errors['sak.opprettet_av']}
          />
          <DateField
            className="pkt-cell pkt-cell--span6-tablet-up"
            id="sak.opprettet_dato"
            label="Opprettet dato"
            value={sak.opprettet_dato}
            onChange={()=>{}}
            readOnly
          />
        </div>
      </FieldsetCard>

      <FieldsetCard legend="Prosjekt">
        <div className="pkt-grid">
          <InputField className="pkt-cell pkt-cell--span6-tablet-up" id="sak.prosjekt_navn" label="Prosjekt" value={sak.prosjekt_navn} onChange={e => handleChange('prosjekt_navn', e.target.value)} required error={errors['sak.prosjekt_navn']} />
          <InputField className="pkt-cell pkt-cell--span6-tablet-up" id="sak.kontrakt_referanse" label="Prosjektnummer" value={sak.kontrakt_referanse} onChange={e => handleChange('kontrakt_referanse', e.target.value)} required error={errors['sak.kontrakt_referanse']} />
          <InputField className="pkt-cell pkt-cell--span6-tablet-up" id="sak.entreprenor" label="Entreprenør (TE)" value={sak.entreprenor} onChange={e => handleChange('entreprenor', e.target.value)} required error={errors['sak.entreprenor']} />
          <InputField className="pkt-cell pkt-cell--span6-tablet-up" id="sak.byggherre" label="Byggherre (BH)" value={sak.byggherre} onChange={e => handleChange('byggherre', e.target.value)} required error={errors['sak.byggherre']} />
        </div>
      </FieldsetCard>
    </div>
  );
};

export default GrunninfoPanel;