import { describe, expect, it } from 'vitest';
import { sortBroadcastsByDate } from './broadcasts';

describe('sortBroadcastsByDate', () => {
  it('sorts broadcasts by created date in descending order by default', () => {
    const broadcasts: Array<{ id: string; created_at: string }> = [
      { id: '1', created_at: '2024-01-01T00:00:00.000Z' },
      { id: '2', created_at: '2024-03-01T00:00:00.000Z' },
      { id: '3', created_at: '2024-02-01T00:00:00.000Z' },
    ];

    const sorted = sortBroadcastsByDate(broadcasts, 'desc');

    expect(sorted.map((broadcast) => broadcast.id)).toEqual(['2', '3', '1']);
  });

  it('sorts broadcasts by created date in ascending order when requested', () => {
    const broadcasts: Array<{ id: string; created_at: string }> = [
      { id: '1', created_at: '2024-01-01T00:00:00.000Z' },
      { id: '2', created_at: '2024-03-01T00:00:00.000Z' },
      { id: '3', created_at: '2024-02-01T00:00:00.000Z' },
    ];

    const sorted = sortBroadcastsByDate(broadcasts, 'asc');

    expect(sorted.map((broadcast) => broadcast.id)).toEqual(['1', '3', '2']);
  });
});
