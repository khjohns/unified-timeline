import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import type {
  SakState,
  SporStatus,
  VederlagsMetode,
  FristVarselType,
  GrunnlagResponsResultat,
  VederlagBeregningResultat,
  FristBeregningResultat,
} from '../types/timeline';
import { styles, COLORS, baseUrl } from './styles';
import { getOverordnetStatusLabel } from '../constants/statusLabels';
import { getHovedkategoriLabel, getUnderkategoriLabel } from '../constants/categories';
import { getVarselMetoderLabels } from '../constants/varselMetoder';

// ============================================================
// Helper Components
// ============================================================

const Header: React.FC = () => (
  <View style={styles.header}>
    <View style={styles.headerContent}>
      <Text style={styles.headerTitle}>Krav fra entreprenør</Text>
      <Text style={styles.headerSubtitle}>NS 8407:2011</Text>
    </View>
    <Image
      src={`${baseUrl}/logos/Oslo-logo-hvit-RGB.png`}
      style={styles.headerLogo}
    />
  </View>
);

const Footer: React.FC<{ pageNumber: number; totalPages: number }> = ({ pageNumber, totalPages }) => (
  <View style={styles.footer} fixed>
    <Text style={styles.footerText}>
      Generert: {new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Oslo' })} kl.{' '}
      {new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' })}
    </Text>
    <Text style={styles.footerPageNumber}>
      Side {pageNumber} av {totalPages}
    </Text>
  </View>
);

const TableRow: React.FC<{ label: string; value: string; striped?: boolean }> = ({ label, value, striped }) => (
  <View style={striped ? [styles.tableRow, styles.tableRowStriped] : styles.tableRow}>
    <Text style={styles.tableLabel}>{label}</Text>
    <Text style={styles.tableValue}>{value}</Text>
  </View>
);

const TableRow4Col: React.FC<{
  label1: string;
  value1: string;
  label2: string;
  value2: string;
  striped?: boolean;
}> = ({ label1, value1, label2, value2, striped }) => (
  <View style={striped ? [styles.tableRow4Col, styles.tableRowStriped] : styles.tableRow4Col}>
    <Text style={styles.tableLabel4Col}>{label1}</Text>
    <Text style={styles.tableValue4Col}>{value1}</Text>
    <Text style={styles.tableLabel4Col}>{label2}</Text>
    <Text style={styles.tableValue4Col}>{value2}</Text>
  </View>
);

const TableCategoryHeader: React.FC<{ title: string; rightText?: string }> = ({ title, rightText }) => (
  <View style={styles.tableCategoryHeader}>
    <Text style={styles.tableCategoryText}>{title}</Text>
    {rightText && <Text style={styles.tableCategoryRight}>{rightText}</Text>}
  </View>
);

const RevisionBadge: React.FC<{ revision: number }> = ({ revision }) => (
  <View style={styles.revisionBadge}>
    <Text style={styles.revisionBadgeText}>Rev. {revision}</Text>
  </View>
);

const TextBlock: React.FC<{ title: string; content?: string }> = ({ title, content }) => {
  if (!content?.trim()) return null;
  return (
    <View style={styles.textBlock}>
      <Text style={styles.textBlockTitle}>{title}</Text>
      <Text style={styles.textBlockContent}>{content}</Text>
    </View>
  );
};

const StatusBadge: React.FC<{ status: SporStatus; label?: string }> = ({ status, label }) => {
  const displayLabel = label || formatStatus(status);

  let badgeStyle = styles.statusGray;
  let textStyle = styles.statusGrayText;

  switch (status) {
    case 'godkjent':
      badgeStyle = styles.statusGreen;
      textStyle = styles.statusGreenText;
      break;
    case 'delvis_godkjent':
      badgeStyle = styles.statusYellow;
      textStyle = styles.statusYellowText;
      break;
    case 'avslatt':
      badgeStyle = styles.statusRed;
      textStyle = styles.statusRedText;
      break;
    case 'sendt':
    case 'under_behandling':
    case 'under_forhandling':
      badgeStyle = styles.statusBlue;
      textStyle = styles.statusBlueText;
      break;
    default:
      badgeStyle = styles.statusGray;
      textStyle = styles.statusGrayText;
  }

  return (
    <View style={[styles.statusBadge, badgeStyle]}>
      <Text style={[styles.statusBadgeText, textStyle]}>{displayLabel}</Text>
    </View>
  );
};

const NotClaimedBox: React.FC<{ message: string }> = ({ message }) => (
  <View style={styles.notClaimedBox}>
    <Text style={styles.notClaimedText}>{message}</Text>
  </View>
);

// ============================================================
// Signature Section (for approved documents)
// ============================================================

export interface SignatureInfo {
  navn: string;
  rolle: string;
  dato: string;
}

interface SignatureSectionProps {
  saksbehandler: SignatureInfo;
  godkjenner: SignatureInfo;
}

const SignatureSection: React.FC<SignatureSectionProps> = ({ saksbehandler, godkjenner }) => (
  <View style={styles.signatureContainer}>
    <View style={styles.signatureBox}>
      <Text style={styles.signatureLabel}>Saksbehandler</Text>
      <Text style={styles.signatureName}>{saksbehandler.navn}</Text>
      <Text style={styles.signatureRole}>{saksbehandler.rolle}</Text>
      <Text style={styles.signatureDate}>{saksbehandler.dato}</Text>
    </View>
    <View style={styles.signatureBox}>
      <Text style={styles.signatureLabel}>Godkjenner</Text>
      <Text style={styles.signatureName}>{godkjenner.navn}</Text>
      <Text style={styles.signatureRole}>{godkjenner.rolle}</Text>
      <Text style={styles.signatureDate}>{godkjenner.dato}</Text>
    </View>
  </View>
);

const SubsidiaerBadge: React.FC = () => (
  <View style={[styles.statusBadge, styles.statusSubsidiaer]}>
    <Text style={[styles.statusBadgeText, styles.statusSubsidiaerText]}>Subsidiært</Text>
  </View>
);

// ============================================================
// Formatting Helpers
// ============================================================

function formatStatus(status: SporStatus): string {
  const statusMap: Record<SporStatus, string> = {
    'ikke_relevant': 'Ikke relevant',
    'utkast': 'Utkast',
    'sendt': 'Sendt til BH',
    'under_behandling': 'Under behandling',
    'godkjent': 'Godkjent',
    'delvis_godkjent': 'Delvis godkjent',
    'avslatt': 'Avslått',
    'under_forhandling': 'Under forhandling',
    'trukket': 'Trukket',
    'laast': 'Låst',
  };
  return statusMap[status] || status;
}

function formatGrunnlagResultat(resultat?: GrunnlagResponsResultat): string {
  if (!resultat) return '—';
  const map: Record<GrunnlagResponsResultat, string> = {
    'godkjent': 'Godkjent',
    'delvis_godkjent': 'Delvis godkjent',
    'avslatt': 'Avslått',
    'frafalt': 'Frafalt (§32.3 c)',
  };
  return map[resultat] || resultat;
}

function formatVederlagResultat(resultat?: VederlagBeregningResultat): string {
  if (!resultat) return '—';
  const map: Record<VederlagBeregningResultat, string> = {
    'godkjent': 'Godkjent',
    'delvis_godkjent': 'Delvis godkjent',
    'avslatt': 'Avslått',
    'hold_tilbake': 'Betaling holdes tilbake (§30.2)',
  };
  return map[resultat] || resultat;
}

function formatFristResultat(resultat?: FristBeregningResultat): string {
  if (!resultat) return '—';
  const map: Record<FristBeregningResultat, string> = {
    'godkjent': 'Godkjent',
    'delvis_godkjent': 'Delvis godkjent',
    'avslatt': 'Avslått',
  };
  return map[resultat] || resultat;
}

function formatVederlagsmetode(metode?: VederlagsMetode): string {
  if (!metode) return '—';
  const metodeMap: Record<VederlagsMetode, string> = {
    'ENHETSPRISER': 'Enhetspriser (§34.3)',
    'REGNINGSARBEID': 'Regningsarbeid med kostnadsoverslag (§30.2, §34.4)',
    'FASTPRIS_TILBUD': 'Fastpris / Tilbud (§34.2.1)',
  };
  return metodeMap[metode] || metode;
}

function formatFristVarselType(type?: FristVarselType): string {
  if (!type) return '—';
  const typeMap: Record<FristVarselType, string> = {
    'varsel': 'Varsel om fristforlengelse (§33.4)',
    'spesifisert': 'Spesifisert krav (§33.6)',
    'begrunnelse_utsatt': 'Begrunnelse for utsettelse (§33.6.2 b)',
  };
  return typeMap[type] || type;
}


function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return '—';
  const prefix = amount < 0 ? '−' : '';
  return `${prefix}${Math.abs(amount).toLocaleString('no-NO')} NOK`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Oslo',
    });
  } catch {
    return dateStr;
  }
}

