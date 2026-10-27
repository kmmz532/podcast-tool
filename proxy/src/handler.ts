// 自前 CORS プロキシの本体。標準の Request / Response だけを使い、Workers と Node（local.ts）の両方で動かす

export interface ProxyEnv {
  /** 許可するアプリの Origin（カンマ区切り）。空なら拒否する */
  ALLOWED_ORIGINS?: string;
  /** 設定すると Authorization: Bearer <TOKEN> を確認する */
  TOKEN?: string;
}

/** 配信元へそのまま渡すリクエストヘッダー */
const FORWARD_REQUEST = ['range', 'if-none-match', 'if-modified-since', 'accept'];
/** アプリへ返すレスポンスヘッダー */
const FORWARD_RESPONSE = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified', 'cache-control'];
const EXPOSE = 'Content-Length, Content-Range, Content-Type, ETag, Last-Modified, Accept-Ranges';
const MAX_REDIRECTS = 5;
// User-Agent がないと断る配信元があるため付ける
const USER_AGENT = 'Mozilla/5.0 (compatible; PodcastPWA-Proxy/1.0)';

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h === '0.0.0.0') return true;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (h.includes(':')) return h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h.startsWith('::ffff:');
  return false;
}

function targetOf(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !isBlockedHost(u.hostname) ? u : null;
  } catch {
    return null;
  }
}

const allowedOrigins = (env: ProxyEnv) =>
  (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function corsHeaders(origin: string): Headers {
  return new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Expose-Headers': EXPOSE,
    Vary: 'Origin',
  });
}

const text = (status: number, body: string, headers = new Headers()) => {
  headers.set('Content-Type', 'text/plain; charset=utf-8');
  return new Response(body, { status, headers });
};

export async function handle(req: Request, env: ProxyEnv): Promise<Response> {
  const origin = req.headers.get('Origin');
  if (!origin || !allowedOrigins(env).includes(origin)) return text(403, 'Origin not allowed');
  const cors = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    cors.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    cors.set('Access-Control-Allow-Headers', 'Range, Authorization, If-None-Match, If-Modified-Since');
    cors.set('Access-Control-Max-Age', '86400');
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return text(405, 'Method not allowed', cors);
  if (env.TOKEN && req.headers.get('Authorization') !== `Bearer ${env.TOKEN}`) return text(401, 'Unauthorized', cors);

  let target = targetOf(new URL(req.url).searchParams.get('url'));
  if (!target) return text(400, 'Invalid url', cors);

  const headers = new Headers({ 'User-Agent': USER_AGENT });
  for (const name of FORWARD_REQUEST) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }

  // リダイレクトは自分でたどり、行き先ごとにプライベート宛てでないか確かめる
  let upstream: Response
  for (let i = 0; ; i++) {
    try {
      upstream = await fetch(target.href, { method: req.method, headers, redirect: 'manual' });
    } catch (e) {
      return text(502, `Upstream fetch failed: ${e instanceof Error ? e.message : String(e)}`, cors);
    }
    const location = upstream.status >= 300 && upstream.status < 400 ? upstream.headers.get('Location') : null;
    if (!location) break;
    if (i >= MAX_REDIRECTS) return text(508, 'Too many redirects', cors);
    const next = targetOf(new URL(location, target).href);
    if (!next) return text(400, 'Redirect to a blocked url', cors);
    target = next;
  }

  for (const name of FORWARD_RESPONSE) {
    const v = upstream.headers.get(name);
    if (v) cors.set(name, v);
  }
  // fetch は圧縮を解いて渡すので、圧縮されていたときの長さは本文と合わない
  if (upstream.headers.get('content-encoding')) cors.delete('content-length');
  // 本文はバッファせず、ストリームのまま返す
  return new Response(req.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers: cors });
}
