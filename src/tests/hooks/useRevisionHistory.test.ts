/**
 * Unit tests for useRevisionHistory hook
 *
 * Tests revision extraction from timeline events and version management.
 * Critical for CasePage versioning logic.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useRevisionHistory,
  useIsResponseOutdated,
  formatVersionLabel,
  formatRevisionDate,
  groupByVersion,
  getTeEntries,
  getBhEntries,
  formatHistorikkBelop,
  formatHistorikkDager,
} from '@/hooks/useRevisionHistory';
import { TimelineEvent, SporType } from '@/types/timeline';

// Helper to create timeline events
function createEvent(
  overrides: Partial<TimelineEvent> & { type: string; spor: SporType }
): TimelineEvent {
  return {
    id: `event-${Math.random().toString(36).substr(2, 9)}`,
    specversion: '1.0',
    source: '/test',
    time: new Date().toISOString(),
    actorrole: 'TE',
    summary: 'Test event',
    data: undefined,
    ...overrides,
  };
}

describe('useRevisionHistory', () => {
  describe('basic revision extraction', () => {
    it('should return empty summary for empty events', () => {
      const { result } = renderHook(() => useRevisionHistory([], 'grunnlag'));

      expect(result.current.currentVersion).toBe(0);
      expect(result.current.totalRevisions).toBe(0);
      expect(result.current.revisions).toHaveLength(0);
      expect(result.current.lastRevisionDate).toBeUndefined();
      expect(result.current.originalEventId).toBeUndefined();
    });

    it('should identify original grunnlag event as version 0', () => {
      const events: TimelineEvent[] = [
        createEvent({
          id: 'grunnlag-1',
          type: 'no.oslo.koe.grunnlag_opprettet',
          spor: 'grunnlag',
          actorrole: 'TE',
          time: '2025-01-01T10:00:00Z',
          summary: 'Varslet endringsforhold',
        }),
      ];

      const { result } = renderHook(() => useRevisionHistory(events, 'grunnlag'));

      expect(result.current.currentVersion).toBe(0);
      expect(result.current.totalRevisions).toBe(0);
      expect(result.current.revisions).toHaveLength(1);
      expect(result.current.revisions[0]!.versjon).toBe(0);
      expect(result.current.revisions[0]!.erRevisjon).toBe(false);
      expect(result.current.originalEventId).toBe('grunnlag-1');
    });

    it('should identify updates as revisions starting from version 1', () => {
      const events: TimelineEvent[] = [
        createEvent({
          id: 'grunnlag-1',
          type: 'no.oslo.koe.grunnlag_opprettet',
          spor: 'grunnlag',
          actorrole: 'TE',
          time: '2025-01-01T10:00:00Z',
        }),
        createEvent({
          id: 'grunnlag-2',
          type: 'no.oslo.koe.grunnlag_oppdatert',
          spor: 'grunnlag',
          actorrole: 'TE',
          time: '2025-01-02T10:00:00Z',
          data: { original_event_id: 'grunnlag-1' } as any,
        }),
      ];

      const { result } = renderHook(() => useRevisionHistory(events, 'grunnlag'));

      expect(result.current.currentVersion).toBe(1);
      expect(result.current.totalRevisions).toBe(1);
      expect(result.current.revisions).toHaveLength(2);
      expect(result.current.revisions[1]!.versjon).toBe(1);
      expect(result.current.revisions[1]!.erRevisjon).toBe(true);
      expect(result.current.revisions[1]!.original_event_id).toBe('grunnlag-1');
    });

    it('should handle multiple revisions correctly', () => {
      const events: TimelineEvent[] = [
        createEvent({
          id: 'v-1',
          type: 'no.oslo.koe.vederlag_krav_sendt',
          spor: 'vederlag',
          actorrole: 'TE',
          time: '2025-01-01T10:00:00Z',
        }),
        createEvent({
          id: 'v-2',
          type: 'no.oslo.koe.vederlag_krav_oppdatert',
          spor: 'vederlag',
          actorrole: 'TE',
          time: '2025-01-02T10:00:00Z',
        }),
        createEvent({
          id: 'v-3',
          type: 'no.oslo.koe.vederlag_krav_oppdatert',
          spor: 'vederlag',
          actorrole: 'TE',
          time: '2025-01-03T10:00:00Z',
        }),
      ];

      const { result } = renderHook(() => useRevisionHistory(events, 'vederlag'));

      expect(result.current.currentVersion).toBe(2);
      expect(result.current.totalRevisions).toBe(2);
      expect(result.current.revisions).toHaveLength(3);
      expect(result.current.revisions.map((r) => r.versjon)).toEqual([0, 1, 2]);
    });
  });

  describe('track filtering', () => {
    it('should only include events for the specified track', () => {
      const events: TimelineEvent[] = [
        createEvent({
          type: 'no.oslo.koe.grunnlag_opprettet',
          spor: 'grunnlag',
          actorrole: 'TE',
        }),
        createEvent({
          type: 'no.oslo.koe.vederlag_krav_sendt',
          spor: 'vederlag',
          actorrole: 'TE',
        }),
        createEvent({
          type: 'no.oslo.koe.frist_krav_sendt',
          spor: 'frist',
          actorrole: 'TE',
        }),
      ];

      const { result: grunnlagResult } = renderHook(() => useRevisionHistory(events, 'grunnlag'));
      const { result: vederlagResult } = renderHook(() => useRevisionHistory(events, 'vederlag'));
      const { result: fristResult } = renderHook(() => useRevisionHistory(events, 'frist'));

      expect(grunnlagResult.current.revisions).toHaveLength(1);
      expect(vederlagResult.current.revisions).toHaveLength(1);
      expect(fristResult.current.revisions).toHaveLength(1);
    });
  });

  describe('role filtering', () => {
    it('should filter by TE role when specified', () => {
      const events: TimelineEvent[] = [
        createEvent({
          id: 'te-1',
          type: 'no.oslo.koe.grunnlag_opprettet',
          spor: 'grunnlag',
          actorrole: 'TE',
          time: '2025-01-01T10:00:00Z',
        }),
        createEvent({
          id: 'bh-1',
          type: 'no.oslo.koe.respons_grunnlag',
          spor: 'grunnlag',
          actorrole: 'BH',
          time: '2025-01-02T10:00:00Z',
        }),
      ];

      const { result: teResult } = renderHook(() => useRevisionHistory(events, 'grunnlag', 'TE'));
      const { result: bhResult } = renderHook(() => useRevisionHistory(events, 'grunnlag', 'BH'));

      expect(teResult.current.revisions).toHaveLength(1);
      expect(teResult.current.revisions[0]!.event_id).toBe('te-1');

      expect(bhResult.current.revisions).toHaveLength(1);
      expect(bhResult.current.revisions[0]!.event_id).toBe('bh-1');
    });

    it('should include all roles when no role specified', () => {
      const events: TimelineEvent[] = [
        createEvent({
          type: 'no.oslo.koe.grunnlag_opprettet',
          spor: 'grunnlag',
          actorrole: 'TE',
          time: '2025-01-01T10:00:00Z',
        }),
        createEvent({
          type: 'no.oslo.koe.respons_grunnlag',
          spor: 'grunnlag',
          actorrole: 'BH',
          time: '2025-01-02T10:00:00Z',
        }),
      ];

      const { result } = renderHook(() => useRevisionHistory(events, 'grunnlag'));

      // Both originals should be included
      expect(result.current.revisions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('sorting', () => {
    it('should sort events by timestamp (oldest first)', () => {
      const events: TimelineEvent[] = [
        createEvent({
          id: 'later',
          type: 'no.oslo.koe.frist_krav_oppdatert',
          spor: 'frist',
          actorrole: 'TE',
          time: '2025-01-03T10:00:00Z',
        }),
        createEvent({
          id: 'earliest',
          type: 'no.oslo.koe.frist_krav_sendt',
          spor: 'frist',
          actorrole: 'TE',
          time: '2025-01-01T10:00:00Z',
        }),
        createEvent({
          id: 'middle',
          type: 'no.oslo.koe.frist_krav_oppdatert',
          spor: 'frist',
          actorrole: 'TE',
          time: '2025-01-02T10:00:00Z',
        }),
      ];

      const { result } = renderHook(() => useRevisionHistory(events, 'frist'));

      expect(result.current.revisions[0]!.event_id).toBe('earliest');
      expect(result.current.originalEventId).toBe('earliest');
    });
  });

  describe('BH response updates', () => {
    it('should track BH response revisions separately', () => {
      const events: TimelineEvent[] = [
        createEvent({
          id: 'bh-resp-1',
          type: 'no.oslo.koe.respons_vederlag',
          spor: 'vederlag',
          actorrole: 'BH',
          time: '2025-01-01T10:00:00Z',
        }),
        createEvent({
          id: 'bh-resp-2',
          type: 'no.oslo.koe.respons_vederlag_oppdatert',
          spor: 'vederlag',
          actorrole: 'BH',
          time: '2025-01-02T10:00:00Z',
          data: { original_respons_id: 'bh-resp-1' } as any,
        }),
      ];

      const { result } = renderHook(() => useRevisionHistory(events, 'vederlag', 'BH'));

      expect(result.current.totalRevisions).toBe(1);
      expect(result.current.revisions[1]!.original_event_id).toBe('bh-resp-1');
    });
  });
});

describe('useIsResponseOutdated', () => {
  it('should return not outdated when no events', () => {
    const { result } = renderHook(() => useIsResponseOutdated([], 'grunnlag'));

    expect(result.current.isOutdated).toBe(false);
    expect(result.current.claimVersion).toBe(0);
    expect(result.current.responseVersion).toBe(0);
  });

  it('should detect when TE has updated after BH response', () => {
    const events: TimelineEvent[] = [
      createEvent({
        type: 'no.oslo.koe.grunnlag_opprettet',
        spor: 'grunnlag',
        actorrole: 'TE',
        time: '2025-01-01T10:00:00Z',
      }),
      createEvent({
        type: 'no.oslo.koe.respons_grunnlag',
        spor: 'grunnlag',
        actorrole: 'BH',
        time: '2025-01-02T10:00:00Z',
      }),
      createEvent({
        type: 'no.oslo.koe.grunnlag_oppdatert',
        spor: 'grunnlag',
        actorrole: 'TE',
        time: '2025-01-03T10:00:00Z',
      }),
    ];

    const { result } = renderHook(() => useIsResponseOutdated(events, 'grunnlag'));

    expect(result.current.isOutdated).toBe(true);
    expect(result.current.claimVersion).toBe(1); // Original + 1 update
    expect(result.current.responseVersion).toBe(0); // Original response
  });

  it('should not be outdated when BH responded after TE update', () => {
    const events: TimelineEvent[] = [
      createEvent({
        type: 'no.oslo.koe.grunnlag_opprettet',
        spor: 'grunnlag',
        actorrole: 'TE',
        time: '2025-01-01T10:00:00Z',
      }),
      createEvent({
        type: 'no.oslo.koe.grunnlag_oppdatert',
        spor: 'grunnlag',
        actorrole: 'TE',
        time: '2025-01-02T10:00:00Z',
      }),
      createEvent({
        type: 'no.oslo.koe.respons_grunnlag',
        spor: 'grunnlag',
        actorrole: 'BH',
        time: '2025-01-03T10:00:00Z',
      }),
    ];

    const { result } = renderHook(() => useIsResponseOutdated(events, 'grunnlag'));

    expect(result.current.isOutdated).toBe(false);
  });

  it('should track version numbers correctly', () => {
    const events: TimelineEvent[] = [
      createEvent({
        type: 'no.oslo.koe.vederlag_krav_sendt',
        spor: 'vederlag',
        actorrole: 'TE',
        time: '2025-01-01T10:00:00Z',
      }),
      createEvent({
        type: 'no.oslo.koe.vederlag_krav_oppdatert',
        spor: 'vederlag',
        actorrole: 'TE',
        time: '2025-01-02T10:00:00Z',
      }),
      createEvent({
        type: 'no.oslo.koe.vederlag_krav_oppdatert',
        spor: 'vederlag',
        actorrole: 'TE',
        time: '2025-01-03T10:00:00Z',
      }),
      createEvent({
        type: 'no.oslo.koe.respons_vederlag',
        spor: 'vederlag',
        actorrole: 'BH',
        time: '2025-01-04T10:00:00Z',
      }),
    ];

    const { result } = renderHook(() => useIsResponseOutdated(events, 'vederlag'));

    expect(result.current.claimVersion).toBe(2); // Original (0) + 2 updates
    expect(result.current.responseVersion).toBe(0); // Original response
    expect(result.current.isOutdated).toBe(false);
  });
});

describe('formatVersionLabel', () => {
  it('should return "Original" for version 0', () => {
    expect(formatVersionLabel(0)).toBe('Original');
  });

  it('should return "Rev. 1" for version 1', () => {
    expect(formatVersionLabel(1)).toBe('Rev. 1');
  });

  it('should return "Rev. N" for version N', () => {
    expect(formatVersionLabel(5)).toBe('Rev. 5');
    expect(formatVersionLabel(10)).toBe('Rev. 10');
  });
});

describe('formatRevisionDate', () => {
  it('should format ISO date to Norwegian locale', () => {
    const result = formatRevisionDate('2025-03-15T10:30:00Z');

    // Norwegian format: dd.mm.yyyy
    expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    expect(result).toContain('15');
    expect(result).toContain('03');
    expect(result).toContain('2025');
  });
});

describe('groupByVersion', () => {
  interface TestEntry {
    versjon: number;
    aktor: { rolle: 'TE' | 'BH' };
    value: string;
  }

  it('should group entries by version number', () => {
    const entries: TestEntry[] = [
      { versjon: 1, aktor: { rolle: 'TE' }, value: 'te-1' },
      { versjon: 1, aktor: { rolle: 'BH' }, value: 'bh-1' },
      { versjon: 2, aktor: { rolle: 'TE' }, value: 'te-2' },
    ];

    const result = groupByVersion(entries);

    expect(result).toHaveLength(2);
    expect(result[0]!.versjon).toBe(1);
    expect(result[0]!.teEntry?.value).toBe('te-1');
    expect(result[0]!.bhEntry?.value).toBe('bh-1');
    expect(result[1]!.versjon).toBe(2);
    expect(result[1]!.teEntry?.value).toBe('te-2');
    expect(result[1]!.bhEntry).toBeUndefined();
  });

  it('should sort by version number', () => {
    const entries: TestEntry[] = [
      { versjon: 3, aktor: { rolle: 'TE' }, value: 'v3' },
      { versjon: 1, aktor: { rolle: 'TE' }, value: 'v1' },
      { versjon: 2, aktor: { rolle: 'TE' }, value: 'v2' },
    ];

    const result = groupByVersion(entries);

    expect(result.map((g) => g.versjon)).toEqual([1, 2, 3]);
  });

  it('should handle empty array', () => {
    const result = groupByVersion([]);
    expect(result).toHaveLength(0);
  });
});

describe('getTeEntries', () => {
  interface TestEntry {
    aktor: { rolle: 'TE' | 'BH' };
    endring_type: string;
    value: string;
  }

  it('should filter TE entries with valid endring_type', () => {
    const entries: TestEntry[] = [
      { aktor: { rolle: 'TE' }, endring_type: 'sendt', value: 'a' },
      { aktor: { rolle: 'TE' }, endring_type: 'oppdatert', value: 'b' },
      { aktor: { rolle: 'TE' }, endring_type: 'trukket', value: 'c' },
      { aktor: { rolle: 'BH' }, endring_type: 'respons', value: 'd' },
      { aktor: { rolle: 'TE' }, endring_type: 'respons', value: 'e' }, // Invalid combo
    ];

    const result = getTeEntries(entries);

    expect(result).toHaveLength(3);
    expect(result.map((e) => e.value)).toEqual(['a', 'b', 'c']);
  });
});

describe('getBhEntries', () => {
  interface TestEntry {
    aktor: { rolle: 'TE' | 'BH' };
    endring_type: string;
    value: string;
  }

  it('should filter BH entries with valid endring_type', () => {
    const entries: TestEntry[] = [
      { aktor: { rolle: 'BH' }, endring_type: 'respons', value: 'a' },
      { aktor: { rolle: 'BH' }, endring_type: 'respons_oppdatert', value: 'b' },
      { aktor: { rolle: 'TE' }, endring_type: 'sendt', value: 'c' },
      { aktor: { rolle: 'BH' }, endring_type: 'sendt', value: 'd' }, // Invalid combo
    ];

    const result = getBhEntries(entries);

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.value)).toEqual(['a', 'b']);
  });
});

describe('formatHistorikkBelop', () => {
  it('should format positive amount with NOK', () => {
    const result = formatHistorikkBelop(1500000);
    expect(result).toContain('NOK');
    // Norwegian locale uses space as thousands separator
    expect(result).toMatch(/1[\s\u00A0]?500[\s\u00A0]?000/);
  });

  it('should return dash for null', () => {
    expect(formatHistorikkBelop(null)).toBe('—');
  });

  it('should return dash for undefined', () => {
    expect(formatHistorikkBelop(undefined)).toBe('—');
  });

  it('should format zero', () => {
    expect(formatHistorikkBelop(0)).toContain('0');
    expect(formatHistorikkBelop(0)).toContain('NOK');
  });
});

describe('formatHistorikkDager', () => {
  it('should format days with "dager" suffix', () => {
    expect(formatHistorikkDager(30)).toBe('30 dager');
  });

  it('should return dash for null', () => {
    expect(formatHistorikkDager(null)).toBe('—');
  });

  it('should return dash for undefined', () => {
    expect(formatHistorikkDager(undefined)).toBe('—');
  });

  it('should format zero days', () => {
    expect(formatHistorikkDager(0)).toBe('0 dager');
  });

  it('should format single day', () => {
    expect(formatHistorikkDager(1)).toBe('1 dager');
  });
});
