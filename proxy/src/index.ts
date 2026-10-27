// Cloudflare Workers の入り口。ALLOWED_ORIGINS は wrangler.toml の vars、TOKEN は `wrangler secret put TOKEN` で設定する
import { handle, type ProxyEnv } from './handler.ts'

export default {
  fetch: (req: Request, env: ProxyEnv) => handle(req, env),
}
