/**
 * SaksoversiktPage Component
 *
 * Project dashboard with bento grid layout showing:
 * - Row 1: Project identity + Progress + Dagmulkt + Recent activity
 * - Row 2: Case list (compact/expanded) + Economics chart
 * - Row 3: Category breakdown
 */

import { useState, useMemo, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Button,
  DropdownMenuItem,
} from '../components/primitives';
import { PageHeader } from '../components/PageHeader';
import {
  ProjectIdentityTile,
  ProgressTile,
  DagmulktTile,
  RecentActivityTile,
  CaseListTile,
  EconomicsChartTile,
  CategoryBreakdownTile,
} from '../components/dashboard';
import { useCaseListSuspense } from '../hooks/useCaseList';
import { useAuth } from '../context/AuthContext';
import { useProject } from '../context/ProjectContext';
import { useUserRole } from '../context/UserRoleContext';
import { useContractSettings } from '../hooks/useContractSettings';
import { LoadingState, VerifyingState } from '../components/PageStateHelpers';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { downloadAllCasesExcel } from '../utils/excelExport';
import {
  PlusIcon,
  RocketIcon,
  TimerIcon,
  BarChartIcon,
} from '@radix-ui/react-icons';

// ========== Main Component ==========

export function SaksoversiktPage() {
  const { isVerifying } = useAuth();

  if (isVerifying) {
    return <VerifyingState />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingState />}>
        <SaksoversiktContent />
      </Suspense>
    </ErrorBoundary>
  );
}

function SaksoversiktContent() {
  const navigate = useNavigate();
  const { userRole } = useUserRole();
  const { activeProject } = useProject();
  const { contract } = useContractSettings();
  const [caseListExpanded, setCaseListExpanded] = useState(false);

  // Data
  const { data } = useCaseListSuspense({});
  const allCases = data.cases;

  // ========== Computed ==========

  const kpi = useMemo(() => {
    const totalKrevd = allCases.reduce((sum, c) => sum + (c.cached_sum_krevd ?? 0), 0);
    const totalGodkjent = allCases.reduce((sum, c) => sum + (c.cached_sum_godkjent ?? 0), 0);
    const totalDagerGodkjent = allCases.reduce((sum, c) => sum + (c.cached_dager_godkjent ?? 0), 0);

    // Forsering KPI - aggregate from active forsering cases
    const CLOSED = new Set(['OMFORENT', 'LUKKET', 'LUKKET_TRUKKET']);
    const forseringCases = allCases.filter(
      c => c.sakstype === 'forsering' && !CLOSED.has(c.cached_status ?? '')
    );
    const forseringPaalopt = forseringCases.reduce((sum, c) => sum + (c.cached_forsering_paalopt ?? 0), 0);
    const forseringMaks = forseringCases.reduce((sum, c) => sum + (c.cached_forsering_maks ?? 0), 0);
    const forseringCount = forseringCases.length;

    return { totalKrevd, totalGodkjent, totalDagerGodkjent, forseringPaalopt, forseringMaks, forseringCount };
  }, [allCases]);

  // ========== Render ==========

  return (
    <div className="min-h-screen bg-pkt-bg-subtle">
      <PageHeader
        title="Prosjektoversikt"
        subtitle={activeProject.name}
        maxWidth="wide"
        menuActions={
          <>
            <DropdownMenuItem asChild>
              <Link to={userRole === 'BH' ? '/endringsordre/ny' : '/saker/ny'}>
                {userRole === 'BH' ? 'Opprett endringsordre' : 'Opprett ny sak'}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/analyse">Analysedashboard</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => downloadAllCasesExcel(allCases)}>
              Eksporter til Excel
            </DropdownMenuItem>
          </>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* ===== Empty State: No cases at all ===== */}
        {allCases.length === 0 ? (
          <EmptyProjectState
            projectName={activeProject.name}
            userRole={userRole}
            onCreateCase={() => navigate(userRole === 'BH' ? '/endringsordre/ny' : '/saker/ny')}
          />
        ) : (
          /* ===== Bento Grid ===== */
          <div className="grid grid-cols-12 gap-4">
            {/* Row 1: Identity(4) + Progress(5) + Dagmulkt(3) = 12 */}
            <ProjectIdentityTile
              projectName={activeProject.name}
              contract={contract}
              cases={allCases}
              userRole={userRole}
            />
            <ProgressTile
              contract={contract}
              totalDagerGodkjent={kpi.totalDagerGodkjent}
            />
            <DagmulktTile
              contract={contract}
              totalDagerGodkjent={kpi.totalDagerGodkjent}
              forseringPaalopt={kpi.forseringPaalopt}
              forseringMaks={kpi.forseringMaks}
              forseringCount={kpi.forseringCount}
            />

            {/* Row 1.5: Recent activity strip (12) */}
            <RecentActivityTile cases={allCases} />

            {/* Row 2: Case list (compact/expanded) + Economics chart */}
            <CaseListTile
              cases={allCases}
              allCases={allCases}
              userRole={userRole}
              expanded={caseListExpanded}
              onToggleExpand={() => setCaseListExpanded(prev => !prev)}
            />
            <EconomicsChartTile
              cases={allCases}
              contract={contract}
              totalKrevd={kpi.totalKrevd}
              totalGodkjent={kpi.totalGodkjent}
            />

            {/* Row 3: Category breakdown */}
            <CategoryBreakdownTile cases={allCases} />
          </div>
        )}
      </main>
    </div>
  );
}

// ========== Empty State ==========

function EmptyProjectState({
  projectName,
  userRole,
  onCreateCase,
}: {
  projectName: string;
  userRole: 'BH' | 'TE';
  onCreateCase: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-pkt-grays-gray-200 bg-pkt-bg-card">
      <div
        className="absolute top-0 right-0 w-64 h-64 opacity-10 blur-3xl pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, var(--color-pkt-brand-blue-1000) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10 text-center py-16 px-6 max-w-md mx-auto">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-pkt-surface-light-blue flex items-center justify-center">
          <RocketIcon className="w-8 h-8 text-pkt-brand-warm-blue-1000" />
        </div>
        <h3 className="text-xl font-bold text-pkt-text-body-dark mb-2">
          Kom i gang med {projectName}
        </h3>
        <p className="text-sm text-pkt-text-body-subtle mb-8 leading-relaxed">
          {userRole === 'BH'
            ? 'Opprett din første endringsordre for å starte digital håndtering etter NS 8407.'
            : 'Opprett din første KOE-sak for å starte digital håndtering av endringsordrer etter NS 8407.'}
        </p>
        <Button variant="primary" onClick={onCreateCase}>
          <PlusIcon className="w-4 h-4 mr-1.5" />
          {userRole === 'BH' ? 'Opprett første endringsordre' : 'Opprett første sak'}
        </Button>

        <div className="flex items-center gap-3 mt-8 pt-6 border-t border-pkt-border-subtle">
          <div className="flex-1 h-px bg-pkt-border-subtle" />
          <span className="text-xs text-pkt-text-body-subtle">
            NS 8407:2011
          </span>
          <div className="flex-1 h-px bg-pkt-border-subtle" />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 text-center">
          {[
            { icon: BarChartIcon, label: 'Grunnlag' },
            { icon: TimerIcon, label: 'Frist' },
            { icon: RocketIcon, label: 'Vederlag' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-pkt-bg-subtle flex items-center justify-center">
                <Icon className="w-4 h-4 text-pkt-text-body-subtle" />
              </div>
              <span className="text-xs text-pkt-text-body-subtle">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SaksoversiktPage;
