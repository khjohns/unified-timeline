// @ts-nocheck
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FormDataModel } from '../types';

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

  // === HEADER & FOOTER HELPERS ===
  const addHeader = () => {
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

  const addFooter = () => {
    const pageCount = doc.internal.getNumberOfPages();
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
  
  // === PAGE MANAGEMENT ===
  const addNewPage = () => {
    doc.addPage();
    addHeader();
    y = 40; // Start Y on new page
  };

  const checkPageBreak = (requiredHeight: number) => {
    if (y + requiredHeight > PAGE_HEIGHT - MARGIN) {
      addNewPage();
    }
  };
  
  // === DRAWING HELPERS (REFACTORED) ===
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
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...hexToRgb(COLORS.inkDim));
    doc.text(title, MARGIN, y);
    y += 8;
  };

  const addTextBlock = (title: string, content: string) => {
    if (!content?.trim()) return;
    
    doc.setFontSize(10); // Title font
    const titleHeight = doc.getTextDimensions(title).h;
    doc.setFontSize(9); // Content font
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
  
  const addTable = (body: any[][], striped = true) => {
    checkPageBreak(15); // Check for at least a header and one row
    autoTable(doc, {
      startY: y,
      body: body,
      theme: striped ? 'striped' : 'plain',
      styles: { fontSize: 9, cellPadding: 3, textColor: hexToRgb(COLORS.ink) },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 }, 1: { cellWidth: 'auto' } },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: (hookData) => {
        // If autoTable creates a new page, we need to add our header and reset 'y'
        if (hookData.pageNumber > doc.internal.getNumberOfPages()) {
          // This case should be handled by autoTable's own page break logic, but as a fallback:
        } else if (hookData.pageNumber > 1 && hookData.cursor.y < 40) {
             addHeader();
        }
      }
    });
    y = doc.lastAutoTable.finalY + SPACING.TABLE_AFTER;
  };

  // === START DOCUMENT GENERATION ===
  addHeader();
  y = 45;

  // Page 1: Title and Summary
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
  y += 48;

  if (data.koe.vederlag.krav_vederlag || data.koe.frist.krav_fristforlengelse) {
    checkPageBreak(50);
    addSubTitle('Sammendrag krav');
    const summaryData: any[] = [];
    if (data.koe.vederlag.krav_vederlag) {
      summaryData.push(['Krevd vederlag', `${(parseFloat(data.koe.vederlag.krav_vederlag_belop) || 0).toLocaleString('no-NO')} NOK`]);
      if(data.bh_svar.vederlag.bh_svar_vederlag) {
        summaryData.push(['Godkjent vederlag', `${(parseFloat(data.bh_svar.vederlag.bh_godkjent_vederlag_belop) || 0).toLocaleString('no-NO')} NOK`]);
      }
    }
    if (data.koe.frist.krav_fristforlengelse) {
      summaryData.push(['Krevd fristforlengelse', `${data.koe.frist.krav_frist_antall_dager || '—'} dager`]);
      if(data.bh_svar.frist.bh_svar_frist) {
         summaryData.push(['Godkjent fristforlengelse', `${data.bh_svar.frist.bh_godkjent_frist_dager || '—'} dager`]);
      }
    }
    addTable(summaryData, false);
  }

  // === START DETAILED PAGES ===
  addNewPage();

  // 1. Varsel
  addMainTitle('1. Varsel');
  addTable([
    ['Dato forhold oppdaget', data.varsel.dato_forhold_oppdaget || '—'],
    ['Dato varsel sendt', data.varsel.dato_varsel_sendt || '—'],
    ['Hovedkategori', data.varsel.hovedkategori || '—'],
    ['Underkategori', data.varsel.underkategori || '—'],
  ]);
  addTextBlock('Beskrivelse:', data.varsel.varsel_beskrivelse);
  y += SPACING.SECTION;

  // 2. Krav om endringsordre
  addMainTitle('2. Krav om endringsordre');
  addTable([
    ['Revisjonsnummer', data.koe.koe_revisjonsnr || '—'],
    ['Dato krav sendt', data.koe.dato_krav_sendt || '—'],
  ]);

  if (data.koe.vederlag.krav_vederlag) {
    y += SPACING.SUB_SECTION;
    addSubTitle('Vederlagsjustering');
    addTable([
      ['Krav om produktivitetstap', data.koe.vederlag.krav_produktivitetstap ? 'Ja' : 'Nei'],
      ['Særskilt rigg/drift', data.koe.vederlag.saerskilt_varsel_rigg_drift ? 'Ja' : 'Nei'],
      ['Oppgjørsmetode', data.koe.vederlag.krav_vederlag_metode || '—'],
      ['Beløp (NOK)', data.koe.vederlag.krav_vederlag_belop ? parseFloat(data.koe.vederlag.krav_vederlag_belop).toLocaleString('no-NO') : '—'],
    ]);
    addTextBlock('Begrunnelse/kalkyle:', data.koe.vederlag.krav_vederlag_begrunnelse);
  }

  if (data.koe.frist.krav_fristforlengelse) {
    y += SPACING.SUB_SECTION;
    addSubTitle('Fristforlengelse');
    addTable([
      ['Fristtype', data.koe.frist.krav_frist_type || '—'],
      ['Antall dager', data.koe.frist.krav_frist_antall_dager || '—'],
      ['Påvirker kritisk linje', data.koe.frist.forsinkelse_kritisk_linje ? 'Ja' : 'Nei'],
    ]);
    addTextBlock('Begrunnelse:', data.koe.frist.krav_frist_begrunnelse);
  }
  
  if (data.koe.for_entreprenor) {
      y += SPACING.SUB_SECTION;
      addSubTitle('Signatur');
      checkPageBreak(20);
      y += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...hexToRgb(COLORS.ink));
      doc.text('For Entreprenør', MARGIN, y)
      doc.text(data.koe.for_entreprenor || '—', MARGIN + 60, y)
  }

  // 3. Svar fra Byggherre
  addNewPage();
  addMainTitle('3. Svar fra Byggherre');
  
  if (data.bh_svar.mote_dato || data.bh_svar.mote_referat) {
    addSubTitle('Avklaring-/Forhandlingsmøte');
    addTable([
        ['Dato for møte', data.bh_svar.mote_dato || '—'],
        ['Referanse til møtereferat', data.bh_svar.mote_referat || '—'],
    ]);
  }

  if (data.koe.vederlag.krav_vederlag) {
    y += SPACING.SUB_SECTION;
    addSubTitle('Svar på vederlagskrav');
    addTable([
      ['Vederlagsvarsel ansett for sent', data.bh_svar.vederlag.varsel_for_sent ? 'Ja' : 'Nei'],
      ['Status', data.bh_svar.vederlag.bh_svar_vederlag || '—'],
      ['Godkjent beløp (NOK)', data.bh_svar.vederlag.bh_godkjent_vederlag_belop ? parseFloat(data.bh_svar.vederlag.bh_godkjent_vederlag_belop).toLocaleString('no-NO') : '—'],
    ]);
    if (data.bh_svar.vederlag.varsel_for_sent) {
        addTextBlock('Begrunnelse for sen varsling:', data.bh_svar.vederlag.varsel_for_sent_begrunnelse);
    }
    addTextBlock('Subsidiær begrunnelse for svar:', data.bh_svar.vederlag.bh_begrunnelse_vederlag);
  }
  
  if (data.koe.frist.krav_fristforlengelse) {
    y += SPACING.SUB_SECTION;
    addSubTitle('Svar på fristkrav');
    addTable([
      ['Fristvarsel ansett for sent', data.bh_svar.frist.varsel_for_sent ? 'Ja' : 'Nei'],
      ['Status', data.bh_svar.frist.bh_svar_frist || '—'],
      ['Godkjente dager', data.bh_svar.frist.bh_godkjent_frist_dager || '—'],
      ['Frist for spesifisering', data.bh_svar.frist.bh_frist_for_spesifisering || '—'],
    ]);
    if (data.bh_svar.frist.varsel_for_sent) {
        addTextBlock('Begrunnelse for sen varsling:', data.bh_svar.frist.varsel_for_sent_begrunnelse);
    }
    addTextBlock('Subsidiær begrunnelse for svar:', data.bh_svar.frist.bh_begrunnelse_frist);
  }
  
  if (data.bh_svar.sign.dato_svar_bh || data.bh_svar.sign.for_byggherre) {
    y += SPACING.SUB_SECTION;
    addSubTitle('Signatur');
    addTable([
      ['Dato for BH svar', data.bh_svar.sign.dato_svar_bh || '—'],
    ]);
    checkPageBreak(30);
    y += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...hexToRgb(COLORS.ink));
    doc.text('For Byggherre', MARGIN, y)
    doc.text(data.bh_svar.sign.for_byggherre || '—', MARGIN + 60, y)
  }

  // === APPLY FOOTER TO ALL PAGES ===
  addFooter();

  // Save the PDF
  const filename = `KOE_${data.sak.sak_id_display || 'rapport'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};