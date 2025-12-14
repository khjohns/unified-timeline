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
            {grunnlag.tittel && (
              <TableRow label="Tittel" value={grunnlag.tittel} />
            )}
            {grunnlag.hovedkategori && (
              <TableRow label="Hovedkategori" value={grunnlag.hovedkategori} striped />
            )}
            {grunnlag.underkategori && (
              <TableRow label="Underkategori" value={formatUnderkategori(grunnlag.underkategori)} />
            )}
            {grunnlag.dato_oppdaget && (
              <TableRow label="Dato oppdaget" value={formatDate(grunnlag.dato_oppdaget)} striped />
            )}
            {grunnlag.grunnlag_varsel?.dato_sendt && (
              <TableRow label="Varsel sendt" value={formatDate(grunnlag.grunnlag_varsel.dato_sendt)} />
            )}
            {grunnlag.grunnlag_varsel?.metode && (
              <TableRow label="Varselmetode" value={formatVarselMetode(grunnlag.grunnlag_varsel.metode)} striped />
            )}
            {grunnlag.kontraktsreferanser && grunnlag.kontraktsreferanser.length > 0 && (
              <TableRow label="Kontraktsreferanser" value={grunnlag.kontraktsreferanser.join(', ')} />
            )}
            {grunnlag.siste_oppdatert && (
              <TableRow label="Sist oppdatert" value={formatDate(grunnlag.siste_oppdatert)} striped />
            )}
          </View>

          {/* Beskrivelse - Viktig for juridisk dokumentasjon */}
          <TextBlock title="Beskrivelse av forholdet" content={grunnlag.beskrivelse} />

          {/* BH Response */}
          {grunnlag.bh_resultat && (
            <View style={styles.subSection} wrap={false}>
              <Text style={styles.subSectionTitle}>Byggherrens vurdering av grunnlag</Text>
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
          <View style={styles.subSection} wrap={false}>
            <Text style={styles.subSectionTitle}>Entreprenørens krav</Text>
            <View style={styles.table}>
              <TableRow label="Oppgjørsmetode" value={formatVederlagsmetode(vederlag.metode)} />
              {krevdBelop !== undefined && (
                <TableRow
                  label={vederlag.metode === 'REGNINGSARBEID' ? 'Kostnadsoverslag' : 'Krevd beløp'}
                  value={formatCurrency(krevdBelop)}
                  striped
                />
              )}
              {vederlag.krever_justert_ep !== undefined && (
                <TableRow label="Krever justerte enhetspriser" value={formatBoolean(vederlag.krever_justert_ep)} />
              )}
              {vederlag.krav_fremmet_dato && (
                <TableRow label="Krav fremmet dato" value={formatDate(vederlag.krav_fremmet_dato)} striped />
              )}
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
                {vederlag.rigg_drift_varsel?.dato_sendt && (
                  <TableRow
                    label="Rigg/drift varsel"
                    value={`${formatDate(vederlag.rigg_drift_varsel.dato_sendt)} (${formatVarselMetode(vederlag.rigg_drift_varsel.metode)})`}
                  />
                )}
                {vederlag.justert_ep_varsel?.dato_sendt && (
                  <TableRow
                    label="Justerte EP varsel"
                    value={`${formatDate(vederlag.justert_ep_varsel.dato_sendt)} (${formatVarselMetode(vederlag.justert_ep_varsel.metode)})`}
                    striped
                  />
                )}
                {vederlag.regningsarbeid_varsel?.dato_sendt && (
                  <TableRow
                    label="Regningsarbeid varsel"
                    value={`${formatDate(vederlag.regningsarbeid_varsel.dato_sendt)} (${formatVarselMetode(vederlag.regningsarbeid_varsel.metode)})`}
                  />
                )}
                {vederlag.produktivitetstap_varsel?.dato_sendt && (
                  <TableRow
                    label="Produktivitetstap varsel"
                    value={`${formatDate(vederlag.produktivitetstap_varsel.dato_sendt)} (${formatVarselMetode(vederlag.produktivitetstap_varsel.metode)})`}
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
                  <>
                    <TableRow
                      label="Rigg/drift beløp"
                      value={formatCurrency(vederlag.saerskilt_krav.rigg_drift.belop)}
                    />
                    {vederlag.saerskilt_krav.rigg_drift.dato_klar_over && (
                      <TableRow
                        label="Dato klar over rigg/drift"
                        value={formatDate(vederlag.saerskilt_krav.rigg_drift.dato_klar_over)}
                        striped
                      />
                    )}
                  </>
                )}
                {vederlag.saerskilt_krav.produktivitet?.belop !== undefined && (
                  <>
                    <TableRow
                      label="Produktivitetstap beløp"
                      value={formatCurrency(vederlag.saerskilt_krav.produktivitet.belop)}
                    />
                    {vederlag.saerskilt_krav.produktivitet.dato_klar_over && (
                      <TableRow
                        label="Dato klar over produktivitetstap"
                        value={formatDate(vederlag.saerskilt_krav.produktivitet.dato_klar_over)}
                        striped
                      />
                    )}
                  </>
                )}
              </View>
            </View>
          )}

          {/* BH Response - Port 1: Varsling */}
          {(vederlag.saerskilt_varsel_rigg_drift_ok !== undefined ||
            vederlag.varsel_justert_ep_ok !== undefined ||
            vederlag.varsel_start_regning_ok !== undefined ||
            vederlag.krav_fremmet_i_tide !== undefined) && (
            <View style={styles.subSection} wrap={false}>
              <Text style={styles.subSectionTitle}>Byggherrens vurdering - Port 1: Varsling</Text>
              <View style={styles.table}>
                {vederlag.saerskilt_varsel_rigg_drift_ok !== undefined && (
                  <TableRow
                    label="Varsel rigg/drift OK"
                    value={formatBoolean(vederlag.saerskilt_varsel_rigg_drift_ok)}
                  />
                )}
                {vederlag.varsel_justert_ep_ok !== undefined && (
                  <TableRow
                    label="Varsel justerte EP OK"
                    value={formatBoolean(vederlag.varsel_justert_ep_ok)}
                    striped
                  />
                )}
                {vederlag.varsel_start_regning_ok !== undefined && (
                  <TableRow
                    label="Varsel start regning OK"
                    value={formatBoolean(vederlag.varsel_start_regning_ok)}
                  />
                )}
                {vederlag.krav_fremmet_i_tide !== undefined && (
                  <TableRow
                    label="Krav fremmet i tide"
                    value={formatBoolean(vederlag.krav_fremmet_i_tide)}
                    striped
                  />
                )}
              </View>
              <TextBlock title="Begrunnelse varselvurdering" content={vederlag.begrunnelse_varsel} />
            </View>
          )}

          {/* BH Response - Port 2: Beregning */}
          {vederlag.bh_resultat && (
            <View style={styles.subSection} wrap={false}>
              <Text style={styles.subSectionTitle}>Byggherrens vurdering - Port 2: Beregning</Text>
              <View style={styles.table}>
                <TableRow label="Resultat" value={formatVederlagResultat(vederlag.bh_resultat)} />
                {vederlag.bh_metode && (
                  <TableRow
                    label="Godkjent metode"
                    value={formatVederlagsmetode(vederlag.bh_metode)}
                    striped
                  />
                )}
                {vederlag.godkjent_belop !== undefined && (
                  <TableRow
                    label="Godkjent beløp"
                    value={formatCurrency(vederlag.godkjent_belop)}
                  />
                )}
                {vederlag.differanse !== undefined && vederlag.differanse !== 0 && (
                  <TableRow
                    label="Differanse"
                    value={formatCurrency(vederlag.differanse)}
                    striped
                  />
                )}
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
          <View style={styles.subSection} wrap={false}>
            <Text style={styles.subSectionTitle}>Entreprenørens krav</Text>
            <View style={styles.table}>
              <TableRow label="Varseltype" value={formatFristVarselType(frist.varsel_type)} />
              {frist.noytralt_varsel?.dato_sendt && (
                <TableRow
                  label="Nøytralt varsel sendt"
                  value={`${formatDate(frist.noytralt_varsel.dato_sendt)} (${formatVarselMetode(frist.noytralt_varsel.metode)})`}
                  striped
                />
              )}
              {frist.spesifisert_varsel?.dato_sendt && (
                <TableRow
                  label="Spesifisert krav sendt"
                  value={`${formatDate(frist.spesifisert_varsel.dato_sendt)} (${formatVarselMetode(frist.spesifisert_varsel.metode)})`}
                />
              )}
              {frist.krevd_dager !== undefined && (
                <TableRow
                  label="Krevd dager"
                  value={`${frist.krevd_dager} dager`}
                  striped
                />
              )}
              {frist.pavirker_kritisk_linje !== undefined && (
                <TableRow label="Påvirker kritisk linje" value={formatBoolean(frist.pavirker_kritisk_linje)} />
              )}
              {frist.milepael_pavirket && (
                <TableRow label="Milepæl påvirket" value={frist.milepael_pavirket} striped />
              )}
              {frist.fremdriftsanalyse_vedlagt !== undefined && (
                <TableRow label="Fremdriftsanalyse vedlagt" value={formatBoolean(frist.fremdriftsanalyse_vedlagt)} />
              )}
              {frist.siste_oppdatert && (
                <TableRow label="Sist oppdatert" value={formatDate(frist.siste_oppdatert)} striped />
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
            <View style={styles.subSection} wrap={false}>
              <Text style={styles.subSectionTitle}>Byggherrens vurdering - Port 1: Varsling</Text>
              <View style={styles.table}>
                {frist.noytralt_varsel_ok !== undefined && (
                  <TableRow label="Nøytralt varsel OK" value={formatBoolean(frist.noytralt_varsel_ok)} />
                )}
                {frist.spesifisert_krav_ok !== undefined && (
                  <TableRow label="Spesifisert krav OK" value={formatBoolean(frist.spesifisert_krav_ok)} striped />
                )}
                {frist.har_bh_etterlyst !== undefined && (
                  <TableRow label="BH har etterlyst" value={formatBoolean(frist.har_bh_etterlyst)} />
                )}
              </View>
              <TextBlock title="Begrunnelse varselvurdering" content={frist.begrunnelse_varsel} />
            </View>
          )}

          {/* BH Response - Port 2: Vilkår */}
          {frist.vilkar_oppfylt !== undefined && (
            <View style={styles.subSection} wrap={false}>
              <Text style={styles.subSectionTitle}>Byggherrens vurdering - Port 2: Vilkår</Text>
              <View style={styles.table}>
                <TableRow label="Vilkår oppfylt" value={formatBoolean(frist.vilkar_oppfylt)} />
              </View>
              <TextBlock title="Begrunnelse vilkårsvurdering" content={frist.begrunnelse_vilkar} />
            </View>
          )}

          {/* BH Response - Port 3: Beregning */}
          {frist.bh_resultat && (
            <View style={styles.subSection} wrap={false}>
              <Text style={styles.subSectionTitle}>Byggherrens vurdering - Port 3: Beregning</Text>
              <View style={styles.table}>
                <TableRow label="Resultat" value={formatFristResultat(frist.bh_resultat)} />
                {frist.godkjent_dager !== undefined && (
                  <TableRow label="Godkjent dager" value={`${frist.godkjent_dager} dager`} striped />
                )}
                {frist.differanse_dager !== undefined && frist.differanse_dager !== 0 && (
                  <TableRow label="Differanse" value={`${frist.differanse_dager} dager`} />
                )}
                {frist.ny_sluttdato && (
                  <TableRow label="Ny sluttdato" value={formatDate(frist.ny_sluttdato)} striped />
                )}
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
                <TableRow label="Varslet dato" value={formatDate(frist.forsering.dato_varslet)} />
                {frist.forsering.estimert_kostnad !== undefined && (
                  <TableRow
                    label="Estimert kostnad"
                    value={formatCurrency(frist.forsering.estimert_kostnad)}
                    striped
                  />
                )}
                {frist.forsering.bekreft_30_prosent_regel !== undefined && (
                  <TableRow
                    label="Bekreftet 30%-regel"
                    value={formatBoolean(frist.forsering.bekreft_30_prosent_regel)}
                  />
                )}
                <TableRow label="Iverksatt" value={formatBoolean(frist.forsering.er_iverksatt)} striped />
                {frist.forsering.dato_iverksatt && (
                  <TableRow label="Dato iverksatt" value={formatDate(frist.forsering.dato_iverksatt)} />
                )}
                {frist.forsering.er_stoppet && (
                  <>
                    <TableRow label="Stoppet" value="Ja" striped />
                    {frist.forsering.dato_stoppet && (
                      <TableRow label="Dato stoppet" value={formatDate(frist.forsering.dato_stoppet)} />
                    )}
                  </>
                )}
                {frist.forsering.paalopte_kostnader !== undefined && (
                  <TableRow
                    label="Påløpte kostnader"
                    value={formatCurrency(frist.forsering.paalopte_kostnader)}
                    striped
                  />
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
