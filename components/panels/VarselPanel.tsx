import React from 'react';
import { FormDataModel } from '../../types';
import { DateField, SelectField, TextareaField } from '../ui/Field';
import FieldsetCard from '../ui/FieldsetCard';
import { HOVEDKATEGORI_OPTIONS, UNDERKATEGORI_MAP } from '../../constants';

interface VarselPanelProps {
  formData: FormDataModel;
  setFormData: (section: 'varsel', field: string, value: any) => void;
  errors: Record<string, string>;
}

const VarselPanel: React.FC<VarselPanelProps> = ({ formData, setFormData, errors }) => {
  const { varsel } = formData;
  const handleChange = (field: string, value: any) => setFormData('varsel', field, value);

  const handleHovedkategoriChange = (value: string) => {
    handleChange('hovedkategori', value);
    handleChange('underkategori', ''); // Reset underkategori
  };
  
  const underkategoriOptions = [
      {value:"", label: varsel.hovedkategori ? "— Velg —" : "— Velg hovedkategori først —"}, 
      ...(UNDERKATEGORI_MAP[varsel.hovedkategori] || []).map(o => ({ value: o, label: o }))
  ];

  return (
    <div className="space-y-6">
      <FieldsetCard legend="Dato">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <DateField className="md:col-span-6" id="varsel.dato_forhold_oppdaget" label="Dato forhold oppdaget" value={varsel.dato_forhold_oppdaget} onChange={value => handleChange('dato_forhold_oppdaget', value)} required error={errors['varsel.dato_forhold_oppdaget']} />
          <DateField className="md:col-span-6" id="varsel.dato_varsel_sendt" label="Dato varsel sendt" value={varsel.dato_varsel_sendt} onChange={value => handleChange('dato_varsel_sendt', value)} required error={errors['varsel.dato_varsel_sendt']} />
        </div>
      </FieldsetCard>

      <FieldsetCard legend="Klassifisering">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <SelectField className="md:col-span-6" id="varsel.hovedkategori" label="Hovedkategori (NS 8407)" value={varsel.hovedkategori} onChange={handleHovedkategoriChange} options={HOVEDKATEGORI_OPTIONS} required error={errors['varsel.hovedkategori']} />
          <SelectField className="md:col-span-6" id="varsel.underkategori" label="Underkategori" value={varsel.underkategori} onChange={value => handleChange('underkategori', value)} options={underkategoriOptions} />
        </div>
      </FieldsetCard>
      
      <FieldsetCard legend="Beskrivelse og Referanser">
          <TextareaField id="varsel.varsel_beskrivelse" label="Beskrivelse (vis til vedlegg)" value={varsel.varsel_beskrivelse} onChange={e => handleChange('varsel_beskrivelse', e.target.value)} />
          <div className="mt-4">
            <TextareaField id="varsel.referansedokumenter" label="Referansedokumenter / tidligere korrespondanse" value={varsel.referansedokumenter} onChange={e => handleChange('referansedokumenter', e.target.value)} />
          </div>
      </FieldsetCard>
    </div>
  );
};

export default VarselPanel;