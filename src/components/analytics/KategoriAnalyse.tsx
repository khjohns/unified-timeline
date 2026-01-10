/**
 * Kategorianalyse Component
 *
 * Analysemetode: Analyse per grunnlagskategori
 * Bruksområde: Identifisere trender per årsak, risikoanalyse
 */

import { Card } from '../primitives';
import { ProgressBar, AnalyticsSection } from './AnalyticsHelpers';
import { getHovedkategoriLabel } from '../../constants/categories';
import type { CategoryAnalytics } from '../../api/analytics';

interface KategoriAnalyseProps {
  categories: CategoryAnalytics | undefined;
}

export function KategoriAnalyse({ categories }: KategoriAnalyseProps) {
  const totalCases = categories?.categories.reduce((sum, cat) => sum + cat.antall, 0) ?? 0;
  const avgApprovalRate = (categories?.categories.reduce((sum, cat) => sum + cat.godkjenningsrate, 0) ?? 0) / (categories?.categories.length || 1);

  return (
    <AnalyticsSection
      title="Kategorianalyse"
      description="Analyse av saker fordelt på grunnlagskategorier med godkjenningsrater. Brukes til å identifisere hvilke årsaker som har høyest suksessrate."
    >
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card variant="outlined" padding="md" className="text-center">
          <div className="text-2xl font-bold text-oslo-blue">{categories?.categories.length ?? 0}</div>
          <div className="text-sm text-pkt-text-body-subtle">Kategorier i bruk</div>
        </Card>
        <Card variant="outlined" padding="md" className="text-center">
          <div className="text-2xl font-bold text-oslo-blue">{totalCases}</div>
          <div className="text-sm text-pkt-text-body-subtle">Saker totalt</div>
        </Card>
        <Card variant="outlined" padding="md" className="text-center">
          <div className="text-2xl font-bold text-badge-success-text">{avgApprovalRate?.toFixed(1) ?? 0}%</div>
          <div className="text-sm text-pkt-text-body-subtle">Gj.snitt godkjenning</div>
        </Card>
      </div>

      {/* Category table */}
      <Card variant="outlined" padding="md">
        <h3 className="text-body-lg font-semibold mb-4">Grunnlagskategorier</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-pkt-border-default">
                <th className="text-left py-2 px-2 text-sm font-semibold text-pkt-text-body-subtle">Kategori</th>
                <th className="text-right py-2 px-2 text-sm font-semibold text-pkt-text-body-subtle">Antall</th>
                <th className="text-right py-2 px-2 text-sm font-semibold text-pkt-text-body-subtle">Godkjent</th>
                <th className="text-right py-2 px-2 text-sm font-semibold text-pkt-text-body-subtle">Delvis</th>
                <th className="text-right py-2 px-2 text-sm font-semibold text-pkt-text-body-subtle">Avslått</th>
                <th className="py-2 px-2 text-sm font-semibold text-pkt-text-body-subtle w-40">Godkjenningsrate</th>
              </tr>
            </thead>
            <tbody>
              {categories?.categories.map((cat) => (
                <tr key={cat.kategori} className="border-b border-pkt-border-default last:border-0">
                  <td className="py-3 px-2 font-medium">{getHovedkategoriLabel(cat.kategori)}</td>
                  <td className="py-3 px-2 text-right">{cat.antall}</td>
                  <td className="py-3 px-2 text-right text-badge-success-text">{cat.godkjent}</td>
                  <td className="py-3 px-2 text-right text-badge-warning-text">{cat.delvis_godkjent}</td>
                  <td className="py-3 px-2 text-right text-badge-error-text">{cat.avslatt}</td>
                  <td className="py-3 px-2">
                    <ProgressBar
                      value={cat.godkjenningsrate}
                      color={cat.godkjenningsrate >= 70 ? 'bg-badge-success-bg' : cat.godkjenningsrate >= 50 ? 'bg-badge-warning-bg' : 'bg-badge-error-bg'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Insights */}
        {categories && categories.categories.length > 0 && (
          <div className="mt-6 p-4 bg-pkt-surface-subtle-pale-blue rounded-lg">
            <h4 className="text-sm font-semibold text-oslo-blue mb-2">Innsikt</h4>
            <ul className="text-sm text-pkt-text-body-default space-y-1">
              {(() => {
                const sorted = [...categories.categories].sort((a, b) => b.godkjenningsrate - a.godkjenningsrate);
                const best = sorted[0];
                const worst = sorted[sorted.length - 1];
                if (!best || !worst) return null;
                return (
                  <>
                    <li>Høyest godkjenningsrate: <strong>{getHovedkategoriLabel(best.kategori)}</strong> ({best.godkjenningsrate.toFixed(1)}%)</li>
                    <li>Lavest godkjenningsrate: <strong>{getHovedkategoriLabel(worst.kategori)}</strong> ({worst.godkjenningsrate.toFixed(1)}%)</li>
                  </>
                );
              })()}
            </ul>
          </div>
        )}
      </Card>
    </AnalyticsSection>
  );
}