function formatUnderkategori(underkategori?: string | string[]): string {
  if (!underkategori) return '—';
  if (Array.isArray(underkategori)) {
    return underkategori.map(uk => getUnderkategoriLabel(uk)).join(', ');
  }
  return getUnderkategoriLabel(underkategori);
}

function formatVarselMetode(metode?: string[]): string {
  if (!metode || metode.length === 0) return '—';
  return getVarselMetoderLabels(metode);
}

function formatBoolean(value?: boolean): string {
  if (value === undefined || value === null) return '—';
  return value ? 'Ja' : 'Nei';
}

// ============================================================
// Section Components
// ============================================================

interface CaseInfoProps {
  state: SakState;
}

const CaseInfoSection: React.FC<CaseInfoProps> = ({ state }) => {
  const hasVederlag = state.vederlag.status !== 'ikke_relevant';
  const hasFrist = state.frist.status !== 'ikke_relevant';
  const krevdBelop = state.vederlag.belop_direkte ?? state.vederlag.kostnads_overslag ?? 0;
  const godkjentBelop = state.vederlag.godkjent_belop ?? 0;

  return (
    <View>
      <Text style={styles.title}>{state.sakstittel || 'Uten tittel'}</Text>

      <View style={styles.metadataTable}>
        {/* Saksinformasjon */}
        <TableCategoryHeader title="Saksinformasjon" rightText={`Sak-ID: ${state.sak_id}`} />
        <TableRow4Col
          label1="Status"
          value1={getOverordnetStatusLabel(state.overordnet_status)}
          label2="Opprettet"
          value2={formatDate(state.opprettet)}
        />
        <TableRow4Col
          label1="Siste aktivitet"
          value1={formatDate(state.siste_aktivitet)}
          label2="Hendelser"
          value2={String(state.antall_events)}
          striped
        />

        {/* Vederlagsjustering */}
        {hasVederlag && (
          <>
            <TableCategoryHeader title="Vederlagsjustering" />
            <TableRow4Col
              label1="Krevd"
              value1={formatCurrency(krevdBelop)}
              label2="Godkjent"
              value2={formatCurrency(godkjentBelop)}
            />
          </>
        )}

        {/* Fristforlengelse */}
        {hasFrist && state.frist.krevd_dager !== undefined && (
          <>
            <TableCategoryHeader title="Fristforlengelse" />
            <TableRow4Col
              label1="Krevd"
              value1={`${state.frist.krevd_dager} dager`}
              label2="Godkjent"
              value2={state.frist.godkjent_dager !== undefined ? `${state.frist.godkjent_dager} dager` : '—'}
            />
          </>
        )}
      </View>
    </View>
  );
};

