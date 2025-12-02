import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Role, FormDataModel } from './types';
import { INITIAL_FORM_DATA, DEMO_DATA } from './config';
import Toast from './components/ui/Toast';
import { generatePdfReact } from './utils/pdfGeneratorReact';
import { useAutoSave } from './hooks/useAutoSave';
import { useUrlParams } from './hooks/useUrlParams';
import { useApiConnection } from './hooks/useApiConnection';
import { useCaseLoader } from './hooks/useCaseLoader';
import { useHandleInputChange } from './hooks/useHandleInputChange';
import { useFormSubmission } from './hooks/useFormSubmission';
import { useModal } from './hooks/useModal';
import { revisionService } from './services/revisionService';
import { showToast } from './utils/toastHelpers';
import { logger } from './utils/logger';
import AppHeader from './components/layout/AppHeader';
import TabNavigation from './components/layout/TabNavigation';
import InfoBanner from './components/layout/InfoBanner';
import BottomBar from './components/layout/BottomBar';
import AppLayout from './components/layout/AppLayout';

// New Event Sourcing pages
import { ExampleCasesPage } from './src/pages/ExampleCasesPage';
import { CasePage } from './src/pages/CasePage';

// Lazy load panels for better performance
const VarselPanel = lazy(() => import('./components/panels/VarselPanel'));
const KravKoePanel = lazy(() => import('./components/panels/KravKoePanel'));
const BhSvarPanel = lazy(() => import('./components/panels/BhSvarPanel'));
const TestOversiktPanel = lazy(() => import('./components/panels/TestOversiktPanel'));
const PDFPreviewModal = lazy(() => import('./components/ui/PDFPreviewModal'));

import { ErrorBoundary } from './components/ui/ErrorBoundary';
import ConfirmDialog from './components/ui/ConfirmDialog';

// Loading spinner for lazy-loaded components
const PanelLoader: React.FC = () => (
    <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pri"></div>
    </div>
);

// Legacy App Component (existing form-based app)
const LegacyApp: React.FC = () => {
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

    // Auto-save hook
    const [autoSaveData, setAutoSaveData] = useState(INITIAL_FORM_DATA);
    const loadedData = useAutoSave({
        data: autoSaveData,
        storageKey: 'koe_v5_0_draft',
        debounceMs: 1500,
        onSave: () => {
            showToast(setToastMessage, 'Utkast lagret');
        },
    });

    // Case loading hook
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

    // Handle input change
    const handleInputChange = useHandleInputChange(setFormData, setErrors);

    // PDF Preview modal
    const { modal, openModal, closeModal } = useModal();

    // Form submission hook
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
            openModal(blob, type);
        },
        onSuccess: () => {
            closeModal();
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

    // Add BH svar revision
    const addBhSvarRevisjon = () => {
        const nyttSvar = revisionService.createBhSvarRevisjon();
        setFormData(prev => ({
            ...prev,
            bh_svar_revisjoner: [...prev.bh_svar_revisjoner, nyttSvar]
        }));
    };

    // Add Koe revision
    const addKoeRevisjon = () => {
        const sisteKrav = formData.koe_revisjoner[formData.koe_revisjoner.length - 1];
        const nyttKrav = revisionService.createKoeRevisjon(sisteKrav);
        setFormData(prev => ({
            ...prev,
            koe_revisjoner: [...prev.koe_revisjoner, nyttKrav]
        }));
    };

    // Get submit button text based on modus
    const getSubmitButtonText = () => {
        if (submission.isSubmitting) {
            return <span>Sender...</span>;
        }

        const sisteKoeIndex = formData.koe_revisjoner.length - 1;
        const sisteKoe = formData.koe_revisjoner[sisteKoeIndex];
        const sisteBhSvarIndex = formData.bh_svar_revisjoner.length - 1;
        const sisteBhSvar = formData.bh_svar_revisjoner[sisteBhSvarIndex];

        switch (modus) {
            case 'varsel':
                return (
                    <span className="flex flex-col">
                        <span>Send varsel til BH</span>
                        <span className="text-xs opacity-75">Byggherre varsles automatisk</span>
                    </span>
                );
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
                const godkjent = vederlagStatus === '100000004';
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
                <AppHeader rolle={formData.rolle} onRoleChange={handleRoleChange} />

                <InfoBanner
                    apiError={apiError}
                    sakId={internalSakId}
                    modus={modus}
                    isApiConnected={isApiConnected}
                />

                <AppLayout
                    sidePanel={{
                        sak: formData.sak,
                        koeRevisjoner: formData.koe_revisjoner,
                    }}
                >
                    <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
                    {renderPanel()}
                    <BottomBar
                        onReset={handleReset}
                        onDownloadPdf={handleDownloadPdf}
                        onDemo={handleDemo}
                        onSubmit={submission.handleSubmit}
                        isApiConnected={isApiConnected}
                        isSubmitting={submission.isSubmitting}
                        submitButtonText={getSubmitButtonText()}
                    />
                </AppLayout>

                {toastMessage && <Toast message={toastMessage} />}

                {modal.isOpen && (
                    <Suspense fallback={null}>
                        <PDFPreviewModal
                            isOpen={modal.isOpen}
                            onClose={closeModal}
                            onConfirm={submission.handleConfirm}
                            pdfBlob={modal.pdfBlob}
                            type={modal.type}
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

// Main App with Routing
const App: React.FC = () => {
    return (
        <Routes>
            {/* New Event Sourcing Architecture */}
            <Route path="/examples" element={<ExampleCasesPage />} />
            <Route path="/saker/:id" element={<CasePage />} />

            {/* Legacy Form-based App (default) */}
            <Route path="*" element={<LegacyApp />} />
        </Routes>
    );
};

export default App;
