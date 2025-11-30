import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Role, BhSvar, Koe } from './types';
import { TABS, INITIAL_FORM_DATA, DEMO_DATA } from './config';
import Toast from './components/ui/Toast';
import { generatePdfReact } from './utils/pdfGeneratorReact';
import { PktHeader, PktButton, PktTabs, PktTabItem, PktAlert } from '@oslokommune/punkt-react';
import { useAutoSave } from './hooks/useAutoSave';
import { useUrlParams } from './hooks/useUrlParams';
import { useApiConnection } from './hooks/useApiConnection';
import { useCaseLoader } from './hooks/useCaseLoader';
import { useHandleInputChange } from './hooks/useHandleInputChange';
import { useFormSubmission } from './hooks/useFormSubmission';
import { showToast } from './utils/toastHelpers';
import { logger } from './utils/logger';
import { KOE_STATUS, BH_SVAR_STATUS } from './utils/statusHelpers';

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
    const [toastMessage, setToastMessage] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
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

    // URL parameters
    const { magicToken, sakId, modus, topicGuid: initialTopicGuid, isFromMagicLink, clearMagicToken } = useUrlParams();

    // API connection state
    const { isApiConnected } = useApiConnection();

    // Auto-save hook (needs formData, so we get loadedData first)
    // This is used as fallback when API is not available
    const [autoSaveData, setAutoSaveData] = useState(INITIAL_FORM_DATA);
    const loadedData = useAutoSave({
        data: autoSaveData,
        storageKey: 'koe_v5_0_draft',
        debounceMs: 1500,
        onSave: () => {
            showToast(setToastMessage, 'Utkast lagret');
        },
    });

    // Case loading hook - handles magic token verification and data loading
    const {
        formData,
        setFormData,
        internalSakId,
        topicGuid,
        isLoading,
        apiError,
        activeTab,
        setActiveTab,
    } = useCaseLoader({
        magicToken,
        sakId,
        modus,
        topicGuid: initialTopicGuid,
        isFromMagicLink,
        isApiConnected,
        clearMagicToken,
        loadedData,
        setToastMessage,
    });

    // Sync formData to autoSave
    useEffect(() => {
        setAutoSaveData(formData);
    }, [formData]);

    // Handle input change for nested form updates
    const handleInputChange = useHandleInputChange(setFormData, setErrors);

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

    // Body class for BH role styling
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
            status: BH_SVAR_STATUS.UTKAST,
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
            status: KOE_STATUS.UTKAST,
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