// Table of Contents Component
const TocEntry: React.FC<{ number: string; title: string; status: string; statusType: SporStatus }> = ({
  number,
  title,
  status,
  statusType,
}) => (
  <View style={styles.tocEntry}>
    <View style={styles.tocLeft}>
      <Text style={styles.tocNumber}>{number}</Text>
      <Text style={styles.tocTitle}>{title}</Text>
    </View>
    <StatusBadge status={statusType} label={status} />
  </View>
);

const TableOfContents: React.FC<{ state: SakState }> = ({ state }) => {
  const getStatusInfo = (status: SporStatus): string => {
    if (status === 'ikke_relevant') return 'Ikke krevd';
    if (status === 'utkast') return 'Utkast';
    return formatStatus(status);
  };

  return (
    <View style={styles.tocContainer}>
      <Text style={styles.tocHeader}>Innhold</Text>
      <TocEntry
        number="1."
        title="Ansvarsgrunnlag"
        status={getStatusInfo(state.grunnlag.status)}
        statusType={state.grunnlag.status}
      />
      <TocEntry
        number="2."
        title="Vederlagsjustering"
        status={getStatusInfo(state.vederlag.status)}
        statusType={state.vederlag.status}
      />
      <TocEntry
        number="3."
        title="Fristforlengelse"
        status={getStatusInfo(state.frist.status)}
        statusType={state.frist.status}
      />
    </View>
  );
};

