/**
 * BACKUP: Veiviser-innhold fra RespondVederlagModal, RespondFristModal og BHResponsForseringModal
 *
 * Fjernet fra oversikts-steget for å forenkle modalene.
 * Kan gjeninnføres hvis brukertesting viser behov.
 *
 * Dato: 2025-01-30
 */

// ============================================================================
// VEDERLAG MODAL - Veiviser (lå i Oversikt-steget)
// ============================================================================

/**
 * Props som kreves:
 * - harPreklusjonsSteg: boolean
 */
export const VederlagVeiviser = `
{/* Veiviser */}
<div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
  <h4 className="font-medium text-sm mb-3">Hva du skal vurdere</h4>
  <div className="space-y-2 text-sm">
    {harPreklusjonsSteg && (
      <div className="flex gap-3">
        <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 2</span>
        <div>
          <span className="font-medium">Preklusjon</span>
          <span className="text-pkt-text-body-subtle">
            {' '}
            — Ta stilling til om kravene ble varslet i tide
          </span>
        </div>
      </div>
    )}
    <div className="flex gap-3">
      <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">
        Steg {harPreklusjonsSteg ? 3 : 2}
      </span>
      <div>
        <span className="font-medium">Beregningsmetode</span>
        <span className="text-pkt-text-body-subtle">
          {' '}
          — Akseptere eller endre beregningsmetode
        </span>
      </div>
    </div>
    <div className="flex gap-3">
      <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">
        Steg {harPreklusjonsSteg ? 4 : 3}
      </span>
      <div>
        <span className="font-medium">Beløp</span>
        <span className="text-pkt-text-body-subtle"> — Vurdere beløpene for hvert krav</span>
      </div>
    </div>
    <div className="flex gap-3">
      <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">
        Steg {harPreklusjonsSteg ? 5 : 4}
      </span>
      <div>
        <span className="font-medium">Oppsummering</span>
        <span className="text-pkt-text-body-subtle"> — Se samlet resultat og send svar</span>
      </div>
    </div>
  </div>
</div>
`;


// ============================================================================
// FRIST MODAL - Veiviser (lå i Oversikt-steget)
// ============================================================================

/**
 * Props som kreves:
 * - varselType: 'varsel' | 'spesifisert' | 'begrunnelse_utsatt'
 */
export const FristVeiviser = `
{/* Veiviser */}
<div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
  <h4 className="font-medium text-sm mb-3">Hva du skal vurdere</h4>
  <div className="space-y-2 text-sm">
    <div className="flex gap-3">
      <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 2</span>
      <div>
        <span className="font-medium">Preklusjon</span>
        <span className="text-pkt-text-body-subtle">
          {' '}
          — Ble kravet varslet i tide? (§33.4/§33.6)
        </span>
      </div>
    </div>
    <div className="flex gap-3">
      <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 3</span>
      <div>
        <span className="font-medium">Årsakssammenheng</span>
        <span className="text-pkt-text-body-subtle">
          {' '}
          — Forårsaket forholdet faktisk forsinkelse? (§33.1)
        </span>
      </div>
    </div>
    <div className="flex gap-3">
      <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 4</span>
      <div>
        <span className="font-medium">Beregning</span>
        <span className="text-pkt-text-body-subtle">
          {' '}
          — Hvor mange kalenderdager? (§33.5)
        </span>
      </div>
    </div>
    <div className="flex gap-3">
      <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 5</span>
      <div>
        <span className="font-medium">Oppsummering</span>
        <span className="text-pkt-text-body-subtle"> — Se resultat og send svar</span>
      </div>
    </div>
  </div>

  {/* Etterlysning-info for foreløpig varsel */}
  {varselType === 'varsel' && (
    <div className="mt-4 pt-3 border-t border-pkt-border-subtle text-sm text-pkt-text-body-subtle">
      <strong>Merk:</strong> Ved foreløpig varsel kan du etterspørre et spesifisert krav
      (§33.6.2). Hvis entreprenøren ikke svarer i tide, tapes kravet.
    </div>
  )}
</div>
`;


// ============================================================================
// FORSERING MODAL - Veiviser (lå i Oversikt-steget)
// ============================================================================

/**
 * Fil: src/components/forsering/BHResponsForseringModal.tsx
 * Ingen props kreves
 */
export const ForseringVeiviser = `
{/* Veiviser */}
<div className="p-4 bg-pkt-surface-subtle rounded-none border border-pkt-border-subtle">
  <h4 className="font-medium text-sm mb-3">Hva du skal vurdere</h4>
  <div className="space-y-2 text-sm">
    <div className="flex gap-3">
      <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 2</span>
      <div>
        <span className="font-medium">Forseringsrett</span>
        <span className="text-pkt-text-body-subtle">
          {' '}— Var avslagene på fristforlengelse berettiget? (§33.8)
        </span>
      </div>
    </div>
    <div className="flex gap-3">
      <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 3</span>
      <div>
        <span className="font-medium">30%-regel</span>
        <span className="text-pkt-text-body-subtle">
          {' '}— Er kostnadene innenfor dagmulkt + 30%?
        </span>
      </div>
    </div>
    <div className="flex gap-3">
      <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 4</span>
      <div>
        <span className="font-medium">Beløpsvurdering</span>
        <span className="text-pkt-text-body-subtle">
          {' '}— Vurder forseringskostnadene
        </span>
      </div>
    </div>
    <div className="flex gap-3">
      <span className="font-mono text-pkt-text-body-subtle w-16 shrink-0">Steg 5</span>
      <div>
        <span className="font-medium">Oppsummering</span>
        <span className="text-pkt-text-body-subtle">
          {' '}— Se resultat og send standpunkt
        </span>
      </div>
    </div>
  </div>
</div>
`;
