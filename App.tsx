import React, { useState, useEffect, useRef } from 'react';
import { FormDataModel, Role, BhSvar, Koe } from './types';
import { TABS, INITIAL_FORM_DATA, DEMO_DATA } from './constants';
import Toast from './components/ui/Toast';
import { generatePdf } from './utils/pdfGenerator';
import { generatePdfReact } from './utils/pdfGeneratorReact';
import { PktHeader, PktButton, PktModal, PktTabs, PktTabItem } from '@oslokommune/punkt-react';
import { useSkjemaData } from './hooks/useSkjemaData';
import { useAutoSave } from './hooks/useAutoSave';

import GrunninfoPanel from './components/panels/GrunninfoPanel';
import VarselPanel from './components/panels/VarselPanel';
import KravKoePanel from './components/panels/KravKoePanel';
import BhSvarPanel from './components/panels/BhSvarPanel';
import OppsummeringPanel from './components/panels/OppsummeringPanel';


const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [formStatus, setFormStatus] = useState<'varsel' | 'krav' | 'svar'>('varsel');
    const [toastMessage, setToastMessage] = useState('');
    const [pdfMethod, setPdfMethod] = useState<'jspdf' | 'react-pdf'>('jspdf');
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
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

    const openModal = (title: string, message: string, onConfirm: () => void) => {
        setModalConfig({
            isOpen: true,
            title,
            message,
            onConfirm,
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
        modalConfig.onConfirm();
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

    const handleNextTab = () => {
        if (validateCurrentTab()) {
            setActiveTab(prev => Math.min(prev + 1, TABS.length - 1));
            window.scrollTo(0, 0);
        }
    };

    const handlePrevTab = () => {
        setActiveTab(prev => Math.max(prev - 1, 0));
        window.scrollTo(0, 0);
    };
    
    const handleDownloadPdf = async () => {
        if (pdfMethod === 'jspdf') {
            generatePdf(formData);
        } else {
            await generatePdfReact(formData);
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
            formStatus,
            setFormStatus,
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
        <div className="mt-8 px-4 sm:px-0" role="navigation" aria-label="Steg navigasjon">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <button
                    onClick={handleReset}
                    className="text-sm text-red-600 hover:text-red-700 hover:underline"
                >
                    Nullstill
                </button>
                <div className="flex gap-3 flex-wrap items-center">
                    <div className="flex items-center gap-2">
                        <label htmlFor="pdf-method" className="text-sm text-muted">
                            PDF-metode:
                        </label>
                        <select
                            id="pdf-method"
                            value={pdfMethod}
                            onChange={(e) => setPdfMethod(e.target.value as 'jspdf' | 'react-pdf')}
                            className="text-sm border border-border-color rounded px-2 py-1"
                        >
                            <option value="jspdf">jsPDF (nåværende)</option>
                            <option value="react-pdf">@react-pdf/renderer (ny)</option>
                        </select>
                    </div>
                    <PktButton
                        skin="secondary"
                        size="small"
                        onClick={handleDownloadPdf}
                        iconName="document-pdf"
                        variant="icon-left"
                    >
                        Last ned PDF
                    </PktButton>
                    <PktButton
                        skin="secondary"
                        size="small"
                        onClick={handleDemo}
                        iconName="plus-circle"
                        variant="icon-left"
                    >
                        Eksempel
                    </PktButton>
                    {activeTab > 0 && (
                        <PktButton
                            skin="secondary"
                            size="medium"
                            onClick={handlePrevTab}
                            iconName="chevron-left"
                            variant="icon-left"
                        >
                            Forrige
                        </PktButton>
                    )}
                    {activeTab < TABS.length - 1 && (
                        <PktButton
                            skin="primary"
                            size="medium"
                            onClick={handleNextTab}
                            iconName="chevron-right"
                            variant="icon-right"
                        >
                            Neste
                        </PktButton>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="bg-body-bg min-h-screen text-ink font-sans">
            <PktHeader
                serviceName="Skjema for krav om endringsordre (KOE)"
                user={{ name: formData.rolle === 'TE' ? 'Total Entreprenør' : 'Byggherren', showName: true }}
                
                // 1. GJORDE DENNE STICKY/FAST:
                // Dette blir den eneste faste topplinjen.
                fixed={true} 
            >
                {/* BH/TE-knappen bor her som 'children' */}
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
            
            {/* 2. FJERNET DEN SEPARATE <header>-BLOKKEN for tabs */}
    
            {/* 3. OPPDATERT <main>:
                - Lagt til 'pt-24' (padding-top) for å dytte alt innholdet
                  ned, slik at det starter *under* den faste PktHeader-en.
            */}
            <main className="pt-24 pb-8 sm:pb-12">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                
                    {/* 4. FLYTTET TABS INN HIT:
                        - Ligger nå inne i 'max-w-4xl'-containeren.
                        - Får automatisk riktig bredde.
                        - Lagt til 'mb-8' (margin-bottom) for avstand til panelet.
                    */}
                    <div className="mb-8">
                        {renderTabs()}
                    </div>

                    {renderPanel()}
                    {renderBottomBar()}
                </div> 
            </main>
            
            {toastMessage && <Toast message={toastMessage} />}
            {modalConfig.isOpen && (
                <PktModal
                    ref={modalRef}
                    headingText={modalConfig.title}
                    size="small"
                    variant="dialog"
                >
                    <p className="mb-6">{modalConfig.message}</p>
                    <div className="flex justify-end gap-3">
                        <PktButton
                            skin="secondary"
                            onClick={closeModal}
                        >
                            Avbryt
                        </PktButton>
                        <PktButton
                            skin="primary"
                            onClick={handleModalConfirm}
                        >
                            Bekreft
                        </PktButton>
                    </div>
                </PktModal>
            )}
        </div>
    );
};

export default App;
