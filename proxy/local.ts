// 手元の PC で動かすプロキシ（Node 24 以降。型を取り除いて直接動く）。本体は Workers 版と同じ src/handler.ts
//   node local.ts
// 環境変数:
//   PORT             既定 8787
//   HOST             既定 127.0.0.1。スマホなど同じ LAN の端末から利用するなら 0.0.0.0
//   ALLOWED_ORIGINS  既定 http://localhost:5173,http://localhost:4173
//   TOKEN            設定すると Authorization: Bearer <TOKEN> を確認する
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { handle } from './src/handler.ts'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '127.0.0.1'
const env = {
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:4173',
  TOKEN: process.env.TOKEN,
}

createServer(async (req, res) => {
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
  const response = await handle(new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, { method: req.method, headers }), env)
  res.writeHead(response.status, Object.fromEntries(response.headers))
  if (!response.body) return void res.end()
  const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)
  // アプリ側が中止したら（シークや停止）、配信元からの取得もやめる
  res.on('close', () => body.destroy())
  body.on('error', () => res.destroy())
  body.pipe(res)
}).listen(PORT, HOST, () => {
  console.log(`proxy: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/?url={url}`)
  console.log(`allowed origins: ${env.ALLOWED_ORIGINS}`)
})
