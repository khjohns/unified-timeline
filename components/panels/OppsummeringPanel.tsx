import React from 'react';
import { FormDataModel } from '../../types';

interface OppsummeringPanelProps {
  data: FormDataModel;
}

const SummaryItem: React.FC<{ label: string; value?: string | number | boolean; children?: React.ReactNode }> = ({ label, value, children }) => {
    const displayValue = typeof value === 'boolean' ? (value ? 'Ja' : 'Nei') : (value || '—');
    return (
      <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt className="text-sm font-medium text-muted">{label}</dt>
        <dd className="mt-1 text-sm text-ink sm:col-span-2 sm:mt-0">{children || displayValue}</dd>
      </div>
    );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h3 className="text-lg font-semibold leading-6 text-ink mb-3 border-b pb-2">{title}</h3>
        <dl className="divide-y divide-border-color">{children}</dl>
    </div>
);


const OppsummeringPanel: React.FC<OppsummeringPanelProps> = ({ data }) => {

    return (
        <div className="space-y-8">
            <div className="space-y-6">
                <Section title="1) Grunninfo">
                    <SummaryItem label="Sak-ID" value={data.sak.sak_id_display} />
                    <SummaryItem label="Sakstittel" value={data.sak.sakstittel} />
                    <SummaryItem label="Opprettet dato" value={data.sak.opprettet_dato} />
                    <SummaryItem label="Opprettet av" value={data.sak.opprettet_av} />
                    <SummaryItem label="Prosjekt" value={data.sak.prosjekt_navn} />
                    <SummaryItem label="Prosjektnummer" value={data.sak.kontrakt_referanse} />
                    <SummaryItem label="Entreprenør (TE)" value={data.sak.entreprenor} />
                    <SummaryItem label="Byggherre (BH)" value={data.sak.byggherre} />
                </Section>
                
                <Section title="2) Varsel">
                    <SummaryItem label="Dato forhold oppdaget" value={data.varsel.dato_forhold_oppdaget} />
                    <SummaryItem label="Dato varsel sendt" value={data.varsel.dato_varsel_sendt} />
                    <SummaryItem label="Hovedkategori" value={data.varsel.hovedkategori} />
                    <SummaryItem label="Underkategori" value={data.varsel.underkategori} />
                    <SummaryItem label="Beskrivelse"><p className="whitespace-pre-wrap">{data.varsel.varsel_beskrivelse || '—'}</p></SummaryItem>
                    <SummaryItem label="Referansedokumenter"><p className="whitespace-pre-wrap">{data.varsel.referansedokumenter || '—'}</p></SummaryItem>
                </Section>
                
                <Section title="3) Krav (KOE)">
                    <SummaryItem label="Revisjonsnummer" value={data.koe.koe_revisjonsnr} />
                    <SummaryItem label="Dato krav sendt" value={data.koe.dato_krav_sendt} />
                    
                    <SummaryItem label="Krav om vederlagsjustering" value={data.koe.vederlag.krav_vederlag} />
                    {data.koe.vederlag.krav_vederlag && <>
                        <SummaryItem label="Krav om produktivitetstap" value={data.koe.vederlag.krav_produktivitetstap} />
                        <SummaryItem label="Særskilt rigg/drift" value={data.koe.vederlag.saerskilt_varsel_rigg_drift} />
                        <SummaryItem label="Oppgjørsmetode" value={data.koe.vederlag.krav_vederlag_metode} />
                        <SummaryItem label="Beløp (NOK)" value={data.koe.vederlag.krav_vederlag_belop ? Number(data.koe.vederlag.krav_vederlag_belop).toLocaleString('no-NO') : '—'} />
                        <SummaryItem label="Begrunnelse/kalkyle"><p className="whitespace-pre-wrap">{data.koe.vederlag.krav_vederlag_begrunnelse || '—'}</p></SummaryItem>
                    </>}

                    <SummaryItem label="Krav om fristforlengelse" value={data.koe.frist.krav_fristforlengelse} />
                     {data.koe.frist.krav_fristforlengelse && <>
                        <SummaryItem label="Fristtype" value={data.koe.frist.krav_frist_type} />
                        <SummaryItem label="Antall dager" value={data.koe.frist.krav_frist_antall_dager} />
                        <SummaryItem label="Påvirker kritisk linje" value={data.koe.frist.forsinkelse_kritisk_linje} />
                        <SummaryItem label="Begrunnelse"><p className="whitespace-pre-wrap">{data.koe.frist.krav_frist_begrunnelse || '—'}</p></SummaryItem>
                    </>}
                    <SummaryItem label="For Entreprenør" value={data.koe.for_entreprenor} />
                </Section>
                
                <Section title="4) BH Svar">
                    <SummaryItem label="Dato for møte" value={data.bh_svar.mote_dato} />
                    <SummaryItem label="Møtereferat" value={data.bh_svar.mote_referat} />

                    <SummaryItem label="Vederlagsvarsel ansett for sent" value={data.bh_svar.vederlag.varsel_for_sent} />
                    {data.bh_svar.vederlag.varsel_for_sent && 
                        <SummaryItem label="Begrunnelse"><p className="whitespace-pre-wrap">{data.bh_svar.vederlag.varsel_for_sent_begrunnelse || '—'}</p></SummaryItem>
                    }
                    <SummaryItem label="Svar på vederlagskrav" value={data.bh_svar.vederlag.bh_svar_vederlag} />
                    <SummaryItem label="Godkjent beløp (NOK)" value={data.bh_svar.vederlag.bh_godkjent_vederlag_belop ? Number(data.bh_svar.vederlag.bh_godkjent_vederlag_belop).toLocaleString('no-NO') : '—'} />
                    <SummaryItem label="Begrunnelse (vederlag)"><p className="whitespace-pre-wrap">{data.bh_svar.vederlag.bh_begrunnelse_vederlag || '—'}</p></SummaryItem>
                    
                    <SummaryItem label="Fristvarsel ansett for sent" value={data.bh_svar.frist.varsel_for_sent} />
                    {data.bh_svar.frist.varsel_for_sent && 
                        <SummaryItem label="Begrunnelse"><p className="whitespace-pre-wrap">{data.bh_svar.frist.varsel_for_sent_begrunnelse || '—'}</p></SummaryItem>
                    }
                    <SummaryItem label="Svar på fristkrav" value={data.bh_svar.frist.bh_svar_frist} />
                    <SummaryItem label="Godkjente dager" value={data.bh_svar.frist.bh_godkjent_frist_dager} />
                    <SummaryItem label="Frist for spesifisering" value={data.bh_svar.frist.bh_frist_for_spesifisering} />
                    <SummaryItem label="Begrunnelse (frist)"><p className="whitespace-pre-wrap">{data.bh_svar.frist.bh_begrunnelse_frist || '—'}</p></SummaryItem>

                    <SummaryItem label="Dato for svar" value={data.bh_svar.sign.dato_svar_bh} />
                    <SummaryItem label="For Byggherre" value={data.bh_svar.sign.for_byggherre} />
                </Section>
            </div>
        </div>
    );
};

export default OppsummeringPanel;