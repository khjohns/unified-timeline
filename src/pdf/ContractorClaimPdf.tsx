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

const Footer: React.FC = () => (
  <View style={styles.footer} fixed>
    <Text>
      Generert: {new Date().toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })} kl.{' '}
      {new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
    </Text>
    <Text render={({ pageNumber, totalPages }) => `Side ${pageNumber} av ${totalPages}`} />
  </View>
);

const TableRow: React.FC<{ label: string; value: string; striped?: boolean }> = ({ label, value, striped }) => (
  <View style={[styles.tableRow, striped && styles.tableRowStriped]}>
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
  <View style={[styles.tableRow4Col, striped && styles.tableRowStriped]}>
    <Text style={styles.tableLabel4Col}>{label1}</Text>
    <Text style={styles.tableValue4Col}>{value1}</Text>
    <Text style={styles.tableLabel4Col}>{label2}</Text>
    <Text style={styles.tableValue4Col}>{value2}</Text>
  </View>
);

const TableCategoryHeader: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.tableCategoryHeader}>
    <Text style={styles.tableCategoryText}>{title}</Text>
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
    'erkjenn_fm': 'Force majeure erkjent',
    'avslatt': 'Avslått',
    'frafalt': 'Frafalt (pålegg trukket)',
    'krever_avklaring': 'Krever avklaring',
  };
  return map[resultat] || resultat;
}

function formatVederlagResultat(resultat?: VederlagBeregningResultat): string {
  if (!resultat) return '—';
  const map: Record<VederlagBeregningResultat, string> = {
    'godkjent': 'Godkjent',
    'delvis_godkjent': 'Delvis godkjent',
    'avslatt': 'Avslått',
    'hold_tilbake': 'Betaling holdes tilbake',
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
    'REGNINGSARBEID': 'Regningsarbeid (§30.2/§34.4)',
    'FASTPRIS_TILBUD': 'Fastpris/Tilbud (§34.2.1)',
  };
  return metodeMap[metode] || metode;
}