const GrunnlagSection: React.FC<{ state: SakState }> = ({ state }) => {
  const { grunnlag } = state;

  const isNotRelevant = grunnlag.status === 'ikke_relevant' || grunnlag.status === 'utkast';

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader} wrap={false}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>1. ANSVARSGRUNNLAG</Text>
          {grunnlag.antall_versjoner > 1 && (
            <RevisionBadge revision={grunnlag.antall_versjoner} />
          )}
        </View>
        {!isNotRelevant && (
          <View style={styles.sectionStatusRow}>
            <StatusBadge status={grunnlag.status} />
          </View>
        )}
      </View>

      {isNotRelevant ? (
        <NotClaimedBox message="Ansvarsgrunnlag er ikke fastsatt for denne saken." />
      ) : (
        <View>
          <View style={styles.table}>
            {/* Kategorier */}
            {(grunnlag.hovedkategori || grunnlag.underkategori) && (
              <TableRow4Col
                label1="Hovedkategori"
                value1={grunnlag.hovedkategori ? getHovedkategoriLabel(grunnlag.hovedkategori) : '—'}
                label2="Underkategori"
                value2={formatUnderkategori(grunnlag.underkategori)}
              />
            )}
            {/* Datoer */}
            {(grunnlag.dato_oppdaget || grunnlag.grunnlag_varsel?.dato_sendt) && (
              <TableRow4Col
                label1="Dato oppdaget"
                value1={formatDate(grunnlag.dato_oppdaget)}
                label2="Varsel sendt"
                value2={formatDate(grunnlag.grunnlag_varsel?.dato_sendt)}
                striped
              />
            )}
            {/* Varselmetode og sist oppdatert */}
            {(grunnlag.grunnlag_varsel?.metode || grunnlag.siste_oppdatert) && (
              <TableRow4Col
                label1="Varselmetode"
                value1={formatVarselMetode(grunnlag.grunnlag_varsel?.metode)}
                label2="Sist oppdatert"
                value2={formatDate(grunnlag.siste_oppdatert)}
              />
            )}
          </View>

          {/* Beskrivelse - Viktig for juridisk dokumentasjon */}
          <TextBlock title="Beskrivelse av forholdet" content={grunnlag.beskrivelse} />

          {/* BH Response */}
          {grunnlag.bh_resultat && (
            <View style={styles.mainSubSection}>
              <Text style={styles.mainSubSectionTitle}>Byggherrens vurdering</Text>
              <View style={styles.table}>
                <TableRow label="Resultat" value={formatGrunnlagResultat(grunnlag.bh_resultat)} />
              </View>
              <TextBlock title="Byggherrens begrunnelse" content={grunnlag.bh_begrunnelse} />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const VederlagSection: React.FC<{ state: SakState }> = ({ state }) => {
  const { vederlag } = state;

  const isNotClaimed = vederlag.status === 'ikke_relevant';
  const krevdBelop = vederlag.belop_direkte ?? vederlag.kostnads_overslag;

  // Calculate total krevd including særskilte krav
  const totalKrevd = (krevdBelop ?? 0) +
    (vederlag.saerskilt_krav?.rigg_drift?.belop ?? 0) +
    (vederlag.saerskilt_krav?.produktivitet?.belop ?? 0);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader} wrap={false}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>2. VEDERLAGSJUSTERING</Text>
          {vederlag.antall_versjoner > 1 && (
            <RevisionBadge revision={vederlag.antall_versjoner} />
          )}
        </View>
        {!isNotClaimed && (
          <View style={styles.sectionStatusRow}>
            <StatusBadge status={vederlag.status} />
            {state.er_subsidiaert_vederlag && <SubsidiaerBadge />}
          </View>
        )}
      </View>

      {isNotClaimed ? (
        <NotClaimedBox message="Det er ikke fremsatt krav om vederlagsjustering for denne saken." />
      ) : (
        <View>
          {/* Entreprenørens krav - Kompakt oversikt */}
          <View style={styles.mainSubSection}>
            <Text style={styles.mainSubSectionTitle}>Entreprenørens krav</Text>
            <View style={styles.table}>
              <TableRow
                label="Oppgjørsmetode"
                value={formatVederlagsmetode(vederlag.metode)}
              />

              {/* Hovedkrav */}
              <TableRow4Col
                label1="Hovedkrav"
                value1={krevdBelop !== undefined ? formatCurrency(krevdBelop) : '—'}
                label2={vederlag.metode === 'ENHETSPRISER' && vederlag.krever_justert_ep ? 'Justerte EP' : ''}
                value2={vederlag.metode === 'ENHETSPRISER' && vederlag.krever_justert_ep ? 'Ja (§34.3.3)' : ''}
                striped
              />

              {/* Særskilte krav - kompakt visning */}
              {vederlag.saerskilt_krav?.rigg_drift?.belop !== undefined && (
                <TableRow4Col
                  label1="Rigg/drift (§34.1.3)"
                  value1={formatCurrency(vederlag.saerskilt_krav.rigg_drift.belop)}
                  label2="Varslet"
                  value2={formatDate(vederlag.saerskilt_krav.rigg_drift.dato_klar_over)}
                />
              )}
              {vederlag.saerskilt_krav?.produktivitet?.belop !== undefined && (
                <TableRow4Col
                  label1="Produktivitetstap (§34.1.3)"
                  value1={formatCurrency(vederlag.saerskilt_krav.produktivitet.belop)}
                  label2="Varslet"
                  value2={formatDate(vederlag.saerskilt_krav.produktivitet.dato_klar_over)}
                  striped
                />
              )}

              {/* Total */}
              {totalKrevd > (krevdBelop ?? 0) && (
                <TableRow
                  label="Totalt krevd"
                  value={formatCurrency(totalKrevd)}
                />
              )}
            </View>

            {/* Entreprenørens begrunnelse */}
            <TextBlock title="Entreprenørens begrunnelse" content={vederlag.begrunnelse} />
          </View>

          {/* Byggherrens vurdering - Narrativ begrunnelse */}
          {vederlag.bh_resultat && (
            <View style={styles.mainSubSection}>
              <Text style={styles.mainSubSectionTitle}>Byggherrens vurdering</Text>

              {/* Resultat-sammendrag */}
              <View style={styles.table}>
                <TableRow4Col
                  label1="Resultat"
                  value1={formatVederlagResultat(vederlag.bh_resultat)}
                  label2="Godkjent beløp"
                  value2={vederlag.godkjent_belop !== undefined ? formatCurrency(vederlag.godkjent_belop) : '—'}
                />
                {vederlag.godkjenningsgrad_prosent != null && (
                  <TableRow4Col
                    label1="Godkjenningsgrad"
                    value1={`${vederlag.godkjenningsgrad_prosent.toFixed(1)}%`}
                    label2="Differanse"
                    value2={vederlag.differanse !== undefined ? formatCurrency(vederlag.differanse) : '—'}
                    striped
                  />
                )}
                {vederlag.bh_metode && vederlag.bh_metode !== vederlag.metode && (
                  <TableRow
                    label="Endret beregningsmetode"
                    value={formatVederlagsmetode(vederlag.bh_metode)}
                  />
                )}
              </View>

              {/* Subsidiært standpunkt */}
              {vederlag.har_subsidiaert_standpunkt && vederlag.subsidiaer_godkjent_belop !== undefined && (
                <View style={styles.subsidiaerBox}>
                  <Text style={styles.subsidiaerTitle}>Subsidiært standpunkt</Text>
                  <Text style={styles.subsidiaerText}>
                    Dersom de prekluderte kravene hadde vært varslet i tide: {formatCurrency(vederlag.subsidiaer_godkjent_belop)}
                  </Text>
                </View>
              )}

              {/* Hovedbegrunnelse - Narrativ tekst generert fra valgene */}
              <TextBlock title="Begrunnelse" content={vederlag.bh_begrunnelse} />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const FristSection: React.FC<{ state: SakState }> = ({ state }) => {
  const { frist } = state;

  const isNotClaimed = frist.status === 'ikke_relevant';

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader} wrap={false}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>3. FRISTFORLENGELSE</Text>
          {frist.antall_versjoner > 1 && (
            <RevisionBadge revision={frist.antall_versjoner} />
          )}
        </View>
        {!isNotClaimed && (
          <View style={styles.sectionStatusRow}>
            <StatusBadge status={frist.status} />
            {state.er_subsidiaert_frist && <SubsidiaerBadge />}
          </View>
        )}
      </View>

      {isNotClaimed ? (
        <NotClaimedBox message="Det er ikke fremsatt krav om fristforlengelse for denne saken." />
      ) : (
        <View>
          {/* Entreprenørens krav - Kompakt oversikt */}
          <View style={styles.mainSubSection}>
            <Text style={styles.mainSubSectionTitle}>Entreprenørens krav</Text>
            <View style={styles.table}>
              <TableRow4Col
                label1="Varseltype"
                value1={formatFristVarselType(frist.varsel_type)}
                label2="Krevd dager"
                value2={frist.krevd_dager !== undefined ? `${frist.krevd_dager} dager` : '—'}
              />
              {/* Varseldato */}
              {frist.varsel_type === 'varsel' && frist.frist_varsel?.dato_sendt && (
                <TableRow
                  label="Varsel om fristforlengelse"
                  value={formatDate(frist.frist_varsel?.dato_sendt)}
                  striped
                />
              )}
              {frist.varsel_type === 'spesifisert' && frist.spesifisert_varsel?.dato_sendt && (
                <TableRow
                  label="Spesifisert krav"
                  value={formatDate(frist.spesifisert_varsel?.dato_sendt)}
                  striped
                />
              )}
            </View>

            {/* Entreprenørens begrunnelse */}
            <TextBlock title="Entreprenørens begrunnelse" content={frist.begrunnelse} />
          </View>

          {/* Byggherrens vurdering - Narrativ begrunnelse */}
          {frist.bh_resultat && (
            <View style={styles.mainSubSection}>
              <Text style={styles.mainSubSectionTitle}>Byggherrens vurdering</Text>

              {/* Resultat-sammendrag */}
              <View style={styles.table}>
                <TableRow4Col
                  label1="Resultat"
                  value1={formatFristResultat(frist.bh_resultat)}
                  label2="Godkjent dager"
                  value2={frist.godkjent_dager !== undefined ? `${frist.godkjent_dager} dager` : '—'}
                />
                {frist.krevd_dager !== undefined && frist.godkjent_dager !== undefined && (
                  <TableRow4Col
                    label1="Godkjenningsgrad"
                    value1={frist.krevd_dager > 0 ? `${((frist.godkjent_dager / frist.krevd_dager) * 100).toFixed(0)}%` : '—'}
                    label2="Differanse"
                    value2={`${(frist.krevd_dager - frist.godkjent_dager)} dager`}
                    striped
                  />
                )}
                {frist.ny_sluttdato && (
                  <TableRow
                    label="Ny sluttdato"
                    value={formatDate(frist.ny_sluttdato)}
                  />
                )}
              </View>

              {/* Subsidiært standpunkt */}
              {frist.har_subsidiaert_standpunkt && frist.subsidiaer_godkjent_dager !== undefined && (
                <View style={styles.subsidiaerBox}>
                  <Text style={styles.subsidiaerTitle}>Subsidiært standpunkt</Text>
                  <Text style={styles.subsidiaerText}>
                    Dersom byggherren ikke får medhold i sin prinsipale avvisning: Maks {frist.subsidiaer_godkjent_dager} dager
                  </Text>
                </View>
              )}

              {/* Hovedbegrunnelse - Narrativ tekst generert fra valgene */}
              <TextBlock title="Begrunnelse" content={frist.bh_begrunnelse} />
            </View>
          )}

          {/* Forsering (§33.8) - vises når saken har forsering_data */}
          {state.forsering_data && (
            <View style={styles.subSection}>
              <Text style={styles.subSectionTitle}>Forsering (§33.8)</Text>
              <View style={styles.table}>
                <TableRow4Col
                  label1="Varslet dato"
                  value1={formatDate(state.forsering_data.dato_varslet)}
                  label2="Estimert kostnad"
                  value2={state.forsering_data.estimert_kostnad !== undefined ? formatCurrency(state.forsering_data.estimert_kostnad) : '—'}
                />
                <TableRow4Col
                  label1="30%-regel"
                  value1={formatBoolean(state.forsering_data.bekreft_30_prosent_regel)}
                  label2="Iverksatt"
                  value2={formatBoolean(state.forsering_data.er_iverksatt)}
                  striped
                />
                {(state.forsering_data.dato_iverksatt || state.forsering_data.er_stoppet) && (
                  <TableRow4Col
                    label1="Dato iverksatt"
                    value1={formatDate(state.forsering_data.dato_iverksatt)}
                    label2="Stoppet"
                    value2={state.forsering_data.er_stoppet ? `Ja (${formatDate(state.forsering_data.dato_stoppet)})` : 'Nei'}
                  />
                )}
                {state.forsering_data.paalopte_kostnader !== undefined && (
                  <TableRow label="Påløpte kostnader" value={formatCurrency(state.forsering_data.paalopte_kostnader)} striped />
                )}
              </View>
              <TextBlock title="Begrunnelse for forsering" content={state.forsering_data.begrunnelse} />
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// ============================================================
// Main Document Component
// ============================================================

export interface ContractorClaimPdfProps {
  state: SakState;
  /** Signature data - only shown when both are provided (after full approval) */
  saksbehandler?: SignatureInfo;
  godkjenner?: SignatureInfo;
}

export const ContractorClaimPdf: React.FC<ContractorClaimPdfProps> = ({
  state,
  saksbehandler,
  godkjenner,
}) => {
  // Signatur vises kun når begge er satt (etter full godkjenning)
  const showSignatures = saksbehandler && godkjenner;

  // Bestem hvilke seksjoner som skal inkluderes
  const harGrunnlag = state.grunnlag.status !== 'ikke_relevant' && state.grunnlag.status !== 'utkast';
  const harVederlag = state.vederlag.status !== 'ikke_relevant';
  const harFrist = state.frist.status !== 'ikke_relevant';

  // Finn siste side for signaturplassering
  const isLastPageFrist = harFrist;
  const isLastPageVederlag = !harFrist && harVederlag;
  const isLastPageGrunnlag = !harFrist && !harVederlag && harGrunnlag;

  // Dynamisk beregning av totale sider
  // Side 1 = Tittelside (alltid) + 1 per relevant seksjon
  const totalPages = 1 + (harGrunnlag ? 1 : 0) + (harVederlag ? 1 : 0) + (harFrist ? 1 : 0);

  // Forhåndsberegn sidetall for hver seksjon
  const grunnlagPage = 2;
  const vederlagPage = harGrunnlag ? 3 : 2;
  const fristPage = (harGrunnlag ? 1 : 0) + (harVederlag ? 1 : 0) + 2;

  return (
    <Document
      title={`Entreprenørkrav - ${state.sakstittel || state.sak_id}`}
      author="Oslo Kommune"
      subject="Krav fra entreprenør iht. NS 8407:2011"
    >
      {/* Side 1: Tittelside */}
      <Page size="A4" style={styles.page}>
        <Header />
        <CaseInfoSection state={state} />
        <TableOfContents state={state} />
        <Footer pageNumber={1} totalPages={totalPages} />
      </Page>

      {/* Grunnlag (hvis relevant) */}
      {harGrunnlag && (
        <Page size="A4" style={styles.page}>
          <Header />
          <GrunnlagSection state={state} />
          {showSignatures && isLastPageGrunnlag && (
            <SignatureSection saksbehandler={saksbehandler} godkjenner={godkjenner} />
          )}
          <Footer pageNumber={grunnlagPage} totalPages={totalPages} />
        </Page>
      )}

      {/* Vederlagsjustering (hvis relevant) */}
      {harVederlag && (
        <Page size="A4" style={styles.page}>
          <Header />
          <VederlagSection state={state} />
          {showSignatures && isLastPageVederlag && (
            <SignatureSection saksbehandler={saksbehandler} godkjenner={godkjenner} />
          )}
          <Footer pageNumber={vederlagPage} totalPages={totalPages} />
        </Page>
      )}

      {/* Fristforlengelse (hvis relevant) */}
      {harFrist && (
        <Page size="A4" style={styles.page}>
          <Header />
          <FristSection state={state} />
          {showSignatures && isLastPageFrist && (
            <SignatureSection saksbehandler={saksbehandler} godkjenner={godkjenner} />
          )}
          <Footer pageNumber={fristPage} totalPages={totalPages} />
        </Page>
      )}
    </Document>
  );
};

export default ContractorClaimPdf;
