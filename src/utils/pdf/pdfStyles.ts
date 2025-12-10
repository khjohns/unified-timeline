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
  PDF_FONT = 'Oslo Sans';
} catch (error) {
  console.warn('Failed to register Oslo Sans fonts, using Helvetica fallback:', error);
}

// Design System Colors (Oslo Kommune official palette)
export const COLORS = {
  // Primary colors
  primary: '#2A2859',
  primaryDark: '#2A2859',
  ink: '#2C2C2C',
  white: '#FFFFFF',
  lightBg: '#F8F0DD',

  // Secondary colors
  success: '#034B45',
  successBg: '#C7F6C9',
  warning: '#F9C66B',
  warningBg: '#F8F0DD',
  danger: '#FF8274',
  dangerBg: '#F8F0DD',
  info: '#2A2859',
  infoBg: '#B3F5FF',
  neutral: '#D0BFAE',
  neutralBg: '#F8F0DD',

  // Utility colors
  inkDim: '#4D4D4D',
  muted: '#666666',
  border: '#E6E6E6',
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
    marginLeft: -42,
    marginRight: -42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: {
    height: 60,
  },
  headerContent: {},
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
    paddingVertical: 6,
  },
  tableRowStriped: {
    backgroundColor: '#F5F5F5',
  },
  tableLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    width: '45%',
    paddingRight: 10,
    color: COLORS.inkDim,
  },
  tableValue: {
    fontSize: 9,
    width: '55%',
    color: COLORS.ink,
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
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 4,
  },
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
  },
  notRelevant: {
    fontSize: 9,
    color: COLORS.muted,
    fontStyle: 'italic',
    marginTop: 5,
  },
});