function formatFristVarselType(type?: FristVarselType): string {
  if (!type) return '—';
  const typeMap: Record<FristVarselType, string> = {
    'noytralt': 'Nøytralt varsel (§33.4)',
    'spesifisert': 'Spesifisert krav (§33.6)',
    'force_majeure': 'Force majeure (§33.3)',
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
    return new Date(dateStr).toLocaleDateString('no-NO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatUnderkategori(underkategori?: string | string[]): string {
  if (!underkategori) return '—';
  if (Array.isArray(underkategori)) {
    return underkategori.join(', ');
  }
  return underkategori;
}

function formatVarselMetode(metode?: string[]): string {
  if (!metode || metode.length === 0) return '—';
  return metode.join(', ');
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
      <Text style={styles.sakId}>Sak-ID: {state.sak_id}</Text>

      <View style={styles.metadataTable}>
        {/* Saksinformasjon */}
        <TableCategoryHeader title="Saksinformasjon" />
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

        {/* Økonomisk sammendrag */}
        {hasVederlag && (
          <>
            <TableCategoryHeader title="Økonomisk sammendrag" />
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

const GrunnlagSection: React.FC<{ state: SakState }> = ({ state }) => {
  const { grunnlag } = state;

  const isNotRelevant = grunnlag.status === 'ikke_relevant' || grunnlag.status === 'utkast';

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader} wrap={false}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>1. GRUNNLAG</Text>
          {grunnlag.antall_versjoner > 1 && (
            <Text style={{ fontSize: 8, color: COLORS.muted }}>
              (Rev. {grunnlag.antall_versjoner})
            </Text>
          )}
        </View>
        {!isNotRelevant && (
          <View style={styles.sectionStatusRow}>
            <StatusBadge status={grunnlag.status} />
          </View>
        )}
      </View>

      {isNotRelevant ? (
        <NotClaimedBox message="Grunnlag er ikke fastsatt for denne saken." />
      ) : (
        <View>
          <View style={styles.table} wrap={false}>
            {/* Kategorier */}
            {(grunnlag.hovedkategori || grunnlag.underkategori) && (
              <TableRow4Col
                label1="Hovedkategori"
                value1={grunnlag.hovedkategori || '—'}
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
            {/* Kontraktsreferanser - full bredde */}
            {grunnlag.kontraktsreferanser && grunnlag.kontraktsreferanser.length > 0 && (
              <TableRow label="Kontraktsreferanser" value={grunnlag.kontraktsreferanser.join(', ')} striped />
            )}
          </View>

          {/* Beskrivelse - Viktig for juridisk dokumentasjon */}
          <TextBlock title="Beskrivelse av forholdet" content={grunnlag.beskrivelse} />

          {/* BH Response */}
          {grunnlag.bh_resultat && (
            <View style={styles.mainSubSection} wrap={false}>
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

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader} wrap={false}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>2. VEDERLAGSJUSTERING</Text>
          {vederlag.antall_versjoner > 1 && (
            <Text style={{ fontSize: 8, color: COLORS.muted }}>
              (Rev. {vederlag.antall_versjoner})
            </Text>
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
          {/* Entreprenørens krav */}
          <View style={styles.mainSubSection} wrap={false}>
            <Text style={styles.mainSubSectionTitle}>Entreprenørens krav</Text>
            <View style={styles.table}>
              <TableRow4Col
                label1="Oppgjørsmetode"
                value1={formatVederlagsmetode(vederlag.metode)}
                label2={vederlag.metode === 'REGNINGSARBEID' ? 'Kostnadsoverslag' : 'Krevd beløp'}
                value2={krevdBelop !== undefined ? formatCurrency(krevdBelop) : '—'}
              />
              <TableRow4Col
                label1="Justerte EP"
                value1={formatBoolean(vederlag.krever_justert_ep)}
                label2="Krav fremmet"
                value2={formatDate(vederlag.krav_fremmet_dato)}
                striped
              />
              {vederlag.siste_oppdatert && (
                <TableRow label="Sist oppdatert" value={formatDate(vederlag.siste_oppdatert)} />
              )}
            </View>

            {/* Begrunnelse - Viktig for juridisk dokumentasjon */}
            <TextBlock title="Begrunnelse og kalkyle" content={vederlag.begrunnelse} />
          </View>

          {/* Varsler */}
          {(vederlag.rigg_drift_varsel || vederlag.justert_ep_varsel || vederlag.regningsarbeid_varsel || vederlag.produktivitetstap_varsel) && (
            <View style={styles.subSection} wrap={false}>
              <Text style={styles.subSectionTitle}>Varsler</Text>
              <View style={styles.table}>
                {(vederlag.rigg_drift_varsel?.dato_sendt || vederlag.justert_ep_varsel?.dato_sendt) && (
                  <TableRow4Col
                    label1="Rigg/drift"
                    value1={formatDate(vederlag.rigg_drift_varsel?.dato_sendt)}
                    label2="Justerte EP"
                    value2={formatDate(vederlag.justert_ep_varsel?.dato_sendt)}
                  />
                )}
                {(vederlag.regningsarbeid_varsel?.dato_sendt || vederlag.produktivitetstap_varsel?.dato_sendt) && (
                  <TableRow4Col
                    label1="Regningsarbeid"
                    value1={formatDate(vederlag.regningsarbeid_varsel?.dato_sendt)}
                    label2="Produktivitetstap"
                    value2={formatDate(vederlag.produktivitetstap_varsel?.dato_sendt)}
                    striped
                  />
                )}
              </View>
            </View>
          )}

          {/* Særskilte krav (§34.1.3) */}
          {vederlag.saerskilt_krav && (vederlag.saerskilt_krav.rigg_drift || vederlag.saerskilt_krav.produktivitet) && (
            <View style={styles.subSection} wrap={false}>
              <Text style={styles.subSectionTitle}>Særskilte krav (§34.1.3)</Text>
              <View style={styles.table}>
                {vederlag.saerskilt_krav.rigg_drift?.belop !== undefined && (
                  <TableRow4Col
                    label1="Rigg/drift beløp"
                    value1={formatCurrency(vederlag.saerskilt_krav.rigg_drift.belop)}
                    label2="Dato klar over"
                    value2={formatDate(vederlag.saerskilt_krav.rigg_drift.dato_klar_over)}
                  />
                )}
                {vederlag.saerskilt_krav.produktivitet?.belop !== undefined && (
                  <TableRow4Col
                    label1="Produktivitetstap"
                    value1={formatCurrency(vederlag.saerskilt_krav.produktivitet.belop)}
                    label2="Dato klar over"
                    value2={formatDate(vederlag.saerskilt_krav.produktivitet.dato_klar_over)}
                    striped
                  />
                )}
              </View>
            </View>
          )}

          {/* BH Response - Port 1: Varsling */}
          {(vederlag.saerskilt_varsel_rigg_drift_ok !== undefined ||
            vederlag.varsel_justert_ep_ok !== undefined ||
            vederlag.varsel_start_regning_ok !== undefined ||
            vederlag.krav_fremmet_i_tide !== undefined) && (
            <View style={styles.mainSubSection} wrap={false}>
              <Text style={styles.mainSubSectionTitle}>Byggherrens vurdering – Varsling</Text>
              <View style={styles.table}>
                <TableRow4Col
                  label1="Rigg/drift OK"
                  value1={formatBoolean(vederlag.saerskilt_varsel_rigg_drift_ok)}
                  label2="Justerte EP OK"
                  value2={formatBoolean(vederlag.varsel_justert_ep_ok)}
                />
                <TableRow4Col
                  label1="Start regning OK"
                  value1={formatBoolean(vederlag.varsel_start_regning_ok)}
                  label2="Krav i tide"
                  value2={formatBoolean(vederlag.krav_fremmet_i_tide)}
                  striped
                />
              </View>
              <TextBlock title="Begrunnelse varselvurdering" content={vederlag.begrunnelse_varsel} />
            </View>
          )}

          {/* BH Response - Port 2: Beregning */}
          {vederlag.bh_resultat && (
            <View style={styles.mainSubSection} wrap={false}>
              <Text style={styles.mainSubSectionTitle}>Byggherrens vurdering – Beregning</Text>
              <View style={styles.table}>
                <TableRow4Col
                  label1="Resultat"
                  value1={formatVederlagResultat(vederlag.bh_resultat)}
                  label2="Godkjent metode"
                  value2={formatVederlagsmetode(vederlag.bh_metode)}
                />
                <TableRow4Col
                  label1="Godkjent beløp"
                  value1={vederlag.godkjent_belop !== undefined ? formatCurrency(vederlag.godkjent_belop) : '—'}
                  label2="Differanse"
                  value2={vederlag.differanse !== undefined ? formatCurrency(vederlag.differanse) : '—'}
                  striped
                />
                {vederlag.godkjenningsgrad_prosent !== undefined && (
                  <TableRow
                    label="Godkjenningsgrad"
                    value={`${vederlag.godkjenningsgrad_prosent.toFixed(1)}%`}
                  />
                )}
              </View>
              <TextBlock title="Byggherrens begrunnelse" content={vederlag.bh_begrunnelse} />
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
            <Text style={{ fontSize: 8, color: COLORS.muted }}>
              (Rev. {frist.antall_versjoner})
            </Text>
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
          {/* Entreprenørens krav */}
          <View style={styles.mainSubSection} wrap={false}>
            <Text style={styles.mainSubSectionTitle}>Entreprenørens krav</Text>
            <View style={styles.table}>
              <TableRow4Col
                label1="Varseltype"
                value1={formatFristVarselType(frist.varsel_type)}
                label2="Krevd dager"
                value2={frist.krevd_dager !== undefined ? `${frist.krevd_dager} dager` : '—'}
              />
              <TableRow4Col
                label1="Nøytralt varsel"
                value1={formatDate(frist.noytralt_varsel?.dato_sendt)}
                label2="Spesifisert krav"
                value2={formatDate(frist.spesifisert_varsel?.dato_sendt)}
                striped
              />
              <TableRow4Col
                label1="Kritisk linje"
                value1={formatBoolean(frist.pavirker_kritisk_linje)}
                label2="Fremdriftsanalyse"
                value2={formatBoolean(frist.fremdriftsanalyse_vedlagt)}
              />
              {(frist.milepael_pavirket || frist.siste_oppdatert) && (
                <TableRow4Col
                  label1="Milepæl påvirket"
                  value1={frist.milepael_pavirket || '—'}
                  label2="Sist oppdatert"
                  value2={formatDate(frist.siste_oppdatert)}
                  striped
                />
              )}
            </View>

            {/* Begrunnelse - Viktig for juridisk dokumentasjon */}
            <TextBlock title="Begrunnelse for fristforlengelse" content={frist.begrunnelse} />

            {/* Berørte aktiviteter */}
            <TextBlock title="Berørte aktiviteter" content={frist.berorte_aktiviteter} />
          </View>

          {/* BH Response - Port 1: Varsling */}
          {(frist.noytralt_varsel_ok !== undefined ||
            frist.spesifisert_krav_ok !== undefined ||
            frist.har_bh_etterlyst !== undefined) && (
            <View style={styles.mainSubSection} wrap={false}>
              <Text style={styles.mainSubSectionTitle}>Byggherrens vurdering – Varsling</Text>
              <View style={styles.table}>
                <TableRow4Col
                  label1="Nøytralt varsel OK"
                  value1={formatBoolean(frist.noytralt_varsel_ok)}
                  label2="Spesifisert krav OK"
                  value2={formatBoolean(frist.spesifisert_krav_ok)}
                />
                {frist.har_bh_etterlyst !== undefined && (
                  <TableRow label="BH har etterlyst" value={formatBoolean(frist.har_bh_etterlyst)} striped />
                )}
              </View>
              <TextBlock title="Begrunnelse varselvurdering" content={frist.begrunnelse_varsel} />
            </View>
          )}

          {/* BH Response - Port 2: Vilkår */}
          {frist.vilkar_oppfylt !== undefined && (
            <View style={styles.mainSubSection} wrap={false}>
              <Text style={styles.mainSubSectionTitle}>Byggherrens vurdering – Vilkår</Text>
              <View style={styles.table}>
                <TableRow label="Vilkår oppfylt" value={formatBoolean(frist.vilkar_oppfylt)} />
              </View>
              <TextBlock title="Begrunnelse vilkårsvurdering" content={frist.begrunnelse_vilkar} />
            </View>
          )}

          {/* BH Response - Port 3: Beregning */}
          {frist.bh_resultat && (
            <View style={styles.mainSubSection} wrap={false}>
              <Text style={styles.mainSubSectionTitle}>Byggherrens vurdering – Beregning</Text>
              <View style={styles.table}>
                <TableRow4Col
                  label1="Resultat"
                  value1={formatFristResultat(frist.bh_resultat)}
                  label2="Godkjent dager"
                  value2={frist.godkjent_dager !== undefined ? `${frist.godkjent_dager} dager` : '—'}
                />
                <TableRow4Col
                  label1="Differanse"
                  value1={frist.differanse_dager !== undefined ? `${frist.differanse_dager} dager` : '—'}
                  label2="Ny sluttdato"
                  value2={formatDate(frist.ny_sluttdato)}
                  striped
                />
                {frist.frist_for_spesifisering && (
                  <TableRow label="Frist for spesifisering" value={formatDate(frist.frist_for_spesifisering)} />
                )}
              </View>
              <TextBlock title="Byggherrens begrunnelse" content={frist.bh_begrunnelse} />
              <TextBlock title="Begrunnelse beregning" content={frist.begrunnelse_beregning} />
            </View>
          )}

          {/* Forsering (§33.8) */}
          {frist.forsering?.er_varslet && (
            <View style={styles.subSection} wrap={false}>
              <Text style={styles.subSectionTitle}>Forsering (§33.8)</Text>
              <View style={styles.table}>
                <TableRow4Col
                  label1="Varslet dato"
                  value1={formatDate(frist.forsering.dato_varslet)}
                  label2="Estimert kostnad"
                  value2={frist.forsering.estimert_kostnad !== undefined ? formatCurrency(frist.forsering.estimert_kostnad) : '—'}
                />
                <TableRow4Col
                  label1="30%-regel"
                  value1={formatBoolean(frist.forsering.bekreft_30_prosent_regel)}
                  label2="Iverksatt"
                  value2={formatBoolean(frist.forsering.er_iverksatt)}
                  striped
                />
                {(frist.forsering.dato_iverksatt || frist.forsering.er_stoppet) && (
                  <TableRow4Col
                    label1="Dato iverksatt"
                    value1={formatDate(frist.forsering.dato_iverksatt)}
                    label2="Stoppet"
                    value2={frist.forsering.er_stoppet ? `Ja (${formatDate(frist.forsering.dato_stoppet)})` : 'Nei'}
                  />
                )}
                {frist.forsering.paalopte_kostnader !== undefined && (
                  <TableRow label="Påløpte kostnader" value={formatCurrency(frist.forsering.paalopte_kostnader)} striped />
                )}
              </View>
              <TextBlock title="Begrunnelse for forsering" content={frist.forsering.begrunnelse} />
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
}

export const ContractorClaimPdf: React.FC<ContractorClaimPdfProps> = ({ state }) => {
  return (
    <Document
      title={`Entreprenørkrav - ${state.sakstittel || state.sak_id}`}
      author="Oslo Kommune"
      subject="Krav fra entreprenør iht. NS 8407:2011"
    >
      <Page size="A4" style={styles.page}>
        <Header />

        <CaseInfoSection state={state} />

        <GrunnlagSection state={state} />

        <VederlagSection state={state} />

        <FristSection state={state} />

        <Footer />
      </Page>
    </Document>
  );
};

export default ContractorClaimPdf;
