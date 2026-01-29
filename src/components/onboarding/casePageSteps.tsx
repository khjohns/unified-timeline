/**
 * CasePage Onboarding Steps Configuration
 *
 * Defines the steps for the CasePage user onboarding guide.
 * Each step targets a specific element and explains its purpose.
 */

import type { OnboardingStepConfig } from './OnboardingGuide';

export const casePageSteps: OnboardingStepConfig[] = [
  {
    id: 'welcome',
    title: 'Velkommen til sakssiden',
    description: (
      <>
        <p>
          Dette er hovedsiden for en <strong>KOE-sak</strong> (Krav om Endring).
        </p>
        <p className="mt-2">
          Her kan du se status, sende krav og svare på henvendelser.
        </p>
      </>
    ),
    targetSelector: '[data-onboarding="page-header"]',
    side: 'bottom',
  },
  {
    id: 'status-alert',
    title: 'Kontekstuell veiledning',
    description: (
      <>
        <p>
          Dette feltet viser <strong>hva som skjer nå</strong> og hva du bør gjøre som neste steg.
        </p>
        <p className="mt-2">
          Innholdet oppdateres automatisk basert på sakens tilstand.
        </p>
      </>
    ),
    targetSelector: '[data-onboarding="status-alert"]',
    side: 'bottom',
  },
  {
    id: 'three-track-intro',
    title: 'Tre-spor-modellen',
    description: (
      <>
        <p>
          En KOE-sak har <strong>tre parallelle spor</strong> som behandles uavhengig:
        </p>
        <ul className="mt-2 ml-4 space-y-1 list-disc">
          <li><strong>Grunnlag</strong> – Har TE krav på endring?</li>
          <li><strong>Vederlag</strong> – Hva koster det?</li>
          <li><strong>Frist</strong> – Hvor lang tid trengs?</li>
        </ul>
      </>
    ),
    targetSelector: '[data-onboarding="case-dashboard"]',
    side: 'top',
  },
  {
    id: 'grunnlag-card',
    title: 'Ansvarsgrunnlag',
    description: (
      <>
        <p>
          Her håndteres <strong>ansvarsgrunnlaget</strong> – selve årsaken til endringen.
        </p>
        <p className="mt-2">
          TE varsler om endringen, og BH svarer med godkjenning, avslag eller delvis godkjenning.
        </p>
      </>
    ),
    targetSelector: '[data-onboarding="grunnlag-card"]',
    side: 'bottom',
  },
  {
    id: 'vederlag-card',
    title: 'Vederlagskrav',
    description: (
      <>
        <p>
          Her håndteres <strong>kostnadene</strong> knyttet til endringen.
        </p>
        <p className="mt-2">
          TE sender krav med beløp og metode (enhetspriser, regningsarbeid, etc.),
          og BH responderer med godkjent beløp.
        </p>
      </>
    ),
    targetSelector: '[data-onboarding="vederlag-card"]',
    side: 'bottom',
  },
  {
    id: 'frist-card',
    title: 'Fristforlengelse',
    description: (
      <>
        <p>
          Her håndteres <strong>tidsbehovet</strong> for endringen.
        </p>
        <p className="mt-2">
          TE krever antall dager fristforlengelse, og BH svarer med godkjente dager.
          Ved avslag kan TE kreve forsering (§33.8).
        </p>
      </>
    ),
    targetSelector: '[data-onboarding="frist-card"]',
    side: 'bottom',
  },
  {
    id: 'history',
    title: 'Historikk',
    description: (
      <>
        <p>
          Klikk på <strong>overskriften</strong> i hvert kort for å se historikken.
        </p>
        <p className="mt-2">
          Der kan du se alle hendelser, versjoner og svar som har vært i løpet av saken.
        </p>
      </>
    ),
    targetSelector: '[data-onboarding="grunnlag-card"]',
    side: 'left',
  },
  {
    id: 'metadata',
    title: 'Metadata og eksport',
    description: (
      <>
        <p>
          Nederst finner du <strong>detaljert informasjon</strong> om saken.
        </p>
        <p className="mt-2">
          Du kan også eksportere dataene til Excel eller CSV for videre analyse.
        </p>
      </>
    ),
    targetSelector: '[data-onboarding="metadata-section"]',
    side: 'top',
  },
];
