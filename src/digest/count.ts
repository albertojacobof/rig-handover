import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';
import type { RunStatus } from './types.js';

export type StatusCounts = Record<RunStatus, number>;

// Counts lines by status in runs/<night>.jsonl. Bad lines are skipped; a missing file is null.
export function countStatuses(runsDir: string, night: string): StatusCounts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line) counts[line.status]++;
  }
  return counts;
}
