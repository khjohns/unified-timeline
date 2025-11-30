import React, { useState, useEffect, lazy, Suspense, useCallback, useMemo, useRef } from 'react';
import { FormDataModel, Role, BhSvar, Koe } from './types';
import { TABS, INITIAL_FORM_DATA, DEMO_DATA } from './constants';
import Toast from './components/ui/Toast';
import { generatePdfReact, generatePdfBlob } from './utils/pdfGeneratorReact';
import { PktHeader, PktButton, PktTabs, PktTabItem, PktAlert } from '@oslokommune/punkt-react';
import { useSkjemaData } from './hooks/useSkjemaData';
import { useAutoSave } from './hooks/useAutoSave';
import { useUrlParams } from './hooks/useUrlParams';
import { useApiConnection } from './hooks/useApiConnection';
import { useFormSubmission } from './hooks/useFormSubmission';
import { showToast } from './utils/toastHelpers';
import { focusOnField } from './utils/focusHelpers';
import { logger } from './utils/logger';
import { api, Modus } from './services/api';
import { SAK_STATUS } from './utils/statusHelpers';
import { validationService } from './services/validationService';
import { submissionService } from './services/submissionService';

// Lazy load panels for better performance
const VarselPanel = lazy(() => import('./components/panels/VarselPanel'));
const KravKoePanel = lazy(() => import('./components/panels/KravKoePanel'));
const BhSvarPanel = lazy(() => import('./components/panels/BhSvarPanel'));
const TestOversiktPanel = lazy(() => import('./components/panels/TestOversiktPanel'));
const PDFPreviewModal = lazy(() => import('./components/ui/PDFPreviewModal'));

import SidePanel from './components/ui/SidePanel';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import ConfirmDialog from './components/ui/ConfirmDialog';

