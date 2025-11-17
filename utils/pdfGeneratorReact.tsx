import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import { FormDataModel } from '../types';
import { pdfLabels } from './pdfLabels';
import { getKravStatusSkin, getSvarStatusSkin, getSakStatusSkin } from './statusHelpers';

// Register Oslo Sans fonts (all variants)
Font.register({
  family: 'Oslo Sans',
  fonts: [
    { src: '/Skjema_Endringsmeldinger/fonts/OsloSans-Light.woff2', fontWeight: 300 },
    { src: '/Skjema_Endringsmeldinger/fonts/OsloSans-LightItalic.woff2', fontWeight: 300, fontStyle: 'italic' },
    { src: '/Skjema_Endringsmeldinger/fonts/OsloSans-Regular.woff2', fontWeight: 'normal' },
    { src: '/Skjema_Endringsmeldinger/fonts/OsloSans-RegularItalic.woff2', fontWeight: 'normal', fontStyle: 'italic' },
    { src: '/Skjema_Endringsmeldinger/fonts/OsloSans-Medium.woff2', fontWeight: 500 },
    { src: '/Skjema_Endringsmeldinger/fonts/OsloSans-MediumItalic.woff2', fontWeight: 500, fontStyle: 'italic' },
    { src: '/Skjema_Endringsmeldinger/fonts/OsloSans-Bold.woff2', fontWeight: 'bold' },
    { src: '/Skjema_Endringsmeldinger/fonts/OsloSans-BoldItalic.woff2', fontWeight: 'bold', fontStyle: 'italic' },
  ],
});

// Design System Colors (Oslo Kommune official palette)
// FASE 1.3: Utvidet fargepalett basert på Oslo kommunes offisielle designsystem
const COLORS = {
  // Primærfarger (Oslo Kommune offisielle)
  primary: '#2A2859',      // Oslo mørk blå
  primaryDark: '#2A2859',
  ink: '#2C2C2C',          // Oslo sort
  white: '#FFFFFF',
  lightBg: '#F8F0DD',      // Oslo lys beige

  // Sekundærfarger (Oslo Kommune offisielle)
  success: '#034B45',      // Oslo mørk grønn
  successBg: '#C7F6C9',    // Oslo lys grønn

  warning: '#F9C66B',      // Oslo gul
  warningBg: '#F8F0DD',    // Oslo lys beige (brukes som varm bakgrunn)

  danger: '#FF8274',       // Oslo rød
  dangerBg: '#F8F0DD',     // Oslo lys beige (ingen lys rød finnes i paletten)

  info: '#2A2859',         // Oslo mørk blå (gjenbruk av primary)
  infoBg: '#B3F5FF',       // Oslo lys blå

  neutral: '#D0BFAE',      // Oslo mørk beige
  neutralBg: '#F8F0DD',    // Oslo lys beige

  // DEPRECATED - Bruk opacity i stedet for å følge designsystemet
  // Disse fargene er ikke en del av Oslo kommunes offisielle palett
  // For dimmet tekst, bruk: style={{ color: COLORS.ink, opacity: 0.7 }}
  inkDim: '#4D4D4D',       // DEPRECATED: Bruk COLORS.ink med opacity: 0.7
  muted: '#666666',        // DEPRECATED: Bruk COLORS.ink med opacity: 0.5
  border: '#E6E6E6',       // DEPRECATED: Bruk COLORS.neutral med opacity: 0.3
};

