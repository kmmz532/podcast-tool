import { describe, expect, it } from 'vitest';
import { CorsBlockedError, OfflineError } from './errors';
import { createGateway, type RouteStore } from './gateway';
import type { ProxyConfig } from './transports';

const proxy = (id: string, enabled = true): ProxyConfig => ({ id, name: id, urlTemplate: `https://${id}.example/?url={url}`, enabled });

function memRoutes(init: Record<string, string> = {}): RouteStore & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    get: async (o) => data[o],
    set: async (o, t) => void (data[o] = t),
    delete: async (o) => void delete data[o],
  };
}

function mockFetch(okHosts: string[], status = 200) {
  const calls: string[] = [];
  const fn = async (req: Request) => {
    calls.push(req.url);
    if (!okHosts.includes(new URL(req.url).host)) throw new TypeError('Failed to fetch');
    return new Response('ok', { status });
  };
  return { fn: fn as unknown as typeof fetch, calls };
}

const URL_ = 'https://feeds.example/show.xml'
const ORIGIN = 'https://feeds.example'

describe('gateway', () => {
  it('uses direct first and records it', async () => {
    const routes = memRoutes();
    const f = mockFetch(['feeds.example']);
    const res = await createGateway({ getProxies: () => [proxy('p1')], routes, fetch: f.fn })(URL_);
    expect(res.status).toBe(200);
    expect(f.calls).toEqual([URL_]);
    expect(routes.data[ORIGIN]).toBe('direct');
  });

  it('falls back to proxies in order, skipping disabled ones', async () => {
    const routes = memRoutes();
    const f = mockFetch(['p2.example']);
    await createGateway({ getProxies: () => [proxy('p0', false), proxy('p1'), proxy('p2')], routes, fetch: f.fn })(URL_);
    expect(f.calls.map((u) => new URL(u).host)).toEqual(['feeds.example', 'p1.example', 'p2.example']);
    expect(f.calls[2]).toBe(`https://p2.example/?url=${encodeURIComponent(URL_)}`);
    expect(routes.data[ORIGIN]).toBe('p2');
  });

  it('tries the recorded route first', async () => {
    const routes = memRoutes({ [ORIGIN]: 'p2' });
    const f = mockFetch(['p2.example']);
    await createGateway({ getProxies: () => [proxy('p1'), proxy('p2')], routes, fetch: f.fn })(URL_);
    expect(f.calls.map((u) => new URL(u).host)).toEqual(['p2.example']);
  });

  it('drops a recorded route that fails and records the new one', async () => {
    const routes = memRoutes({ [ORIGIN]: 'p1' });
    const f = mockFetch(['feeds.example']);
    await createGateway({ getProxies: () => [proxy('p1')], routes, fetch: f.fn })(URL_);
    expect(f.calls.map((u) => new URL(u).host)).toEqual(['p1.example', 'feeds.example']);
    expect(routes.data[ORIGIN]).toBe('direct');
  });

  it('returns HTTP errors without trying other routes', async () => {
    const f = mockFetch(['feeds.example'], 404);
    const res = await createGateway({ getProxies: () => [proxy('p1')], routes: memRoutes(), fetch: f.fn })(URL_);
    expect(res.status).toBe(404);
    expect(f.calls).toHaveLength(1);
  });

  it('passes proxy headers', async () => {
    let auth: string | null = null;
    const fn = (async (req: Request) => {
      if (new URL(req.url).host !== 'p1.example') throw new TypeError('x');
      auth = req.headers.get('Authorization');
      return new Response('ok');
    }) as unknown as typeof fetch;
    await createGateway({ getProxies: () => [{ ...proxy('p1'), headers: { Authorization: 'Bearer t' } }], routes: memRoutes(), fetch: fn })(URL_);
    expect(auth).toBe('Bearer t');
  });

  it('throws CorsBlockedError when online and everything fails', async () => {
    const g = createGateway({ getProxies: () => [proxy('p1')], routes: memRoutes(), fetch: mockFetch([]).fn, isOnline: () => true });
    await expect(g(URL_)).rejects.toBeInstanceOf(CorsBlockedError);
  });

  it('throws OfflineError when offline', async () => {
    const g = createGateway({ getProxies: () => [], routes: memRoutes(), fetch: mockFetch([]).fn, isOnline: () => false });
    await expect(g(URL_)).rejects.toBeInstanceOf(OfflineError);
  });

  it('rethrows aborts without trying other routes', async () => {
    const ac = new AbortController();
    const calls: string[] = [];
    const fn = (async (req: Request) => {
      calls.push(req.url);
      ac.abort();
      throw new DOMException('aborted', 'AbortError');
    }) as unknown as typeof fetch;
    const g = createGateway({ getProxies: () => [proxy('p1')], routes: memRoutes(), fetch: fn });
    await expect(g(URL_, { signal: ac.signal })).rejects.toThrow('aborted');
    expect(calls).toHaveLength(1);
  });
})
