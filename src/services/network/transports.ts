export interface Transport {
  id: string;
  buildRequest(url: string, init: RequestInit): Request;
}

/** 設定に登録するプロキシ。公開CORSプロキシ、自前プロキシ（proxy/） */
export interface ProxyConfig {
  id: string;
  name: string;
  /** 例: https://proxy.example.workers.dev/?url={url} */
  urlTemplate: string;
  /** 例: { Authorization: 'Bearer xxx' }（自前プロキシ用） */
  headers?: Record<string, string>;
  enabled: boolean;
}

export const direct: Transport = {
  id: 'direct',
  buildRequest: (url, init) => new Request(url, { ...init, mode: 'cors' }),
};

export function proxyTransport(cfg: ProxyConfig): Transport {
  return {
    id: cfg.id,
    buildRequest: (url, init) => {
      const headers = new Headers(init.headers);
      for (const [k, v] of Object.entries(cfg.headers ?? {})) headers.set(k, v);
      return new Request(cfg.urlTemplate.replace('{url}', encodeURIComponent(url)), { ...init, headers, mode: 'cors' });
    },
  };
}

/** direct と、有効なプロキシを設定順に */
export function transportsFor(proxies: readonly ProxyConfig[]): Transport[] {
  return [direct, ...proxies.filter((p) => p.enabled && p.urlTemplate.includes('{url}')).map(proxyTransport)];
}
