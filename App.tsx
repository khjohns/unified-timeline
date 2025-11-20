import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FormDataModel, Role, BhSvar, Koe } from './types';
import { TABS, INITIAL_FORM_DATA, DEMO_DATA } from './constants';
import Toast from './components/ui/Toast';
import { generatePdfReact } from './utils/pdfGeneratorReact';
import { PktHeader, PktButton, PktTabs, PktTabItem } from '@oslokommune/punkt-react';
import { useSkjemaData } from './hooks/useSkjemaData';
import { useAutoSave } from './hooks/useAutoSave';
import { showToast } from './utils/toastHelpers';
import { api, Modus } from './services/api';

import GrunninfoPanel from './components/panels/GrunninfoPanel';
import VarselPanel from './components/panels/VarselPanel';
import KravKoePanel from './components/panels/KravKoePanel';
import BhSvarPanel from './components/panels/BhSvarPanel';
import OppsummeringPanel from './components/panels/OppsummeringPanel';
import SidePanel from './components/ui/SidePanel';
import SuccessModal from './components/ui/SuccessModal';


const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [toastMessage, setToastMessage] = useState('');

    // URL parameters for POC integration
    const [searchParams] = useSearchParams();
    const sakId = searchParams.get('sakId');
    const modus = searchParams.get('modus') as Modus | null;
    const topicGuid = searchParams.get('topicGuid'); // From Catenda webhook

    // Loading and error states
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [isApiConnected, setIsApiConnected] = useState<boolean | null>(null);

    // Success modal state
    const [successModal, setSuccessModal] = useState<{
        isOpen: boolean;
        type: 'varsel' | 'koe' | 'svar' | 'revidering';
        message?: string;
        nextStep?: string;
        pdfUrl?: string;
    }>({
        isOpen: false,
        type: 'koe'
    });

    // Use custom hooks for state management and auto-save
    const { formData, setFormData, handleInputChange, errors, setErrors } = useSkjemaData(INITIAL_FORM_DATA);

    const loadedData = useAutoSave({
        data: formData,
        storageKey: 'koe_v5_0_draft',
        debounceMs: 1500,
        onSave: () => {
            showToast(setToastMessage, 'Utkast lagret ✓');
        },
    });

    // Check API connectivity on mount
    useEffect(() => {
        const checkApiConnection = async () => {
            const connected = await api.healthCheck();
            setIsApiConnected(connected);
            if (!connected) {
                console.warn('API server not available - running in offline mode');
            }
        };
        checkApiConnection();
    }, []);

    // Load data from API when sakId parameter is present
    useEffect(() => {
        const loadFromApi = async () => {
            if (!sakId) return;

            setIsLoading(true);
            setApiError(null);

            try {
                const response = await api.getCase(sakId, modus || undefined);

                if (response.success && response.data) {
                    setFormData(response.data.formData);
                    showToast(setToastMessage, `Sak ${sakId} lastet fra server`);
                } else {
                    setApiError(response.error || 'Kunne ikke laste sak');
                    // Fall back to localStorage if API fails
                    if (loadedData) {
                        setFormData(loadedData);
                        showToast(setToastMessage, 'API ikke tilgjengelig - bruker lokal lagring');
                    }
                }
            } catch (error) {
                console.error('Failed to load from API:', error);
                setApiError('Nettverksfeil ved lasting av sak');
                // Fall back to localStorage
                if (loadedData) {
                    setFormData(loadedData);
                }
            } finally {
                setIsLoading(false);
            }
        };

        if (sakId && isApiConnected === true) {
            loadFromApi();
        } else if (!sakId && loadedData) {
            // No sakId - load from localStorage
            setFormData(loadedData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sakId, isApiConnected]);

    // Set role based on modus parameter
    useEffect(() => {
        if (modus) {
            const roleMap: Record<Modus, Role> = {
                'varsel': 'TE',
                'koe': 'TE',
                'svar': 'BH',
                'revidering': 'TE',
            };
            const newRole = roleMap[modus];
            if (newRole && formData.rolle !== newRole) {
                setFormData(prev => ({ ...prev, rolle: newRole }));
            }

            // Set initial tab based on modus
            // Tab 0: Grunninfo, Tab 1: Varsel, Tab 2: Krav, Tab 3: BH Svar, Tab 4: Oppsummering
            if (modus === 'varsel') {
                setActiveTab(1); // Varsel tab
            } else if (modus === 'koe' || modus === 'revidering') {
                setActiveTab(2); // Krav tab
            } else if (modus === 'svar') {
                setActiveTab(3); // BH Svar tab
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modus]);

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
            showToast(setToastMessage, 'Vennligst fyll ut alle obligatoriske felt før du går videre');
            return false;
        }

        setErrors({});
        return true;
    };

    const handleDownloadPdf = async () => {
        await generatePdfReact(formData);
    };

    // API submission handlers for POC workflow
    const handleSubmitToApi = async () => {
        if (!validateCurrentTab()) {
            return;
        }

        setIsSubmitting(true);
        setApiError(null);

        try {
            let response;

            if (modus === 'varsel') {
                // TE submitting initial warning
                response = await api.submitVarsel(formData, topicGuid || undefined, sakId || undefined);
            } else if (modus === 'svar' && sakId) {
                // BH submitting response to claim
                response = await api.submitSvar(formData, sakId, topicGuid || undefined);
            } else if (modus === 'revidering' && sakId) {
                // TE submitting revision
                response = await api.submitRevidering(formData, sakId);
            } else {
                // KOE submission (claim)
                response = await api.submitKoe(formData, sakId || undefined, topicGuid || undefined);
            }

            if (response.success && response.data) {
                // Generate and download PDF after successful submission
                const { blob, filename } = await generatePdfReact(formData);

                // Upload PDF to backend for Catenda integration
                const effectiveSakId = response.data.sakId || sakId;
                if (effectiveSakId && isApiConnected) {
                    const pdfResponse = await api.uploadPdf(
                        effectiveSakId,
                        blob,
                        filename,
                        modus || 'koe',
                        topicGuid || undefined
                    );
                    if (pdfResponse.success) {
                        console.log('PDF uploaded successfully');
                    } else {
                        console.warn('PDF upload failed:', pdfResponse.error);
                    }
                }

                // Clear localStorage after successful submission
                localStorage.removeItem('koe_v5_0_draft');

                // Determine next step message
                let nextStepMessage = '';
                if (modus === 'varsel') {
                    nextStepMessage = 'Entreprenør kan nå spesifisere krav (vederlag/frist)';
                } else if (modus === 'koe' || modus === 'revidering') {
                    nextStepMessage = 'Byggherre vil bli varslet og kan svare på kravet';
                } else if (modus === 'svar') {
                    nextStepMessage = 'Entreprenør kan se svaret og sende revidert krav om nødvendig';
                }

                // Show success modal
                setSuccessModal({
                    isOpen: true,
                    type: modus || 'koe',
                    message: response.data.message || 'Skjema sendt til server',
                    nextStep: nextStepMessage,
                    pdfUrl: blob ? URL.createObjectURL(blob) : undefined
                });
            } else {
                setApiError(response.error || 'Kunne ikke sende skjema');
                showToast(setToastMessage, `Feil: ${response.error}`);
            }
        } catch (error) {
            console.error('Submit error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Ukjent feil';
            setApiError(errorMessage);
            showToast(setToastMessage, `Feil ved innsending: ${errorMessage}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Get submit button text based on modus
    const getSubmitButtonText = () => {
        if (isSubmitting) {
            return (
                <span className="flex flex-col">
                    <span>Sender...</span>
                </span>
            );
        }

        // Hent siste revisjon for kontekst
        const sisteKoeIndex = formData.koe_revisjoner.length - 1;
        const sisteKoe = formData.koe_revisjoner[sisteKoeIndex];
        const sisteBhSvarIndex = formData.bh_svar_revisjoner.length - 1;
        const sisteBhSvar = formData.bh_svar_revisjoner[sisteBhSvarIndex];

        switch (modus) {
            case 'varsel': {
                return (
                    <span className="flex flex-col">
                        <span>Send varsel til BH</span>
                        <span className="text-xs opacity-75">Byggherre varsles automatisk</span>
                    </span>
                );
            }
            case 'koe': {
                const beløp = sisteKoe?.vederlag?.krevd_belop;
                const text = beløp ? `Send krav (${beløp} NOK)` : 'Send krav';
                return (
                    <span className="flex flex-col">
                        <span>{text}</span>
                        <span className="text-xs opacity-75">PDF genereres og sendes til BH</span>
                    </span>
                );
            }
            case 'svar': {
                const vederlagStatus = sisteBhSvar?.vederlag?.bh_svar_vederlag;
                const godkjent = vederlagStatus === '100000004'; // Godkjent
                const subtext = godkjent ? '✅ Godkjenner krav' : '⚠️ Krever revisjon';
                return (
                    <span className="flex flex-col">
                        <span>Send svar til TE</span>
                        <span className="text-xs opacity-75">{subtext}</span>
                    </span>
                );
            }
            case 'revidering': {
                const nextRevNr = Number(sisteKoe?.koe_revisjonsnr || 0) + 1;
                return (
                    <span className="flex flex-col">
                        <span>Send revisjon {nextRevNr}</span>
                        <span className="text-xs opacity-75">Oppdatert krav sendes til BH</span>
                    </span>
                );
            }
            default:
                return 'Send';
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
                    {isApiConnected && (
                        <PktButton
                            skin="primary"
                            size="small"
                            onClick={handleSubmitToApi}
                            iconName="arrow-right"
                            variant="icon-right"
                            disabled={isSubmitting}
                        >
                            {getSubmitButtonText()}
                        </PktButton>
                    )}
                </div>
            </div>
        </div>
    );

    // Render loading state
    if (isLoading) {
        return (
            <div className="bg-body-bg min-h-screen text-ink font-sans flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pri mx-auto mb-4"></div>
                    <p className="text-ink-dim">Laster sak {sakId}...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-body-bg min-h-screen text-ink font-sans">
            <PktHeader
                serviceName="Skjema for krav om endringsordre (KOE)"
                user={{ name: formData.rolle === 'TE' ? 'Entreprenør' : 'Byggherren', showName: true }}
                fixed={true}
            >
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

            <main className="pt-24 pb-8 sm:pb-12">
                {/* API Error Banner */}
                {apiError && (
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
                        <div className="bg-red-50 border border-red-200 rounded-md p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-red-700">{apiError}</p>
                                </div>
                                <div className="ml-auto pl-3">
                                    <button
                                        onClick={() => setApiError(null)}
                                        className="text-red-400 hover:text-red-500"
                                    >
                                        <span className="sr-only">Lukk</span>
                                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mode and SakId Info Banner */}
                {(sakId || modus) && (
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <div className="flex items-center gap-4 text-sm">
                                {sakId && (
                                    <span className="text-blue-700">
                                        <strong>Sak:</strong> {sakId}
                                    </span>
                                )}
                                {modus && (
                                    <span className="text-blue-700">
                                        <strong>Modus:</strong> {
                                            modus === 'varsel' ? 'Varsel (Entreprenør)' :
                                            modus === 'koe' ? 'Krav (Entreprenør)' :
                                            modus === 'svar' ? 'Svar (Byggherre)' :
                                            'Revidering (Entreprenør)'
                                        }
                                    </span>
                                )}
                                {isApiConnected === false && (
                                    <span className="text-orange-600 ml-auto">
                                        Offline-modus (API ikke tilgjengelig)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 lg:grid lg:grid-cols-3 lg:gap-12">

                    {/* Hovedkolonne (2/3) - Tabs, panel og knapper */}
                    <div className="lg:col-span-2 space-y-8">
                        {renderTabs()}
                        {renderPanel()}
                        {renderBottomBar()}
                    </div>

                    {/* Sidekolonne (1/3) - Nøkkelinfo (kun på store skjermer) */}
                    <div className="hidden lg:block lg:col-span-1">
                        <SidePanel sak={formData.sak} koeRevisjoner={formData.koe_revisjoner} />
                    </div>

                </div>
            </main>

            {toastMessage && <Toast message={toastMessage} />}

            <SuccessModal
                isOpen={successModal.isOpen}
                onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
                type={successModal.type}
                message={successModal.message}
                nextStep={successModal.nextStep}
                pdfUrl={successModal.pdfUrl}
            />
        </div>
    );
};

export default App;
