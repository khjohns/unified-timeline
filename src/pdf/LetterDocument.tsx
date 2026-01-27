/**
 * LetterDocument - React-PDF Component
 *
 * Generates a formal letter PDF from BrevInnhold.
 * Uses Oslo Kommune design system colors and fonts.
 */

import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import type { BrevInnhold } from '../types/letter';
import { PDF_FONT, COLORS, baseUrl } from './styles';

// Letter-specific styles
const letterStyles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingLeft: 50,
    paddingRight: 50,
    fontFamily: PDF_FONT,
    fontSize: 10,
    color: COLORS.ink,
    lineHeight: 1.5,
  },

  // Header with logo
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logo: {
    height: 80,
  },
  headerRight: {
    textAlign: 'right',
  },
  headerDate: {
    fontSize: 10,
    color: COLORS.ink,
    marginBottom: 4,
  },
  headerRef: {
    fontSize: 9,
    color: COLORS.muted,
  },

  // Recipient section
  recipientSection: {
    marginBottom: 30,
  },
  recipientLabel: {
    fontSize: 8,
    color: COLORS.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recipientName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 2,
  },
  recipientDetail: {
    fontSize: 10,
    color: COLORS.inkDim,
    marginBottom: 1,
  },

  // Subject line
  subject: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },

  // Content sections
  sectionContainer: {
    marginBottom: 16,
  },
  sectionContent: {
    fontSize: 10,
    lineHeight: 1.6,
    color: COLORS.ink,
    textAlign: 'justify',
  },

  // Signature area
  signatureSection: {
    marginTop: 40,
  },
  signatureClosing: {
    fontSize: 10,
    color: COLORS.ink,
    marginBottom: 30,
  },
  signatureName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.ink,
    marginBottom: 4,
  },
  signatureRole: {
    fontSize: 10,
    color: COLORS.inkDim,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: COLORS.muted,
  },
  footerLeft: {
    fontSize: 8,
    color: COLORS.muted,
  },
  footerRight: {
    fontSize: 8,
    color: COLORS.muted,
  },
});

/**
 * Format date for display.
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) {
    return new Date().toLocaleDateString('nb-NO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Oslo',
    });
  }
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

/**
 * Render text with line breaks preserved.
 */
const MultiLineText: React.FC<{ text: string; style?: Style }> = ({ text, style }) => {
  // Split by newlines and render each as a separate Text element
  const lines = text.split('\n');

  return (
    <View>
      {lines.map((line, index) => (
        <Text key={index} style={style}>
          {line || ' '} {/* Use space for empty lines to preserve spacing */}
        </Text>
      ))}
    </View>
  );
};

/**
 * Header component with logo and date.
 */
const Header: React.FC<{ brevInnhold: BrevInnhold }> = ({ brevInnhold }) => (
  <View style={letterStyles.header}>
    <Image
      src={`${baseUrl}/logos/Oslo-logo-sort-RGB.png`}
      style={letterStyles.logo}
    />
    <View style={letterStyles.headerRight}>
      <Text style={letterStyles.headerDate}>
        {formatDate(brevInnhold.referanser.dato)}
      </Text>
      <Text style={letterStyles.headerRef}>
        Vår ref: {brevInnhold.referanser.sakId}
      </Text>
      <Text style={letterStyles.headerRef}>
        Deres ref: {brevInnhold.referanser.eventId.substring(0, 8)}
      </Text>
    </View>
  </View>
);

/**
 * Recipient section.
 */
const RecipientSection: React.FC<{ brevInnhold: BrevInnhold }> = ({ brevInnhold }) => (
  <View style={letterStyles.recipientSection}>
    <Text style={letterStyles.recipientLabel}>Til</Text>
    <Text style={letterStyles.recipientName}>{brevInnhold.mottaker.navn}</Text>
    <Text style={letterStyles.recipientDetail}>{brevInnhold.mottaker.adresse}</Text>
    <Text style={letterStyles.recipientDetail}>{brevInnhold.mottaker.orgnr}</Text>
  </View>
);

/**
 * Subject line.
 */
const SubjectLine: React.FC<{ tittel: string }> = ({ tittel }) => (
  <Text style={letterStyles.subject}>{tittel}</Text>
);

/**
 * Content section (innledning, begrunnelse, avslutning).
 */
const ContentSection: React.FC<{ text: string }> = ({ text }) => (
  <View style={letterStyles.sectionContainer}>
    <MultiLineText text={text} style={letterStyles.sectionContent} />
  </View>
);

/**
 * Footer component.
 */
const Footer: React.FC<{ sakId: string }> = ({ sakId }) => (
  <View style={letterStyles.footer} fixed>
    <Text style={letterStyles.footerLeft}>
      {sakId} | NS 8407:2011
    </Text>
    <Text style={letterStyles.footerRight}>
      Generert: {formatDate()}
    </Text>
  </View>
);

/**
 * Props for LetterDocument.
 */
export interface LetterDocumentProps {
  brevInnhold: BrevInnhold;
}

/**
 * Main Letter Document component.
 *
 * Renders a formal letter PDF with:
 * - Header with logo and date
 * - Recipient information
 * - Subject line
 * - Content sections (innledning, begrunnelse, avslutning)
 * - Footer with case reference
 */
export const LetterDocument: React.FC<LetterDocumentProps> = ({ brevInnhold }) => {
  const { seksjoner, referanser, tittel } = brevInnhold;

  return (
    <Document
      title={tittel}
      author="Oslo Kommune"
      subject={`Svar på krav - ${referanser.sakId}`}
    >
      <Page size="A4" style={letterStyles.page}>
        {/* Header */}
        <Header brevInnhold={brevInnhold} />

        {/* Recipient */}
        <RecipientSection brevInnhold={brevInnhold} />

        {/* Subject */}
        <SubjectLine tittel={tittel} />

        {/* Content */}
        <ContentSection text={seksjoner.innledning.redigertTekst} />
        <ContentSection text={seksjoner.begrunnelse.redigertTekst} />
        <ContentSection text={seksjoner.avslutning.redigertTekst} />

        {/* Footer */}
        <Footer sakId={referanser.sakId} />
      </Page>
    </Document>
  );
};

export default LetterDocument;
