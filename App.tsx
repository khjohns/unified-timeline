import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import { FormDataModel, Role, BhSvar, Koe } from './types';
import { TABS, INITIAL_FORM_DATA, DEMO_DATA } from './constants';
import Toast from './components/ui/Toast';
import { generatePdf } from './utils/pdfGenerator';
import { PktHeader, PktButton, PktModal, PktTabs, PktTabItem } from '@oslokommune/punkt-react';

import GrunninfoPanel from './components/panels/GrunninfoPanel';
import VarselPanel from './components/panels/VarselPanel';
import KravKoePanel from './components/panels/KravKoePanel';
import BhSvarPanel from './components/panels/BhSvarPanel';
import OppsummeringPanel from './components/panels/OppsummeringPanel';


const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [formData, setFormData] = useState<FormDataModel>(INITIAL_FORM_DATA);
    const [formStatus, setFormStatus] = useState<'varsel' | 'krav' | 'svar'>('varsel');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [toastMessage, setToastMessage] = useState('');
    const debounceTimeoutRef = useRef<number | null>(null);
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

    // Load from localStorage on initial mount
    useEffect(() => {
        try {
            const savedDraft = localStorage.getItem('koe_v5_0_draft');
            if (savedDraft) {
                const parsedData = JSON.parse(savedDraft);
                if (!parsedData.sak.opprettet_dato) {
                    parsedData.sak.opprettet_dato = new Date().toISOString().split('T')[0];
                }

                // Migrate old data structure to new revision-based structure
                if (parsedData.koe && !parsedData.koe_revisjoner) {
                    // Old structure detected, convert to new
                    parsedData.koe_revisjoner = [parsedData.koe];
                    delete parsedData.koe;
                }
                if (parsedData.bh_svar && !parsedData.bh_svar_revisjoner) {
                    // Old structure detected, convert to new
                    parsedData.bh_svar_revisjoner = [parsedData.bh_svar];
                    delete parsedData.bh_svar;
                }

                // Ensure new Varsel fields exist
                if (!parsedData.varsel.varsel_metode) {
                    parsedData.varsel.varsel_metode = '';
                }
                if (!parsedData.varsel.signatur_te) {
                    parsedData.varsel.signatur_te = '';
                }

                setFormData(parsedData);
            }
        } catch (error) {
            console.error("Failed to load draft from localStorage", error);
        }
    }, []);

    // Auto-save with debounce on formData change
    useEffect(() => {
        if (JSON.stringify(formData) === JSON.stringify(INITIAL_FORM_DATA)) {
            return;
        }
        
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = window.setTimeout(() => {
            localStorage.setItem('koe_v5_0_draft', JSON.stringify(formData));
            setToastMessage('Utkast lagret ✓');
            setTimeout(() => setToastMessage(''), 3000);
        }, 1500);

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [formData]);

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
    
    const handleInputChange = (section: keyof Omit<FormDataModel, 'versjon' | 'rolle'>, field: string, value: any, index?: number) => {
        setFormData(prev => {
            const path = field.split('.');

            // Handle array-based sections (koe_revisjoner, bh_svar_revisjoner)
            if (section === 'koe_revisjoner' || section === 'bh_svar_revisjoner') {
                const arraySection = prev[section] as any[];
                const targetIndex = index !== undefined ? index : arraySection.length - 1;

                if (path.length === 1) {
                    const updatedArray = [...arraySection];
                    updatedArray[targetIndex] = {
                        ...updatedArray[targetIndex],
                        [field]: value,
                    };
                    return { ...prev, [section]: updatedArray };
                }

                if (path.length === 2) {
                    const [nestedObjectKey, nestedFieldKey] = path;
                    const updatedArray = [...arraySection];
                    updatedArray[targetIndex] = {
                        ...updatedArray[targetIndex],
                        [nestedObjectKey]: {
                            ...updatedArray[targetIndex][nestedObjectKey],
                            [nestedFieldKey]: value,
                        },
                    };
                    return { ...prev, [section]: updatedArray };
                }
            }

            // Handle non-array sections (sak, varsel)
            if (path.length === 1) {
                return {
                    ...prev,
                    [section]: {
                        ...prev[section],
                        [field]: value,
                    },
                };
            }

            if (path.length === 2) {
                const [nestedObjectKey, nestedFieldKey] = path;
                return {
                    ...prev,
                    [section]: {
                        ...prev[section],
                        [nestedObjectKey]: {
                            ...(prev[section] as any)[nestedObjectKey],
                            [nestedFieldKey]: value,
                        },
                    },
                };
            }
            return prev;
        });

        const fieldId = `${section}.${field}`.replace(/\./g, '_');
        if (errors[fieldId]) {
            setErrors(prev => {
                const newErrors = {...prev};
                delete newErrors[fieldId];
                return newErrors;
            });
        }
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
    
    const handleDownloadPdf = () => {
        generatePdf(formData);
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
                <div className="flex gap-3 flex-wrap">
                    <PktButton
                        skin="secondary"
                        size="small"
                        onClick={handleDownloadPdf}
                        iconName="document-pdf"
                        variant="icon-left"
                    >
                        PDF
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
                            secondIconName="chevron-right"
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
            />
            <header className="bg-card-bg border-b border-border-color sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div>
                            <h1 className="text-xl font-semibold flex gap-2.5 items-center">
                                Skjema for krav om endringsordre (KOE)
                                <span className="text-muted font-medium bg-gray-100 py-0.5 px-2.5 rounded-full border border-border-color text-xs">v5.0</span>
                            </h1>
                            <p className="subtitle text-sm text-muted mt-1">NS 8407:2011‑konsistent TE → BH to‑trinns flyt • Datamodell 3.3</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-ink-dim">Rolle:</span>
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
                    </div>
                     <div className="mt-2">
                        {renderTabs()}
                    </div>
                </div>
            </header>
            <main className="pt-32 pb-8 sm:pb-12">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
