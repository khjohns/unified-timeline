import React, { useState } from 'react';
import { FormDataModel } from '../../types';
import { PktTag, PktButton } from '@oslokommune/punkt-react';
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

  return (
    <div className="space-y-8 p-6">
      {/* SAKSMETADATA */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3 flex items-center gap-2">
          📋 Saksmetadata (automatisk generert)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-border-color bg-white">
            <tbody>
              <tr>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50 w-1/4">
                  Sak-ID
                </td>
                <td className="border border-border-color px-4 py-2">
                  {sak.sak_id_display || sak.sak_id || '—'}
                </td>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50 w-1/4">
                  Opprettet dato
                </td>
                <td className="border border-border-color px-4 py-2">
                  {sak.opprettet_dato || '—'}
                </td>
              </tr>
              <tr>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50">
                  Opprettet av
                </td>
                <td className="border border-border-color px-4 py-2">
                  {sak.opprettet_av || '—'}
                </td>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50">
                  Status
                </td>
                <td className="border border-border-color px-4 py-2">
                  <PktTag skin={getSakStatusSkin(sak.status)}>
                    {getSakStatusLabel(sak.status)}
                  </PktTag>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* PROSJEKTINFORMASJON */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3 flex items-center gap-2">
          🏗️ Prosjektinformasjon
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-border-color bg-white">
            <tbody>
              <tr>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50 w-1/4">
                  Sakstittel
                </td>
                <td className="border border-border-color px-4 py-2" colSpan={3}>
                  {sak.sakstittel || '—'}
                </td>
              </tr>
              <tr>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50">
                  Prosjekt
                </td>
                <td className="border border-border-color px-4 py-2" colSpan={3}>
                  {sak.prosjekt_navn || '—'}
                </td>
              </tr>
              <tr>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50">
                  Prosjektnummer
                </td>
                <td className="border border-border-color px-4 py-2">
                  {sak.kontrakt_referanse || '—'}
                </td>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50 w-1/4">
                  Entreprenør (TE)
                </td>
                <td className="border border-border-color px-4 py-2">
                  {sak.entreprenor || '—'}
                </td>
              </tr>
              <tr>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50">
                  Byggherre (BH)
                </td>
                <td className="border border-border-color px-4 py-2" colSpan={3}>
                  {sak.byggherre || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* VARSEL */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3 flex items-center gap-2">
          📨 Varsel
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-border-color bg-white">
            <tbody>
              <tr>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50 w-1/4">
                  Dato oppdaget
                </td>
                <td className="border border-border-color px-4 py-2">
                  {varsel.dato_forhold_oppdaget || '—'}
                </td>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50 w-1/4">
                  Dato sendt
                </td>
                <td className="border border-border-color px-4 py-2">
                  {varsel.dato_varsel_sendt || '—'}
                </td>
              </tr>
              <tr>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50">
                  Hovedkategori
                </td>
                <td className="border border-border-color px-4 py-2" colSpan={3}>
                  {varsel.hovedkategori ? getHovedkategoriLabel(varsel.hovedkategori) : '—'}
                </td>
              </tr>
              {varsel.underkategori && varsel.underkategori.length > 0 && (
                <tr>
                  <td className="border border-border-color px-4 py-2 font-medium bg-gray-50">
                    Underkategori(er)
                  </td>
                  <td className="border border-border-color px-4 py-2" colSpan={3}>
                    {getUnderkategoriLabels(varsel.hovedkategori, varsel.underkategori)}
                  </td>
                </tr>
              )}
              <tr>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50">
                  Metode for varsling
                </td>
                <td className="border border-border-color px-4 py-2">
                  {varsel.varsel_metode || '—'}
                  {varsel.varsel_metode_annet && ` (${varsel.varsel_metode_annet})`}
                </td>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50 w-1/4">
                  Vedlegg
                </td>
                <td className="border border-border-color px-4 py-2">
                  {varsel.vedlegg && varsel.vedlegg.length > 0 ? (
                    <span className="text-muted text-sm">{varsel.vedlegg.length} fil(er)</span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
              <tr>
                <td className="border border-border-color px-4 py-2 font-medium bg-gray-50">
                  Beskrivelse
                </td>
                <td className="border border-border-color px-4 py-2" colSpan={3}>
                  {varsel.varsel_beskrivelse ? (
                    <PktButton
                      size="small"
                      skin="tertiary"
                      onClick={() =>
                        openModal(
                          'Varsel - Beskrivelse av forholdet',
                          '',
                          varsel.varsel_beskrivelse
                        )
                      }
                    >
                      Vis beskrivelse
                    </PktButton>
                  ) : (
                    <span className="text-muted text-sm">—</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* KRAV (KOE) - REVISJONSHISTORIKK */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3 flex items-center gap-2">
          📋 Krav (KOE) - Revisjonshistorikk
        </h3>
        {koe_revisjoner.length === 0 ? (
          <div className="bg-gray-50 border border-border-color rounded-lg p-4 text-sm text-muted">
            Ingen revisjoner registrert ennå
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-border-color bg-white text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-border-color px-3 py-2 text-left font-semibold">
                    Felt
                  </th>
                  {koe_revisjoner.map((_, idx) => (
                    <th
                      key={idx}
                      className="border border-border-color px-3 py-2 text-center font-semibold min-w-[140px]"
                    >
                      Rev {koe_revisjoner[idx].koe_revisjonsnr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Status
                  </td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      <PktTag skin={getKravStatusSkin(rev.status)}>
                        {getKravStatusLabel(rev.status)}
                      </PktTag>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Dato sendt
                  </td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {rev.dato_krav_sendt || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Sendt av
                  </td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {rev.for_entreprenor || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Vederlag krevd
                  </td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
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
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Produktivitetstap
                  </td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {rev.vederlag?.krav_produktivitetstap ? (
                        <span className="text-green-700">✓</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Særskilt varsel rigg/drift
                  </td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {rev.vederlag?.saerskilt_varsel_rigg_drift ? (
                        <span className="text-green-700">✓</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Vederlagsmetode
                  </td>
                  {koe_revisjoner.map((rev, idx) => {
                    const metodeMap: Record<string, string> = {
                      '100000000': 'Enhetspris',
                      '100000001': 'Regning',
                      '100000002': 'Fast pris',
                      '100000003': 'Kalkyle',
                    };
                    return (
                      <td key={idx} className="border border-border-color px-3 py-2 text-center text-xs">
                        {rev.vederlag?.krav_vederlag_metode ? metodeMap[rev.vederlag.krav_vederlag_metode] || '—' : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Fristforlengelse
                  </td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
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
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Fristtype
                  </td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center text-xs">
                      {rev.frist?.krav_frist_type || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Kritisk linje
                  </td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {rev.frist?.forsinkelse_kritisk_linje ? (
                        <span className="text-blue-700">✓</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Vedlegg
                  </td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center text-xs">
                      {rev.vedlegg && rev.vedlegg.length > 0 ? (
                        <span className="text-muted">{rev.vedlegg.length} fil(er)</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Vederlagsbegrunnelse
                  </td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {rev.vederlag?.krav_vederlag_begrunnelse ? (
                        <PktButton
                          size="small"
                          skin="tertiary"
                          onClick={() =>
                            openModal(
                              'Vederlagsbegrunnelse',
                              `Revisjon ${rev.koe_revisjonsnr}`,
                              rev.vederlag.krav_vederlag_begrunnelse
                            )
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
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Fristbegrunnelse
                  </td>
                  {koe_revisjoner.map((rev, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {rev.frist?.krav_frist_begrunnelse ? (
                        <PktButton
                          size="small"
                          skin="tertiary"
                          onClick={() =>
                            openModal(
                              'Fristbegrunnelse',
                              `Revisjon ${rev.koe_revisjonsnr}`,
                              rev.frist.krav_frist_begrunnelse
                            )
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

      {/* BH SVAR - REVISJONSHISTORIKK */}
      <section>
        <h3 className="text-lg font-semibold text-ink-dim mb-3 flex items-center gap-2">
          💬 Svar fra byggherre - Revisjonshistorikk
        </h3>
        {bh_svar_revisjoner.length === 0 ? (
          <div className="bg-gray-50 border border-border-color rounded-lg p-4 text-sm text-muted">
            Ingen svar registrert ennå
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-border-color bg-white text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-border-color px-3 py-2 text-left font-semibold">
                    Felt
                  </th>
                  {bh_svar_revisjoner.map((_, idx) => (
                    <th
                      key={idx}
                      className="border border-border-color px-3 py-2 text-center font-semibold min-w-[140px]"
                    >
                      Svar {idx}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Status
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      <PktTag skin={getSvarStatusSkin(svar.status)}>
                        {getSvarStatusLabel(svar.status)}
                      </PktTag>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Dato svar
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {svar.sign?.dato_svar_bh || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Svart av
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {svar.sign?.for_byggherre || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Varsel for sent (vederlag)
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {svar.vederlag?.varsel_for_sent ? (
                        <span className="text-red-700">✓</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Vederlag
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => {
                    const vedStatus = svar.vederlag?.bh_svar_vederlag;
                    const beløp = svar.vederlag?.bh_godkjent_vederlag_belop;
                    let display = '—';
                    if (vedStatus === '100000000') display = `✅ ${beløp ? beløp + ' NOK' : 'Godkjent'}`;
                    else if (vedStatus === '100000001') display = `⚠️ ${beløp ? beløp + ' NOK' : 'Delvis'}`;
                    else if (vedStatus === '100000002') display = '❌ Avslått';

                    return (
                      <td key={idx} className="border border-border-color px-3 py-2 text-center">
                        {display}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Vederlagsmetode (BH)
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => {
                    const metodeMap: Record<string, string> = {
                      '100000000': 'Enhetspris',
                      '100000001': 'Regning',
                      '100000002': 'Fast pris',
                      '100000003': 'Kalkyle',
                    };
                    return (
                      <td key={idx} className="border border-border-color px-3 py-2 text-center text-xs">
                        {svar.vederlag?.bh_vederlag_metode ? metodeMap[svar.vederlag.bh_vederlag_metode] || '—' : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Varsel for sent (frist)
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {svar.frist?.varsel_for_sent ? (
                        <span className="text-red-700">✓</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Frist
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => {
                    const fristStatus = svar.frist?.bh_svar_frist;
                    const dager = svar.frist?.bh_godkjent_frist_dager;
                    let display = '—';
                    if (fristStatus === '100000000') display = `✅ ${dager ? dager + ' dager' : 'Godkjent'}`;
                    else if (fristStatus === '100000001') display = `⚠️ ${dager ? dager + ' dager' : 'Delvis'}`;
                    else if (fristStatus === '100000002') display = '❌ Avslått';

                    return (
                      <td key={idx} className="border border-border-color px-3 py-2 text-center">
                        {display}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Frist for spesifisering
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center text-xs">
                      {svar.frist?.bh_frist_for_spesifisering || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Møte
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center text-xs">
                      {svar.mote_dato ? (
                        <span className="text-muted">{svar.mote_dato}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Vederlagsbegrunnelse
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {svar.vederlag?.bh_begrunnelse_vederlag ? (
                        <PktButton
                          size="small"
                          skin="tertiary"
                          onClick={() =>
                            openModal(
                              'BH Vederlagsbegrunnelse',
                              `Svar ${idx}`,
                              svar.vederlag.bh_begrunnelse_vederlag
                            )
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
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    For sent-begrunnelse (vederlag)
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {svar.vederlag?.varsel_for_sent_begrunnelse ? (
                        <PktButton
                          size="small"
                          skin="tertiary"
                          onClick={() =>
                            openModal(
                              'Varsel for sent - Begrunnelse (vederlag)',
                              `Svar ${idx}`,
                              svar.vederlag.varsel_for_sent_begrunnelse
                            )
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
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Fristbegrunnelse
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {svar.frist?.bh_begrunnelse_frist ? (
                        <PktButton
                          size="small"
                          skin="tertiary"
                          onClick={() =>
                            openModal(
                              'BH Fristbegrunnelse',
                              `Svar ${idx}`,
                              svar.frist.bh_begrunnelse_frist
                            )
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
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    For sent-begrunnelse (frist)
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {svar.frist?.varsel_for_sent_begrunnelse ? (
                        <PktButton
                          size="small"
                          skin="tertiary"
                          onClick={() =>
                            openModal(
                              'Varsel for sent - Begrunnelse (frist)',
                              `Svar ${idx}`,
                              svar.frist.varsel_for_sent_begrunnelse
                            )
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
                  <td className="border border-border-color px-3 py-2 font-medium bg-gray-50">
                    Møtereferat
                  </td>
                  {bh_svar_revisjoner.map((svar, idx) => (
                    <td key={idx} className="border border-border-color px-3 py-2 text-center">
                      {svar.mote_referat ? (
                        <PktButton
                          size="small"
                          skin="tertiary"
                          onClick={() =>
                            openModal(
                              'Møtereferat',
                              `Svar ${idx}`,
                              svar.mote_referat
                            )
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

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">💡 Om denne visningen:</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Tabellene viser alle revisjoner side-ved-side for enkel sammenligning</li>
          <li>Horisontalt layout gjør det lett å følge historikken</li>
          <li>Bruk redigeringsfanene (Varsel, Krav, Svar) for å jobbe med aktiv revisjon</li>
          <li>Denne fanen kan scrolles horisontalt på små skjermer</li>
          <li>Klikk på "Vis"-knappene for å se fulle begrunnelser og referater</li>
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
