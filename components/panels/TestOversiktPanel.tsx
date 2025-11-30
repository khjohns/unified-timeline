import React, { useState } from 'react';
import { FormDataModel } from '../../types';
import { PktTag, PktButton, PktAlert } from '@oslokommune/punkt-react';
import { HOVEDKATEGORI_OPTIONS, UNDERKATEGORI_MAP } from '../../constants';
import {
  getSakStatusLabel,
  getSakStatusSkin,
  getKravStatusLabel,
  getKravStatusSkin,
  getSvarStatusLabel,
  getSvarStatusSkin,
  isVederlagGodkjent,
  isVederlagDelvis,
  isVederlagAvslått,
  isFristGodkjent,
  isFristDelvis,
  isFristAvslått
} from '../../utils/statusHelpers';
import { getVederlagsmetodeLabel } from '../../utils/pdfLabels';
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
  // GRID COMPONENTS (Metadata)
  // -------------------------------------------------------------------
  
  const MetadataGrid = ({ children }: { children: React.ReactNode }) => (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(150px,_auto)_1fr_minmax(150px,_auto)_1fr] border border-border-color rounded-lg overflow-hidden bg-white shadow-sm">
      {children}
    </div>
  );

  const GridLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-gray-50 px-4 py-3 font-medium text-ink-dim border-b md:border-b-0 md:border-r border-border-color flex items-center text-sm">
      {children}
    </div>
  );

  const GridValue = ({ children, span = false }: { children: React.ReactNode; span?: boolean }) => (
    <div className={`px-4 py-3 border-b border-border-color md:border-b-0 flex items-center text-sm ${span ? 'md:col-span-3' : 'md:border-r'}`}>
      {children}
    </div>
  );

  const GridDivider = () => (
    <div className="col-span-1 md:col-span-4 h-px bg-border-color hidden md:block"></div>
  );

  return (
    <div className="space-y-10 p-6">
      
      {/* STYLING FOR CUSTOM TABLES (Revisjonshistorikk) */}
      <style>{`
        /* Custom table som etterligner Grid-utseendet */
        .custom-grid-table {
          border-collapse: separate;
          border-spacing: 0;
          width: 100%;
        }
        .custom-grid-table th,
        .custom-grid-table td {
          padding: 12px 16px;
          font-size: 0.875rem; /* text-sm */
          border-right: 1px solid #E6E6E6; /* border-border-color */
          border-bottom: 1px solid #E6E6E6;
        }
        .custom-grid-table th:last-child,
        .custom-grid-table td:last-child {
          border-right: none;
        }
        .custom-grid-table tr:last-child td {
          border-bottom: none;
        }
        
        /* Sticky First Column Styling */
        .sticky-col {
          position: sticky;
          left: 0;
          z-index: 10;
          background-color: #F9FAFB; /* bg-gray-50 */
          font-weight: 500;
          color: #4D4D4D; /* text-ink-dim */
          border-right: 2px solid #E6E6E6 !important; /* Litt tydeligere skille */
        }
      `}</style>

      {/* SAKSMETADATA */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3">
          Saksmetadata (automatisk generert)
        </h3>
        <MetadataGrid>
          <GridLabel>Sak-ID</GridLabel>
          <GridValue>{sak.sak_id_display || sak.sak_id || '—'}</GridValue>
          <GridLabel>Opprettet dato</GridLabel>
          <GridValue>{sak.opprettet_dato || '—'}</GridValue>

          <GridDivider />

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

      {/* PROSJEKTINFORMASJON */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3">
          Prosjektinformasjon
        </h3>
        <MetadataGrid>
          {/* Rad 1 */}
          <GridLabel>Sakstittel</GridLabel>
          <GridValue span>{sak.sakstittel || '—'}</GridValue>
          
          <GridDivider />

          {/* Rad 2 */}
          <GridLabel>Prosjekt</GridLabel>
          <GridValue span>{sak.prosjekt_navn || '—'}</GridValue>

          <GridDivider />

          {/* Rad 3 - Entreprenør og Byggherre på samme linje */}
          <GridLabel>Entreprenør (TE)</GridLabel>
          <GridValue>{sak.entreprenor || '—'}</GridValue>
          <GridLabel>Byggherre (BH)</GridLabel>
          <GridValue>{sak.byggherre || '—'}</GridValue>
        </MetadataGrid>
      </section>

      {/* VARSEL */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3">
          Varsel
        </h3>
        <MetadataGrid>
          <GridLabel>Dato oppdaget</GridLabel>
          <GridValue>{varsel.dato_forhold_oppdaget || '—'}</GridValue>
          <GridLabel>Dato sendt</GridLabel>
          <GridValue>{varsel.dato_varsel_sendt || '—'}</GridValue>

          <GridDivider />

          <GridLabel>Hovedkategori</GridLabel>
          <GridValue span>
            {varsel.hovedkategori ? getHovedkategoriLabel(varsel.hovedkategori) : '—'}
          </GridValue>

          {varsel.underkategori && varsel.underkategori.length > 0 && (
            <>
              <GridDivider />
              <GridLabel>Underkategori(er)</GridLabel>
              <GridValue span>
                {getUnderkategoriLabels(varsel.hovedkategori, varsel.underkategori)}
              </GridValue>
            </>
          )}

          <GridDivider />

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

      {/* KRAV FRA ENTREPRENØR - REVISJONSHISTORIKK */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3">
          Krav fra entreprenør - Revisjonshistorikk
        </h3>
        {koe_revisjoner.length === 0 ? (
          <PktAlert skin="info" compact>
            <span>Ingen revisjoner registrert ennå</span>
          </PktAlert>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-color bg-white shadow-sm">
            <table className="custom-grid-table">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky-col text-left min-w-[200px]">Felt</th>
                  {koe_revisjoner.map((_, idx) => (
                    <th key={idx} className="text-center font-semibold min-w-[160px] text-ink-dim bg-gray-50">
                      Rev {koe_revisjoner[idx].koe_revisjonsnr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="sticky-col">Status</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center">
                      <PktTag skin={getKravStatusSkin(rev.status)}>
                        {getKravStatusLabel(rev.status)}
                      </PktTag>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky-col">Dato sendt</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center">
                      {rev.dato_krav_sendt || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky-col">Sendt av</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center">
                      {rev.for_entreprenor || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky-col">Vederlag krevd</td>
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
                  <td className="sticky-col">Produktivitetstap</td>
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
                  <td className="sticky-col">Særskilt varsel rigg/drift</td>
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
                  <td className="sticky-col">Vederlagsmetode</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center text-sm">
                      {rev.vederlag?.krav_vederlag_metode
                        ? getVederlagsmetodeLabel(rev.vederlag.krav_vederlag_metode)
                        : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky-col">Fristforlengelse</td>
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
                  <td className="sticky-col">Fristtype</td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="text-center text-sm">
                      {rev.frist?.krav_frist_type || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky-col">Kritisk linje</td>
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
                  <td className="sticky-col">Vedlegg</td>
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
                  <td className="sticky-col">Vederlagsbegrunnelse</td>
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
                  <td className="sticky-col">Fristbegrunnelse</td>
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
            </table>
          </div>
        )}
      </section>

      {/* SVAR FRA BYGGHERRE - REVISJONSHISTORIKK */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3">
          Svar fra byggherre - Revisjonshistorikk
        </h3>
        {bh_svar_revisjoner.length === 0 ? (
          <PktAlert skin="info" compact>
            <span>Ingen svar registrert ennå</span>
          </PktAlert>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-color bg-white shadow-sm">
            <table className="custom-grid-table">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky-col text-left min-w-[200px]">Felt</th>
                  {bh_svar_revisjoner.map((_, idx) => (
                    <th key={idx} className="text-center font-semibold min-w-[160px] text-ink-dim bg-gray-50">
                      Svar {idx}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="sticky-col">Status</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      <PktTag skin={getSvarStatusSkin(svar.status)}>
                        {getSvarStatusLabel(svar.status)}
                      </PktTag>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky-col">Dato svar</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      {svar.sign?.dato_svar_bh || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky-col">Svart av</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      {svar.sign?.for_byggherre || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky-col">Vederlag</td>
                  {bh_svar_revisjoner.map((svar, idx) => {
                    const vedStatus = svar.vederlag?.bh_svar_vederlag;
                    const beløp = svar.vederlag?.bh_godkjent_vederlag_belop;
                    let display = '—';
                    if (isVederlagGodkjent(vedStatus)) {
                      display = `✅ ${beløp ? beløp + ' NOK' : 'Godkjent'}`;
                    } else if (isVederlagDelvis(vedStatus)) {
                      display = `⚠️ ${beløp ? beløp + ' NOK' : 'Delvis'}`;
                    } else if (isVederlagAvslått(vedStatus)) {
                      display = '❌ Avslått';
                    }
                    return (
                      <td key={idx} className="text-center text-sm">
                        {display}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="sticky-col">Frist</td>
                  {bh_svar_revisjoner.map((svar, idx) => {
                    const fristStatus = svar.frist?.bh_svar_frist;
                    const dager = svar.frist?.bh_godkjent_frist_dager;
                    let display = '—';
                    if (isFristGodkjent(fristStatus)) {
                      display = `✅ ${dager ? dager + ' dager' : 'Godkjent'}`;
                    } else if (isFristDelvis(fristStatus)) {
                      display = `⚠️ ${dager ? dager + ' dager' : 'Delvis'}`;
                    } else if (isFristAvslått(fristStatus)) {
                      display = '❌ Avslått';
                    }
                    return (
                      <td key={idx} className="text-center text-sm">
                        {display}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="sticky-col">Varsel for sent (vederlag)</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      {svar.vederlag?.varsel_for_sent ? <span className="text-red-700">✓</span> : <span className="text-muted">—</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky-col">Vederlagsbegrunnelse</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      {svar.vederlag?.bh_begrunnelse_vederlag ? (
                        <PktButton size="small" skin="tertiary" onClick={() => openModal('BH Vederlagsbegrunnelse', `Svar ${idx}`, svar.vederlag.bh_begrunnelse_vederlag)}>Vis</PktButton>
                      ) : <span className="text-muted text-xs">—</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky-col">Fristbegrunnelse</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      {svar.frist?.bh_begrunnelse_frist ? (
                        <PktButton size="small" skin="tertiary" onClick={() => openModal('BH Fristbegrunnelse', `Svar ${idx}`, svar.frist.bh_begrunnelse_frist)}>Vis</PktButton>
                      ) : <span className="text-muted text-xs">—</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="sticky-col">Møtereferat</td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="text-center">
                      {svar.mote_referat ? (
                        <PktButton size="small" skin="tertiary" onClick={() => openModal('Møtereferat', `Svar ${idx}`, svar.mote_referat)}>Vis</PktButton>
                      ) : <span className="text-muted text-xs">—</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Legend */}
      <PktAlert title="Om denne visningen" skin="info" compact>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Tabellene viser alle revisjoner side-ved-side for enkel sammenligning.</li>
          <li>Du kan scrolle horisontalt i tabellene. Første kolonne (Feltnavn) står stille når du scroller.</li>
          <li>Visningen er tilpasset små skjermer med "sticky" feltnavn.</li>
        </ul>
      </PktAlert>

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
