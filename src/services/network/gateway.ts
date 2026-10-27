import { db } from '../../db/schema';
import { CorsBlockedError, OfflineError } from './errors';
import { transportsFor, type ProxyConfig, type Transport } from './transports';

export interface RouteStore {
  get(origin: string): Promise<string | undefined>;
  set(origin: string, transportId: string): Promise<void>;
  delete(origin: string): Promise<void>;
}

export const dexieRoutes: RouteStore = {
  get: async (origin) => (await db.originRoutes.get(origin))?.transportId,
  set: async (origin, transportId) => void (await db.originRoutes.put({ origin, transportId, checkedAt: Date.now() })),
  delete: (origin) => db.originRoutes.delete(origin),
};

export interface GatewayDeps {
  getProxies: () => readonly ProxyConfig[];
  routes: RouteStore;
  fetch?: typeof fetch;
  isOnline?: () => boolean;
}

export function createGateway(deps: GatewayDeps) {
  const doFetch = deps.fetch ?? ((r: Request) => fetch(r));
  const isOnline = deps.isOnline ?? (() => navigator.onLine);

  return async function gatewayFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const origin = new URL(url).origin;
    const all = transportsFor(deps.getProxies());
    const recorded = await deps.routes.get(origin);
    const first = all.find((t) => t.id === recorded);
    const ordered: Transport[] = first ? [first, ...all.filter((t) => t !== first)] : all;

    for (const t of ordered) {
      try {
        const res = await doFetch(t.buildRequest(url, init));
        if (t.id !== recorded) await deps.routes.set(origin, t.id);
        return res;
      } catch (e) {
        if (init.signal?.aborted) throw e;
        if (!(e instanceof TypeError)) throw e;
        if (t.id === recorded) await deps.routes.delete(origin);
      }
    }
    throw isOnline() ? new CorsBlockedError(url) : new OfflineError(url);
  };
}

export async function forgetRoutesFor(transportIds: string[]) {
  if (transportIds.length) await db.originRoutes.filter((r) => transportIds.includes(r.transportId)).delete();
}
