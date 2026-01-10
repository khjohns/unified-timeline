/**
 * Analytics API Functions
 *
 * API calls for fetching aggregated analytics data.
 * Demonstrates how event-sourced data can be analyzed for
 * project and portfolio insights, similar to Power BI.
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';

// ============================================================
// Types
// ============================================================

export interface AnalyticsSummary {
  total_cases: number;
  by_sakstype: Record<string, number>;
  by_status: Record<string, number>;
  total_events: number;
  total_vederlag_krevd: number;
  total_vederlag_godkjent: number;
  godkjenningsgrad_vederlag: number;
  avg_events_per_case: number;
  last_activity: string | null;
}

export interface CategoryData {
  kategori: string;
  antall: number;
  godkjent: number;
  delvis_godkjent: number;
  avslatt: number;
  under_behandling: number;
  godkjenningsrate: number;
}

export interface CategoryAnalytics {
  categories: CategoryData[];
}

export interface TimelineDataPoint {
  date: string;
  events: number;
  new_cases: number;
}

export interface TimelineAnalytics {
  period: string;
  days_back: number;
  data: TimelineDataPoint[];
}

export interface VederlagByMetode {
  metode: string;
  antall: number;
  total_krevd: number;
  total_godkjent: number;
  godkjenningsgrad: number;
}

export interface VederlagDistribution {
  range: string;
  count: number;
}

export interface VederlagAnalytics {
  summary: {
    total_krevd: number;
    total_godkjent: number;
    godkjenningsgrad: number;
    antall_krav: number;
    avg_krav: number;
    avg_godkjent: number;
  };
  by_metode: VederlagByMetode[];
  krav_distribution: VederlagDistribution[];
}

export interface FristAnalytics {
  summary: {
    total_dager_krevd: number;
    total_dager_godkjent: number;
    godkjenningsgrad: number;
    antall_krav: number;
  };
  /** Standard dagmulktsats brukt i beregninger */
  dagmulktsats: number;
  /** Økonomisk eksponering: dager × dagmulktsats */
  eksponering_krevd: number;
  eksponering_godkjent: number;
}

export interface ResponseTimeData {
  avg_days: number | null;
  median_days: number | null;
  min_days: number | null;
  max_days: number | null;
  sample_size: number;
}

export interface ResponseTimesAnalytics {
  grunnlag: ResponseTimeData;
  vederlag: ResponseTimeData;
  frist: ResponseTimeData;
}

export interface ActorData {
  name: string;
  role: string;
  events: number;
}

export interface ActorAnalytics {
  by_role: Record<string, { events: number; unique_actors: number }>;
  top_actors: ActorData[];
}

// ============================================================
// Mock Data
// ============================================================

const MOCK_SUMMARY: AnalyticsSummary = {
  total_cases: 47,
  by_sakstype: {
    standard: 38,
    forsering: 5,
    endringsordre: 4,
  },
  by_status: {
    under_behandling: 12,
    godkjent: 15,
    delvis_godkjent: 8,
    avslatt: 6,
    avventer_respons: 4,
    lukket: 2,
  },
  total_events: 312,
  total_vederlag_krevd: 4850000,
  total_vederlag_godkjent: 3420000,
  godkjenningsgrad_vederlag: 70.5,
  avg_events_per_case: 6.6,
  last_activity: new Date().toISOString(),
};

const MOCK_CATEGORIES: CategoryAnalytics = {
  categories: [
    { kategori: 'ENDRING', antall: 18, godkjent: 12, delvis_godkjent: 3, avslatt: 2, under_behandling: 1, godkjenningsrate: 88.2 },
    { kategori: 'SVIKT', antall: 12, godkjent: 6, delvis_godkjent: 2, avslatt: 3, under_behandling: 1, godkjenningsrate: 72.7 },
    { kategori: 'GRUNNFORHOLD', antall: 8, godkjent: 4, delvis_godkjent: 1, avslatt: 2, under_behandling: 1, godkjenningsrate: 71.4 },
    { kategori: 'FORCE_MAJEURE', antall: 5, godkjent: 2, delvis_godkjent: 1, avslatt: 1, under_behandling: 1, godkjenningsrate: 75.0 },
    { kategori: 'HINDRING', antall: 4, godkjent: 2, delvis_godkjent: 1, avslatt: 1, under_behandling: 0, godkjenningsrate: 75.0 },
  ],
};

const MOCK_TIMELINE: TimelineAnalytics = {
  period: 'week',
  days_back: 90,
  data: [
    { date: '2024-10-14', events: 8, new_cases: 2 },
    { date: '2024-10-21', events: 12, new_cases: 3 },
    { date: '2024-10-28', events: 15, new_cases: 4 },
    { date: '2024-11-04', events: 18, new_cases: 3 },
    { date: '2024-11-11', events: 22, new_cases: 5 },
    { date: '2024-11-18', events: 16, new_cases: 2 },
    { date: '2024-11-25', events: 25, new_cases: 6 },
    { date: '2024-12-02', events: 28, new_cases: 4 },
    { date: '2024-12-09', events: 32, new_cases: 5 },
    { date: '2024-12-16', events: 20, new_cases: 3 },
    { date: '2024-12-23', events: 14, new_cases: 2 },
    { date: '2024-12-30', events: 18, new_cases: 3 },
  ],
};

