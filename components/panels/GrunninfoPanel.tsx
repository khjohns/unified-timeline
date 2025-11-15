import React from 'react';
import { FormDataModel } from '../../types';
import { InputField, DateField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';
import PanelLayout from '../ui/PanelLayout';

interface GrunninfoPanelProps {
  formData: FormDataModel;
  setFormData: (section: 'sak', field: string, value: any) => void;
  errors: Record<string, string>;
  disabled?: boolean;
}

const GrunninfoPanel: React.FC<GrunninfoPanelProps> = ({ formData, setFormData, errors, disabled }) => {
  const { sak } = formData;
  const handleChange = (field: string, value: any) => setFormData('sak', field, value);

  return (
    <PanelLayout>
      <div className="space-y-6">
            <FieldsetCard legend="Saksdetaljer">
              <div className="space-y-6">
                <InputField
                  id="sak.sakstittel"
                  label="Sakstittel"
                  value={sak.sakstittel}
                  onChange={e => handleChange('sakstittel', e.target.value)}
                  helpText="Kort beskrivelse av endringen"
                  error={errors['sak.sakstittel']}
                  readOnly={disabled}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField
                    id="sak.sak_id_display"
                    label="Sak-ID"
                    value={sak.sak_id_display}
                    onChange={e => handleChange('sak_id_display', e.target.value)}
                    helpText="Format: KOE-ÅÅÅÅ-NNNN"
                    error={errors['sak.sak_id_display']}
                    readOnly={disabled}
                    optional
                    autoComplete="off"
                    className="w-full md:max-w-xs"
                  />
                  <InputField
                    id="sak.opprettet_av"
                    label="Opprettet av"
                    value={sak.opprettet_av}
                    onChange={e => handleChange('opprettet_av', e.target.value)}
                    error={errors['sak.opprettet_av']}
                    readOnly={disabled}
                    autoComplete="name"
                    className="w-full md:max-w-sm"
                  />
                </div>
                <DateField
                  id="sak.opprettet_dato"
                  label="Opprettet dato"
                  value={sak.opprettet_dato}
                  onChange={()=>{}}
                  readOnly
                  className="max-w-sm"
                />
              </div>
            </FieldsetCard>

            <FieldsetCard legend="Prosjektinformasjon">
              <div className="space-y-6">
                <InputField
                  id="sak.prosjekt_navn"
                  label="Prosjekt"
                  value={sak.prosjekt_navn}
                  onChange={e => handleChange('prosjekt_navn', e.target.value)}
                  error={errors['sak.prosjekt_navn']}
                  readOnly={disabled}
                />
                <InputField
                  id="sak.kontrakt_referanse"
                  label="Prosjektnummer"
                  value={sak.kontrakt_referanse}
                  onChange={e => handleChange('kontrakt_referanse', e.target.value)}
                  helpText="Prosjektets unike referansenummer"
                  error={errors['sak.kontrakt_referanse']}
                  readOnly={disabled}
                  autoComplete="off"
                  className="w-full md:max-w-xs"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField
                    id="sak.entreprenor"
                    label="Entreprenør (TE)"
                    value={sak.entreprenor}
                    onChange={e => handleChange('entreprenor', e.target.value)}
                    error={errors['sak.entreprenor']}
                    readOnly={disabled}
                    autoComplete="organization"
                    className="w-full"
                  />
                  <InputField
                    id="sak.byggherre"
                    label="Byggherre (BH)"
                    value={sak.byggherre}
                    onChange={e => handleChange('byggherre', e.target.value)}
                    error={errors['sak.byggherre']}
                    readOnly={disabled}
                    autoComplete="organization"
                    className="w-full"
                  />
                </div>
              </div>
            </FieldsetCard>
          </div>
    </PanelLayout>
  );
};

export default GrunninfoPanel;
