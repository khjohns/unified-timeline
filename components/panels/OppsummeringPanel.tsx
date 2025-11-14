import React from 'react';
import { FormDataModel } from '../../types';
import { PktAccordion, PktAccordionItem, PktTag } from '@oslokommune/punkt-react';
import { TABS } from '../../constants';
import { getStatusLabel, getStatusSkin } from '../../utils/statusHelpers';

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

const SubHeader: React.FC<{ title: string }> = ({ title }) => (
    <h4 className="text-md font-semibold text-ink-dim mt-6 mb-2 pb-1 border-b border-border-color">
        {title}
    </h4>
);

const OppsummeringPanel: React.FC<OppsummeringPanelProps> = ({ data }) => {
    const { koe_revisjoner = [], bh_svar_revisjoner = [] } = data;

    return (
        <div className="space-y-8">
            <PktAccordion
                skin="outlined"
                compact>
                {/* Sak */}
                <PktAccordionItem
                    id="oppsummering-grunninfo"
                    title={`1) ${TABS[0].label}`}
                >
                    <div className="p-4">
                        <dl className="divide-y divide-border-color">
                            <SummaryItem label="Sak-ID" value={data.sak.sak_id_display} />
                            <SummaryItem label="Sakstittel" value={data.sak.sakstittel} />
                            <SummaryItem label="Opprettet dato" value={data.sak.opprettet_dato} />
                            <SummaryItem label="Opprettet av" value={data.sak.opprettet_av} />
                            <SummaryItem label="Prosjekt" value={data.sak.prosjekt_navn} />
                            <SummaryItem label="Prosjektnummer" value={data.sak.kontrakt_referanse} />
                            <SummaryItem label="Entreprenør (TE)" value={data.sak.entreprenor} />
                            <SummaryItem label="Byggherre (BH)" value={data.sak.byggherre} />
                        </dl>
                    </div>
                </PktAccordionItem>

                {/* Varsel */}
                <PktAccordionItem
                    id="oppsummering-varsel"
                    title={`2) ${TABS[1].label}`}
                >
                    <div className="p-4">
                        <dl className="divide-y divide-border-color">
                            <SummaryItem label="Dato forhold oppdaget" value={data.varsel.dato_forhold_oppdaget} />
                            <SummaryItem label="Dato varsel sendt" value={data.varsel.dato_varsel_sendt} />
                            <SummaryItem label="Hovedkategori" value={data.varsel.hovedkategori} />
                            <SummaryItem label="Underkategori" value={data.varsel.underkategori} />
                            <SummaryItem label="Metode for varsling" value={data.varsel.varsel_metode} />
                            <SummaryItem label="Beskrivelse"><p className="whitespace-pre-wrap">{data.varsel.varsel_beskrivelse || '—'}</p></SummaryItem>
                        </dl>
                    </div>
                </PktAccordionItem>

                {/* Krav */}
                {koe_revisjoner.length === 0 ? (
                    <PktAccordionItem id="oppsummering-krav-ingen" title={`3) ${TABS[2].label}`} disabled>
                         <div className="p-4"><p className="text-muted">Ingen krav registrert.</p></div>
                    </PktAccordionItem>
                ) : (
                    koe_revisjoner.map((koe, index) => (
                        <PktAccordionItem
                            key={index}
                            id={`oppsummering-krav-${index}`}
                            title={`3) ${TABS[2].label} (revisjonsnr. ${koe.koe_revisjonsnr})`}
                            defaultOpen={index === koe_revisjoner.length - 1}
                        >
                            <div className="p-4">
                                <dl className="divide-y divide-border-color">
                                    <SummaryItem label="Revisjonsnummer" value={koe.koe_revisjonsnr} />
                                    <SummaryItem label="Status">
                                        <PktTag skin={getStatusSkin(koe.status)}>
                                            {getStatusLabel(koe.status)}
                                        </PktTag>
                                    </SummaryItem>
                                    <SummaryItem label="Dato krav sendt" value={koe.dato_krav_sendt} />

                                    {koe.vederlag.krav_vederlag && <SubHeader title="Vederlagskrav" />}
                                    <SummaryItem label="Krav om vederlagsjustering" value={koe.vederlag.krav_vederlag} />
                                    {koe.vederlag.krav_vederlag && <>
                                        <SummaryItem label="Krav om produktivitetstap" value={koe.vederlag.krav_produktivitetstap} />
                                        <SummaryItem label="Særskilt rigg/drift" value={koe.vederlag.saerskilt_varsel_rigg_drift} />
                                        <SummaryItem label="Oppgjørsmetode" value={koe.vederlag.krav_vederlag_metode} />
                                        <SummaryItem label="Beløp (NOK)" value={koe.vederlag.krav_vederlag_belop ? Number(koe.vederlag.krav_vederlag_belop).toLocaleString('no-NO') : '—'} />
                                        <SummaryItem label="Begrunnelse/kalkyle"><p className="whitespace-pre-wrap">{koe.vederlag.krav_vederlag_begrunnelse || '—'}</p></SummaryItem>
                                    </>}

                                    {koe.frist.krav_fristforlengelse && <SubHeader title="Fristkrav" />}
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
                    ))
                )}

                {/* BH Svar */}
                {bh_svar_revisjoner.length === 0 ? (
                    <PktAccordionItem id="oppsummering-svar-ingen" title={`4) ${TABS[3].label}`} disabled>
                        <div className="p-4"><p className="text-muted">Ingen svar registrert.</p></div>
                    </PktAccordionItem>
                ) : (
                    bh_svar_revisjoner.map((bh_svar, index) => {
                        const tilhorendeKoe = koe_revisjoner[Math.min(index, koe_revisjoner.length - 1)];
                        return (
                            <PktAccordionItem
                                key={index}
                                id={`oppsummering-svar-${index}`}
                                title={`4) ${TABS[3].label} (revisjonsnr. ${tilhorendeKoe?.koe_revisjonsnr ?? index})`}
                                defaultOpen={index === bh_svar_revisjoner.length - 1}
                            >
                                <div className="p-4">
                                    <dl className="divide-y divide-border-color">
                                        {tilhorendeKoe?.vederlag.krav_vederlag && <>
                                            <SubHeader title="Svar på vederlagskrav" />
                                            <SummaryItem label="Vederlagsvarsel ansett for sent" value={bh_svar.vederlag.varsel_for_sent} />
                                            {bh_svar.vederlag.varsel_for_sent &&
                                                <SummaryItem label="Begrunnelse"><p className="whitespace-pre-wrap">{bh_svar.vederlag.varsel_for_sent_begrunnelse || '—'}</p></SummaryItem>
                                            }
                                            <SummaryItem label="Svar på vederlagskrav" value={bh_svar.vederlag.bh_svar_vederlag} />
                                            <SummaryItem label="Godkjent beløp (NOK)" value={bh_svar.vederlag.bh_godkjent_vederlag_belop ? Number(bh_svar.vederlag.bh_godkjent_vederlag_belop).toLocaleString('no-NO') : '—'} />
                                            <SummaryItem label="Begrunnelse (vederlag)"><p className="whitespace-pre-wrap">{bh_svar.vederlag.bh_begrunnelse_vederlag || '—'}</p></SummaryItem>
                                        </>}

                                        {tilhorendeKoe?.frist.krav_fristforlengelse && <>
                                            <SubHeader title="Svar på fristkrav" />
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
                    })
                )}
            </PktAccordion>
        </div>
    );
};

export default OppsummeringPanel;