const MOCK_VEDERLAG: VederlagAnalytics = {
  summary: {
    total_krevd: 4850000,
    total_godkjent: 3420000,
    godkjenningsgrad: 70.5,
    antall_krav: 38,
    avg_krav: 127632,
    avg_godkjent: 114000,
  },
  by_metode: [
    { metode: 'ENHETSPRISER', antall: 18, total_krevd: 2200000, total_godkjent: 1760000, godkjenningsgrad: 80.0 },
    { metode: 'REGNINGSARBEID', antall: 12, total_krevd: 1500000, total_godkjent: 975000, godkjenningsgrad: 65.0 },
    { metode: 'FASTPRIS_TILBUD', antall: 8, total_krevd: 1150000, total_godkjent: 685000, godkjenningsgrad: 59.6 },
  ],
  krav_distribution: [
    { range: '0-50k', count: 8 },
    { range: '50k-100k', count: 12 },
    { range: '100k-500k', count: 14 },
    { range: '500k-1M', count: 3 },
    { range: '1M+', count: 1 },
  ],
};

const MOCK_RESPONSE_TIMES: ResponseTimesAnalytics = {
  grunnlag: { avg_days: 4.2, median_days: 3, min_days: 1, max_days: 14, sample_size: 28 },
  vederlag: { avg_days: 7.8, median_days: 6, min_days: 2, max_days: 21, sample_size: 24 },
  frist: { avg_days: 5.5, median_days: 4, min_days: 1, max_days: 18, sample_size: 20 },
};

const MOCK_FRIST: FristAnalytics = {
  summary: {
    total_dager_krevd: 145,
    total_dager_godkjent: 98,
    godkjenningsgrad: 67.6,
    antall_krav: 18,
  },
  dagmulktsats: 50000,
  eksponering_krevd: 7250000, // 145 × 50000
  eksponering_godkjent: 4900000, // 98 × 50000
};

const MOCK_ACTORS: ActorAnalytics = {
  by_role: {
    TE: { events: 185, unique_actors: 6 },
    BH: { events: 127, unique_actors: 4 },
  },
  top_actors: [
    { name: 'Ola Nordmann', role: 'TE', events: 52 },
    { name: 'Kari Hansen', role: 'BH', events: 48 },
    { name: 'Per Olsen', role: 'TE', events: 41 },
    { name: 'Mari Johansen', role: 'BH', events: 38 },
    { name: 'Erik Berg', role: 'TE', events: 35 },
  ],
};

// ============================================================
// API Functions
// ============================================================

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  if (USE_MOCK_API) {
    await mockDelay(300);
    return MOCK_SUMMARY;
  }
  return apiFetch<AnalyticsSummary>('/api/analytics/summary');
}

export async function fetchCategoryAnalytics(): Promise<CategoryAnalytics> {
  if (USE_MOCK_API) {
    await mockDelay(300);
    return MOCK_CATEGORIES;
  }
  return apiFetch<CategoryAnalytics>('/api/analytics/by-category');
}

export async function fetchTimelineAnalytics(
  period: 'day' | 'week' | 'month' = 'week',
  days: number = 90
): Promise<TimelineAnalytics> {
  if (USE_MOCK_API) {
    await mockDelay(300);
    return MOCK_TIMELINE;
  }
  return apiFetch<TimelineAnalytics>(`/api/analytics/timeline?period=${period}&days=${days}`);
}

export async function fetchVederlagAnalytics(): Promise<VederlagAnalytics> {
  if (USE_MOCK_API) {
    await mockDelay(300);
    return MOCK_VEDERLAG;
  }
  return apiFetch<VederlagAnalytics>('/api/analytics/vederlag');
}

export async function fetchResponseTimesAnalytics(): Promise<ResponseTimesAnalytics> {
  if (USE_MOCK_API) {
    await mockDelay(300);
    return MOCK_RESPONSE_TIMES;
  }
  return apiFetch<ResponseTimesAnalytics>('/api/analytics/response-times');
}

export async function fetchActorAnalytics(): Promise<ActorAnalytics> {
  if (USE_MOCK_API) {
    await mockDelay(300);
    return MOCK_ACTORS;
  }
  return apiFetch<ActorAnalytics>('/api/analytics/actors');
}

export async function fetchFristAnalytics(): Promise<FristAnalytics> {
  if (USE_MOCK_API) {
    await mockDelay(300);
    return MOCK_FRIST;
  }
  return apiFetch<FristAnalytics>('/api/analytics/frist');
}
