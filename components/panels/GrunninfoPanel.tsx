import React from 'react';
import { FormDataModel } from '../../types';
import { InputField, DateField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';

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
    // Ytre container for hele siden, bred nok for to kolonner på desktop
    <div className="max-w-7xl mx-auto">
      {/* Grid som kun aktiveres på store skjermer (lg:). 2/3 til skjema, 1/3 til sidepanel. */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-12">
        
        {/* Kolonne 1: Hovedinnhold med skjemaet */}
        <div className="lg:col-span-2">
          <div className="space-y-6">
            <FieldsetCard legend="Saksdetaljer">
              <div className="space-y-6">
                <InputField
                  id="sak.sakstittel"
                  label="Sakstittel"
                  value={sak.sakstittel}
                  onChange={e => handleChange('sakstittel', e.target.value)}
                  placeholder=""
                  error={errors['sak.sakstittel']}
                  readOnly={disabled}
                />
                <InputField
                  id="sak.sak_id_display"
                  label="Sak-ID"
                  value={sak.sak_id_display}
                  onChange={e => handleChange('sak_id_display', e.target.value)}
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
                  onChange={e => handleChange('opprettet_av', e.target.value)}
                  placeholder="Navn"
                  error={errors['sak.opprettet_av']}
                  readOnly={disabled}
                  className="max-w-sm"
                />
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

            <FieldsetCard legend="Prosjekt">
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
                  error={errors['sak.kontrakt_referanse']} 
                  readOnly={disabled}
                  className="max-w-sm"
                />
                <InputField 
                  id="sak.entreprenor" 
                  label="Entreprenør (TE)" 
                  value={sak.entreprenor} 
                  onChange={e => handleChange('entreprenor', e.target.value)} 
                  error={errors['sak.entreprenor']} 
                  readOnly={disabled}
                />
                <InputField 
                  id="sak.byggherre" 
                  label="Byggherre (BH)" 
                  value={sak.byggherre} 
                  onChange={e => handleChange('byggherre', e.target.value)} 
                  error={errors['sak.byggherre']} 
                  readOnly={disabled}
                />
              </div>
            </FieldsetCard>
          </div>
        </div>

        {/* Kolonne 2: Sidepanelet. Vises kun på store skjermer. */}
        <aside className="hidden lg:block">
          <div className="sticky top-36 space-y-4">
            <h3 className="text-lg font-semibold text-ink">Saksinformasjon</h3>
            <div className="text-sm space-y-2 p-4 bg-gray-50 rounded-lg border border-border-color">
              <p><strong>Sakstittel:</strong> {sak.sakstittel || 'Ikke angitt'}</p>
              <p><strong>Sak-ID:</strong> {sak.sak_id_display || 'Ikke angitt'}</p>
              <p><strong>Prosjekt:</strong> {sak.prosjekt_navn || 'Ikke angitt'}</p>
              <p><strong>Entreprenør:</strong> {sak.entreprenor || 'Ikke angitt'}</p>
              <p><strong>Byggherre:</strong> {sak.byggherre || 'Ikke angitt'}</p>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
};

export default GrunninfoPanel;
