/**
 * Analytics API Functions
 *
 * API calls for fetching aggregated analytics data.
 * Demonstrates how event-sourced data can be analyzed for
 * project and portfolio insights, similar to Power BI.
 */

import { apiFetch } from './client';

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
// API Functions
// ============================================================

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  return apiFetch<AnalyticsSummary>('/api/analytics/summary');
}

export async function fetchCategoryAnalytics(): Promise<CategoryAnalytics> {
  return apiFetch<CategoryAnalytics>('/api/analytics/by-category');
}

export async function fetchTimelineAnalytics(
  period: 'day' | 'week' | 'month' = 'week',
  days: number = 90
): Promise<TimelineAnalytics> {
  return apiFetch<TimelineAnalytics>(`/api/analytics/timeline?period=${period}&days=${days}`);
}

export async function fetchVederlagAnalytics(): Promise<VederlagAnalytics> {
  return apiFetch<VederlagAnalytics>('/api/analytics/vederlag');
}

export async function fetchResponseTimesAnalytics(): Promise<ResponseTimesAnalytics> {
  return apiFetch<ResponseTimesAnalytics>('/api/analytics/response-times');
}

export async function fetchActorAnalytics(): Promise<ActorAnalytics> {
  return apiFetch<ActorAnalytics>('/api/analytics/actors');
}

export async function fetchFristAnalytics(): Promise<FristAnalytics> {
  return apiFetch<FristAnalytics>('/api/analytics/frist');
}
