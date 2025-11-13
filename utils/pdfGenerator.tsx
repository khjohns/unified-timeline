import { jsPDF } from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';
import { FormDataModel, Koe, BhSvar } from '../types';

// Extend jsPDF with autoTable plugin for type safety
interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: { finalY: number };
}

// Design System Colors
const COLORS = {
  primary: '#1F42AA',
  primaryDark: '#2A2859',
  ink: '#2C2C2C',
  inkDim: '#4D4D4D',
  muted: '#666666',
  border: '#E6E6E6',
  lightBg: '#F1FDFF',
};

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
};

// === HELPER FUNCTIONS ===

const renderHeader = (doc: jsPDFWithAutoTable, data: FormDataModel, PAGE_WIDTH: number, MARGIN: number) => {
  doc.setFillColor(...hexToRgb(COLORS.primary));
  doc.rect(0, 0, PAGE_WIDTH, 25, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('KOE – Krav om endringsordre', MARGIN, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('NS 8407:2011', MARGIN, 18);

  doc.setFontSize(8);
  const versionText = `v${data.versjon}`;
  const versionWidth = doc.getTextWidth(versionText);
  doc.setFillColor(255, 255, 255, 0.2);
  doc.roundedRect(PAGE_WIDTH - MARGIN - versionWidth - 8, 8, versionWidth + 6, 6, 2, 2, 'F');
  doc.text(versionText, PAGE_WIDTH - MARGIN - versionWidth - 5, 12);
};

const renderFooter = (doc: jsPDFWithAutoTable, PAGE_WIDTH: number, PAGE_HEIGHT: number, MARGIN: number) => {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...hexToRgb(COLORS.border));
    doc.line(MARGIN, PAGE_HEIGHT - 15, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 15);

    doc.setTextColor(...hexToRgb(COLORS.muted));
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    const generatedText = `Generert: ${new Date().toLocaleString('no-NO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    doc.text(generatedText, MARGIN, PAGE_HEIGHT - 10);

    const pageText = `Side ${i} av ${pageCount}`;
    const pageTextWidth = doc.getTextWidth(pageText);
    doc.text(pageText, PAGE_WIDTH - MARGIN - pageTextWidth, PAGE_HEIGHT - 10);
  }
};

const renderTitlePage = (
  doc: jsPDFWithAutoTable,
  data: FormDataModel,
  y: number,
  MARGIN: number,
  CONTENT_WIDTH: number
): number => {
  doc.setTextColor(...hexToRgb(COLORS.ink));
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(data.sak.sakstittel || 'Uten tittel', CONTENT_WIDTH);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 10 + 5;

  doc.setFontSize(14);
  doc.setTextColor(...hexToRgb(COLORS.primaryDark));
  doc.text(`Sak-ID: ${data.sak.sak_id_display || 'Ikke angitt'}`, MARGIN, y);
  y += 15;

  doc.setFillColor(...hexToRgb(COLORS.lightBg));
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 38, 3, 3, 'F');

  const infoY = y + 8;
  const col1X = MARGIN + 5;
  const col2X = MARGIN + CONTENT_WIDTH / 2;
  doc.setTextColor(...hexToRgb(COLORS.inkDim));
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Prosjekt:', col1X, infoY);
  doc.text('Kontrakt:', col1X, infoY + 7);
  doc.text('Entreprenør:', col1X, infoY + 14);
  doc.text('Opprettet:', col2X, infoY);
  doc.text('Opprettet av:', col2X, infoY + 7);
  doc.text('Byggherre:', col2X, infoY + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(data.sak.prosjekt_navn || '—', col1X + 25, infoY);
  doc.text(data.sak.kontrakt_referanse || '—', col1X + 25, infoY + 7);
  doc.text(data.sak.entreprenor || '—', col1X + 25, infoY + 14);
  doc.text(data.sak.opprettet_dato || '—', col2X + 25, infoY);
  doc.text(data.sak.opprettet_av || '—', col2X + 25, infoY + 7);
  doc.text(data.sak.byggherre || '—', col2X + 25, infoY + 14);

  return y + 48;
};

const renderVarselSection = (
  doc: jsPDFWithAutoTable,
  data: FormDataModel,
  y: number,
  MARGIN: number,
  addMainTitle: (title: string) => void,
  addTable: (body: string[][], striped?: boolean) => void,
  addTextBlock: (title: string, content: string) => void,
  SPACING: { SECTION: number }
): number => {
  addMainTitle('1. Varsel');
  addTable([
    ['Dato forhold oppdaget', data.varsel.dato_forhold_oppdaget || '—'],
    ['Dato varsel sendt', data.varsel.dato_varsel_sendt || '—'],
    ['Hovedkategori', data.varsel.hovedkategori || '—'],
    ['Underkategori', data.varsel.underkategori || '—'],
  ]);
  addTextBlock('Beskrivelse:', data.varsel.varsel_beskrivelse);

  return SPACING.SECTION;
};

const renderKoeRevision = (
  doc: jsPDFWithAutoTable,
  koe: Koe,
  revisionIndex: number,
  addMainTitle: (title: string) => void,
  addSubTitle: (title: string) => void,
  addTable: (body: string[][], striped?: boolean) => void,
  addTextBlock: (title: string, content: string) => void,
  checkPageBreak: (height: number) => void,
  MARGIN: number,
  SPACING: { SUB_SECTION: number }
): void => {
  const revNum = koe.koe_revisjonsnr || revisionIndex.toString();
  addMainTitle(`2. Krav om endringsordre (Revisjon ${revNum})`);

  addTable([
    ['Revisjonsnummer', koe.koe_revisjonsnr || '—'],
    ['Dato krav sendt', koe.dato_krav_sendt || '—'],
  ]);

  if (koe.vederlag.krav_vederlag) {
    addSubTitle('Vederlagsjustering');
    addTable([
      ['Krav om produktivitetstap', koe.vederlag.krav_produktivitetstap ? 'Ja' : 'Nei'],
      ['Særskilt rigg/drift', koe.vederlag.saerskilt_varsel_rigg_drift ? 'Ja' : 'Nei'],
      ['Oppgjørsmetode', koe.vederlag.krav_vederlag_metode || '—'],
      ['Beløp (NOK)', koe.vederlag.krav_vederlag_belop ? parseFloat(koe.vederlag.krav_vederlag_belop).toLocaleString('no-NO') : '—'],
    ]);
    addTextBlock('Begrunnelse/kalkyle:', koe.vederlag.krav_vederlag_begrunnelse);
  }

  if (koe.frist.krav_fristforlengelse) {
    addSubTitle('Fristforlengelse');
    addTable([
      ['Fristtype', koe.frist.krav_frist_type || '—'],
      ['Antall dager', koe.frist.krav_frist_antall_dager || '—'],
      ['Påvirker kritisk linje', koe.frist.forsinkelse_kritisk_linje ? 'Ja' : 'Nei'],
    ]);
    addTextBlock('Begrunnelse:', koe.frist.krav_frist_begrunnelse);
  }

  if (koe.for_entreprenor) {
    addSubTitle('Signatur');
    checkPageBreak(20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hexToRgb(COLORS.ink));
    const currentY = (doc as any).y || 0;
    doc.text('For Entreprenør', MARGIN, currentY);
    doc.text(koe.for_entreprenor || '—', MARGIN + 60, currentY);
  }
};

const renderBhSvarRevision = (
  doc: jsPDFWithAutoTable,
  bhSvar: BhSvar,
  koe: Koe,
  revisionIndex: number,
  addMainTitle: (title: string) => void,
  addSubTitle: (title: string) => void,
  addTable: (body: string[][], striped?: boolean) => void,
  addTextBlock: (title: string, content: string) => void,
  checkPageBreak: (height: number) => void,
  MARGIN: number,
  SPACING: { SUB_SECTION: number }
): void => {
  const revNum = koe.koe_revisjonsnr || revisionIndex.toString();
  addMainTitle(`3. Svar fra Byggherre (Revisjon ${revNum})`);

  if (bhSvar.mote_dato || bhSvar.mote_referat) {
    addSubTitle('Avklaring-/Forhandlingsmøte');
    addTable([
      ['Dato for møte', bhSvar.mote_dato || '—'],
      ['Referanse til møtereferat', bhSvar.mote_referat || '—'],
    ]);
  }

  if (koe.vederlag.krav_vederlag) {
    addSubTitle('Svar på vederlagskrav');
    addTable([
      ['Vederlagsvarsel ansett for sent', bhSvar.vederlag.varsel_for_sent ? 'Ja' : 'Nei'],
      ['Status', bhSvar.vederlag.bh_svar_vederlag || '—'],
      ['Godkjent beløp (NOK)', bhSvar.vederlag.bh_godkjent_vederlag_belop ? parseFloat(bhSvar.vederlag.bh_godkjent_vederlag_belop).toLocaleString('no-NO') : '—'],
    ]);
    if (bhSvar.vederlag.varsel_for_sent) {
      addTextBlock('Begrunnelse for sen varsling:', bhSvar.vederlag.varsel_for_sent_begrunnelse);
    }
    addTextBlock('Subsidiær begrunnelse for svar:', bhSvar.vederlag.bh_begrunnelse_vederlag);
  }

  if (koe.frist.krav_fristforlengelse) {
    addSubTitle('Svar på fristkrav');
    addTable([
      ['Fristvarsel ansett for sent', bhSvar.frist.varsel_for_sent ? 'Ja' : 'Nei'],
      ['Status', bhSvar.frist.bh_svar_frist || '—'],
      ['Godkjente dager', bhSvar.frist.bh_godkjent_frist_dager || '—'],
      ['Frist for spesifisering', bhSvar.frist.bh_frist_for_spesifisering || '—'],
    ]);
    if (bhSvar.frist.varsel_for_sent) {
      addTextBlock('Begrunnelse for sen varsling:', bhSvar.frist.varsel_for_sent_begrunnelse);
    }
    addTextBlock('Subsidiær begrunnelse for svar:', bhSvar.frist.bh_begrunnelse_frist);
  }

  if (bhSvar.sign.dato_svar_bh || bhSvar.sign.for_byggherre) {
    addSubTitle('Signatur');
    addTable([
      ['Dato for BH svar', bhSvar.sign.dato_svar_bh || '—'],
    ]);
    checkPageBreak(30);
    const currentY = (doc as any).y || 0;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hexToRgb(COLORS.ink));
    doc.text('For Byggherre', MARGIN, currentY + 10);
    doc.text(bhSvar.sign.for_byggherre || '—', MARGIN + 60, currentY + 10);
  }
};

// === MAIN FUNCTION ===

export const generatePdf = (data: FormDataModel) => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const PAGE_WIDTH = doc.internal.pageSize.getWidth();
  const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
  const MARGIN = 20;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
  const SPACING = {
    SECTION: 12,
    SUB_SECTION: 8,
    BLOCK: 5,
    TABLE_AFTER: 8,
  };

  // === GLOBAL Y CURSOR ===
  let y: number;

  // === PAGE MANAGEMENT ===
  const addNewPage = () => {
    doc.addPage();
    renderHeader(doc, data, PAGE_WIDTH, MARGIN);
    y = 40;
  };

  const checkPageBreak = (requiredHeight: number) => {
    if (y + requiredHeight > PAGE_HEIGHT - MARGIN) {
      addNewPage();
    }
  };

  // === DRAWING HELPERS ===
  const addMainTitle = (title: string) => {
    checkPageBreak(15);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hexToRgb(COLORS.primary));
    doc.text(title, MARGIN, y);
    y += 10;
  };

  const addSubTitle = (title: string) => {
    checkPageBreak(12);
    y += SPACING.SUB_SECTION;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hexToRgb(COLORS.inkDim));
    doc.text(title, MARGIN, y);
    y += 8;
  };

  const addTextBlock = (title: string, content: string) => {
    if (!content?.trim()) return;

    doc.setFontSize(10);
    const titleHeight = doc.getTextDimensions(title).h;
    doc.setFontSize(9);
    const textLines = doc.splitTextToSize(content, CONTENT_WIDTH - 5);
    const textHeight = doc.getTextDimensions(textLines).h;

    const totalHeight = titleHeight + textHeight + 2 + SPACING.BLOCK;
    checkPageBreak(totalHeight);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hexToRgb(COLORS.inkDim));
    doc.text(title, MARGIN, y);
    y += titleHeight + 2;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hexToRgb(COLORS.ink));
    doc.text(textLines, MARGIN + 5, y);
    y += textHeight + SPACING.BLOCK;
  };

  const addTable = (body: string[][], striped = true) => {
    checkPageBreak(15);
    const options: UserOptions = {
      startY: y,
      body: body,
      theme: striped ? 'striped' : 'plain',
      styles: { fontSize: 9, cellPadding: 3, textColor: hexToRgb(COLORS.ink) },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { cellWidth: 'auto' } },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: (hookData) => {
        if (hookData.pageNumber > 1 && hookData.cursor && hookData.cursor.y < 40) {
          renderHeader(doc, data, PAGE_WIDTH, MARGIN);
        }
      }
    };
    autoTable(doc, options);
    y = doc.lastAutoTable.finalY + SPACING.TABLE_AFTER;
  };

  // === START DOCUMENT GENERATION ===
  renderHeader(doc, data, PAGE_WIDTH, MARGIN);
  y = 45;

  // Title page
  y = renderTitlePage(doc, data, y, MARGIN, CONTENT_WIDTH);

  // Summary section (show latest revision)
  const latestKoe = data.koe_revisjoner[data.koe_revisjoner.length - 1];
  const latestBhSvar = data.bh_svar_revisjoner[data.bh_svar_revisjoner.length - 1];

  if (latestKoe && (latestKoe.vederlag.krav_vederlag || latestKoe.frist.krav_fristforlengelse)) {
    checkPageBreak(50);
    addSubTitle('Sammendrag krav (siste revisjon)');
    const summaryData: string[][] = [];
    if (latestKoe.vederlag.krav_vederlag) {
      summaryData.push(['Krevd vederlag', `${(parseFloat(latestKoe.vederlag.krav_vederlag_belop) || 0).toLocaleString('no-NO')} NOK`]);
      if (latestBhSvar?.vederlag.bh_svar_vederlag) {
        summaryData.push(['Godkjent vederlag', `${(parseFloat(latestBhSvar.vederlag.bh_godkjent_vederlag_belop) || 0).toLocaleString('no-NO')} NOK`]);
      }
    }
    if (latestKoe.frist.krav_fristforlengelse) {
      summaryData.push(['Krevd fristforlengelse', `${latestKoe.frist.krav_frist_antall_dager || '—'} dager`]);
      if (latestBhSvar?.frist.bh_svar_frist) {
        summaryData.push(['Godkjent fristforlengelse', `${latestBhSvar.frist.bh_godkjent_frist_dager || '—'} dager`]);
      }
    }
    addTable(summaryData, false);
  }

  // === DETAILED PAGES ===
  addNewPage();

  // Varsel
  renderVarselSection(doc, data, y, MARGIN, addMainTitle, addTable, addTextBlock, SPACING);
  y += SPACING.SECTION;

  // Krav revisjoner
  data.koe_revisjoner.forEach((koe, index) => {
    if (index > 0) addNewPage();
    renderKoeRevision(doc, koe, index, addMainTitle, addSubTitle, addTable, addTextBlock, checkPageBreak, MARGIN, SPACING);
  });

  // BH Svar revisjoner
  data.bh_svar_revisjoner.forEach((bhSvar, index) => {
    const correspondingKoe = data.koe_revisjoner[index];
    if (correspondingKoe) {
      addNewPage();
      renderBhSvarRevision(doc, bhSvar, correspondingKoe, index, addMainTitle, addSubTitle, addTable, addTextBlock, checkPageBreak, MARGIN, SPACING);
    }
  });

  // === FOOTER ===
  renderFooter(doc, PAGE_WIDTH, PAGE_HEIGHT, MARGIN);

  // Save
  const filename = `KOE_${data.sak.sak_id_display || 'rapport'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};
