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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: COLORS.primary,
  },
  sakId: {
    fontSize: 11,
    color: COLORS.inkDim,
    marginBottom: 20,
  },

  // Metadata table - professional with border and striped rows
  metadataTable: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 28,
  },

  // Section styling - with proper spacing
  section: {
    marginBottom: 24,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  sectionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subSection: {
    marginTop: 14,
    marginBottom: 10,
  },
  subSectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.inkDim,
    marginBottom: 8,
  },
  // Main subsection headers (Entreprenørens krav, Byggherrens vurdering)
  mainSubSection: {
    marginTop: 16,
    marginBottom: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  mainSubSectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Section container with border (professional look)
  sectionContainer: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
    marginTop: 16,
  },

  // Table rows
  table: {
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableRowStriped: {
    backgroundColor: COLORS.grayBg,
  },
  tableLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    width: '40%',
    paddingRight: 12,
    color: COLORS.inkDim,
  },
  tableValue: {
    fontSize: 9,
    width: '60%',
    color: COLORS.ink,
  },

  // 4-column table rows for compact layout
  tableRow4Col: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableLabel4Col: {
    fontSize: 9,
    fontWeight: 'bold',
    width: '22%',
    color: COLORS.inkDim,
  },
  tableValue4Col: {
    fontSize: 9,
    width: '28%',
    color: COLORS.ink,
  },

  // Category header row
  tableCategoryHeader: {
    backgroundColor: COLORS.grayBg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableCategoryText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.inkDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  // Subsidiært badge - orange/brown for good contrast
  statusSubsidiaer: {
    backgroundColor: '#FFF3E0',
    borderWidth: 1,
    borderColor: '#E65100',
  },
  statusSubsidiaerText: {
    color: '#E65100',
    fontStyle: 'italic',
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

  // Summary section - professional with border
  summaryContainer: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 20,
  },
  summaryHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  // Summary cards
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.grayBg,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryCardSuccess: {
    borderColor: COLORS.success,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
    backgroundColor: COLORS.successFaded,
  },
  summaryCardWarning: {
    borderColor: COLORS.warning,
    borderLeftWidth: 3,
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