// Stylesheet
const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingLeft: 42,
    paddingRight: 42,
    paddingBottom: 42,
    fontFamily: 'Oslo Sans',
    fontSize: 9,
    color: COLORS.ink,
    lineHeight: 1.4,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 42,
    paddingRight: 42,
    marginBottom: 25,
    // Negative marger for å fylle hele bredden med bakgrunnsfarge
    marginLeft: -42,
    marginRight: -42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Logo til høyre, tekst til venstre
  },
  headerLogo: {
    // ENDRING: Satt kun høyde for å bevare aspect ratio. Flyttet til høyre.
    height: 60,
  },
  headerContent: {
    // Fjernet flex: 1 for å la tekst ligge helt til venstre
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    // ENDRING: Økt avstand til undertittel
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 9,
    color: '#FFFFFF',
  },
  versionBadge: {
    position: 'absolute',
    right: 20,
    top: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: '4 6',
    borderRadius: 2,
    fontSize: 8,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sakId: {
    fontSize: 12,
    color: COLORS.primaryDark,
  },
  infoBox: {
    backgroundColor: COLORS.lightBg,
    padding: 8,
    borderRadius: 3,
    marginBottom: 15,
    flexDirection: 'row',
    gap: 15,
  },
  infoColumn: {
    width: '50%',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 7,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.inkDim,
    width: 120,
  },
  infoValue: {
    fontSize: 10,
    color: COLORS.ink,
    flex: 1,
  },
  mainTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 15,
    marginBottom: 10,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.inkDim,
    marginTop: 10,
    marginBottom: 8,
  },
  table: {
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 6, // FASE 1.2: Økt fra 5 til 6 for bedre lesbarhet
  },
  tableRowStriped: {
    backgroundColor: '#F5F5F5', // FASE 1.2: Mørkere fra #F9F9F9 for bedre visuell separasjon
  },
  tableLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    width: '45%', // FASE 1.2: Økt fra 40% til 45%
    paddingRight: 10,
    color: COLORS.inkDim, // FASE 1.2: Lagt til farge for bedre visuell hierarki
  },
  tableValue: {
    fontSize: 9,
    width: '55%', // FASE 1.2: Redusert fra 60% til 55%
    color: COLORS.ink, // FASE 1.2: Lagt til farge for konsistens
  },
  textBlock: {
    marginBottom: 8,
  },
  textBlockTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.inkDim,
    marginBottom: 3,
  },
  textBlockContent: {
    fontSize: 9,
    lineHeight: 1.4,
    paddingLeft: 5,
  },
  // FASE 2.1: Executive Summary styles
  executiveSummary: {
    marginTop: 15,
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
    padding: 10,
    borderRadius: 3,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  summaryCardWarning: {
    borderLeftColor: COLORS.warning,
    backgroundColor: COLORS.warningBg,
  },
  summaryCardSuccess: {
    borderLeftColor: COLORS.success,
    backgroundColor: COLORS.successBg,
  },
  summaryCardTitle: {
    fontSize: 8,
    color: COLORS.inkDim,
    marginBottom: 4,
  },
  summaryCardValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.ink,
  },
  summaryCardSubtext: {
    fontSize: 7,
    color: COLORS.muted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  statusText: {
    fontSize: 9,
    color: COLORS.ink,
  },
  // FASE 2.3: Status Badge styles
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  statusBadgeBlue: {
    backgroundColor: COLORS.infoBg,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  statusBadgeBlueText: {
    color: COLORS.primary,
  },
  statusBadgeGreen: {
    backgroundColor: COLORS.successBg,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  statusBadgeGreenText: {
    color: COLORS.success,
  },
  statusBadgeRed: {
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  statusBadgeRedText: {
    color: COLORS.danger,
  },
  statusBadgeYellow: {
    backgroundColor: COLORS.warningBg,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  statusBadgeYellowText: {
    color: COLORS.ink,
  },
  statusBadgeBeige: {
    backgroundColor: COLORS.neutralBg,
    borderWidth: 1,
    borderColor: COLORS.neutral,
  },
  statusBadgeBeigeText: {
    color: COLORS.ink,
  },
  statusBadgeGrey: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusBadgeGreyText: {
    color: COLORS.muted,
  },
  footer: {
    position: 'absolute',
    bottom: 15,
    // ENDRING: Justert for å matche ny sidemarg
    left: 42,
    right: 42,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: COLORS.muted,
  },
  signatureRow: {
    marginTop: 10,
    fontSize: 9,
  },
  signatureLabel: {
    fontWeight: 'bold',
    // ENDRING: Fjernet 'marginRight: 60'
  },
});

// Components
const Header: React.FC<{ data: FormDataModel }> = ({ data }) => (
  <View style={styles.header}>
    <View style={styles.headerContent}>
      <Text style={styles.headerTitle}>KOE – Krav om endringsordre</Text>
      <Text style={styles.headerSubtitle}>NS 8407:2011</Text>
    </View>
    <Image
      src="/Skjema_Endringsmeldinger/logos/Oslo-logo-hvit-RGB.png"
      style={styles.headerLogo}
    />
  </View>
);

const Footer: React.FC<{ pageNumber: number; totalPages: number }> = ({ pageNumber, totalPages }) => (
  <View style={styles.footer} fixed>
    <Text>
      Generert: {new Date().toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })} kl.{' '}
      {new Date().toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
    </Text>
    <Text>
      Side {pageNumber} av {totalPages}
    </Text>
  </View>
);

// FASE 1.4: Metadata footer for siste side
const MetadataFooter: React.FC<{
  generatedBy: string;
  system: string;
  version: string;
}> = ({ generatedBy, system, version }) => (
  <View style={{
    marginTop: 30,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  }}>
    <Text style={{ fontSize: 7, color: COLORS.muted }}>
      Generert av: {generatedBy} • System: {system} v{version} • Oslo Kommune
    </Text>
  </View>
);

const TableRow: React.FC<{ label: string; value: string; striped?: boolean }> = ({ label, value, striped }) => (
  <View style={[styles.tableRow, striped && styles.tableRowStriped]}>
    <Text style={styles.tableLabel}>{label}</Text>
    <Text style={styles.tableValue}>{value}</Text>
  </View>
);

const TextBlock: React.FC<{ title: string; content: string }> = ({ title, content }) => {
  if (!content?.trim()) return null;
  return (
    <View style={styles.textBlock}>
      <Text style={styles.textBlockTitle}>{title}</Text>
      <Text style={styles.textBlockContent}>{content}</Text>
    </View>
  );
};

// FASE 2.3: Status Badge komponent
const StatusBadge: React.FC<{
  type: 'krav' | 'svar' | 'sak';
  status?: string;
  label?: string;
}> = ({ type, status, label }) => {
  if (!status) return null;

  // Hent skin basert på type
  let skin: 'blue' | 'green' | 'red' | 'beige' | 'yellow' | 'grey' = 'grey';
  let displayLabel = label;

  if (type === 'krav') {
    skin = getKravStatusSkin(status as any);
    if (!displayLabel) displayLabel = pdfLabels.kravStatus(status as any);
  } else if (type === 'svar') {
    skin = getSvarStatusSkin(status as any);
    if (!displayLabel) displayLabel = pdfLabels.svarStatus(status as any);
  } else if (type === 'sak') {
    skin = getSakStatusSkin(status as any);
    if (!displayLabel) displayLabel = pdfLabels.sakStatus(status as any);
  }

  // Map skin til styles
  const badgeStyle = [
    styles.statusBadge,
    skin === 'blue' && styles.statusBadgeBlue,
    skin === 'green' && styles.statusBadgeGreen,
    skin === 'red' && styles.statusBadgeRed,
    skin === 'yellow' && styles.statusBadgeYellow,
    skin === 'beige' && styles.statusBadgeBeige,
    skin === 'grey' && styles.statusBadgeGrey,
  ].filter(Boolean);

  const textStyle = [
    styles.statusBadgeText,
    skin === 'blue' && styles.statusBadgeBlueText,
    skin === 'green' && styles.statusBadgeGreenText,
    skin === 'red' && styles.statusBadgeRedText,
    skin === 'yellow' && styles.statusBadgeYellowText,
    skin === 'beige' && styles.statusBadgeBeigeText,
    skin === 'grey' && styles.statusBadgeGreyText,
  ].filter(Boolean);

  return (
    <View style={badgeStyle}>
      <Text style={textStyle}>{displayLabel}</Text>
    </View>
  );
};

// FASE 3.2: Signature Block komponent
const SignatureBlock: React.FC<{
  title?: string;
  name?: string;
  date?: string;
}> = ({ title = 'Signatur', name, date }) => {
  if (!name && !date) return null;

  return (
    <View style={{ marginTop: 20 }}>
      {title && <Text style={styles.subTitle}>{title}</Text>}
      {date && (
        <View style={styles.table}>
          <TableRow label="Dato" value={date} />
        </View>
      )}
      <View style={{ marginTop: 15 }}>
        <View style={{
          borderBottomWidth: 1,
          borderBottomColor: COLORS.ink,
          width: 200,
          height: 40,
          marginBottom: 5,
        }} />
        <Text style={{ fontSize: 9, color: COLORS.inkDim }}>
          {name || '—'}
        </Text>
      </View>
    </View>
  );
};

// FASE 4.2: Attachments Section komponent
const AttachmentsSection: React.FC<{ data: FormDataModel }> = ({ data }) => {
  // Samle alle vedlegg fra varsel, krav og svar
  interface Attachment {
    source: string;
    files: string[];
  }

  const attachments: Attachment[] = [];

  // Vedlegg fra varsel
  if (data.varsel.vedlegg && data.varsel.vedlegg.length > 0) {
    attachments.push({
      source: 'Varsel',
      files: data.varsel.vedlegg,
    });
  }

  // Vedlegg fra krav-revisjoner (kun sendte)
  const senteKoeRevisjoner = data.koe_revisjoner.filter(
    koe => koe.dato_krav_sendt && koe.dato_krav_sendt !== ''
  );

  senteKoeRevisjoner.forEach((koe, index) => {
    if (koe.vedlegg && koe.vedlegg.length > 0) {
      attachments.push({
        source: `Krav - Revisjon ${koe.koe_revisjonsnr || index + 1}`,
        files: koe.vedlegg,
      });
    }
  });

  // Vedlegg fra BH svar-revisjoner (kun for sendte krav)
  const senteBhSvarRevisjoner = data.bh_svar_revisjoner.filter(
    (_, index) => data.koe_revisjoner[index]?.dato_krav_sendt && data.koe_revisjoner[index]?.dato_krav_sendt !== ''
  );

  senteBhSvarRevisjoner.forEach((bhSvar, index) => {
    if (bhSvar.vedlegg && bhSvar.vedlegg.length > 0) {
      const correspondingKoe = senteKoeRevisjoner[index];
      attachments.push({
        source: `BH Svar - Revisjon ${correspondingKoe?.koe_revisjonsnr || index + 1}`,
        files: bhSvar.vedlegg,
      });
    }
  });

  // Vis kun hvis det finnes vedlegg
  if (attachments.length === 0) return null;

  return (
    <View style={{ marginTop: 30 }} wrap={true}>
      <Text style={styles.mainTitle}>Vedleggsreferanser</Text>
      <Text style={{ fontSize: 9, color: COLORS.inkDim, marginBottom: 10 }}>
        Totalt {attachments.reduce((sum, att) => sum + att.files.length, 0)} vedlegg
      </Text>

      {attachments.map((attachment, attIndex) => (
        <View key={attIndex} style={{ marginBottom: 12 }} wrap={false}>
          <Text style={styles.subTitle}>{attachment.source}</Text>
          <View style={{ marginLeft: 10 }}>
            {attachment.files.map((file, fileIndex) => (
              <View
                key={fileIndex}
                style={{
                  flexDirection: 'row',
                  marginBottom: 3,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 9, color: COLORS.ink, width: 25 }}>
                  {fileIndex + 1}.
                </Text>
                <Text style={{ fontSize: 9, color: COLORS.ink, flex: 1 }}>
                  {file}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

// FASE 2.1: Executive Summary komponent
const ExecutiveSummary: React.FC<{ data: FormDataModel }> = ({ data }) => {
  // Beregn totaler basert på sendte revisjoner
  const senteKoeRevisjoner = data.koe_revisjoner.filter(
    koe => koe.dato_krav_sendt && koe.dato_krav_sendt !== ''
  );

  const senteBhSvarRevisjoner = data.bh_svar_revisjoner.filter(
    (_, index) => data.koe_revisjoner[index]?.dato_krav_sendt && data.koe_revisjoner[index]?.dato_krav_sendt !== ''
  );

  // Beregn vederlagstotaler
  const totalKravVederlag = senteKoeRevisjoner.reduce(
    (sum, koe) => sum + (parseFloat(koe.vederlag.krav_vederlag_belop || '0')), 0
  );

  const totalGodkjentVederlag = senteBhSvarRevisjoner.reduce(
    (sum, bhSvar) => sum + (parseFloat(bhSvar.vederlag.bh_godkjent_vederlag_belop || '0')), 0
  );

  const vederlagsDifferanse = totalKravVederlag - totalGodkjentVederlag;

  // Beregn fristtotaler
  const totalKravFrist = senteKoeRevisjoner.reduce(
    (sum, koe) => sum + (parseInt(koe.frist.krav_frist_antall_dager || '0', 10)), 0
  );

  const totalGodkjentFrist = senteBhSvarRevisjoner.reduce(
    (sum, bhSvar) => sum + (parseInt(bhSvar.frist.bh_godkjent_frist_dager || '0', 10)), 0
  );

  const fristDifferanse = totalKravFrist - totalGodkjentFrist;

  // Hent status fra siste revisjon
  const latestKoe = senteKoeRevisjoner[senteKoeRevisjoner.length - 1];

  // Vis kun hvis vi har sendte revisjoner
  if (senteKoeRevisjoner.length === 0) return null;

  return (
    <View wrap minPresenceAhead={120} style={styles.executiveSummary}>
      <Text style={styles.subTitle}>Økonomisk oversikt</Text>

      {/* Vederlag */}
      {totalKravVederlag > 0 && (
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>Totalt krevd vederlag</Text>
            <Text style={styles.summaryCardValue}>
              {totalKravVederlag.toLocaleString('no-NO')} NOK
            </Text>
            <Text style={styles.summaryCardSubtext}>
              {senteKoeRevisjoner.length} {senteKoeRevisjoner.length === 1 ? 'revisjon' : 'revisjoner'}
            </Text>
          </View>

          <View style={[styles.summaryCard, styles.summaryCardSuccess]}>
            <Text style={styles.summaryCardTitle}>Totalt godkjent vederlag</Text>
            <Text style={styles.summaryCardValue}>
              {totalGodkjentVederlag.toLocaleString('no-NO')} NOK
            </Text>
            <Text style={styles.summaryCardSubtext}>
              {senteBhSvarRevisjoner.length} {senteBhSvarRevisjoner.length === 1 ? 'svar' : 'svar'}
            </Text>
          </View>

          <View style={[
            styles.summaryCard,
            vederlagsDifferanse > 0 && styles.summaryCardWarning
          ]}>
            <Text style={styles.summaryCardTitle}>Differanse</Text>
            <Text style={styles.summaryCardValue}>
              {vederlagsDifferanse.toLocaleString('no-NO')} NOK
            </Text>
            <Text style={styles.summaryCardSubtext}>
              {vederlagsDifferanse > 0 ? 'Under behandling' : 'Fullstendig godkjent'}
            </Text>
          </View>
        </View>
      )}

      {/* Frist */}
      {totalKravFrist > 0 && (
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>Totalt krevd fristforlengelse</Text>
            <Text style={styles.summaryCardValue}>
              {totalKravFrist} dager
            </Text>
          </View>

          <View style={[styles.summaryCard, styles.summaryCardSuccess]}>
            <Text style={styles.summaryCardTitle}>Totalt godkjent fristforlengelse</Text>
            <Text style={styles.summaryCardValue}>
              {totalGodkjentFrist} dager
            </Text>
          </View>

          <View style={[
            styles.summaryCard,
            fristDifferanse > 0 && styles.summaryCardWarning
          ]}>
            <Text style={styles.summaryCardTitle}>Differanse</Text>
            <Text style={styles.summaryCardValue}>
              {fristDifferanse} dager
            </Text>
            <Text style={styles.summaryCardSubtext}>
              {fristDifferanse > 0 ? 'Under behandling' : 'Fullstendig godkjent'}
            </Text>
          </View>
        </View>
      )}

      {/* Status */}
      {latestKoe && (
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>
            Status siste revisjon: {pdfLabels.kravStatus(latestKoe.status)}
          </Text>
        </View>
      )}
    </View>
  );
};

const TitlePage: React.FC<{ data: FormDataModel }> = ({ data }) => (
  <View wrap>
    {/* Tittel og Sak-ID på separate linjer for å unngå overlapping */}
    <View wrap={false} style={{ marginBottom: 15 }}>
      <Text style={styles.title}>{data.sak.sakstittel || 'Uten tittel'}</Text>
      <Text style={styles.sakId}>Sak-ID: {data.sak.sak_id_display || 'Ikke angitt'}</Text>
    </View>

    <View wrap={false} minPresenceAhead={100} style={styles.infoBox}>
      <View style={styles.infoColumn}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Prosjekt:</Text>
          <Text style={styles.infoValue}>{data.sak.prosjekt_navn || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Kontrakt:</Text>
          <Text style={styles.infoValue}>{data.sak.kontrakt_referanse || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Entreprenør:</Text>
          <Text style={styles.infoValue}>{data.sak.entreprenor || '—'}</Text>
        </View>
      </View>
      <View style={styles.infoColumn}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Opprettet:</Text>
          <Text style={styles.infoValue}>{data.sak.opprettet_dato || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Opprettet av:</Text>
          <Text style={styles.infoValue}>{data.sak.opprettet_av || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Byggherre:</Text>
          <Text style={styles.infoValue}>{data.sak.byggherre || '—'}</Text>
        </View>
      </View>
    </View>
  </View>
);

const SummarySection: React.FC<{ data: FormDataModel }> = ({ data }) => {
  const latestKoe = data.koe_revisjoner[data.koe_revisjoner.length - 1];
  const latestBhSvar = data.bh_svar_revisjoner[data.bh_svar_revisjoner.length - 1];

  if (!latestKoe || (!latestKoe.vederlag.krav_vederlag && !latestKoe.frist.krav_fristforlengelse)) {
    return null;
  }

  return (
    <View wrap minPresenceAhead={80}>
      <Text style={styles.subTitle}>Sammendrag krav (siste revisjon)</Text>
      <View style={styles.table}>
        {latestKoe.vederlag.krav_vederlag && (
          <>
            <TableRow
              label="Krevd vederlag"
              value={`${(parseFloat(latestKoe.vederlag.krav_vederlag_belop) || 0).toLocaleString('no-NO')} NOK`}
            />
            {latestBhSvar?.vederlag.bh_svar_vederlag && (
              <TableRow
                label="Godkjent vederlag"
                value={`${(parseFloat(latestBhSvar.vederlag.bh_godkjent_vederlag_belop) || 0).toLocaleString('no-NO')} NOK`}
                striped
              />
            )}
          </>
        )}
        {latestKoe.frist.krav_fristforlengelse && (
          <>
            <TableRow label="Krevd fristforlengelse" value={`${latestKoe.frist.krav_frist_antall_dager || '—'} dager`} />
            {latestBhSvar?.frist.bh_svar_frist && (
              <TableRow
                label="Godkjent fristforlengelse"
                value={`${latestBhSvar.frist.bh_godkjent_frist_dager || '—'} dager`}
                striped
              />
            )}
          </>
        )}
      </View>
    </View>
  );
};

const VarselSection: React.FC<{ data: FormDataModel }> = ({ data }) => (
  // FASE 3.1: Wrap og minPresenceAhead for dynamisk page breaking
  <View wrap minPresenceAhead={80}>
    <Text style={styles.mainTitle}>Varsel</Text>
    <View style={styles.table}>
      <TableRow label="Dato forhold oppdaget" value={data.varsel.dato_forhold_oppdaget || '—'} />
      <TableRow label="Dato varsel sendt" value={data.varsel.dato_varsel_sendt || '—'} striped />
      <TableRow
        label="Hovedkategori"
        value={pdfLabels.hovedkategori(data.varsel.hovedkategori)}
      />
      <TableRow
        label="Underkategori"
        value={pdfLabels.underkategorier(data.varsel.hovedkategori, data.varsel.underkategori)}
        striped
      />
    </View>
    <TextBlock title="Beskrivelse:" content={data.varsel.varsel_beskrivelse} />
  </View>
);

const KoeRevisionSection: React.FC<{
  koe: FormDataModel['koe_revisjoner'][0];
  index: number;
}> = ({ koe, index }) => (
  <View wrap={false}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15, marginBottom: 10 }}>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.primary }}>
        Krav (Revisjon {koe.koe_revisjonsnr || index})
      </Text>
      {/* FASE 2.3: Status badge for krav */}
      <StatusBadge type="krav" status={koe.status} />
    </View>
    <View style={styles.table}>
      <TableRow label="Revisjonsnummer" value={koe.koe_revisjonsnr || '—'} />
      <TableRow label="Dato krav sendt" value={koe.dato_krav_sendt || '—'} striped />
    </View>

    {koe.vederlag.krav_vederlag && (
      <View>
        <Text style={styles.subTitle}>Vederlagsjustering</Text>
        <View style={styles.table}>
          <TableRow label="Krav om produktivitetstap" value={koe.vederlag.krav_produktivitetstap ? 'Ja' : 'Nei'} />
          <TableRow label="Særskilt rigg/drift" value={koe.vederlag.saerskilt_varsel_rigg_drift ? 'Ja' : 'Nei'} striped />
          <TableRow
            label="Oppgjørsmetode"
            value={pdfLabels.vederlagsmetode(koe.vederlag.krav_vederlag_metode)}
          />
          <TableRow
            label="Beløp (NOK)"
            value={
              koe.vederlag.krav_vederlag_belop ? parseFloat(koe.vederlag.krav_vederlag_belop).toLocaleString('no-NO') : '—'
            }
            striped
          />
        </View>
        <TextBlock title="Begrunnelse/kalkyle:" content={koe.vederlag.krav_vederlag_begrunnelse} />
      </View>
    )}

    {koe.frist.krav_fristforlengelse && (
      <View>
        <Text style={styles.subTitle}>Fristforlengelse</Text>
        <View style={styles.table}>
          <TableRow label="Fristtype" value={koe.frist.krav_frist_type || '—'} />
          <TableRow label="Antall dager" value={koe.frist.krav_frist_antall_dager || '—'} striped />
          <TableRow label="Påvirker kritisk linje" value={koe.frist.forsinkelse_kritisk_linje ? 'Ja' : 'Nei'} />
        </View>
        <TextBlock title="Begrunnelse:" content={koe.frist.krav_frist_begrunnelse} />
      </View>
    )}

    {/* FASE 3.2: SignatureBlock for entreprenør */}
    <SignatureBlock
      title="For Entreprenør"
      name={koe.for_entreprenor}
    />
  </View>
);

const BhSvarRevisionSection: React.FC<{
  bhSvar: FormDataModel['bh_svar_revisjoner'][0];
  koe: FormDataModel['koe_revisjoner'][0];
  index: number;
}> = ({ bhSvar, koe, index }) => (
  <View wrap={false}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15, marginBottom: 10 }}>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.primary }}>
        BH Svar (Revisjon {koe.koe_revisjonsnr || index})
      </Text>
      {/* FASE 2.3: Status badge for BH svar */}
      <StatusBadge type="svar" status={bhSvar.status} />
    </View>

    {koe.vederlag.krav_vederlag && (
      <View>
        <Text style={styles.subTitle}>Svar på vederlagskrav</Text>
        <View style={styles.table}>
          <TableRow label="Vederlagsvarsel ansett for sent" value={bhSvar.vederlag.varsel_for_sent ? 'Ja' : 'Nei'} />
          <TableRow
            label="Status"
            value={pdfLabels.bhVederlagssvar(bhSvar.vederlag.bh_svar_vederlag)}
            striped
          />
          <TableRow
            label="Godkjent beløp (NOK)"
            value={
              bhSvar.vederlag.bh_godkjent_vederlag_belop
                ? parseFloat(bhSvar.vederlag.bh_godkjent_vederlag_belop).toLocaleString('no-NO')
                : '—'
            }
          />
        </View>
        {bhSvar.vederlag.varsel_for_sent && (
          <TextBlock title="Begrunnelse for sen varsling:" content={bhSvar.vederlag.varsel_for_sent_begrunnelse} />
        )}
        <TextBlock title="Subsidiær begrunnelse for svar:" content={bhSvar.vederlag.bh_begrunnelse_vederlag} />
      </View>
    )}

    {koe.frist.krav_fristforlengelse && (
      <View>
        <Text style={styles.subTitle}>Svar på fristkrav</Text>
        <View style={styles.table}>
          <TableRow label="Fristvarsel ansett for sent" value={bhSvar.frist.varsel_for_sent ? 'Ja' : 'Nei'} />
          <TableRow
            label="Status"
            value={pdfLabels.bhFristsvar(bhSvar.frist.bh_svar_frist)}
            striped
          />
          <TableRow label="Godkjente dager" value={bhSvar.frist.bh_godkjent_frist_dager || '—'} />
          <TableRow label="Frist for spesifisering" value={bhSvar.frist.bh_frist_for_spesifisering || '—'} striped />
        </View>
        {bhSvar.frist.varsel_for_sent && (
          <TextBlock title="Begrunnelse for sen varsling:" content={bhSvar.frist.varsel_for_sent_begrunnelse} />
        )}
        <TextBlock title="Subsidiær begrunnelse for svar:" content={bhSvar.frist.bh_begrunnelse_frist} />
      </View>
    )}

    {/* FASE 3.2: SignatureBlock for byggherre */}
    <SignatureBlock
      title="For Byggherre"
      name={bhSvar.sign.for_byggherre}
      date={bhSvar.sign.dato_svar_bh}
    />
  </View>
);

// Main Document Component
const KoePdfDocument: React.FC<{ data: FormDataModel }> = ({ data }) => {
  // FASE 1.1: Filtrer kun sendte revisjoner (fjerner tomme utkast-sider)
  const senteKoeRevisjoner = data.koe_revisjoner.filter(
    koe => koe.dato_krav_sendt && koe.dato_krav_sendt !== ''
  );

  const senteBhSvarRevisjoner = data.bh_svar_revisjoner.filter(
    (_, index) => data.koe_revisjoner[index]?.dato_krav_sendt && data.koe_revisjoner[index]?.dato_krav_sendt !== ''
  );

  // FASE 4.2: Sjekk om det finnes vedlegg
  const harVedlegg = (
    (data.varsel.vedlegg && data.varsel.vedlegg.length > 0) ||
    senteKoeRevisjoner.some(koe => koe.vedlegg && koe.vedlegg.length > 0) ||
    senteBhSvarRevisjoner.some(svar => svar.vedlegg && svar.vedlegg.length > 0)
  );

  // FASE 3.1 & 4.2: Oppdatert sidetelling - 1 fast side + revisjoner + vedleggsside (hvis aktuelt)
  const totalPages = 1 + senteKoeRevisjoner.length + senteBhSvarRevisjoner.length + (harVedlegg ? 1 : 0);

  return (
    <Document
      title={data.sak.sakstittel || 'KOE – Krav om endringsordre'}
      author={data.sak.opprettet_av || 'Oslo Kommune'}
    >
      {/* FASE 3.1: Side 1 - Kombinert TitlePage, SummarySection, ExecutiveSummary og VarselSection */}
      <Page size="A4" style={styles.page}>
        <Header data={data} />
        <TitlePage data={data} />
        <SummarySection data={data} />
        {/* FASE 2.2: Executive Summary plassert mellom SummarySection og Varsel */}
        <ExecutiveSummary data={data} />
        {/* FASE 3.1: VarselSection flyttet til side 1 med dynamisk page breaking */}
        <VarselSection data={data} />
        <Footer pageNumber={1} totalPages={totalPages} />
      </Page>

      {/* KOE Revisjoner - kun sendte */}
      {senteKoeRevisjoner.map((koe, index) => (
        <Page key={`koe-${index}`} size="A4" style={styles.page}>
          <Header data={data} />
          <KoeRevisionSection koe={koe} index={index} />
          <Footer pageNumber={2 + index} totalPages={totalPages} />
        </Page>
      ))}

      {/* BH Svar Revisjoner - kun for sendte krav */}
      {senteBhSvarRevisjoner.map((bhSvar, index) => {
        const correspondingKoe = senteKoeRevisjoner[index];
        if (!correspondingKoe) return null;
        return (
          <Page key={`bh-${index}`} size="A4" style={styles.page}>
            <Header data={data} />
            <BhSvarRevisionSection bhSvar={bhSvar} koe={correspondingKoe} index={index} />
            <Footer pageNumber={2 + senteKoeRevisjoner.length + index} totalPages={totalPages} />
          </Page>
        );
      })}

      {/* FASE 4.2: Dedikert vedleggsside (kun hvis det finnes vedlegg) */}
      {harVedlegg && (
        <Page size="A4" style={styles.page}>
          <Header data={data} />
          <AttachmentsSection data={data} />
          <MetadataFooter
            generatedBy={data.sak.opprettet_av || 'Ukjent'}
            system="KOE - Krav om endringsordre"
            version={data.versjon || '5.0'}
          />
          <Footer pageNumber={totalPages} totalPages={totalPages} />
        </Page>
      )}
    </Document>
  );
};

// Export function
export const generatePdfReact = async (data: FormDataModel) => {
  const blob = await pdf(<KoePdfDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const filename = `KOE_React_${data.sak.sak_id_display || 'rapport'}_${new Date().toISOString().split('T')[0]}.pdf`;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
