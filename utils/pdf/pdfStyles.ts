import { StyleSheet, Font } from '@react-pdf/renderer';

// Register Oslo Sans fonts (all variants)
// Use absolute URLs to ensure fonts load correctly in PDF generation
// Include Vite's BASE_URL to handle subdirectory deployments (e.g., GitHub Pages)
export const baseUrl = typeof window !== 'undefined'
  ? `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/+$/, '')
  : '';

// Determine which font to use
export let PDF_FONT = 'Helvetica'; // Default to built-in font
try {
  Font.register({
    family: 'Oslo Sans',
    fonts: [
      { src: `${baseUrl}/fonts/OsloSans-Light.woff2`, fontWeight: 300 },
      { src: `${baseUrl}/fonts/OsloSans-LightItalic.woff2`, fontWeight: 300, fontStyle: 'italic' },
      { src: `${baseUrl}/fonts/OsloSans-Regular.woff2`, fontWeight: 'normal' },
      { src: `${baseUrl}/fonts/OsloSans-RegularItalic.woff2`, fontWeight: 'normal', fontStyle: 'italic' },
      { src: `${baseUrl}/fonts/OsloSans-Medium.woff2`, fontWeight: 500 },
      { src: `${baseUrl}/fonts/OsloSans-MediumItalic.woff2`, fontWeight: 500, fontStyle: 'italic' },
      { src: `${baseUrl}/fonts/OsloSans-Bold.woff2`, fontWeight: 'bold' },
      { src: `${baseUrl}/fonts/OsloSans-BoldItalic.woff2`, fontWeight: 'bold', fontStyle: 'italic' },
    ],
  });
  PDF_FONT = 'Oslo Sans'; // Use custom font if registration succeeds
} catch (error) {
  console.warn('Failed to register Oslo Sans fonts, using Helvetica fallback:', error);
}

// Design System Colors (Oslo Kommune official palette)
// FASE 1.3: Utvidet fargepalett basert på Oslo kommunes offisielle designsystem
export const COLORS = {
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
export const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingLeft: 42,
    paddingRight: 42,
    paddingBottom: 42,
    fontFamily: PDF_FONT,
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
