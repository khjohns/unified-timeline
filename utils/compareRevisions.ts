import { Koe } from '../types';

export interface RevisionChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export const compareRevisions = (oldRev: Koe, newRev: Koe): RevisionChange[] => {
  const changes: RevisionChange[] = [];

  // Sammenlign grunnleggende felt
  if (oldRev.dato_krav_sendt !== newRev.dato_krav_sendt) {
    changes.push({
      field: 'Dato krav sendt',
      oldValue: oldRev.dato_krav_sendt || 'Ikke satt',
      newValue: newRev.dato_krav_sendt || 'Ikke satt',
    });
  }

  if (oldRev.for_entreprenor !== newRev.for_entreprenor) {
    changes.push({
      field: 'Signatur (Entreprenør)',
      oldValue: oldRev.for_entreprenor || 'Ikke satt',
      newValue: newRev.for_entreprenor || 'Ikke satt',
    });
  }

  // Sammenlign vederlag
  if (oldRev.vederlag.krav_vederlag !== newRev.vederlag.krav_vederlag) {
    changes.push({
      field: 'Krav om vederlagsjustering',
      oldValue: oldRev.vederlag.krav_vederlag ? 'Ja' : 'Nei',
      newValue: newRev.vederlag.krav_vederlag ? 'Ja' : 'Nei',
    });
  }

  if (oldRev.vederlag.krav_produktivitetstap !== newRev.vederlag.krav_produktivitetstap) {
    changes.push({
      field: 'Krav om produktivitetstap',
      oldValue: oldRev.vederlag.krav_produktivitetstap ? 'Ja' : 'Nei',
      newValue: newRev.vederlag.krav_produktivitetstap ? 'Ja' : 'Nei',
    });
  }

  if (oldRev.vederlag.saerskilt_varsel_rigg_drift !== newRev.vederlag.saerskilt_varsel_rigg_drift) {
    changes.push({
      field: 'Særskilt rigg/drift',
      oldValue: oldRev.vederlag.saerskilt_varsel_rigg_drift ? 'Ja' : 'Nei',
      newValue: newRev.vederlag.saerskilt_varsel_rigg_drift ? 'Ja' : 'Nei',
    });
  }

  if (oldRev.vederlag.krav_vederlag_belop !== newRev.vederlag.krav_vederlag_belop) {
    changes.push({
      field: 'Beløp (vederlag)',
      oldValue: oldRev.vederlag.krav_vederlag_belop
        ? `${Number(oldRev.vederlag.krav_vederlag_belop).toLocaleString('no-NO')} kr`
        : 'Ikke satt',
      newValue: newRev.vederlag.krav_vederlag_belop
        ? `${Number(newRev.vederlag.krav_vederlag_belop).toLocaleString('no-NO')} kr`
        : 'Ikke satt',
    });
  }

  if (oldRev.vederlag.krav_vederlag_metode !== newRev.vederlag.krav_vederlag_metode) {
    changes.push({
      field: 'Oppgjørsmetode',
      oldValue: oldRev.vederlag.krav_vederlag_metode || 'Ikke satt',
      newValue: newRev.vederlag.krav_vederlag_metode || 'Ikke satt',
    });
  }

  if (oldRev.vederlag.krav_vederlag_begrunnelse !== newRev.vederlag.krav_vederlag_begrunnelse) {
    changes.push({
      field: 'Begrunnelse (vederlag)',
      oldValue: oldRev.vederlag.krav_vederlag_begrunnelse ? 'Endret' : 'Ikke satt',
      newValue: newRev.vederlag.krav_vederlag_begrunnelse ? 'Endret' : 'Ikke satt',
    });
  }

  // Sammenlign frist
  if (oldRev.frist.krav_fristforlengelse !== newRev.frist.krav_fristforlengelse) {
    changes.push({
      field: 'Krav om fristforlengelse',
      oldValue: oldRev.frist.krav_fristforlengelse ? 'Ja' : 'Nei',
      newValue: newRev.frist.krav_fristforlengelse ? 'Ja' : 'Nei',
    });
  }

  if (oldRev.frist.krav_frist_antall_dager !== newRev.frist.krav_frist_antall_dager) {
    changes.push({
      field: 'Antall dager (frist)',
      oldValue: oldRev.frist.krav_frist_antall_dager || 'Ikke satt',
      newValue: newRev.frist.krav_frist_antall_dager || 'Ikke satt',
    });
  }

  if (oldRev.frist.krav_frist_type !== newRev.frist.krav_frist_type) {
    changes.push({
      field: 'Fristtype',
      oldValue: oldRev.frist.krav_frist_type || 'Ikke satt',
      newValue: newRev.frist.krav_frist_type || 'Ikke satt',
    });
  }

  if (oldRev.frist.forsinkelse_kritisk_linje !== newRev.frist.forsinkelse_kritisk_linje) {
    changes.push({
      field: 'Påvirker kritisk linje',
      oldValue: oldRev.frist.forsinkelse_kritisk_linje ? 'Ja' : 'Nei',
      newValue: newRev.frist.forsinkelse_kritisk_linje ? 'Ja' : 'Nei',
    });
  }

  if (oldRev.frist.krav_frist_begrunnelse !== newRev.frist.krav_frist_begrunnelse) {
    changes.push({
      field: 'Begrunnelse (frist)',
      oldValue: oldRev.frist.krav_frist_begrunnelse ? 'Endret' : 'Ikke satt',
      newValue: newRev.frist.krav_frist_begrunnelse ? 'Endret' : 'Ikke satt',
    });
  }

  return changes;
};
