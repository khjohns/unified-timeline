import React, { useState, useEffect, useRef } from 'react';
import { FormDataModel, Role, BhSvar, Koe } from './types';
import { TABS, INITIAL_FORM_DATA, DEMO_DATA } from './constants';
import Toast from './components/ui/Toast';
// import { generatePdf } from './utils/pdfGenerator'; // FJERNET
import { generatePdfReact } from './utils/pdfGeneratorReact';
import { PktHeader, PktButton, PktModal, PktTabs, PktTabItem } from '@oslokommune/punkt-react';
import { useSkjemaData } from './hooks/useSkjemaData';
import { useAutoSave } from './hooks/useAutoSave';
import { compareRevisions } from './utils/compareRevisions';

import GrunninfoPanel from './components/panels/GrunninfoPanel';
import VarselPanel from './components/panels/VarselPanel';
import KravKoePanel from './components/panels/KravKoePanel';
import BhSvarPanel from './components/panels/BhSvarPanel';
import OppsummeringPanel from './components/panels/OppsummeringPanel';
import SidePanel from './components/ui/SidePanel';


const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [toastMessage, setToastMessage] = useState('');
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        content: React.ReactNode;
        showConfirm?: boolean;
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: '',
        content: '',
        showConfirm: true,
        onConfirm: () => {},
    });
    const modalRef = useRef<HTMLElement>(null);

    // Use custom hooks for state management and auto-save
    const { formData, setFormData, handleInputChange, errors, setErrors } = useSkjemaData(INITIAL_FORM_DATA);

    const loadedData = useAutoSave({
        data: formData,
        storageKey: 'koe_v5_0_draft',
        debounceMs: 1500,
        onSave: () => {
            setToastMessage('Utkast lagret ✓');
            setTimeout(() => setToastMessage(''), 3000);
        },
    });

    // Load saved data on mount
    useEffect(() => {
        if (loadedData) {
            setFormData(loadedData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run on mount

    useEffect(() => {
        if (formData.rolle === 'BH') {
            document.body.classList.add('bh-active');
        } else {
            document.body.classList.remove('bh-active');
        }
    }, [formData.rolle]);
    
    const handleRoleChange = (newRole: Role) => {
        setFormData(prev => ({ ...prev, rolle: newRole }));
    };

    const openModal = (title: string, content: React.ReactNode, onConfirm?: () => void, showConfirm = true) => {
        setModalConfig({
            isOpen: true,
            title,
            content,
            onConfirm,
            showConfirm,
        });
        // Open the modal using the ref
        setTimeout(() => {
            if (modalRef.current && 'open' in modalRef.current) {
                (modalRef.current as any).open();
            }
        }, 0);
    };

    const closeModal = () => {
        if (modalRef.current && 'close' in modalRef.current) {
            (modalRef.current as any).close();
        }
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };

    const handleModalConfirm = () => {
        if (modalConfig.onConfirm) {
            modalConfig.onConfirm();
        }
        closeModal();
    };

    const handleReset = () => {
    if (window.confirm('Er du sikker på at du vil nullstille skjemaet? Alle data vil gå tapt.')) {
        setFormData(JSON.parse(JSON.stringify(INITIAL_FORM_DATA)));
        setErrors({});
        localStorage.removeItem('koe_v5_0_draft');
        }
    };

    const handleDemo = () => {
    // Valgfritt: Legg til en confirm hvis du vil ha bekreftelse
    if (window.confirm('Dette vil erstatte nåværende data med eksempeldata. Fortsette?')) {
        setFormData(JSON.parse(JSON.stringify(DEMO_DATA)));
        setErrors({});
        }
    };

    const validateCurrentTab = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (activeTab === 0) {
            // Grunninfo validation
            if (!formData.sak.sakstittel.trim()) {
                newErrors['sak.sakstittel'] = 'Sakstittel er påkrevd';
            }
            if (!formData.sak.opprettet_av.trim()) {
                newErrors['sak.opprettet_av'] = 'Opprettet av er påkrevd';
            }
            if (!formData.sak.prosjekt_navn.trim()) {
                newErrors['sak.prosjekt_navn'] = 'Prosjekt er påkrevd';
            }
            if (!formData.sak.kontrakt_referanse.trim()) {
                newErrors['sak.kontrakt_referanse'] = 'Prosjektnummer er påkrevd';
            }
            if (!formData.sak.entreprenor.trim()) {
                newErrors['sak.entreprenor'] = 'Entreprenør er påkrevd';
            }
            if (!formData.sak.byggherre.trim()) {
                newErrors['sak.byggherre'] = 'Byggherre er påkrevd';
            }
        } else if (activeTab === 1) {
            // Varsel validation
            if (!formData.varsel.dato_forhold_oppdaget.trim()) {
                newErrors['varsel.dato_forhold_oppdaget'] = 'Dato forhold oppdaget er påkrevd';
            }
            if (!formData.varsel.dato_varsel_sendt.trim()) {
                newErrors['varsel.dato_varsel_sendt'] = 'Dato varsel sendt er påkrevd';
            }
            if (!formData.varsel.hovedkategori.trim()) {
                newErrors['varsel.hovedkategori'] = 'Hovedkategori er påkrevd';
            }
        } else if (activeTab === 2) {
            // KravKoe validation - validate the last revision
            const sisteKrav = formData.koe_revisjoner[formData.koe_revisjoner.length - 1];
            if (!sisteKrav.koe_revisjonsnr.toString().trim()) {
                newErrors['koe_revisjoner.koe_revisjonsnr'] = 'Revisjonsnummer er påkrevd';
            }
            if (!sisteKrav.dato_krav_sendt.trim()) {
                newErrors['koe_revisjoner.dato_krav_sendt'] = 'Dato krav sendt er påkrevd';
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setToastMessage('Vennligst fyll ut alle obligatoriske felt før du går videre');
            setTimeout(() => setToastMessage(''), 3000);
            return false;
        }

        setErrors({});
        return true;
    };

    // const handleNextTab = () => { ... }; // FJERNET
    // const handlePrevTab = () => { ... }; // FJERNET
    
    const handleDownloadPdf = async () => {
        // if (pdfMethod === 'jspdf') { // FJERNET
        //     generatePdf(formData);
        // } else {
        //     await generatePdfReact(formData);
        // }
        await generatePdfReact(formData); // ENDRET: Kun react-pdf
    };

    const handleCompareRevisions = () => {
        const revisjoner = formData.koe_revisjoner;
        if (revisjoner.length < 2) {
            setToastMessage('Du må ha minst 2 revisjoner for å sammenligne');
            setTimeout(() => setToastMessage(''), 3000);
            return;
        }

        const oldRev = revisjoner[revisjoner.length - 2];
        const newRev = revisjoner[revisjoner.length - 1];
        const changes = compareRevisions(oldRev, newRev);

        if (changes.length === 0) {
            openModal(
                `Sammenligning: Revisjon ${oldRev.koe_revisjonsnr} → ${newRev.koe_revisjonsnr}`,
                <p className="text-muted">Ingen endringer funnet mellom revisjonene.</p>,
                undefined,
                false
            );
        } else {
            openModal(
                `Sammenligning: Revisjon ${oldRev.koe_revisjonsnr} → ${newRev.koe_revisjonsnr}`,
                (
                    <div className="space-y-4">
                        <p className="text-sm text-muted mb-4">Følgende endringer er gjort:</p>
                        <ul className="space-y-3">
                            {changes.map((change, idx) => (
                                <li key={idx} className="border-l-4 border-pri pl-4 py-2 bg-gray-50 rounded">
                                    <div className="font-semibold text-sm">{change.field}</div>
                                    <div className="text-xs text-muted mt-1">
                                        <span className="line-through">{change.oldValue}</span>
                                        {' → '}
                                        <span className="text-pri font-medium">{change.newValue}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ),
                undefined,
                false
            );
        }
    };

    // Helper function to add a new BH svar revision
    const addBhSvarRevisjon = () => {
        const nyttSvar: BhSvar = {
            vederlag: {
                varsel_for_sent: false,
                varsel_for_sent_begrunnelse: '',
                bh_svar_vederlag: '',
                bh_vederlag_metode: '',
                bh_godkjent_vederlag_belop: '',
                bh_begrunnelse_vederlag: '',
            },
            frist: {
                varsel_for_sent: false,
                varsel_for_sent_begrunnelse: '',
                bh_svar_frist: '',
                bh_godkjent_frist_dager: '',
                bh_frist_for_spesifisering: '',
                bh_begrunnelse_frist: '',
            },
            mote_dato: '',
            mote_referat: '',
            sign: {
                dato_svar_bh: '',
                for_byggherre: '',
            },
            status: '300000001', // Utkast
        };

        setFormData(prev => ({
            ...prev,
            bh_svar_revisjoner: [...prev.bh_svar_revisjoner, nyttSvar]
        }));
    };

    // Helper function to add a new Koe revision
    const addKoeRevisjon = () => {
        const sisteKrav = formData.koe_revisjoner[formData.koe_revisjoner.length - 1];
        const nyttKrav: Koe = {
            koe_revisjonsnr: (parseInt(sisteKrav.koe_revisjonsnr) + 1).toString(),
            dato_krav_sendt: '',
            for_entreprenor: '',
            status: '100000001', // Utkast
            vederlag: {
                krav_vederlag: false,
                krav_produktivitetstap: false,
                saerskilt_varsel_rigg_drift: false,
                krav_vederlag_metode: '',
                krav_vederlag_belop: '',
                krav_vederlag_begrunnelse: '',
            },
            frist: {
                krav_fristforlengelse: false,
                krav_frist_type: '',
                krav_frist_antall_dager: '',
                forsinkelse_kritisk_linje: false,
                krav_frist_begrunnelse: '',
            },
        };

        setFormData(prev => ({
            ...prev,
            koe_revisjoner: [...prev.koe_revisjoner, nyttKrav]
        }));
    };

    const renderTabs = () => (
        <div className="pkt-tabs-wrapper">
            <PktTabs>
                {TABS.map((tab, idx) => (
                    <PktTabItem
                        key={tab.label}
                        active={activeTab === idx}
                        // ENDRET: onClick har nå fri navigasjon
                        onClick={() => {
                            setActiveTab(idx);
                            window.scrollTo(0, 0);
                        }}
                        icon={tab.icon}
                        index={idx}
                    >
                        {tab.label}
                    </PktTabItem>
                ))}
            </PktTabs>
        </div>
    );

    const renderPanel = () => {
        const isTeDisabled = formData.rolle === 'BH';
        const panelProps = {
            formData,
            setFormData: handleInputChange,
            errors,
            setActiveTab,
            setToastMessage,
            addBhSvarRevisjon,
            addKoeRevisjon,
        };
        switch(activeTab) {
            case 0: return <GrunninfoPanel {...panelProps} disabled={isTeDisabled} />;
            case 1: return <VarselPanel {...panelProps} disabled={isTeDisabled} />;
            case 2: return <KravKoePanel {...panelProps} disabled={isTeDisabled} />;
            case 3: return <BhSvarPanel {...panelProps} />;
            case 4: return <OppsummeringPanel data={formData} />;
            default: return null;
        }
    };
    
    const renderBottomBar = () => (
        <div className="px-4 sm:px-0" role="navigation" aria-label="Steg navigasjon">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <button
                    onClick={handleReset}
                    className="text-sm text-red-600 hover:text-red-700 hover:underline"
                >
                    Nullstill
                </button>
                <div className="flex gap-3 flex-wrap items-center">
                    
                    {/* FJERNET: PDF-metode dropdown */}
                    
                    <PktButton
                        skin="secondary"
                        size="small"
                        onClick={handleDownloadPdf}
                        iconName="document-pdf"
                        variant="icon-left"
                    >
                        Last ned PDF
                    </PktButton>
                    {formData.koe_revisjoner.length >= 2 && (
                        <PktButton
                            skin="secondary"
                            size="small"
                            onClick={handleCompareRevisions}
                            iconName="refresh"
                            variant="icon-left"
                        >
                            Sammenlign revisjoner
                        </PktButton>
                    )}
                    <PktButton
                        skin="secondary"
                        size="small"
                        onClick={handleDemo}
                        iconName="plus-circle"
                        variant="icon-left"
                    >
                        Eksempel
                    </PktButton>
                    
                    {/* FJERNET: 'Forrige' og 'Neste' knapper */}
                
                </div>
            </div>
        </div>
    );


    // Fil: App.tsx

    return (
        <div className="bg-body-bg min-h-screen text-ink font-sans">
            <PktHeader
                serviceName="Skjema for krav om endringsordre (KOE)"
                user={{ name: formData.rolle === 'TE' ? 'Total Entreprenør' : 'Byggherren', showName: true }}
                
                // Gjort headeren fast
                fixed={true} 
            >
                {/* BH/TE-knappen er flyttet inn her som 'children' */}
                <div className="flex items-center gap-3 ml-4">
                    <span className="text-sm font-medium text-ink-dim hidden sm:inline">Rolle:</span>
                    <div className="isolate inline-flex rounded-md shadow-sm">
                        <button
                            type="button"
                            onClick={() => handleRoleChange('TE')}
                            className={`relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-border-color focus:z-10 ${formData.rolle === 'TE' ? 'bg-pri text-white' : 'bg-white text-ink-dim hover:bg-gray-50'}`}
                        >
                            TE
                        </button>
                        <button
                            type="button"
                            onClick={() => handleRoleChange('BH')}
                            className={`relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-border-color focus:z-10 ${formData.rolle === 'BH' ? 'bg-pri text-white' : 'bg-white text-ink-dim hover:bg-gray-50'}`}
                        >
                            BH
                        </button>
                    </div>
                </div>
            </PktHeader>
            
            {/* FJERNET: Den separate <header>-blokken for tabs */}
    
            {/* ENDRET: 'pt-24' for å gi plass til den faste headeren */}
            <main className="pt-24 pb-8 sm:pb-12">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 lg:grid lg:grid-cols-3 lg:gap-12">

                    {/* Hovedkolonne (2/3) - Tabs, panel og knapper */}
                    <div className="lg:col-span-2 space-y-8">
                        {renderTabs()}
                        {renderPanel()}
                        {renderBottomBar()}
                    </div>

                    {/* Sidekolonne (1/3) - Nøkkelinfo (kun på store skjermer) */}
                    <div className="hidden lg:block lg:col-span-1">
                        <SidePanel sak={formData.sak} />
                    </div>

                </div>
            </main>
            
            {toastMessage && <Toast message={toastMessage} />}
            <PktModal
                ref={modalRef}
                headingText={modalConfig.title}
                size="medium"
                variant="dialog"
            >
                <div className="mb-6">{modalConfig.content}</div>
                <div className="flex justify-end gap-3">
                    <PktButton
                        skin="secondary"
                        onClick={closeModal}
                    >
                        {modalConfig.showConfirm ? 'Avbryt' : 'Lukk'}
                    </PktButton>
                    {modalConfig.showConfirm && (
                        <PktButton
                            skin="primary"
                            onClick={handleModalConfirm}
                        >
                            Bekreft
                        </PktButton>
                    )}
                </div>
            </PktModal>
        </div>
    );
};

export default App;
