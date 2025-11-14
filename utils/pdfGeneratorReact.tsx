import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import { FormDataModel } from '../types';

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
const COLORS = {
  primary: '#2A2859',      // Oslo mørk blå (official)
  primaryDark: '#2A2859',
  ink: '#2C2C2C',
  inkDim: '#4D4D4D',
  muted: '#666666',
  border: '#E6E6E6',
  lightBg: '#F8F0DD',      // Oslo lys beige (official)
};

// Stylesheet
const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Oslo Sans',
    fontSize: 9,
    color: COLORS.ink,
    lineHeight: 1.4,
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: 12,
    marginBottom: 25,
    marginLeft: -20,
    marginRight: -20,
    marginTop: -20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 80,
    height: 24,
    marginRight: 15,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
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
    marginBottom: 5,
  },
  sakId: {
    fontSize: 14,
    color: COLORS.primaryDark,
    marginBottom: 15,
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
    paddingVertical: 5,
  },
  tableRowStriped: {
    backgroundColor: '#F9F9F9',
  },
  tableLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    width: '40%',
    paddingRight: 10,
  },
  tableValue: {
    fontSize: 9,
    width: '60%',
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
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 20,
    right: 20,
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
    marginRight: 60,
  },
});

// Components
const Header: React.FC<{ data: FormDataModel }> = ({ data }) => (
  <View style={styles.header}>
    <Image
      src="/Skjema_Endringsmeldinger/logos/Oslo-logo-hvit-RGB.svg"
      style={styles.headerLogo}
    />
    <View style={styles.headerContent}>
      <Text style={styles.headerTitle}>KOE – Krav om endringsordre</Text>
      <Text style={styles.headerSubtitle}>NS 8407:2011</Text>
    </View>
    <View style={styles.versionBadge}>
      <Text>v{data.versjon}</Text>
    </View>
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

const TitlePage: React.FC<{ data: FormDataModel }> = ({ data }) => (
  <View>
    <Text style={styles.title}>{data.sak.sakstittel || 'Uten tittel'}</Text>
    <Text style={styles.sakId}>Sak-ID: {data.sak.sak_id_display || 'Ikke angitt'}</Text>

    <View style={styles.infoBox}>
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
    <View>
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
  <View>
    <Text style={styles.mainTitle}>1. Varsel</Text>
    <View style={styles.table}>
      <TableRow label="Dato forhold oppdaget" value={data.varsel.dato_forhold_oppdaget || '—'} />
      <TableRow label="Dato varsel sendt" value={data.varsel.dato_varsel_sendt || '—'} striped />
      <TableRow label="Hovedkategori" value={data.varsel.hovedkategori || '—'} />
      <TableRow label="Underkategori" value={data.varsel.underkategori || '—'} striped />
    </View>
    <TextBlock title="Beskrivelse:" content={data.varsel.varsel_beskrivelse} />
  </View>
);

const KoeRevisionSection: React.FC<{ koe: FormDataModel['koe_revisjoner'][0]; index: number }> = ({ koe, index }) => (
  <View wrap={false}>
    <Text style={styles.mainTitle}>2. Krav om endringsordre (Revisjon {koe.koe_revisjonsnr || index})</Text>
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
          <TableRow label="Oppgjørsmetode" value={koe.vederlag.krav_vederlag_metode || '—'} />
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

    {koe.for_entreprenor && (
      <View style={styles.signatureRow}>
        <Text>
          <Text style={styles.signatureLabel}>For Entreprenør</Text>
          <Text>{koe.for_entreprenor || '—'}</Text>
        </Text>
      </View>
    )}
  </View>
);

const BhSvarRevisionSection: React.FC<{
  bhSvar: FormDataModel['bh_svar_revisjoner'][0];
  koe: FormDataModel['koe_revisjoner'][0];
  index: number;
}> = ({ bhSvar, koe, index }) => (
  <View wrap={false}>
    <Text style={styles.mainTitle}>3. Svar fra Byggherre (Revisjon {koe.koe_revisjonsnr || index})</Text>

    {(bhSvar.mote_dato || bhSvar.mote_referat) && (
      <View>
        <Text style={styles.subTitle}>Avklaring-/Forhandlingsmøte</Text>
        <View style={styles.table}>
          <TableRow label="Dato for møte" value={bhSvar.mote_dato || '—'} />
          <TableRow label="Referanse til møtereferat" value={bhSvar.mote_referat || '—'} striped />
        </View>
      </View>
    )}

    {koe.vederlag.krav_vederlag && (
      <View>
        <Text style={styles.subTitle}>Svar på vederlagskrav</Text>
        <View style={styles.table}>
          <TableRow label="Vederlagsvarsel ansett for sent" value={bhSvar.vederlag.varsel_for_sent ? 'Ja' : 'Nei'} />
          <TableRow label="Status" value={bhSvar.vederlag.bh_svar_vederlag || '—'} striped />
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
          <TableRow label="Status" value={bhSvar.frist.bh_svar_frist || '—'} striped />
          <TableRow label="Godkjente dager" value={bhSvar.frist.bh_godkjent_frist_dager || '—'} />
          <TableRow label="Frist for spesifisering" value={bhSvar.frist.bh_frist_for_spesifisering || '—'} striped />
        </View>
        {bhSvar.frist.varsel_for_sent && (
          <TextBlock title="Begrunnelse for sen varsling:" content={bhSvar.frist.varsel_for_sent_begrunnelse} />
        )}
        <TextBlock title="Subsidiær begrunnelse for svar:" content={bhSvar.frist.bh_begrunnelse_frist} />
      </View>
    )}

    {(bhSvar.sign.dato_svar_bh || bhSvar.sign.for_byggherre) && (
      <View>
        <Text style={styles.subTitle}>Signatur</Text>
        <View style={styles.table}>
          <TableRow label="Dato for BH svar" value={bhSvar.sign.dato_svar_bh || '—'} />
        </View>
        <View style={styles.signatureRow}>
          <Text>
            <Text style={styles.signatureLabel}>For Byggherre</Text>
            <Text>{bhSvar.sign.for_byggherre || '—'}</Text>
          </Text>
        </View>
      </View>
    )}
  </View>
);

// Main Document Component
const KoePdfDocument: React.FC<{ data: FormDataModel }> = ({ data }) => (
  <Document
    title={data.sak.sakstittel || 'KOE – Krav om endringsordre'}
    author={data.sak.opprettet_av || 'Oslo Kommune'}
  >
    {/* Page 1: Title and Summary */}
    <Page size="A4" style={styles.page}>
      <Header data={data} />
      <TitlePage data={data} />
      <SummarySection data={data} />
      <Footer pageNumber={1} totalPages={data.koe_revisjoner.length + data.bh_svar_revisjoner.length + 2} />
    </Page>

    {/* Page 2: Varsel */}
    <Page size="A4" style={styles.page}>
      <Header data={data} />
      <VarselSection data={data} />
      <Footer pageNumber={2} totalPages={data.koe_revisjoner.length + data.bh_svar_revisjoner.length + 2} />
    </Page>

    {/* KOE Revisjoner */}
    {data.koe_revisjoner.map((koe, index) => (
      <Page key={`koe-${index}`} size="A4" style={styles.page}>
        <Header data={data} />
        <KoeRevisionSection koe={koe} index={index} />
        <Footer pageNumber={3 + index} totalPages={data.koe_revisjoner.length + data.bh_svar_revisjoner.length + 2} />
      </Page>
    ))}

    {/* BH Svar Revisjoner */}
    {data.bh_svar_revisjoner.map((bhSvar, index) => {
      const correspondingKoe = data.koe_revisjoner[index];
      if (!correspondingKoe) return null;
      return (
        <Page key={`bh-${index}`} size="A4" style={styles.page}>
          <Header data={data} />
          <BhSvarRevisionSection bhSvar={bhSvar} koe={correspondingKoe} index={index} />
          <Footer
            pageNumber={3 + data.koe_revisjoner.length + index}
            totalPages={data.koe_revisjoner.length + data.bh_svar_revisjoner.length + 2}
          />
        </Page>
      );
    })}
  </Document>
);

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
