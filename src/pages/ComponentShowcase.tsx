import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  // Core
  Button,
  Card,
  Modal,
  Tooltip,
  AlertDialog,
  Alert,
  Badge,
  // Forms
  Input,
  Textarea,
  Label,
  Checkbox,
  RadioGroup,
  RadioItem,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  DatePicker,
  DateRangePicker,
  CurrencyInput,
  FormField,
  // Data Display
  DataList,
  DataListItem,
  InlineDataList,
  InlineDataListItem,
  Table,
  DashboardCard,
  InfoLabel,
  RevisionTag,
  StepIndicator,
  StatusSummary,
  ActivityHistory,
  // Layout
  Tabs,
  Collapsible,
  AccordionGroup,
  SectionContainer,
  // Navigation
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  // Feedback
  useToast,
} from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import type { DateRangeValue, ActivityHistoryEntry } from '../components/primitives';
import { CheckCircledIcon, PaperPlaneIcon, PlusCircledIcon } from '@radix-ui/react-icons';

/**
 * Component Showcase Page
 *
 * Comprehensive showcase of all primitive components organized by category.
 * Used for testing, verification, and documentation.
 */
export function ComponentShowcase() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState('buttons');

  // Animation demo state
  const [animationKey, setAnimationKey] = useState(0);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  // Form states
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [radioValue, setRadioValue] = useState('option1');
  const [dateValue, setDateValue] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: undefined, to: undefined });
  const [currencyValue, setCurrencyValue] = useState<number | null>(null);
  const [loadingButton, setLoadingButton] = useState(false);

  const handleLoadingDemo = () => {
    setLoadingButton(true);
    setTimeout(() => setLoadingButton(false), 2000);
  };

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      <PageHeader
        title="Primitive Components Showcase"
        subtitle="Alle 34 primitive komponenter"
        maxWidth="wide"
        menuActions={
          <DropdownMenuItem asChild>
            <Link to="/">Tilbake til forsiden</Link>
          </DropdownMenuItem>
        }
      />

      <main className="max-w-6xl mx-auto p-4 sm:p-8">
        <Tabs
          tabs={[
            { id: 'buttons', label: 'Buttons & Actions' },
            { id: 'forms', label: 'Forms' },
            { id: 'data', label: 'Data Display' },
            { id: 'feedback', label: 'Feedback & Overlays' },
            { id: 'layout', label: 'Layout' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="mt-6 space-y-6">
          {/* ============================================
              TAB 1: BUTTONS & ACTIONS
              ============================================ */}
          {activeTab === 'buttons' && (
            <>
              {/* Button */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Button</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-pkt-text-body-subtle mb-2">Variants</h3>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="primary">Primary</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="ghost">Ghost</Button>
                      <Button variant="danger">Danger</Button>
                      <Button variant="primary" disabled>Disabled</Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-pkt-text-body-subtle mb-2">Sizes</h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button size="sm">Small</Button>
                      <Button size="md">Medium</Button>
                      <Button size="lg">Large</Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-pkt-text-body-subtle mb-2">Loading</h3>
                    <Button loading={loadingButton} onClick={handleLoadingDemo}>
                      {loadingButton ? 'Laster...' : 'Klikk for loading'}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* DropdownMenu */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">DropdownMenu</h2>
                <div className="flex gap-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary">Åpne meny</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => toast({ title: 'Rediger valgt', variant: 'info' })}>
                        Rediger
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => toast({ title: 'Dupliser valgt', variant: 'info' })}>
                        Dupliser
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="danger" onSelect={() => toast({ title: 'Slett valgt', variant: 'error' })}>
                        Slett
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            </>
          )}

          {/* ============================================
              TAB 2: FORMS
              ============================================ */}
          {activeTab === 'forms' && (
            <>
              {/* Input & Textarea */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Input & Textarea</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label htmlFor="demo-input">Input</Label>
                    <Input
                      id="demo-input"
                      placeholder="Skriv noe..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                    />
                    <Input placeholder="Med error" error />
                    <Input placeholder="Disabled" disabled />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="demo-textarea">Textarea</Label>
                    <Textarea
                      id="demo-textarea"
                      placeholder="Skriv lengre tekst..."
                      value={textareaValue}
                      onChange={(e) => setTextareaValue(e.target.value)}
                    />
                  </div>
                </div>
              </Card>

              {/* FormField */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">FormField</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Standard felt" helpText="Hjelpetekst vises her">
                    <Input placeholder="Verdi" />
                  </FormField>
                  <FormField label="Valgfritt felt" optional>
                    <Input placeholder="Kan hoppes over" />
                  </FormField>
                  <FormField label="Felt med feil" error="Dette feltet har en feil">
                    <Input placeholder="Ugyldig verdi" error />
                  </FormField>
                  <FormField label="Med tooltip" labelTooltip="Ekstra info om feltet">
                    <Input placeholder="Hover over label" />
                  </FormField>
                </div>
              </Card>

              {/* Select */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Select</h2>
                <div className="flex flex-wrap gap-4">
                  <Select value={selectValue} onValueChange={setSelectValue}>
                    <SelectTrigger className="w-[200px]">
                      {selectValue || 'Velg alternativ...'}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Alternativ 1</SelectItem>
                      <SelectItem value="option2">Alternativ 2</SelectItem>
                      <SelectItem value="option3">Alternativ 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Card>

              {/* Checkbox & RadioGroup */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Checkbox & RadioGroup</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-pkt-text-body-subtle">Checkbox</h3>
                    <Checkbox
                      label="Standard checkbox"
                      checked={checkboxChecked}
                      onCheckedChange={(checked) => setCheckboxChecked(checked === true)}
                    />
                    <Checkbox
                      label="Med beskrivelse"
                      description="Ekstra informasjon om valget"
                    />
                    <Checkbox label="Disabled" disabled />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-pkt-text-body-subtle">RadioGroup</h3>
                    <RadioGroup value={radioValue} onValueChange={setRadioValue}>
                      <RadioItem value="option1" label="Alternativ 1" />
                      <RadioItem value="option2" label="Alternativ 2" />
                      <RadioItem value="option3" label="Alternativ 3" description="Med beskrivelse" />
                    </RadioGroup>
                  </div>
                </div>
              </Card>

              {/* DatePicker & DateRangePicker */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">DatePicker & DateRangePicker</h2>
                <div className="flex flex-wrap gap-4">
                  <div>
                    <Label className="mb-2 block">Enkelt dato</Label>
                    <DatePicker
                      value={dateValue}
                      onChange={(date) => setDateValue(date)}
                      placeholder="Velg dato"
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Datoperiode</Label>
                    <DateRangePicker
                      value={dateRange}
                      onChange={setDateRange}
                      placeholder="Velg periode"
                    />
                  </div>
                </div>
              </Card>

              {/* CurrencyInput */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">CurrencyInput</h2>
                <div className="max-w-xs">
                  <FormField label="Beløp (NOK)">
                    <CurrencyInput
                      value={currencyValue}
                      onChange={setCurrencyValue}
                      placeholder="0"
                    />
                  </FormField>
                  <p className="text-sm text-pkt-text-body-subtle mt-2">
                    Verdi: {currencyValue !== null ? `${currencyValue.toLocaleString('nb-NO')} kr` : 'Ikke satt'}
                  </p>
                </div>
              </Card>

              {/* AttachmentUpload */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">AttachmentUpload</h2>
                <p className="text-pkt-text-body-subtle mb-4">
                  Drag-and-drop fil-opplasting med preview. Brukes i modaler for vedlegg.
                </p>
                <div className="border-2 border-dashed border-pkt-border-gray rounded p-8 text-center text-pkt-text-body-subtle">
                  Dra filer hit eller klikk for å velge
                </div>
              </Card>
            </>
          )}

          {/* ============================================
              TAB 3: DATA DISPLAY
              ============================================ */}
          {activeTab === 'data' && (
            <>
              {/* Badge */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Badge</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-pkt-text-body-subtle mb-2">Variants</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge>Default</Badge>
                      <Badge variant="info">Info</Badge>
                      <Badge variant="success">Success</Badge>
                      <Badge variant="warning">Warning</Badge>
                      <Badge variant="danger">Danger</Badge>
                      <Badge variant="neutral">Neutral</Badge>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-pkt-text-body-subtle mb-2">Sizes</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge size="sm">Small</Badge>
                      <Badge size="md">Medium</Badge>
                      <Badge size="lg">Large</Badge>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Cards */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Card Variants</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card variant="default" padding="md">
                    <h3 className="font-semibold text-pkt-text-body-dark">Default</h3>
                    <p className="text-sm text-pkt-text-body-subtle">Standard kort</p>
                  </Card>
                  <Card variant="elevated" padding="md">
                    <h3 className="font-semibold text-pkt-text-body-dark">Elevated</h3>
                    <p className="text-sm text-pkt-text-body-subtle">Med skygge</p>
                  </Card>
                  <Card variant="outlined" padding="md">
                    <h3 className="font-semibold text-pkt-text-body-dark">Outlined</h3>
                    <p className="text-sm text-pkt-text-body-subtle">Med kantlinje</p>
                  </Card>
                </div>
              </Card>

              {/* DashboardCard */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">DashboardCard</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DashboardCard
                    title="Dashboard Card"
                    headerBadge={<Badge variant="info" size="sm">Ny</Badge>}
                    action={<Button size="sm" variant="ghost">Handling</Button>}
                  >
                    <p className="text-pkt-text-body-subtle">Innhold i dashboard-kort</p>
                  </DashboardCard>
                  <DashboardCard
                    title="Uten header-badge"
                    action={<Button size="sm" variant="ghost">Se mer</Button>}
                  >
                    <p className="text-pkt-text-body-subtle">Enklere variant</p>
                  </DashboardCard>
                </div>
              </Card>

              {/* DataList & InlineDataList */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">DataList & InlineDataList</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-pkt-text-body-subtle mb-2">DataList (grid)</h3>
                    <DataList variant="grid">
                      <DataListItem label="Prosjekt">Byggeprosjekt A</DataListItem>
                      <DataListItem label="Status">Aktiv</DataListItem>
                      <DataListItem label="Beløp" mono>125 000 kr</DataListItem>
                      <DataListItem label="Dato">15.01.2026</DataListItem>
                    </DataList>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-pkt-text-body-subtle mb-2">InlineDataList</h3>
                    <InlineDataList title="Sammendrag">
                      <InlineDataListItem label="Versjon">3</InlineDataListItem>
                      <InlineDataListItem label="Sist endret">I dag</InlineDataListItem>
                      <InlineDataListItem label="Status" variant="success">Godkjent</InlineDataListItem>
                    </InlineDataList>
                  </div>
                </div>
              </Card>

              {/* Table */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Table</h2>
                <Table
                  columns={[
                    { key: 'id', label: 'ID', width: '80px', render: (row) => row.id },
                    { key: 'name', label: 'Navn', render: (row) => row.name },
                    { key: 'status', label: 'Status', render: (row) => (
                      <Badge variant={row.status === 'Aktiv' ? 'success' : 'neutral'} size="sm">
                        {row.status}
                      </Badge>
                    )},
                    { key: 'amount', label: 'Beløp', render: (row) => row.amount },
                  ]}
                  data={[
                    { id: '001', name: 'Prosjekt Alpha', status: 'Aktiv', amount: '50 000 kr' },
                    { id: '002', name: 'Prosjekt Beta', status: 'Inaktiv', amount: '125 000 kr' },
                    { id: '003', name: 'Prosjekt Gamma', status: 'Aktiv', amount: '75 000 kr' },
                  ]}
                  keyExtractor={(row) => row.id}
                />
              </Card>

              {/* InfoLabel & RevisionTag */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">InfoLabel & RevisionTag</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-pkt-text-body-subtle mb-2">InfoLabel</h3>
                    <div className="flex flex-wrap gap-4">
                      <InfoLabel>Standard label</InfoLabel>
                      <InfoLabel tooltip="Ekstra informasjon">Med tooltip</InfoLabel>
                      <InfoLabel optional>Valgfritt felt</InfoLabel>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-pkt-text-body-subtle mb-2">RevisionTag</h3>
                    <div className="flex flex-wrap gap-2">
                      <RevisionTag version={1} />
                      <RevisionTag version={2} showDate date="2026-01-10" />
                      <RevisionTag version={3} size="sm" />
                    </div>
                  </div>
                </div>
              </Card>

              {/* StepIndicator */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">StepIndicator</h2>
                <StepIndicator
                  currentStep={2}
                  steps={[
                    { label: 'Opprett' },
                    { label: 'Fyll ut' },
                    { label: 'Send inn' },
                    { label: 'Ferdig' },
                  ]}
                />
              </Card>

              {/* StatusSummary & ActivityHistory */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">StatusSummary & ActivityHistory</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <StatusSummary title="Status sammendrag">
                    <DataList variant="list">
                      <DataListItem label="Status">Godkjent</DataListItem>
                      <DataListItem label="Behandlet av">Ola Nordmann</DataListItem>
                      <DataListItem label="Dato">15.01.2026</DataListItem>
                    </DataList>
                  </StatusSummary>
                  <ActivityHistory
                    label="Aktivitet"
                    showCount
                    entries={[
                      { id: '1', icon: <PlusCircledIcon />, label: 'Opprettet', meta: '10. jan 2026', variant: 'neutral' },
                      { id: '2', icon: <PaperPlaneIcon />, label: 'Sendt til godkjenning', meta: '12. jan 2026', variant: 'info' },
                      { id: '3', icon: <CheckCircledIcon />, label: 'Godkjent', meta: '15. jan 2026', variant: 'success' },
                    ]}
                  />
                </div>
              </Card>
            </>
          )}

          {/* ============================================
              TAB 4: FEEDBACK & OVERLAYS
              ============================================ */}
          {activeTab === 'feedback' && (
            <>
              {/* Alert */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Alert (Inline)</h2>
                <div className="space-y-3">
                  <Alert variant="info" title="Informasjon">
                    Dette er en informasjonsmelding.
                  </Alert>
                  <Alert variant="success" title="Suksess">
                    Handlingen ble fullført.
                  </Alert>
                  <Alert variant="warning" title="Advarsel">
                    Vær oppmerksom på dette.
                  </Alert>
                  <Alert variant="danger" title="Feil">
                    Noe gikk galt.
                  </Alert>
                </div>
              </Card>

              {/* Modal */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Modal</h2>
                <Button onClick={() => setModalOpen(true)}>Åpne modal</Button>

                <Modal
                  open={modalOpen}
                  onOpenChange={setModalOpen}
                  title="Eksempel Modal"
                  description="En modal dialog med Punkt-styling."
                  size="md"
                >
                  <div className="space-y-4">
                    <p className="text-pkt-text-body-default">
                      Modalen demonstrerer focus trap, keyboard navigation og tilgjengelighet.
                    </p>
                    <div className="flex gap-3">
                      <Button variant="primary" onClick={() => setModalOpen(false)}>
                        Bekreft
                      </Button>
                      <Button variant="secondary" onClick={() => setModalOpen(false)}>
                        Avbryt
                      </Button>
                    </div>
                  </div>
                </Modal>
              </Card>

              {/* AlertDialog */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">AlertDialog</h2>
                <Button variant="danger" onClick={() => setAlertOpen(true)}>
                  Slett element
                </Button>

                <AlertDialog
                  open={alertOpen}
                  onOpenChange={setAlertOpen}
                  title="Er du sikker?"
                  description="Denne handlingen kan ikke angres."
                  confirmLabel="Slett"
                  cancelLabel="Avbryt"
                  variant="danger"
                  onConfirm={() => toast({ title: 'Slettet', variant: 'success' })}
                />
              </Card>

              {/* Tooltip */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Tooltip</h2>
                <div className="flex flex-wrap gap-4">
                  <Tooltip content="Tooltip på toppen" side="top">
                    <Button variant="secondary">Topp</Button>
                  </Tooltip>
                  <Tooltip content="Tooltip til høyre" side="right">
                    <Button variant="secondary">Høyre</Button>
                  </Tooltip>
                  <Tooltip content="Tooltip på bunnen" side="bottom">
                    <Button variant="secondary">Bunn</Button>
                  </Tooltip>
                  <Tooltip content="Tooltip til venstre" side="left">
                    <Button variant="secondary">Venstre</Button>
                  </Tooltip>
                </div>
              </Card>

              {/* Toast */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Toast</h2>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => toast({ title: 'Standard toast', variant: 'info' })}>
                    Standard
                  </Button>
                  <Button onClick={() => toast({ title: 'Suksess!', variant: 'success' })}>
                    Success
                  </Button>
                  <Button onClick={() => toast({ title: 'Advarsel', variant: 'warning' })}>
                    Warning
                  </Button>
                  <Button onClick={() => toast({ title: 'Feil oppstod', variant: 'error' })}>
                    Error
                  </Button>
                  <Button onClick={() => toast({ title: 'Info', description: 'Med beskrivelse', variant: 'info' })}>
                    Info m/beskrivelse
                  </Button>
                </div>
              </Card>
            </>
          )}

          {/* ============================================
              TAB 5: LAYOUT
              ============================================ */}
          {activeTab === 'layout' && (
            <>
              {/* Tabs (meta) */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Tabs</h2>
                <p className="text-pkt-text-body-subtle mb-4">
                  Denne siden bruker Tabs-komponenten for navigasjon mellom kategoriene!
                </p>
                <Alert variant="info">
                  Se toppmenyen for eksempel på Tabs i bruk.
                </Alert>
              </Card>

              {/* Collapsible */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Collapsible</h2>
                <div className="space-y-2">
                  <Collapsible title="Klikk for å utvide">
                    <p className="text-pkt-text-body-subtle">
                      Dette innholdet er skjult som standard og vises når brukeren klikker.
                    </p>
                  </Collapsible>
                  <Collapsible title="Åpen som standard" defaultOpen>
                    <p className="text-pkt-text-body-subtle">
                      Denne seksjonen er åpen fra start.
                    </p>
                  </Collapsible>
                </div>
              </Card>

              {/* AccordionGroup */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">AccordionGroup</h2>
                <AccordionGroup
                  items={[
                    {
                      id: 'item-1',
                      title: 'Første seksjon',
                      content: <p className="text-pkt-text-body-subtle">Innhold i første seksjon.</p>,
                    },
                    {
                      id: 'item-2',
                      title: 'Andre seksjon',
                      subtitle: 'Med undertittel',
                      content: <p className="text-pkt-text-body-subtle">Innhold i andre seksjon.</p>,
                    },
                    {
                      id: 'item-3',
                      title: 'Tredje seksjon',
                      badge: <Badge size="sm" variant="info">Ny</Badge>,
                      content: <p className="text-pkt-text-body-subtle">Innhold i tredje seksjon.</p>,
                    },
                  ]}
                />
              </Card>

              {/* SectionContainer */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">SectionContainer</h2>
                <div className="space-y-4">
                  <SectionContainer title="Standard seksjon">
                    <p className="text-pkt-text-body-subtle">Innhold i seksjonen.</p>
                  </SectionContainer>
                  <SectionContainer
                    title="Med beskrivelse"
                    description="En kort forklaring av seksjonen"
                    variant="subtle"
                  >
                    <p className="text-pkt-text-body-subtle">Innhold med ramme.</p>
                  </SectionContainer>
                </div>
              </Card>
            </>
          )}

          {/* ============================================
              TAB 6: ANIMATIONS
              ============================================ */}
          {activeTab === 'animations' && (
            <>
              {/* Info */}
              <Alert variant="info" title="Animasjons-retningslinjer">
                Subtile, funksjonelle animasjoner med standard easing (ease-out). Unngå bouncy/spring-effekter.
              </Alert>

              {/* DashboardCard fadeInUp */}
              <Card variant="outlined" padding="lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-pkt-text-body-dark">DashboardCard - Staggered fadeInUp</h2>
                  <Button size="sm" variant="secondary" onClick={() => setAnimationKey(k => k + 1)}>
                    Replay animasjon
                  </Button>
                </div>
                <p className="text-pkt-text-body-subtle mb-4">
                  Kortene fader inn med økende delay (0ms, 75ms, 150ms). Hover gir shadow-effekt.
                </p>
                <div key={animationKey} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <DashboardCard
                    title="Ansvarsgrunnlag"
                    headerBadge={<Badge variant="warning" size="sm">Venter</Badge>}
                    className="animate-fade-in-up"
                    style={{ animationDelay: '0ms' }}
                  >
                    <DataList variant="grid">
                      <DataListItem label="Status">Under behandling</DataListItem>
                      <DataListItem label="Kategori">Prosjektering</DataListItem>
                    </DataList>
                  </DashboardCard>
                  <DashboardCard
                    title="Vederlag"
                    headerBadge={<Badge variant="info" size="sm">Åpen</Badge>}
                    className="animate-fade-in-up"
                    style={{ animationDelay: '75ms' }}
                  >
                    <DataList variant="grid">
                      <DataListItem label="Krevd" mono>125 000 kr</DataListItem>
                      <DataListItem label="Innstilt" mono>-</DataListItem>
                    </DataList>
                  </DashboardCard>
                  <DashboardCard
                    title="Frist"
                    headerBadge={<Badge variant="success" size="sm">Godkjent</Badge>}
                    className="animate-fade-in-up"
                    style={{ animationDelay: '150ms' }}
                  >
                    <DataList variant="grid">
                      <DataListItem label="Krevd">14 dager</DataListItem>
                      <DataListItem label="Godkjent">10 dager</DataListItem>
                    </DataList>
                  </DashboardCard>
                </div>
              </Card>

              {/* Collapsible - current (no animation) */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Collapsible - Nåværende (ingen animasjon)</h2>
                <p className="text-pkt-text-body-subtle mb-4">
                  Innholdet vises/skjules umiddelbart uten overgang.
                </p>
                <div className="space-y-2">
                  <Collapsible title="Klikk for å se forskjellen">
                    <p className="text-pkt-text-body-subtle">
                      Innholdet popper inn/ut uten smooth overgang. Sammenlign med AccordionGroup under.
                    </p>
                  </Collapsible>
                </div>
              </Card>

              {/* AccordionGroup - with animation */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">AccordionGroup - Med animasjon</h2>
                <p className="text-pkt-text-body-subtle mb-4">
                  Bruker Radix Accordion med innebygd slide-animasjon (accordion-down/up).
                </p>
                <AccordionGroup
                  items={[
                    {
                      id: 'anim-1',
                      title: 'Første seksjon',
                      content: <p className="text-pkt-text-body-subtle">Smooth slide-animasjon når innholdet vises.</p>,
                    },
                    {
                      id: 'anim-2',
                      title: 'Andre seksjon',
                      content: <p className="text-pkt-text-body-subtle">200ms ease-out - subtil og profesjonell.</p>,
                    },
                  ]}
                />
              </Card>

              {/* Hover effects */}
              <Card variant="outlined" padding="lg">
                <h2 className="text-xl font-semibold text-pkt-text-body-dark mb-4">Hover-effekter</h2>
                <p className="text-pkt-text-body-subtle mb-4">
                  Subtile shadow-transitions på hover gir visuell feedback.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-pkt-bg-card rounded border border-pkt-border-subtle transition-shadow duration-200 hover:shadow-md">
                    <p className="font-medium">hover:shadow-md</p>
                    <p className="text-sm text-pkt-text-body-subtle">Standard hover-effekt</p>
                  </div>
                  <div className="p-4 bg-pkt-bg-card rounded border border-pkt-border-subtle transition-shadow duration-200 hover:shadow-lg">
                    <p className="font-medium">hover:shadow-lg</p>
                    <p className="text-sm text-pkt-text-body-subtle">Mer fremtredende</p>
                  </div>
                  <div className="p-4 bg-pkt-bg-card rounded border border-pkt-border-subtle transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
                    <p className="font-medium">hover:shadow + lift</p>
                    <p className="text-sm text-pkt-text-body-subtle">Med subtil løft-effekt</p>
                  </div>
                </div>
              </Card>
            </>
          )}

        </div>
      </main>
    </div>
  );
}

export default ComponentShowcase;
