import { gatewayFetch } from '../network';

/**
 * 再生に失敗した音声URLのHTTPの状態を調べる（<audio> からは404などが分からないため）。
 * HEADを断る配信元があるので、不可なら先頭1バイトだけGET。CORS などで調べられなければundefined
 */
export async function probeStatus(url: string): Promise<number | undefined> {
  for (const init of [{ method: 'HEAD' }, { headers: { Range: 'bytes=0-0' } }] satisfies RequestInit[]) {
    try {
      const res = await gatewayFetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
      await res.body?.cancel();
      if (res.status !== 405 && res.status !== 501) return res.status;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
