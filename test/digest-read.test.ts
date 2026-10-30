import { describe, expect, it } from 'vitest';
import { digest, readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const n = readNight('runs', '2026-10-28');
    expect(n?.badLines).toBe(1);
    expect(n?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    const refresh = n?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(refresh).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
    const sync = n?.rows.find((r) => r.job === 'lane/sync');
    expect(sync).toMatchObject({ firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' });
    expect(n?.rows.find((r) => r.job === 'notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(n?.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
  });

  it('returns null for a night with no file or a bad night name', () => {
    expect(readNight('runs', '2000-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('an empty night has no rows', () => {
    expect(digest('x', '')).toEqual({ night: 'x', rows: [], badLines: 0 });
  });

  it('counts a line with a bad shape, never throws', () => {
    const n = digest('x', '{"at":"t","job":"a","status":"maybe","owner":null}\n[]\n');
    expect(n).toEqual({ night: 'x', rows: [], badLines: 2 });
  });
});
