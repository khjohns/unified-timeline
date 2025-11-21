import React, { useState } from 'react';
import { FormDataModel } from '../../types';
import { PktTag, PktButton, PktTable } from '@oslokommune/punkt-react';
import { HOVEDKATEGORI_OPTIONS, UNDERKATEGORI_MAP } from '../../constants';
import {
  getSakStatusLabel,
  getSakStatusSkin,
  getKravStatusLabel,
  getKravStatusSkin,
  getSvarStatusLabel,
  getSvarStatusSkin
} from '../../utils/statusHelpers';
import BegrunnelseModal from '../ui/BegrunnelseModal';

interface TestOversiktPanelProps {
  data: FormDataModel;
}

const TestOversiktPanel: React.FC<TestOversiktPanelProps> = ({ data }) => {
  const { sak, varsel, koe_revisjoner = [], bh_svar_revisjoner = [] } = data;

  // Modal state
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    revisjon: string;
    begrunnelse: string;
  }>({
    isOpen: false,
    title: '',
    revisjon: '',
    begrunnelse: '',
  });

  const openModal = (title: string, revisjon: string, begrunnelse: string) => {
    setModal({
      isOpen: true,
      title,
      revisjon,
      begrunnelse,
    });
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
  };

  // Helper to get label from hovedkategori
  const getHovedkategoriLabel = (value: string) => {
    const option = HOVEDKATEGORI_OPTIONS.find(opt => opt.value === value);
    return option?.label || value;
  };

  // Helper to get underkategori labels
  const getUnderkategoriLabels = (hovedkat: string, values: string[]) => {
    const options = UNDERKATEGORI_MAP[hovedkat] || [];
    return values.map(v => {
      const opt = options.find(o => o.value === v);
      return opt?.label || v;
    }).join(', ');
  };

  // -------------------------------------------------------------------
  // GRID COMPONENTS FOR METADATA
  // -------------------------------------------------------------------
  
  // Wrapper for selve gridden
  const MetadataGrid = ({ children }: { children: React.ReactNode }) => (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(150px,_auto)_1fr_minmax(150px,_auto)_1fr] border border-border-color rounded-lg overflow-hidden bg-white">
      {children}
    </div>
  );

  // Label celle (Grå bakgrunn)
  const GridLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-gray-50 px-4 py-3 font-medium text-ink-dim border-b md:border-b-0 md:border-r border-border-color flex items-center">
      {children}
    </div>
  );

  // Verdi celle (Hvit bakgrunn) - span avgjør om den skal ta opp resten av raden på desktop
  const GridValue = ({ children, span = false }: { children: React.ReactNode; span?: boolean }) => (
    <div className={`px-4 py-3 border-b border-border-color md:border-b-0 flex items-center ${span ? 'md:col-span-3' : 'md:border-r'}`}>
      {children}
    </div>
  );

  // Rad-wrapper for å tvinge linjeskift i gridden på desktop (valgfri, men nyttig for logisk gruppering)
  // Note: CSS Grid 'auto-fill' håndterer dette ofte selv, men med vår faste 4-kolonne struktur
  // legger vi bare elementene flatt inn i MetadataGrid. 
  // Strukturer under antar rekkefølgen: Label -> Verdi -> Label -> Verdi.

  return (
    <div className="space-y-10 p-6">
      
      {/* CUSTOM CSS FOR STICKY TABLE COLUMN */}
      <style>{`
        /* Gjør første kolonne sticky og gir den bakgrunn så innhold ikke "blør" gjennom når man scroller */
        .sticky-table-first-col th:first-child,
        .sticky-table-first-col td:first-child {
          position: sticky;
          left: 0;
          z-index: 10;
          background-color: #f9fafb; /* matcher bg-gray-50 */
          border-right: 2px solid #e5e7eb; /* tydelig skille */
        }
        /* Justering for zebra-striping konlfikter */
        .sticky-table-first-col tr:nth-child(even) td:first-child {
          background-color: #f9fafb; 
        }
      `}</style>

      {/* SAKSMETADATA (CSS GRID) */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3 flex items-center gap-2">
          📋 Saksmetadata (automatisk generert)
        </h3>
        <MetadataGrid>
          {/* Rad 1 */}
          <GridLabel>Sak-ID</GridLabel>
          <GridValue>{sak.sak_id_display || sak.sak_id || '—'}</GridValue>
          <GridLabel>Opprettet dato</GridLabel>
          <GridValue>{sak.opprettet_dato || '—'}</GridValue>

          {/* Rad 2 (border-t lagt til manuelt på desktop via grid-gap eller wrapper hvis nødvendig, her bruker vi border-b på grid items hvis vi vil ha linjer mellom rader, men grid-container har border rundt) */}
          {/* For å få border MELLOM rader i grid må vi enten bruke gap-y-px og bg-color, eller border-b på elementene. 
              Her legger jeg border-t på elementene unntatt de første 4 for å simulere rader. */}
          
          <div className="col-span-1 md:col-span-4 h-px bg-border-color hidden md:block"></div>

          <GridLabel>Opprettet av</GridLabel>
          <GridValue>{sak.opprettet_av || '—'}</GridValue>
          <GridLabel>Status</GridLabel>
          <GridValue>
            <PktTag skin={getSakStatusSkin(sak.status)}>
              {getSakStatusLabel(sak.status)}
            </PktTag>
          </GridValue>
        </MetadataGrid>
      </section>

      {/* PROSJEKTINFORMASJON (CSS GRID) */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3 flex items-center gap-2">
          🏗️ Prosjektinformasjon
        </h3>
        <MetadataGrid>
          {/* Rad 1 - Full bredde på verdi */}
          <GridLabel>Sakstittel</GridLabel>
          <GridValue span>{sak.sakstittel || '—'}</GridValue>
          
          <div className="col-span-1 md:col-span-4 h-px bg-border-color hidden md:block"></div>

          {/* Rad 2 - Full bredde på verdi */}
          <GridLabel>Prosjekt</GridLabel>
          <GridValue span>{sak.prosjekt_navn || '—'}</GridValue>

          <div className="col-span-1 md:col-span-4 h-px bg-border-color hidden md:block"></div>

          {/* Rad 3 - Split */}
          <GridLabel>Prosjektnummer</GridLabel>
          <GridValue>{sak.kontrakt_referanse || '—'}</GridValue>
          <GridLabel>Entreprenør (TE)</GridLabel>
          <GridValue>{sak.entreprenor || '—'}</GridValue>

          <div className="col-span-1 md:col-span-4 h-px bg-border-color hidden md:block"></div>

          {/* Rad 4 - Full bredde */}
          <GridLabel>Byggherre (BH)</GridLabel>
          <GridValue span>{sak.byggherre || '—'}</GridValue>
        </MetadataGrid>
      </section>

      {/* VARSEL (CSS GRID) */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3 flex items-center gap-2">
          📨 Varsel
        </h3>
        <MetadataGrid>
          <GridLabel>Dato oppdaget</GridLabel>
          <GridValue>{varsel.dato_forhold_oppdaget || '—'}</GridValue>
          <GridLabel>Dato sendt</GridLabel>
          <GridValue>{varsel.dato_varsel_sendt || '—'}</GridValue>

          <div className="col-span-1 md:col-span-4 h-px bg-border-color hidden md:block"></div>

          <GridLabel>Hovedkategori</GridLabel>
          <GridValue span>
            {varsel.hovedkategori ? getHovedkategoriLabel(varsel.hovedkategori) : '—'}
          </GridValue>

          {varsel.underkategori && varsel.underkategori.length > 0 && (
            <>
              <div className="col-span-1 md:col-span-4 h-px bg-border-color hidden md:block"></div>
              <GridLabel>Underkategori(er)</GridLabel>
              <GridValue span>
                {getUnderkategoriLabels(varsel.hovedkategori, varsel.underkategori)}
              </GridValue>
            </>
          )}

          <div className="col-span-1 md:col-span-4 h-px bg-border-color hidden md:block"></div>

          <GridLabel>Metode for varsling</GridLabel>
          <GridValue>
            {varsel.varsel_metode || '—'}
            {varsel.varsel_metode_annet && ` (${varsel.varsel_metode_annet})`}
          </GridValue>
          <GridLabel>Vedlegg</GridLabel>
          <GridValue>
            {varsel.vedlegg && varsel.vedlegg.length > 0 ? (
               <span className="text-muted text-sm">{varsel.vedlegg.length} fil(er)</span>
            ) : '—'}
          </GridValue>

          <div className="col-span-1 md:col-span-4 h-px bg-border-color hidden md:block"></div>

          <GridLabel>Beskrivelse</GridLabel>
          <GridValue span>
            {varsel.varsel_beskrivelse ? (
              <PktButton
                size="small"
                skin="tertiary"
                onClick={() =>
                  openModal('Varsel - Beskrivelse av forholdet', '', varsel.varsel_beskrivelse)
                }
              >
                Vis beskrivelse
              </PktButton>
            ) : (
              <span className="text-muted text-sm">—</span>
            )}
          </GridValue>
        </MetadataGrid>
      </section>

      {/* KRAV (KOE) - REVISJONSHISTORIKK - MED PKTTABLE */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3 flex items-center gap-2">
          📋 Krav (KOE) - Revisjonshistorikk
        </h3>
        {koe_revisjoner.length === 0 ? (
          <div className="bg-gray-50 border border-border-color rounded-lg p-4 text-sm text-muted">
            Ingen revisjoner registrert ennå
          </div>
        ) : (
          <div className="overflow-x-auto rounded-t-lg border border-border-color sticky-table-first-col">
            <PktTable skin="zebra-blue" compact className="w-full">
              <thead>
                <tr>
                  <th className="font-semibold text-left min-w-[200px]">Felt</th>
                  {koe_revisjoner.map((_, idx) => (
                    <th
                      key={idx}
                      className="text-center font-semibold min-w-[160px]"
                    >
                      Rev {koe_revisjoner[idx].koe_revisjonsnr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Status</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center">
                      <PktTag skin={getKravStatusSkin(rev.status)}>
                        {getKravStatusLabel(rev.status)}
                      </PktTag>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Dato sendt</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center">
                      {rev.dato_krav_sendt || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Sendt av</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center">
                      {rev.for_entreprenor || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Vederlag krevd</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center">
                      {rev.vederlag?.krav_vederlag ? (
                        <span className="font-semibold text-green-700">
                          {rev.vederlag.krav_vederlag_belop ? `${Number(rev.vederlag.krav_vederlag_belop).toLocaleString('no-NO')} NOK` : 'Ja'}
                        </span>
                      ) : (
                        <span className="text-muted">Nei</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Produktivitetstap</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center">
                      {rev.vederlag?.krav_produktivitetstap ? (
                        <span className="text-green-700 text-lg">✓</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Særskilt varsel rigg/drift</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center">
                      {rev.vederlag?.saerskilt_varsel_rigg_drift ? (
                        <span className="text-green-700 text-lg">✓</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Vederlagsmetode</td>
                  {koe_revisjoner.map((rev, idx) => {
                    const metodeMap: Record<string, string> = {
                      '100000000': 'Enhetspris',
                      '100000001': 'Regning',
                      '100000002': 'Fast pris',
                      '100000003': 'Kalkyle',
                    };
                    return (
                      <td key={idx} className="text-center text-sm">
                        {rev.vederlag?.krav_vederlag_metode ? metodeMap[rev.vederlag.krav_vederlag_metode] || '—' : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="font-medium">Fristforlengelse</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center">
                      {rev.frist?.krav_fristforlengelse ? (
                        <span className="font-semibold text-blue-700">
                          {rev.frist.krav_frist_antall_dager ? `${rev.frist.krav_frist_antall_dager} dager` : 'Ja'}
                        </span>
                      ) : (
                        <span className="text-muted">Nei</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Fristtype</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center text-sm">
                      {rev.frist?.krav_frist_type || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Kritisk linje</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center">
                      {rev.frist?.forsinkelse_kritisk_linje ? (
                        <span className="text-blue-700 text-lg">✓</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Vedlegg</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center text-sm">
                      {rev.vedlegg && rev.vedlegg.length > 0 ? (
                        <span className="text-muted">{rev.vedlegg.length} fil(er)</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Vederlagsbegrunnelse</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center">
                      {rev.vederlag?.krav_vederlag_begrunnelse ? (
                        <PktButton
                          size="small"
                          skin="tertiary"
                          onClick={() =>
                            openModal('Vederlagsbegrunnelse', `Revisjon ${rev.koe_revisjonsnr}`, rev.vederlag.krav_vederlag_begrunnelse)
                          }
                        >
                          Vis
                        </PktButton>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Fristbegrunnelse</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center">
                      {rev.frist?.krav_frist_begrunnelse ? (
                        <PktButton
                          size="small"
                          skin="tertiary"
                          onClick={() =>
                            openModal('Fristbegrunnelse', `Revisjon ${rev.koe_revisjonsnr}`, rev.frist.krav_frist_begrunnelse)
                          }
                        >
                          Vis
                        </PktButton>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </PktTable>
          </div>
        )}
      </section>

      {/* BH SVAR - REVISJONSHISTORIKK - MED PKTTABLE */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3 flex items-center gap-2">
          💬 Svar fra byggherre - Revisjonshistorikk
        </h3>
        {bh_svar_revisjoner.length === 0 ? (
          <div className="bg-gray-50 border border-border-color rounded-lg p-4 text-sm text-muted">
            Ingen svar registrert ennå
          </div>
        ) : (
          <div className="overflow-x-auto rounded-t-lg border border-border-color sticky-table-first-col">
            <PktTable skin="zebra-blue" compact className="w-full">
              <thead>
                <tr>
                  <th className="font-semibold text-left min-w-[200px]">Felt</th>
                  {bh_svar_revisjoner.map((_, idx) => (
                    <th key={idx} className="text-center font-semibold min-w-[160px]">
                      Svar {idx}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Status</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      <PktTag skin={getSvarStatusSkin(svar.status)}>
                        {getSvarStatusLabel(svar.status)}
                      </PktTag>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Dato svar</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      {svar.sign?.dato_svar_bh || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Svart av</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      {svar.sign?.for_byggherre || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Vederlag</td>
                  {bh_svar_revisjoner.map((svar, idx) => {
                    const vedStatus = svar.vederlag?.bh_svar_vederlag;
                    const beløp = svar.vederlag?.bh_godkjent_vederlag_belop;
                    let display = '—';
                    if (vedStatus === '100000000') display = `✅ ${beløp ? beløp + ' NOK' : 'Godkjent'}`;
                    else if (vedStatus === '100000001') display = `⚠️ ${beløp ? beløp + ' NOK' : 'Delvis'}`;
                    else if (vedStatus === '100000002') display = '❌ Avslått';
                    return (
                      <td key={idx} className="text-center text-sm">
                        {display}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="font-medium">Frist</td>
                  {bh_svar_revisjoner.map((svar, idx) => {
                    const fristStatus = svar.frist?.bh_svar_frist;
                    const dager = svar.frist?.bh_godkjent_frist_dager;
                    let display = '—';
                    if (fristStatus === '100000000') display = `✅ ${dager ? dager + ' dager' : 'Godkjent'}`;
                    else if (fristStatus === '100000001') display = `⚠️ ${dager ? dager + ' dager' : 'Delvis'}`;
                    else if (fristStatus === '100000002') display = '❌ Avslått';
                    return (
                      <td key={idx} className="text-center text-sm">
                        {display}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="font-medium">Varsel for sent (vederlag)</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      {svar.vederlag?.varsel_for_sent ? <span className="text-red-700">✓</span> : <span className="text-muted">—</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Vederlagsbegrunnelse</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      {svar.vederlag?.bh_begrunnelse_vederlag ? (
                        <PktButton size="small" skin="tertiary" onClick={() => openModal('BH Vederlagsbegrunnelse', `Svar ${idx}`, svar.vederlag.bh_begrunnelse_vederlag)}>Vis</PktButton>
                      ) : <span className="text-muted text-xs">—</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Fristbegrunnelse</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      {svar.frist?.bh_begrunnelse_frist ? (
                        <PktButton size="small" skin="tertiary" onClick={() => openModal('BH Fristbegrunnelse', `Svar ${idx}`, svar.frist.bh_begrunnelse_frist)}>Vis</PktButton>
                      ) : <span className="text-muted text-xs">—</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium">Møtereferat</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      {svar.mote_referat ? (
                        <PktButton size="small" skin="tertiary" onClick={() => openModal('Møtereferat', `Svar ${idx}`, svar.mote_referat)}>Vis</PktButton>
                      ) : <span className="text-muted text-xs">—</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </PktTable>
          </div>
        )}
      </section>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">💡 Om denne visningen:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Tabellene viser alle revisjoner side-ved-side for enkel sammenligning.</li>
          <li>Du kan scrolle horisontalt i tabellene. Første kolonne følger med når du scroller.</li>
          <li>Metadata vises i rutenett øverst (tilpasser seg skjermstørrelse).</li>
        </ul>
      </div>

      {/* Begrunnelse Modal */}
      <BegrunnelseModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        revisjon={modal.revisjon}
        begrunnelse={modal.begrunnelse}
      />
    </div>
  );
};

export default TestOversiktPanel;
