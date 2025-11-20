import React from 'react';
import { FormDataModel } from '../../types';
import { InputField, DateField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';
import PanelLayout from '../ui/PanelLayout';
import { PktTag } from '@oslokommune/punkt-react';
import { getSakStatusSkin, getSakStatusLabel } from '../../utils/statusHelpers';

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
        {/* Metadata tabell - automatisk genererte felt */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Saksmetadata (automatisk)</h3>
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="border border-blue-200 px-3 py-2 bg-white font-medium w-1/4">Sak-ID</td>
                <td className="border border-blue-200 px-3 py-2 bg-white">{sak.sak_id || 'Genereres automatisk'}</td>
                <td className="border border-blue-200 px-3 py-2 bg-white font-medium w-1/4">Opprettet dato</td>
                <td className="border border-blue-200 px-3 py-2 bg-white">{sak.opprettet_dato || 'Settes ved opprettelse'}</td>
              </tr>
              <tr>
                <td className="border border-blue-200 px-3 py-2 bg-white font-medium">Opprettet av</td>
                <td className="border border-blue-200 px-3 py-2 bg-white">{sak.opprettet_av || 'Hentes fra bruker'}</td>
                <td className="border border-blue-200 px-3 py-2 bg-white font-medium">Status</td>
                <td className="border border-blue-200 px-3 py-2 bg-white">
                  <PktTag skin={getSakStatusSkin(sak.status)}>
                    {getSakStatusLabel(sak.status)}
                  </PktTag>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-blue-700 mt-2">
            💡 Disse feltene settes automatisk av systemet og kan ikke endres manuelt
          </p>
        </div>

            <FieldsetCard legend="Saksdetaljer">
              <div className="grid grid-cols-1 gap-6">
                <InputField
                  id="sak.sakstittel"
                  label="Sakstittel"
                  value={sak.sakstittel}
                  onChange={e => handleChange('sakstittel', e.target.value)}
                  helpText="Kort beskrivelse av endringen"
                  error={errors['sak.sakstittel']}
                  readOnly={disabled}
                />
              </div>
            </FieldsetCard>

            <FieldsetCard legend="Prosjektinformasjon">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InputField
                  id="sak.prosjekt_navn"
                  label="Prosjekt"
                  value={sak.prosjekt_navn}
                  onChange={e => handleChange('prosjekt_navn', e.target.value)}
                  error={errors['sak.prosjekt_navn']}
                  readOnly={disabled}
                  className="md:col-span-2"
                />
                <InputField
                  id="sak.kontrakt_referanse"
                  label="Prosjektnummer"
                  value={sak.kontrakt_referanse}
                  onChange={e => handleChange('kontrakt_referanse', e.target.value)}
                  error={errors['sak.kontrakt_referanse']}
                  readOnly={disabled}
                  autoComplete="off"
                />
              </div>
              <div className="grid grid-cols-1 gap-6">
                  <InputField
                    id="sak.entreprenor"
                    label="Entreprenør (TE)"
                    value={sak.entreprenor}
                    onChange={e => handleChange('entreprenor', e.target.value)}
                    error={errors['sak.entreprenor']}
                    readOnly={disabled}
                    autoComplete="organization"
                    className="w-full md:max-w-sm"
                  />
                  <InputField
                    id="sak.byggherre"
                    label="Byggherre (BH)"
                    value={sak.byggherre}
                    onChange={e => handleChange('byggherre', e.target.value)}
                    error={errors['sak.byggherre']}
                    readOnly={disabled}
                    autoComplete="organization"
                    className="w-full md:max-w-sm"
                    
                  />
                </div>
            </FieldsetCard>
          </div>
    </PanelLayout>
  );
};

export default GrunninfoPanel;
