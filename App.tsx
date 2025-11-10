import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import { FormDataModel, Role } from './types';
import { TABS, INITIAL_FORM_DATA, DEMO_DATA } from './constants';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, PrinterIcon, FilePlus2Icon, RefreshCwIcon } from './components/ui/icons';
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
    
    const handleInputChange = (section: keyof Omit<FormDataModel, 'versjon' | 'rolle'>, field: string, value: any) => {
        setFormData(prev => {
            const path = field.split('.');

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
        openModal(
            'Nullstill skjema',
            'Er du sikker på at du vil nullstille skjemaet? Alle ulagrede data vil gå tapt.',
            () => {
                setFormData(JSON.parse(JSON.stringify(INITIAL_FORM_DATA)));
                setErrors({});
                localStorage.removeItem('koe_v5_0_draft');
            }
        );
    };

    const handleDemo = () => {
        openModal(
            'Last inn eksempeldata',
            'Dette vil erstatte nåværende data med eksempeldata. Fortsette?',
            () => {
                setFormData(JSON.parse(JSON.stringify(DEMO_DATA)));
                setErrors({});
            }
        );
    };

    const handleNextTab = () => {
        setActiveTab(prev => Math.min(prev + 1, TABS.length - 1));
        window.scrollTo(0, 0);
    };

    const handlePrevTab = () => {
        setActiveTab(prev => Math.max(prev - 1, 0));
        window.scrollTo(0, 0);
    };
    
    const handleDownloadPdf = () => {
        generatePdf(formData);
    };

    const renderTabs = () => (
        <PktTabs>
            {TABS.map((tab, idx) => (
                <PktTabItem
                    key={tab.label}
                    active={activeTab === idx}
                    onClick={() => {
                        setActiveTab(idx);
                        window.scrollTo(0, 0);
                    }}
                    index={idx}
                >
                    {tab.label}
                </PktTabItem>
            ))}
        </PktTabs>
    );

    const renderPanel = () => {
        const panelProps = {
            formData,
            setFormData: handleInputChange,
            errors,
        };
        switch(activeTab) {
            case 0: return <GrunninfoPanel {...panelProps} />;
            case 1: return <VarselPanel {...panelProps} />;
            case 2: return <KravKoePanel {...panelProps} />;
            case 3: return <BhSvarPanel {...panelProps} />;
            case 4: return <OppsummeringPanel data={formData} />;
            default: return null;
        }
    };
    
    const renderBottomBar = () => (
        <div className="mt-8 px-4 sm:px-0 flex items-center" role="navigation" aria-label="Steg navigasjon">
            <div className="flex-1 flex justify-start">
                {activeTab > 0 && (
                    <PktButton
                        skin="secondary"
                        size="medium"
                        onClick={handlePrevTab}
                    >
                        <ChevronLeftIcon className="h-5 w-5 mr-2" />
                        Forrige
                    </PktButton>
                )}
            </div>

            <div className="flex-1 flex justify-center">
                <div className="flex items-center justify-center gap-3">
                    <PktButton skin="secondary" size="small" onClick={handleDownloadPdf}>
                        <DownloadIcon className="h-4 w-4 mr-2" /> PDF
                    </PktButton>
                    <PktButton skin="secondary" size="small" onClick={handleDemo}>
                        <FilePlus2Icon className="h-4 w-4 mr-2" /> Eksempel
                    </PktButton>
                    <PktButton skin="tertiary" size="small" onClick={handleReset}>
                        <RefreshCwIcon className="h-4 w-4 mr-2" /> Nullstill
                    </PktButton>
                </div>
            </div>

            <div className="flex-1 flex justify-end">
                {activeTab < TABS.length - 1 && (
                    <PktButton
                        skin="primary"
                        size="medium"
                        onClick={handleNextTab}
                    >
                        Neste Steg
                        <ChevronRightIcon className="h-5 w-5 ml-2" />
                    </PktButton>
                )}
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
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 sm:px-0">
                    {renderPanel()}
                </div>
                {renderBottomBar()}
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