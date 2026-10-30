import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const good = [
  { at: '2026-10-28T01:00:00+01:00', job: 'zeta', status: 'ok', owner: 'ana' },
  { at: '2026-10-28T01:05:00+01:00', job: 'alpha', status: 'retry', owner: null },
  { at: '2026-10-28T01:10:00+01:00', job: 'alpha', status: 'fail', owner: 'bo', error: 'boom' },
  { at: '2026-10-28T01:15:00+01:00', job: 'mid', status: 'ok', owner: 'cy' },
];
const jsonl = (xs: unknown[]) => xs.map((x) => JSON.stringify(x)).join('\n') + '\n';

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-digest-'));
  fs.writeFileSync(path.join(dir, '2026-10-28.jsonl'), jsonl(good));
  fs.writeFileSync(path.join(dir, '2026-10-27.jsonl'), '');
  fs.writeFileSync(path.join(dir, '2026-10-26.jsonl'), jsonl(good) + 'not json\n');
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('digest routes', () => {
  it('serves the page and the JSON for a night', async () => {
    const page = await app.request('/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('digest 2026-10-28');
    const api = await app.request('/api/digest/2026-10-28');
    expect(api.status).toBe(200);
    const night = (await api.json()) as Night;
    expect(night.rows).toHaveLength(3);
    expect(night.badLines).toBe(0);
  });

  it('404s for a night with no file', async () => {
    expect((await app.request('/digest/2026-01-01')).status).toBe(404);
    expect((await app.request('/api/digest/2026-01-01')).status).toBe(404);
  });

  it('handles the empty night', async () => {
    const page = await app.request('/digest/2026-10-27');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const night = (await (await app.request('/api/digest/2026-10-27')).json()) as Night;
    expect(night.rows).toEqual([]);
  });

  it('reports a bad line', async () => {
    const page = await app.request('/digest/2026-10-26');
    // JSX escapes the apostrophe in the rendered HTML.
    expect(await page.text()).toContain('1 line didn&#39;t parse');
    const night = (await (await app.request('/api/digest/2026-10-26')).json()) as Night;
    expect(night.badLines).toBe(1);
  });

  it('lists the same jobs in the same order on page and JSON', async () => {
    const html = await (await app.request('/digest/2026-10-28')).text();
    const night = (await (await app.request('/api/digest/2026-10-28')).json()) as Night;
    const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(html)?.[1] ?? '';
    const fromPage = body
      .split('<tr')
      .slice(1)
      .map((tr) => /<td>([^<]*)<\/td>/.exec(tr)?.[1]);
    expect(fromPage).toEqual(night.rows.map((r) => r.job));
    expect(fromPage).toEqual(['alpha', 'mid', 'zeta']);
  });
});
