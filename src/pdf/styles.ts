import { StyleSheet, Font } from '@react-pdf/renderer';

// Base URL for assets (fonts, logos)
// Use absolute URLs to ensure fonts load correctly in PDF generation
export const baseUrl = typeof window !== 'undefined'
  ? `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/+$/, '')
  : '';

// Register Oslo Sans fonts
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

// Oslo Kommune Design System Colors
export const COLORS = {
  // Primary colors
  primary: '#2A2859',        // Oslo dark blue
  primaryDark: '#2A2859',
  warmBlue: '#1F42AA',       // Primary action blue
  ink: '#2C2C2C',            // Oslo black
  white: '#FFFFFF',
  lightBg: '#F8F0DD',        // Oslo light beige

  // Status colors
  success: '#034B45',        // Oslo dark green
  successBg: '#C7F6C9',      // Oslo light green
  successFaded: '#E5FFE6',   // Faded green

  warning: '#F9C66B',        // Oslo yellow
  warningBg: '#FFE7BC',      // Light yellow

  error: '#C9302C',          // Oslo red (WCAG AA compliant)
  errorBg: '#FFDFDC',        // Light red
  errorFaded: '#FFF2F1',     // Faded red

  info: '#2A2859',           // Dark blue
  infoBg: '#B3F5FF',         // Light blue
  infoFaded: '#E5FCFF',      // Faded blue

  neutral: '#D0BFAE',        // Dark beige
  neutralBg: '#F8F0DD',      // Light beige

  // Grays
  inkDim: '#4D4D4D',
  muted: '#666666',
  border: '#E6E6E6',
  grayBg: '#F9F9F9',
};

// PDF Stylesheet
export const styles = StyleSheet.create({
  // Page layout
  page: {
    paddingTop: 0,
    paddingLeft: 42,
    paddingRight: 42,
    paddingBottom: 50,
    fontFamily: PDF_FONT,
    fontSize: 9,
    color: COLORS.ink,
    lineHeight: 1.4,
  },

  // Header
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
  headerContent: {},
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 9,
    color: COLORS.white,
  },
  headerLogo: {
    height: 50,
  },

  // Footer
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

  // Title section
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: COLORS.primary,
  },
  sakId: {
    fontSize: 11,
    color: COLORS.primaryDark,
    marginBottom: 15,
  },

  // Info box (case metadata)
  infoBox: {
    backgroundColor: COLORS.lightBg,
    padding: 12,
    marginBottom: 20,
    flexDirection: 'row',
    gap: 20,
  },
  infoColumn: {
    width: '50%',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.inkDim,
    width: 90,
  },
  infoValue: {
    fontSize: 9,
    color: COLORS.ink,
    flex: 1,
  },

  // Section styling
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  subSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.inkDim,
    marginBottom: 6,
  },

  // Table rows
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
    width: '40%',
    paddingRight: 10,
    color: COLORS.inkDim,
  },
  tableValue: {
    fontSize: 9,
    width: '60%',
    color: COLORS.ink,
  },

  // Text blocks
  textBlock: {
    marginTop: 8,
    marginBottom: 8,
  },
  textBlockTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.inkDim,
    marginBottom: 4,
  },
  textBlockContent: {
    fontSize: 9,
    lineHeight: 1.5,
    color: COLORS.ink,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: COLORS.grayBg,
  },

  // Status badges
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  // Status badge variants
  statusGreen: {
    backgroundColor: COLORS.successBg,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  statusGreenText: {
    color: COLORS.success,
  },
  statusYellow: {
    backgroundColor: COLORS.warningBg,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  statusYellowText: {
    color: COLORS.ink,
  },
  statusRed: {
    backgroundColor: COLORS.errorBg,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  statusRedText: {
    color: COLORS.error,
  },
  statusBlue: {
    backgroundColor: COLORS.infoFaded,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  statusBlueText: {
    color: COLORS.primary,
  },
  statusGray: {
    backgroundColor: COLORS.grayBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusGrayText: {
    color: COLORS.muted,
  },

  // "Not claimed" box
  notClaimedBox: {
    backgroundColor: COLORS.neutralBg,
    borderWidth: 1,
    borderColor: COLORS.neutral,
    padding: 12,
    marginTop: 8,
  },
  notClaimedText: {
    fontSize: 10,
    color: COLORS.inkDim,
    fontStyle: 'italic',
  },

  // Summary cards
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.lightBg,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  summaryCardSuccess: {
    borderLeftColor: COLORS.success,
    backgroundColor: COLORS.successFaded,
  },
  summaryCardWarning: {
    borderLeftColor: COLORS.warning,
    backgroundColor: COLORS.warningBg,
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

  // Divider
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginVertical: 15,
  },
});
