import React, { useState, useEffect, lazy, Suspense } from 'react';
import { FormDataModel, Role, BhSvar, Koe } from './types';
import { TABS, INITIAL_FORM_DATA, DEMO_DATA } from './constants';
import Toast from './components/ui/Toast';
import { generatePdfReact } from './utils/pdfGeneratorReact';
import { PktHeader } from '@oslokommune/punkt-react';
import { useSkjemaData } from './hooks/useSkjemaData';
import { useAutoSave } from './hooks/useAutoSave';
import { useUrlParams } from './hooks/useUrlParams';
import { useApiConnection } from './hooks/useApiConnection';
import { useCaseLoader } from './hooks/useCaseLoader';
import { useFormSubmission } from './hooks/useFormSubmission';
import { showToast } from './utils/toastHelpers';
import { logger } from './utils/logger';
import { Modus } from './services/api';
import { BottomBar } from './components/layout/BottomBar';
import { TabNavigation } from './components/layout/TabNavigation';

// Lazy load panels for better performance
const VarselPanel = lazy(() => import('./components/panels/VarselPanel'));
const KravKoePanel = lazy(() => import('./components/panels/KravKoePanel'));
const BhSvarPanel = lazy(() => import('./components/panels/BhSvarPanel'));
const TestOversiktPanel = lazy(() => import('./components/panels/TestOversiktPanel'));
const PDFPreviewModal = lazy(() => import('./components/ui/PDFPreviewModal'));

import SidePanel from './components/ui/SidePanel';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Loading spinner for lazy-loaded components
const PanelLoader: React.FC = () => (
    <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pri"></div>
    </div>
);

const App: React.FC = () => {
    const [toastMessage, setToastMessage] = useState('');

    // URL parameters (extracted to custom hook)
    const { magicToken, sakId: directSakId, modus, topicGuid: initialTopicGuid, isFromMagicLink, clearMagicToken } = useUrlParams();

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
            showToast(setToastMessage, 'Utkast lagret ✓');
        },
    });

    // Case loader hook (handles magic token verification, API loading, role/tab management)
    const caseLoader = useCaseLoader({
        magicToken,
        sakId: directSakId,
        modus,
        topicGuid: initialTopicGuid,
        isFromMagicLink,
        isApiConnected,
        clearMagicToken,
        loadedData,
        setToastMessage,
    });

    // Sync loaded data from caseLoader into formData
    useEffect(() => {
        setFormData(caseLoader.formData);
    }, [caseLoader.formData, setFormData]);

    // Form submission hook (handles validation, PDF generation, API submission)
    const submission = useFormSubmission({
        formData,
        setFormData,
        modus,
        sakId: caseLoader.internalSakId,
        topicGuid: caseLoader.topicGuid,
        activeTab: caseLoader.activeTab,
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

    const renderPanel = () => {
        const isTeDisabled = formData.rolle === 'BH';
        const panelProps = {
            formData,
            setFormData: handleInputChange,
            errors,
            setActiveTab: caseLoader.setActiveTab,
            setToastMessage,
            addBhSvarRevisjon,
            addKoeRevisjon,
        };

        return (
            <Suspense fallback={<PanelLoader />}>
                {(() => {
                    switch(caseLoader.activeTab) {
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

    // Render loading state
    if (caseLoader.isLoading) {
        return (
            <div className="bg-body-bg min-h-screen text-ink font-sans flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pri mx-auto mb-4"></div>
                    <p className="text-ink-dim">Laster sak {caseLoader.internalSakId || '...'}...</p>
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
                {caseLoader.apiError && (
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
                        <div className="bg-red-50 border border-red-200 rounded-md p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-red-700">{caseLoader.apiError}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mode and SakId Info Banner */}
                {(caseLoader.internalSakId || modus) && (
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <div className="flex items-center gap-4 text-sm">
                                {caseLoader.internalSakId && (
                                    <span className="text-blue-700">
                                        <strong>Sak:</strong> {caseLoader.internalSakId}
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
                        <TabNavigation
                            tabs={TABS}
                            activeTab={caseLoader.activeTab}
                            onTabChange={caseLoader.setActiveTab}
                        />
                        {renderPanel()}
                        <BottomBar
                            formData={formData}
                            modus={modus}
                            isApiConnected={isApiConnected}
                            isSubmitting={submission.isSubmitting}
                            onReset={handleReset}
                            onDownloadPdf={handleDownloadPdf}
                            onDemo={handleDemo}
                            onSubmit={submission.handleSubmit}
                        />
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
        </div>
        </ErrorBoundary>
    );
};

export default App;
