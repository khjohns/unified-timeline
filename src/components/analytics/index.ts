/**
 * Analytics Components
 *
 * Modulære analysemetoder for dashboard-visning.
 * Hver komponent representerer en logisk analysekategori
 * som kan brukes selvstendig eller som del av et helhetlig dashboard.
 */

// Helper components
export {
  KPICard,
  ProgressBar,
  SimpleBarChart,
  formatCurrency,
  AnalyticsSection,
} from './AnalyticsHelpers';

// Analysis method components
export { PortefoljeAnalyse } from './PortefoljeAnalyse';
export { KategoriAnalyse } from './KategoriAnalyse';
export { TrendAnalyse } from './TrendAnalyse';
export { OkonomiskAnalyse } from './OkonomiskAnalyse';
export { YtelsesAnalyse } from './YtelsesAnalyse';
export { RessursAnalyse } from './RessursAnalyse';
