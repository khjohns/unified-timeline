import React from 'react';
import { FormDataModel } from '../../types';
import { PktAccordion, PktAccordionItem } from '@oslokommune/punkt-react';

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
    const { koe_revisjoner = [], bh_svar_revisjoner = [] } = data;

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
                    <SummaryItem label="Metode for varsling" value={data.varsel.varsel_metode} />
                    <SummaryItem label="Beskrivelse"><p className="whitespace-pre-wrap">{data.varsel.varsel_beskrivelse || '—'}</p></SummaryItem>
                </Section>

                <div>
                    <h3 className="text-lg font-semibold leading-6 text-ink mb-3 border-b pb-2">3) Krav (KOE) - Alle revisjoner</h3>
                    {koe_revisjoner.length === 0 ? (
                        <p className="text-muted">Ingen krav registrert.</p>
                    ) : (
                        <PktAccordion skin="outlined">
                            {koe_revisjoner.map((koe, index) => (
                                <PktAccordionItem
                                    key={index}
                                    id={`oppsummering-krav-${index}`}
                                    title={`Krav (Revisjon ${koe.koe_revisjonsnr})`}
                                    defaultOpen={index === koe_revisjoner.length - 1}
                                >
                                    <div className="p-4">
                                        <dl className="divide-y divide-border-color">
                                            <SummaryItem label="Revisjonsnummer" value={koe.koe_revisjonsnr} />
                                            <SummaryItem label="Dato krav sendt" value={koe.dato_krav_sendt} />

                                            <SummaryItem label="Krav om vederlagsjustering" value={koe.vederlag.krav_vederlag} />
                                            {koe.vederlag.krav_vederlag && <>
                                                <SummaryItem label="Krav om produktivitetstap" value={koe.vederlag.krav_produktivitetstap} />
                                                <SummaryItem label="Særskilt rigg/drift" value={koe.vederlag.saerskilt_varsel_rigg_drift} />
                                                <SummaryItem label="Oppgjørsmetode" value={koe.vederlag.krav_vederlag_metode} />
                                                <SummaryItem label="Beløp (NOK)" value={koe.vederlag.krav_vederlag_belop ? Number(koe.vederlag.krav_vederlag_belop).toLocaleString('no-NO') : '—'} />
                                                <SummaryItem label="Begrunnelse/kalkyle"><p className="whitespace-pre-wrap">{koe.vederlag.krav_vederlag_begrunnelse || '—'}</p></SummaryItem>
                                            </>}

                                            <SummaryItem label="Krav om fristforlengelse" value={koe.frist.krav_fristforlengelse} />
                                            {koe.frist.krav_fristforlengelse && <>
                                                <SummaryItem label="Fristtype" value={koe.frist.krav_frist_type} />
                                                <SummaryItem label="Antall dager" value={koe.frist.krav_frist_antall_dager} />
                                                <SummaryItem label="Påvirker kritisk linje" value={koe.frist.forsinkelse_kritisk_linje} />
                                                <SummaryItem label="Begrunnelse"><p className="whitespace-pre-wrap">{koe.frist.krav_frist_begrunnelse || '—'}</p></SummaryItem>
                                            </>}
                                            <SummaryItem label="For Entreprenør" value={koe.for_entreprenor} />
                                        </dl>
                                    </div>
                                </PktAccordionItem>
                            ))}
                        </PktAccordion>
                    )}
                </div>

                <div>
                    <h3 className="text-lg font-semibold leading-6 text-ink mb-3 border-b pb-2">4) BH Svar - Alle revisjoner</h3>
                    {bh_svar_revisjoner.length === 0 ? (
                        <p className="text-muted">Ingen svar registrert.</p>
                    ) : (
                        <PktAccordion skin="outlined">
                            {bh_svar_revisjoner.map((bh_svar, index) => {
                                const tilhorendeKoe = koe_revisjoner[Math.min(index, koe_revisjoner.length - 1)];
                                return (
                                    <PktAccordionItem
                                        key={index}
                                        id={`oppsummering-svar-${index}`}
                                        title={`BH Svar til Revisjon ${tilhorendeKoe?.koe_revisjonsnr ?? index}`}
                                        defaultOpen={index === bh_svar_revisjoner.length - 1}
                                    >
                                        <div className="p-4">
                                            <dl className="divide-y divide-border-color">
                                                <SummaryItem label="Dato for møte" value={bh_svar.mote_dato} />
                                                <SummaryItem label="Møtereferat" value={bh_svar.mote_referat} />

                                                {tilhorendeKoe?.vederlag.krav_vederlag && <>
                                                    <SummaryItem label="Vederlagsvarsel ansett for sent" value={bh_svar.vederlag.varsel_for_sent} />
                                                    {bh_svar.vederlag.varsel_for_sent &&
                                                        <SummaryItem label="Begrunnelse"><p className="whitespace-pre-wrap">{bh_svar.vederlag.varsel_for_sent_begrunnelse || '—'}</p></SummaryItem>
                                                    }
                                                    <SummaryItem label="Svar på vederlagskrav" value={bh_svar.vederlag.bh_svar_vederlag} />
                                                    <SummaryItem label="Godkjent beløp (NOK)" value={bh_svar.vederlag.bh_godkjent_vederlag_belop ? Number(bh_svar.vederlag.bh_godkjent_vederlag_belop).toLocaleString('no-NO') : '—'} />
                                                    <SummaryItem label="Begrunnelse (vederlag)"><p className="whitespace-pre-wrap">{bh_svar.vederlag.bh_begrunnelse_vederlag || '—'}</p></SummaryItem>
                                                </>}

                                                {tilhorendeKoe?.frist.krav_fristforlengelse && <>
                                                    <SummaryItem label="Fristvarsel ansett for sent" value={bh_svar.frist.varsel_for_sent} />
                                                    {bh_svar.frist.varsel_for_sent &&
                                                        <SummaryItem label="Begrunnelse"><p className="whitespace-pre-wrap">{bh_svar.frist.varsel_for_sent_begrunnelse || '—'}</p></SummaryItem>
                                                    }
                                                    <SummaryItem label="Svar på fristkrav" value={bh_svar.frist.bh_svar_frist} />
                                                    <SummaryItem label="Godkjente dager" value={bh_svar.frist.bh_godkjent_frist_dager} />
                                                    <SummaryItem label="Frist for spesifisering" value={bh_svar.frist.bh_frist_for_spesifisering} />
                                                    <SummaryItem label="Begrunnelse (frist)"><p className="whitespace-pre-wrap">{bh_svar.frist.bh_begrunnelse_frist || '—'}</p></SummaryItem>
                                                </>}

                                                <SummaryItem label="Dato for svar" value={bh_svar.sign.dato_svar_bh} />
                                                <SummaryItem label="For Byggherre" value={bh_svar.sign.for_byggherre} />
                                            </dl>
                                        </div>
                                    </PktAccordionItem>
                                );
                            })}
                        </PktAccordion>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OppsummeringPanel;