// Loading spinner for lazy-loaded components
const PanelLoader: React.FC = () => (
    <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pri"></div>
    </div>
);

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [toastMessage, setToastMessage] = useState('');
    const [confirmDialog, setConfirmDialog] = useState<{
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

    // URL parameters (extracted to custom hook)
    const { magicToken, sakId: directSakId, modus, topicGuid: initialTopicGuid, isFromMagicLink, clearMagicToken } = useUrlParams();

    // Internal state for the resolved sakId and topicGuid
    // Check sessionStorage first to survive HMR reloads (but only if we're still in magic link context)
    const savedSakId = sessionStorage.getItem('currentSakId');
    const [internalSakId, setInternalSakId] = useState<string | null>(() => {
        // Only use savedSakId if we're still in magic link context
        if (isFromMagicLink && savedSakId) {
            return savedSakId;
        }
        return directSakId;
    });
    const [topicGuid, setTopicGuid] = useState<string | null>(initialTopicGuid);

    // Loading and error states
    const [isLoading, setIsLoading] = useState(!!magicToken); // Start loading if token is present
    const [apiError, setApiError] = useState<string | null>(null);

    // API connection state (extracted to custom hook)
    const { isApiConnected } = useApiConnection();

    // PDF Preview modal state
    const [pdfPreviewModal, setPdfPreviewModal] = useState<{
        isOpen: boolean;
        type: 'varsel' | 'koe' | 'svar' | 'revidering';
        message?: string;
        nextStep?: string;
        pdfBlob: Blob | null;
    }>({
        isOpen: false,
        type: 'koe',
        pdfBlob: null
    });

    // Use custom hooks for state management and auto-save
    const { formData, setFormData, handleInputChange, errors, setErrors } = useSkjemaData(INITIAL_FORM_DATA);

    const loadedData = useAutoSave({
        data: formData,
        storageKey: 'koe_v5_0_draft',
        debounceMs: 1500,
        onSave: () => {
            showToast(setToastMessage, 'Utkast lagret');
        },
    });

    // Form submission hook (handles validation, PDF generation, API submission)
    const submission = useFormSubmission({
        formData,
        setFormData,
        modus,
        sakId: internalSakId,
        topicGuid,
        activeTab,
        errors,
        setErrors,
        setToastMessage,
        isApiConnected,
        onPreview: (blob, type) => {
            setPdfPreviewModal({
                isOpen: true,
                type,
                pdfBlob: blob,
            });
        },
        onSuccess: () => {
            setPdfPreviewModal({ isOpen: false, type: 'koe', pdfBlob: null });
        },
    });

    // Verify magic token if present
    useEffect(() => {
        const verifyToken = async () => {
            if (!magicToken || isApiConnected === false) return;

            setIsLoading(true);
            setApiError(null);

            // Clear localStorage when using magic link to prevent old data from interfering
            localStorage.removeItem('koe_v5_0_draft');

            const response = await api.verifyMagicToken(magicToken);

            if (response.success && response.data?.sakId) {
                const sakId = response.data.sakId;
                setInternalSakId(sakId);
                // Store sakId in sessionStorage to survive HMR reloads
                sessionStorage.setItem('currentSakId', sakId);
                // Clean the URL, remove the token
                clearMagicToken();
            } else {
                setApiError(response.error || 'Lenken er ugyldig eller utløpt.');
                setIsLoading(false);
            }
        };

        if (magicToken && isApiConnected) {
            verifyToken();
        }
    }, [magicToken, isApiConnected, clearMagicToken]);


    // Load data from API when an internalSakId is available
    useEffect(() => {
        const loadFromApi = async () => {
            if (!internalSakId) return;

            // Only start loading if not already loading from token verification
            if (!magicToken) setIsLoading(true);
            setApiError(null);

            try {
                const response = await api.getCase(internalSakId, modus || undefined);

                if (response.success && response.data) {
                    // Ensure rolle is set to 'TE' if missing (defensive programming)
                    const loadedFormData = response.data.formData;
                    if (!loadedFormData.rolle) {
                        loadedFormData.rolle = 'TE';
                    }

                    // Set rolle based on modus if modus is provided
                    if (modus) {
                        const roleMap: Record<Modus, Role> = {
                            'varsel': 'TE',
                            'koe': 'TE',
                            'svar': 'BH',
                            'revidering': 'TE',
                        };
                        loadedFormData.rolle = roleMap[modus];
                    }

                    // Mark magic link as consumed in sessionStorage
                    // We keep it to survive Vite HMR reloads during development
                    sessionStorage.setItem('isFromMagicLink', 'consumed');

                    setFormData(loadedFormData);
                    setTopicGuid(response.data.topicGuid); // Persist topicGuid in state

                    // If modus is not in URL (e.g. from magic link), set it from loaded data
                    const loadedModus = loadedFormData.sak?.modus as Modus | undefined;
                    if (!modus && loadedModus) {
                        // Add modus to URL so submit logic and role mapping work correctly
                        searchParams.set('modus', loadedModus);
                        setSearchParams(searchParams, { replace: true });
                    }

                    // Set initial tab based on modus
                    if (modus === 'varsel') {
                        setActiveTab(0);
                    } else if (modus === 'koe' || modus === 'revidering') {
                        setActiveTab(1);
                    } else if (modus === 'svar') {
                        setActiveTab(2);
                    }

                    showToast(setToastMessage, `Sak ${internalSakId} lastet fra server`);
                } else {
                    setApiError(response.error || 'Kunne ikke laste sak');
                    // Only use localStorage as fallback if we're not coming from a magic link
                    if (loadedData && !isFromMagicLink) {
                        setFormData(loadedData);
                        showToast(setToastMessage, 'API ikke tilgjengelig - bruker lokal lagring');
                    }
                }
            } catch (error) {
                logger.error('Failed to load from API:', error);
                setApiError('Nettverksfeil ved lasting av sak');
                // Only use localStorage as fallback if we're not coming from a magic link
                if (loadedData && !isFromMagicLink) {
                    setFormData(loadedData);
                }
            } finally {
                setIsLoading(false);
            }
        };

        if (internalSakId && isApiConnected === true) {
            loadFromApi();
        } else if (!internalSakId && !isFromMagicLink && loadedData && isApiConnected !== null) {
            // No sakId and not using magic link - load from localStorage
            setFormData(loadedData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [internalSakId, isApiConnected]);

    // Set role and tab when modus changes (fallback for when data isn't loaded from API)
    useEffect(() => {
        // Skip if loading, if we have a sakId (role is set during API load), or if we came from magic link (waiting for data load)
        if (isLoading || internalSakId || isFromMagicLink) {
            return;
        }

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
            if (modus === 'varsel') {
                setActiveTab(0);
            } else if (modus === 'koe' || modus === 'revidering') {
                setActiveTab(1);
            } else if (modus === 'svar') {
                setActiveTab(2);
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
        setConfirmDialog({
            isOpen: true,
            title: 'Nullstille skjemaet?',
            message: 'Er du sikker på at du vil nullstille skjemaet? Alle data vil gå tapt.',
            onConfirm: () => {
                setFormData(JSON.parse(JSON.stringify(INITIAL_FORM_DATA)));
                setErrors({});
                localStorage.removeItem('koe_v5_0_draft');
            },
        });
    };

    const handleDemo = () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Laste eksempeldata?',
            message: 'Dette vil erstatte nåværende data med eksempeldata. Fortsette?',
            onConfirm: () => {
                setFormData(JSON.parse(JSON.stringify(DEMO_DATA)));
                setErrors({});
            },
        });
    };

    const handleDownloadPdf = async () => {
        try {
            await generatePdfReact(formData);
            showToast(setToastMessage, 'PDF lastet ned');
        } catch (error) {
            logger.error('PDF download error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Ukjent feil';
            showToast(setToastMessage, `Feil ved nedlasting av PDF: ${errorMessage}`);
        }
    };

    // Get submit button text based on modus
    const getSubmitButtonText = () => {
        if (submission.isSubmitting) {
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

        return (
            <Suspense fallback={<PanelLoader />}>
                {(() => {
                    switch(activeTab) {
                        case 0: return <VarselPanel {...panelProps} disabled={isTeDisabled} />;
                        case 1: return <KravKoePanel {...panelProps} disabled={isTeDisabled} />;
                        case 2: return <BhSvarPanel {...panelProps} />;
                        case 3: return <TestOversiktPanel data={formData} />;
                        default: return null;
                    }
                })()}
            </Suspense>
        );
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
                            onClick={submission.handleSubmit}
                            iconName="arrow-right"
                            variant="icon-right"
                            disabled={submission.isSubmitting}
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
                    <p className="text-ink-dim">Laster sak {internalSakId || '...'}...</p>
                </div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
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
                        <PktAlert title="Kunne ikke koble til API" skin="error" compact>
                            <span>{apiError}</span>
                        </PktAlert>
                    </div>
                )}

                {/* Mode and SakId Info Banner */}
                {(internalSakId || modus) && (
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
                        <PktAlert skin="info" compact>
                            <div className="flex items-center gap-4 text-sm">
                                {internalSakId && (
                                    <span>
                                        <strong>Sak:</strong> {internalSakId}
                                    </span>
                                )}
                                {modus && (
                                    <span>
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
                        </PktAlert>
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

            {pdfPreviewModal.isOpen && (
                <Suspense fallback={null}>
                    <PDFPreviewModal
                        isOpen={pdfPreviewModal.isOpen}
                        onClose={() => setPdfPreviewModal({ ...pdfPreviewModal, isOpen: false })}
                        onConfirm={submission.handleConfirm}
                        pdfBlob={pdfPreviewModal.pdfBlob}
                        type={pdfPreviewModal.type}
                        isSubmitting={submission.isSubmitting}
                    />
                </Suspense>
            )}

            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                skin="warning"
            />
        </div>
        </ErrorBoundary>
    );
};

export default App;
