/** どの Transport でも取得できなかった（CORS で止められたとみなす） */
export class CorsBlockedError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(`Blocked by CORS: ${url}`);
    this.name = 'CorsBlockedError';
    this.url = url;
  }
}

/** オフラインのため取得できなかった */
export class OfflineError extends Error {
  readonly url: string

  constructor(url: string) {
    super(`Offline: ${url}`);
    this.name = 'OfflineError';
    this.url = url;
  }
}
