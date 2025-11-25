import React, { useState, useEffect, lazy, Suspense, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FormDataModel, Role, BhSvar, Koe } from './types';
import { TABS, INITIAL_FORM_DATA, DEMO_DATA } from './constants';
import Toast from './components/ui/Toast';
import { generatePdfReact, generatePdfBlob } from './utils/pdfGeneratorReact';
import { PktHeader, PktButton, PktTabs, PktTabItem } from '@oslokommune/punkt-react';
import { useSkjemaData } from './hooks/useSkjemaData';
import { useAutoSave } from './hooks/useAutoSave';
import { showToast } from './utils/toastHelpers';
import { focusOnField } from './utils/focusHelpers';
import { logger } from './utils/logger';
import { api, Modus } from './services/api';
import { SAK_STATUS } from './utils/statusHelpers';

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
    const [activeTab, setActiveTab] = useState(0);
    const [toastMessage, setToastMessage] = useState('');

    // URL parameters
    const [searchParams, setSearchParams] = useSearchParams();
    const magicToken = searchParams.get('magicToken');
    const directSakId = searchParams.get('sakId'); // For direct access or older links
    const modus = searchParams.get('modus') as Modus | null;
    const initialTopicGuid = searchParams.get('topicGuid'); // From Catenda webhook

    // Internal state for the resolved sakId and topicGuid
    const [internalSakId, setInternalSakId] = useState<string | null>(directSakId);
    const [topicGuid, setTopicGuid] = useState<string | null>(initialTopicGuid);

    // Loading and error states
    const [isLoading, setIsLoading] = useState(!!magicToken); // Start loading if token is present
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);
    const [isApiConnected, setIsApiConnected] = useState<boolean | null>(null);

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

    // Check API connectivity on mount
    useEffect(() => {
        const checkApiConnection = async () => {
            const connected = await api.healthCheck();
            setIsApiConnected(connected);
            if (!connected) {
                logger.warn('API server not available - running in offline mode');
            }
        };
        checkApiConnection();
    }, []);

    // Verify magic token if present
    useEffect(() => {
        const verifyToken = async () => {
            if (!magicToken || isApiConnected === false) return;

            setIsLoading(true);
            setApiError(null);
            const response = await api.verifyMagicToken(magicToken);

            if (response.success && response.data?.sakId) {
                setInternalSakId(response.data.sakId);
                // Clean the URL, remove the token
                searchParams.delete('magicToken');
                setSearchParams(searchParams, { replace: true });
            } else {
                setApiError(response.error || 'Lenken er ugyldig eller utløpt.');
                setIsLoading(false);
            }
        };

        if (magicToken && isApiConnected) {
            verifyToken();
        }
    }, [magicToken, isApiConnected, setSearchParams, searchParams]);


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
                    setFormData(loadedFormData);
                    setTopicGuid(response.data.topicGuid); // Persist topicGuid in state

                    // If modus is not in URL (e.g. from magic link), set it from loaded data
                    const loadedModus = loadedFormData.sak?.modus as Modus | undefined;
                    if (!modus && loadedModus) {
                        // Add modus to URL so submit logic and role mapping work correctly
                        searchParams.set('modus', loadedModus);
                        setSearchParams(searchParams, { replace: true });
                        logger.info(`Set modus from loaded data: ${loadedModus}`);
                    }

                    showToast(setToastMessage, `Sak ${internalSakId} lastet fra server`);
                } else {
                    setApiError(response.error || 'Kunne ikke laste sak');
                    if (loadedData) {
                        setFormData(loadedData);
                        showToast(setToastMessage, 'API ikke tilgjengelig - bruker lokal lagring');
                    }
                }
            } catch (error) {
                logger.error('Failed to load from API:', error);
                setApiError('Nettverksfeil ved lasting av sak');
                if (loadedData) {
                    setFormData(loadedData);
                }
            } finally {
                setIsLoading(false);
            }
        };

        if (internalSakId && isApiConnected === true) {
            loadFromApi();
        } else if (!internalSakId && loadedData) {
            // No sakId - load from localStorage
            setFormData(loadedData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [internalSakId, isApiConnected]);

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
            // Tab 0: Varsel, Tab 1: Krav, Tab 2: BH Svar, Tab 3: Saksoversikt
            if (modus === 'varsel') {
                setActiveTab(0); // Varsel tab
            } else if (modus === 'koe' || modus === 'revidering') {
                setActiveTab(1); // Krav tab
            } else if (modus === 'svar') {
                setActiveTab(2); // BH Svar tab
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

    const validateCurrentTab = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};
        let firstInvalidFieldId: string | null = null;

        if (activeTab === 0) {
            // Varsel validation
            // Note: dato_forhold_oppdaget and hovedkategori are always required
            // dato_varsel_sendt is conditionally required and validated in VarselPanel
            if (!formData.varsel.dato_forhold_oppdaget.trim()) {
                newErrors['varsel.dato_forhold_oppdaget'] = 'Dato forhold oppdaget er påkrevd';
                if (!firstInvalidFieldId) firstInvalidFieldId = 'varsel.dato_forhold_oppdaget';
            }
            if (!formData.varsel.hovedkategori.trim()) {
                newErrors['varsel.hovedkategori'] = 'Hovedkategori er påkrevd';
                if (!firstInvalidFieldId) firstInvalidFieldId = 'varsel.hovedkategori';
            }
        } else if (activeTab === 1) {
            // KravKoe validation - validate the last revision
            const sisteKrav = formData.koe_revisjoner[formData.koe_revisjoner.length - 1];

            // Validér revisjonsnummer
            if (!sisteKrav.koe_revisjonsnr.toString().trim()) {
                newErrors['koe_revisjoner.koe_revisjonsnr'] = 'Revisjonsnummer er påkrevd';
                if (!firstInvalidFieldId) firstInvalidFieldId = 'koe_revisjoner.koe_revisjonsnr';
            }

            // Sjekk at minst ett krav er valgt
            if (!sisteKrav.vederlag.krav_vederlag && !sisteKrav.frist.krav_fristforlengelse) {
                newErrors['krav_type'] = 'Du må velge minst ett krav (vederlag eller fristforlengelse)';
                if (!firstInvalidFieldId) firstInvalidFieldId = 'kravstype-vederlag-' + (formData.koe_revisjoner.length - 1);
            }

            // Valider vederlagskrav hvis valgt
            if (sisteKrav.vederlag.krav_vederlag) {
                if (!sisteKrav.vederlag.krav_vederlag_metode) {
                    newErrors['koe.vederlag.krav_vederlag_metode'] = 'Oppgjørsmetode er påkrevd';
                    if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.vederlag.krav_vederlag_metode.' + (formData.koe_revisjoner.length - 1);
                }

                if (!sisteKrav.vederlag.krav_vederlag_belop || sisteKrav.vederlag.krav_vederlag_belop <= 0) {
                    newErrors['koe.vederlag.krav_vederlag_belop'] = 'Krevd beløp er påkrevd';
                    if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.vederlag.krav_vederlag_belop.' + (formData.koe_revisjoner.length - 1);
                }

                if (!sisteKrav.vederlag.krav_vederlag_begrunnelse || sisteKrav.vederlag.krav_vederlag_begrunnelse.trim() === '') {
                    newErrors['koe.vederlag.krav_vederlag_begrunnelse'] = 'Begrunnelse for vederlagskrav er påkrevd';
                    if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.vederlag.krav_vederlag_begrunnelse.' + (formData.koe_revisjoner.length - 1);
                }
            }

            // Valider fristforlengelse hvis valgt
            if (sisteKrav.frist.krav_fristforlengelse) {
                if (!sisteKrav.frist.krav_frist_type) {
                    newErrors['koe.frist.krav_frist_type'] = 'Type fristkrav er påkrevd';
                    if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.frist.krav_frist_type.' + (formData.koe_revisjoner.length - 1);
                }

                if (!sisteKrav.frist.krav_frist_antall_dager || sisteKrav.frist.krav_frist_antall_dager <= 0) {
                    newErrors['koe.frist.krav_frist_antall_dager'] = 'Antall dager fristforlengelse er påkrevd';
                    if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.frist.krav_frist_antall_dager.' + (formData.koe_revisjoner.length - 1);
                }

                if (!sisteKrav.frist.krav_frist_begrunnelse || sisteKrav.frist.krav_frist_begrunnelse.trim() === '') {
                    newErrors['koe.frist.krav_frist_begrunnelse'] = 'Begrunnelse for fristforlengelse er påkrevd';
                    if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.frist.krav_frist_begrunnelse.' + (formData.koe_revisjoner.length - 1);
                }
            }

            // Valider e-post/signatur - sjekk at for_entreprenor er satt
            if (!sisteKrav.for_entreprenor || sisteKrav.for_entreprenor.trim() === '') {
                newErrors['koe.signerende_epost'] = 'E-post for signering må valideres';
                if (!firstInvalidFieldId) firstInvalidFieldId = 'koe.signerende_epost.' + (formData.koe_revisjoner.length - 1);
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);

            // Vis den første feilmeldingen i toasten for å gi spesifikk feedback
            const firstErrorMessage = Object.values(newErrors)[0];
            showToast(setToastMessage, firstErrorMessage);

            // Fokuser på det første ugyldige feltet
            if (firstInvalidFieldId) {
                focusOnField(firstInvalidFieldId);
            }

            return false;
        }

        setErrors({});
        return true;
    }, [activeTab, formData.varsel.dato_forhold_oppdaget, formData.varsel.hovedkategori, formData.koe_revisjoner]);

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

    // Show PDF preview (no submission yet)
    const handleSubmitToApi = async () => {
        if (!validateCurrentTab()) {
            return;
        }

        try {
            // Generate PDF blob for preview
            const { blob } = await generatePdfBlob(formData);

            // Show PDF preview modal
            setPdfPreviewModal({
                isOpen: true,
                type: modus || 'koe',
                pdfBlob: blob
            });
        } catch (error) {
            logger.error('PDF generation error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Ukjent feil';
            showToast(setToastMessage, `Feil ved generering av PDF: ${errorMessage}`);
        }
    };

    // Confirm and submit to API (called from PDF preview modal)
    const handleConfirmSubmit = async () => {
        setIsSubmitting(true);
        setApiError(null);

        try {
            let response;

            // Oppdater status og modus i formData før submit
            // Backend vil automatisk synkronisere disse verdiene til CSV via save_form_data
            const updatedFormData = { ...formData };

            if (modus === 'varsel') {
                // TE submitting initial warning
                updatedFormData.sak.status = SAK_STATUS.VARSLET;
                updatedFormData.sak.modus = 'koe';
                setFormData(updatedFormData);
                response = await api.submitVarsel(updatedFormData, topicGuid || undefined, internalSakId || undefined);
            } else if (modus === 'svar' && internalSakId) {
                // BH submitting response to claim
                // Sjekk om BH godkjente eller avviste kravet
                const sisteBhSvar = formData.bh_svar_revisjoner[formData.bh_svar_revisjoner.length - 1];
                const vederlagSvar = sisteBhSvar?.vederlag?.bh_svar_vederlag || '';
                const fristSvar = sisteBhSvar?.frist?.bh_svar_frist || '';

                // Trenger revidering hvis:
                // - Delvis godkjent (100000001)
                // - Avslått uenig (100000002)
                // - Avslått for sent (100000003) - TE må begrunne varslingtidspunkt
                // - Avventer (100000004) - TE må gi mer detaljer
                const trengerRevidering = (
                    vederlagSvar === '100000001' || vederlagSvar === '100000002' ||
                    vederlagSvar === '100000003' || vederlagSvar === '100000004' ||
                    fristSvar === '100000001' || fristSvar === '100000002' ||
                    fristSvar === '100000003' || fristSvar === '100000004'
                );

                if (trengerRevidering) {
                    updatedFormData.sak.status = SAK_STATUS.VURDERES_AV_TE;
                    updatedFormData.sak.modus = 'revidering';
                } else {
                    updatedFormData.sak.status = SAK_STATUS.OMFORENT;
                    updatedFormData.sak.modus = 'ferdig';
                }
                setFormData(updatedFormData);
                response = await api.submitSvar(updatedFormData, internalSakId, topicGuid || undefined);
            } else if (modus === 'revidering' && internalSakId) {
                // TE submitting revision
                updatedFormData.sak.status = SAK_STATUS.VENTER_PAA_SVAR;
                updatedFormData.sak.modus = 'svar';
                setFormData(updatedFormData);
                response = await api.submitRevidering(updatedFormData, internalSakId);
            } else {
                // KOE submission (claim)
                updatedFormData.sak.status = SAK_STATUS.VENTER_PAA_SVAR;
                updatedFormData.sak.modus = 'svar';
                setFormData(updatedFormData);
                response = await api.submitKoe(updatedFormData, internalSakId || undefined, topicGuid || undefined);
            }

            if (response.success && response.data) {
                // Generate PDF blob for upload (without auto-download)
                const { blob, filename } = await generatePdfBlob(updatedFormData);

                // Upload PDF to backend for Catenda integration
                const effectiveSakId = response.data.sakId || internalSakId;
                if (effectiveSakId && isApiConnected) {
                    const pdfResponse = await api.uploadPdf(
                        effectiveSakId,
                        blob,
                        filename,
                        modus || 'koe',
                        topicGuid || undefined
                    );
                    if (pdfResponse.success) {
                        logger.log('PDF uploaded successfully');
                    } else {
                        logger.warn('PDF upload failed:', pdfResponse.error);
                    }
                }

                // Clear localStorage after successful submission
                localStorage.removeItem('koe_v5_0_draft');

                // Close preview modal and show success message
                setPdfPreviewModal({ isOpen: false, type: 'koe', pdfBlob: null });
                showToast(setToastMessage, response.data.message || 'Skjema sendt til server');
            } else {
                setApiError(response.error || 'Kunne ikke sende skjema');
                showToast(setToastMessage, `Feil: ${response.error}`);
            }
        } catch (error) {
            logger.error('Submit error:', error);
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
                {(internalSakId || modus) && (
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <div className="flex items-center gap-4 text-sm">
                                {internalSakId && (
                                    <span className="text-blue-700">
                                        <strong>Sak:</strong> {internalSakId}
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

            {pdfPreviewModal.isOpen && (
                <Suspense fallback={null}>
                    <PDFPreviewModal
                        isOpen={pdfPreviewModal.isOpen}
                        onClose={() => setPdfPreviewModal({ ...pdfPreviewModal, isOpen: false })}
                        onConfirm={handleConfirmSubmit}
                        pdfBlob={pdfPreviewModal.pdfBlob}
                        type={pdfPreviewModal.type}
                        isSubmitting={isSubmitting}
                    />
                </Suspense>
            )}
        </div>
        </ErrorBoundary>
    );
};

export default App;
