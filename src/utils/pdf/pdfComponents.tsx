import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { SakState } from '../../types/timeline';
import { styles, COLORS, baseUrl } from './pdfStyles';

// Generic Components
export const Header: React.FC<{ sakstittel: string }> = ({ sakstittel }) => (
  <View style={styles.header}>
    <View style={styles.headerContent}>
      <Text style={styles.headerTitle}>KOE – Krav om endringsordre</Text>
      <Text style={styles.headerSubtitle}>{sakstittel}</Text>
    </View>
    <Image
      src={`${baseUrl}/logos/Oslo-logo-hvit-RGB.png`}
      style={styles.headerLogo}
    />
  </View>
);

export const Footer: React.FC<{ pageNumber: number; totalPages: number }> = ({ pageNumber, totalPages }) => (
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

export const MetadataFooter: React.FC<{
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

export const TableRow: React.FC<{ label: string; value: string; striped?: boolean }> = ({ label, value, striped }) => (
  <View style={[styles.tableRow, striped && styles.tableRowStriped]}>
    <Text style={styles.tableLabel}>{label}</Text>
    <Text style={styles.tableValue}>{value}</Text>
  </View>
);

export const TextBlock: React.FC<{ title: string; content: string }> = ({ title, content }) => {
  if (!content?.trim()) return null;
  return (
    <View style={styles.textBlock}>
      <Text style={styles.textBlockTitle}>{title}</Text>
      <Text style={styles.textBlockContent}>{content}</Text>
    </View>
  );
};

export const StatusBadge: React.FC<{
  status?: string;
  label?: string;
}> = ({ status, label }) => {
  if (!status) return null;

  const statusColors: Record<string, 'blue' | 'green' | 'red' | 'yellow' | 'grey'> = {
    'godkjent': 'green',
    'delvis_godkjent': 'yellow',
    'avvist': 'red',
    'sendt': 'blue',
    'under_behandling': 'blue',
  };

  const skin = statusColors[status] || 'grey';
  const displayLabel = label || status;

  const badgeStyle = [
    styles.statusBadge,
    skin === 'blue' && styles.statusBadgeBlue,
    skin === 'green' && styles.statusBadgeGreen,
    skin === 'red' && styles.statusBadgeRed,
    skin === 'yellow' && styles.statusBadgeYellow,
    skin === 'grey' && styles.statusBadgeGrey,
  ].filter(Boolean);

  const textStyle = [
    styles.statusBadgeText,
    skin === 'blue' && styles.statusBadgeBlueText,
    skin === 'green' && styles.statusBadgeGreenText,
    skin === 'red' && styles.statusBadgeRedText,
    skin === 'yellow' && styles.statusBadgeYellowText,
    skin === 'grey' && styles.statusBadgeGreyText,
  ].filter(Boolean);

  return (
    <View style={badgeStyle}>
      <Text style={textStyle}>{displayLabel}</Text>
    </View>
  );
};

export const SignatureBlock: React.FC<{
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

// Main Document Component - SakState only
export const KoePdfDocument: React.FC<{ state: SakState }> = ({ state }) => {
  const formatStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      'ikke_relevant': 'Ikke relevant',
      'utkast': 'Utkast',
      'sendt': 'Sendt til BH',
      'under_behandling': 'Under behandling',
      'godkjent': 'Godkjent',
      'delvis_godkjent': 'Delvis godkjent',
      'avvist': 'Avvist',
      'under_forhandling': 'Under forhandling',
      'trukket': 'Trukket',
      'laast': 'Låst',
    };
    return statusMap[status] || status;
  };

  return (
    <Document
      title={state.sakstittel || 'KOE – Krav om endringsordre'}
      author="Oslo Kommune"
    >
      <Page size="A4" style={styles.page}>
        <Header sakstittel={state.sakstittel} />

        {/* Metadata Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saksinformasjon</Text>
          <TableRow label="Sak-ID:" value={state.sak_id} />
          <TableRow label="Sakstittel:" value={state.sakstittel} striped />
          <TableRow label="Overordnet status:" value={state.overordnet_status} />
        </View>

        {/* GRUNNLAG Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. GRUNNLAG</Text>
          {state.grunnlag.status === 'ikke_relevant' ? (
            <Text style={styles.notRelevant}>Ikke relevant</Text>
          ) : (
            <>
              <TableRow label="Status:" value={formatStatus(state.grunnlag.status)} />
              {state.grunnlag.hovedkategori && (
                <TableRow label="Hovedkategori:" value={state.grunnlag.hovedkategori} striped />
              )}
              {state.grunnlag.underkategori && (
                <TableRow label="Underkategori:" value={state.grunnlag.underkategori} />
              )}
              {state.grunnlag.beskrivelse && (
                <TextBlock title="Beskrivelse" content={state.grunnlag.beskrivelse} />
              )}
              {state.grunnlag.dato_oppdaget && (
                <TableRow label="Dato oppdaget:" value={state.grunnlag.dato_oppdaget} striped />
              )}
              {state.grunnlag.bh_resultat && (
                <>
                  <TableRow label="BH Resultat:" value={formatStatus(state.grunnlag.bh_resultat)} />
                  {state.grunnlag.bh_begrunnelse && (
                    <TextBlock title="BH Begrunnelse" content={state.grunnlag.bh_begrunnelse} />
                  )}
                </>
              )}
            </>
          )}
        </View>

        {/* VEDERLAG Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. VEDERLAG</Text>
          {state.vederlag.status === 'ikke_relevant' ? (
            <Text style={styles.notRelevant}>Ikke relevant</Text>
          ) : (
            <>
              <TableRow label="Status:" value={formatStatus(state.vederlag.status)} />
              {state.vederlag.krevd_belop !== undefined && (
                <TableRow
                  label="Krevd beløp:"
                  value={`${state.vederlag.krevd_belop.toLocaleString('no-NO')} NOK`}
                  striped
                />
              )}
              {state.vederlag.metode && (
                <TableRow label="Metode:" value={state.vederlag.metode} />
              )}
              {state.vederlag.begrunnelse && (
                <TextBlock title="Begrunnelse" content={state.vederlag.begrunnelse} />
              )}
              {state.vederlag.bh_resultat && (
                <>
                  <TableRow label="BH Resultat:" value={formatStatus(state.vederlag.bh_resultat)} striped />
                  {state.vederlag.godkjent_belop !== undefined && (
                    <TableRow
                      label="Godkjent beløp:"
                      value={`${state.vederlag.godkjent_belop.toLocaleString('no-NO')} NOK`}
                    />
                  )}
                  {state.vederlag.bh_begrunnelse && (
                    <TextBlock title="BH Begrunnelse" content={state.vederlag.bh_begrunnelse} />
                  )}
                </>
              )}
            </>
          )}
        </View>

        {/* FRIST Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. FRISTFORLENGELSE</Text>
          {state.frist.status === 'ikke_relevant' ? (
            <Text style={styles.notRelevant}>Ikke relevant</Text>
          ) : (
            <>
              <TableRow label="Status:" value={formatStatus(state.frist.status)} />
              {state.frist.krevd_dager !== undefined && (
                <TableRow label="Antall dager:" value={String(state.frist.krevd_dager)} striped />
              )}
              {state.frist.frist_type && (
                <TableRow label="Type:" value={state.frist.frist_type} />
              )}
              {state.frist.begrunnelse && (
                <TextBlock title="Begrunnelse" content={state.frist.begrunnelse} />
              )}
              {state.frist.bh_resultat && (
                <>
                  <TableRow label="BH Resultat:" value={formatStatus(state.frist.bh_resultat)} striped />
                  {state.frist.godkjent_dager !== undefined && (
                    <TableRow label="Godkjente dager:" value={String(state.frist.godkjent_dager)} />
                  )}
                  {state.frist.bh_begrunnelse && (
                    <TextBlock title="BH Begrunnelse" content={state.frist.bh_begrunnelse} />
                  )}
                </>
              )}
            </>
          )}
        </View>

        <Footer pageNumber={1} totalPages={1} />
      </Page>
    </Document>
  );
};
