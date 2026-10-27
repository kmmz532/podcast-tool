# podcast-tool-proxy
Podcast Tool用のCORSプロキシ。
本体は [src/handler.ts](src/handler.ts) の 1 つで、Cloudflare Workers と Node（ローカル）の両方で動作する。

```
GET /?url={エンコード済みURL}
```
アプリの設定 →「ネットワーク」→「プロキシを追加」で、URL テンプレートに `https://<プロキシ>/?url={url}` を登録するだけで使える。

- 許可した Origin（`ALLOWED_ORIGINS`）以外は 403
- `TOKEN` を設定すると `Authorization: Bearer <TOKEN>` を確認する（アプリのプロキシ設定の「ヘッダー」に書く）
- `http:` / `https:` のみ。localhost・プライベート IP 宛ては拒否（リダイレクト先も確認）
- Range、If-None-Match・If-Modified-Since を転送し、本文はストリームのまま返す

## ローカル環境
```bash
cd proxy
node local.ts # http://127.0.0.1:8787/?url={url}
```

| 環境変数 | 既定 | 備考 |
|---|---|---|
| `PORT` | 8787 | - |
| `HOST` | 127.0.0.1 | スマホなど同じ LAN から利用するなら `0.0.0.0` |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:4173` | カンマ区切り |
| `TOKEN` | なし | - |

## Cloudflare Workers へデプロイ
```bash
cd proxy
npm install
npx wrangler login
npm run deploy # https://podcast-proxy.<アカウント>.workers.dev
npx wrangler secret put TOKEN   # 任意

# ローカルで Workers として実行する (http://127.0.0.1:8787)
npm run dev
```

※wrangler.toml の ALLOWED_ORIGINS にアプリの公開先を追加する必要がある

## テスト
```bash
node --test test/*.test.ts
```
