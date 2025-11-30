import React from 'react';
import { PktAlert } from '@oslokommune/punkt-react';
import { Modus } from '../../services/api';

interface InfoBannerProps {
  apiError?: string | null;
  sakId?: string | null;
  modus?: Modus | null;
  isApiConnected?: boolean | null;
}

/**
 * Information banner component
 *
 * Displays:
 * - API error messages (if any)
 * - Current case ID and mode
 * - Offline mode indicator
 *
 * @param apiError - API error message to display
 * @param sakId - Current case ID
 * @param modus - Current workflow mode
 * @param isApiConnected - API connection status
 */
const InfoBanner: React.FC<InfoBannerProps> = ({
  apiError,
  sakId,
  modus,
  isApiConnected,
}) => {
  const getModusLabel = (m: Modus): string => {
    switch (m) {
      case 'varsel':
        return 'Varsel (Entreprenør)';
      case 'koe':
        return 'Krav (Entreprenør)';
      case 'svar':
        return 'Svar (Byggherre)';
      case 'revidering':
        return 'Revidering (Entreprenør)';
      default:
        return m;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-4 space-y-4">
      {/* API Error Banner */}
      {apiError && (
        <PktAlert title="Kunne ikke koble til API" skin="error" compact>
          <span>{apiError}</span>
        </PktAlert>
      )}

      {/* Mode and SakId Info Banner */}
      {(sakId || modus) && (
        <PktAlert skin="info" compact>
          <div className="flex items-center gap-4 text-sm flex-wrap">
            {sakId && (
              <span>
                <strong>Sak:</strong> {sakId}
              </span>
            )}
            {modus && (
              <span>
                <strong>Modus:</strong> {getModusLabel(modus)}
              </span>
            )}
            {isApiConnected === false && (
              <span className="text-orange-600 ml-auto">
                Offline-modus (API ikke tilgjengelig)
              </span>
            )}
          </div>
        </PktAlert>
      )}
    </div>
  );
};

export default InfoBanner;
