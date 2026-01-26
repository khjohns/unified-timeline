/**
 * LetterHtmlPreview - HTML/CSS Preview Component
 *
 * Renders a formal letter as HTML for instant preview.
 * Matches the visual design of the PDF output (LetterDocument.tsx).
 * Used for live editing - PDF generation happens only on download.
 */

import type { BrevInnhold } from '../../types/letter';

interface LetterHtmlPreviewProps {
  brevInnhold: BrevInnhold;
  className?: string;
}

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
function MultiLineText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, index) => (
        <span key={index}>
          {line || '\u00A0'}
          {index < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

export function LetterHtmlPreview({ brevInnhold, className }: LetterHtmlPreviewProps) {
  const { seksjoner, referanser, tittel, mottaker, avsender } = brevInnhold;

  return (
    <div className={className}>
      {/* A4 paper simulation */}
      <div
        className="bg-white shadow-lg mx-auto"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '40px 50px 60px 50px',
          fontFamily: '"Oslo Sans", Arial, sans-serif',
          fontSize: '10pt',
          color: '#2C2C2C',
          lineHeight: 1.5,
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '30px',
            paddingBottom: '15px',
            borderBottom: '1px solid #E6E6E6',
          }}
        >
          <img
            src="/logos/Oslo-logo-RGB.png"
            alt="Oslo kommune"
            style={{ height: '40px' }}
          />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10pt', color: '#2C2C2C', marginBottom: '4px' }}>
              {formatDate(referanser.dato)}
            </div>
            <div style={{ fontSize: '9pt', color: '#666666' }}>
              Vår ref: {referanser.sakId}
            </div>
            <div style={{ fontSize: '9pt', color: '#666666' }}>
              Deres ref: {referanser.eventId.substring(0, 8)}
            </div>
          </div>
        </div>

        {/* Recipient */}
        <div style={{ marginBottom: '30px' }}>
          <div
            style={{
              fontSize: '8pt',
              color: '#666666',
              marginBottom: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Til
          </div>
          <div
            style={{
              fontSize: '11pt',
              fontWeight: 'bold',
              color: '#2C2C2C',
              marginBottom: '2px',
            }}
          >
            {mottaker.navn}
          </div>
          <div style={{ fontSize: '10pt', color: '#4D4D4D', marginBottom: '1px' }}>
            {mottaker.adresse}
          </div>
          <div style={{ fontSize: '10pt', color: '#4D4D4D' }}>
            {mottaker.orgnr}
          </div>
        </div>

        {/* Subject */}
        <div
          style={{
            fontSize: '12pt',
            fontWeight: 'bold',
            color: '#2A2859',
            marginBottom: '20px',
            paddingBottom: '10px',
            borderBottom: '2px solid #2A2859',
          }}
        >
          {tittel}
        </div>

        {/* Content sections */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '10pt',
              lineHeight: 1.6,
              color: '#2C2C2C',
              textAlign: 'justify',
            }}
          >
            <MultiLineText text={seksjoner.innledning.redigertTekst} />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '10pt',
              lineHeight: 1.6,
              color: '#2C2C2C',
              textAlign: 'justify',
            }}
          >
            <MultiLineText text={seksjoner.begrunnelse.redigertTekst} />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '10pt',
              lineHeight: 1.6,
              color: '#2C2C2C',
              textAlign: 'justify',
            }}
          >
            <MultiLineText text={seksjoner.avslutning.redigertTekst} />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '25px',
            left: '50px',
            right: '50px',
            borderTop: '1px solid #E6E6E6',
            paddingTop: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '8pt',
            color: '#666666',
          }}
        >
          <span>{referanser.sakId} | NS 8407:2011</span>
          <span>Generert: {formatDate()}</span>
        </div>
      </div>
    </div>
  );
}

export default LetterHtmlPreview;
