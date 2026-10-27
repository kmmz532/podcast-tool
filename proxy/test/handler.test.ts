import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { handle, isBlockedHost } from '../src/handler.ts'

const ORIGIN = 'http://localhost:5173'
const env = { ALLOWED_ORIGINS: `${ORIGIN},https://app.example` }
const realFetch = globalThis.fetch
const calls: { url: string; headers: Headers }[] = []

/** 配信元のふり。url ごとに返すものを決める */
function mockUpstream(routes: Record<string, () => Response>) {
  calls.length = 0
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: new Headers(init.headers) })
    const r = routes[url]
    if (!r) throw new TypeError('connect failed')
    return r()
  }) as typeof fetch
}
afterEach(() => {
  globalThis.fetch = realFetch
})

const req = (url: string, init: RequestInit & { origin?: string | null } = {}) => {
  const headers = new Headers(init.headers)
  if (init.origin !== null) headers.set('Origin', init.origin ?? ORIGIN)
  return new Request(`https://proxy.example/?url=${encodeURIComponent(url)}`, { ...init, headers })
}

describe('isBlockedHost', () => {
  for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.1.1', '[::1]', 'fd00::1', 'printer.local'])
    it(`blocks ${h}`, () => assert.equal(isBlockedHost(h), true))
  for (const h of ['example.com', '8.8.8.8', '172.32.0.1', 'www0.ise.osaka-sandai.ac.jp'])
    it(`allows ${h}`, () => assert.equal(isBlockedHost(h), false))
})

describe('handle', () => {
  it('rejects unknown or missing Origin', async () => {
    assert.equal((await handle(req('https://a.example/', { origin: 'https://evil.example' }), env)).status, 403)
    assert.equal((await handle(req('https://a.example/', { origin: null }), env)).status, 403)
  })

  it('answers preflight', async () => {
    const res = await handle(req('https://a.example/', { method: 'OPTIONS' }), env)
    assert.equal(res.status, 204)
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN)
    assert.match(res.headers.get('Access-Control-Allow-Headers')!, /Range/)
  })

  it('rejects bad and private urls', async () => {
    for (const u of ['ftp://a.example/', 'http://127.0.0.1/', 'not a url']) assert.equal((await handle(req(u), env)).status, 400)
  })

  it('checks the token when set', async () => {
    mockUpstream({ 'https://a.example/f': () => new Response('ok') })
    const e = { ...env, TOKEN: 'secret' }
    assert.equal((await handle(req('https://a.example/f'), e)).status, 401)
    assert.equal((await handle(req('https://a.example/f', { headers: { Authorization: 'Bearer secret' } }), e)).status, 200)
  })

  it('forwards Range and conditional headers, and returns 206 with CORS headers', async () => {
    mockUpstream({
      'https://cdn.example/a.mp3': () => new Response('abc', { status: 206, headers: { 'Content-Range': 'bytes 0-2/100', 'Content-Type': 'audio/mpeg', 'Set-Cookie': 'x=1' } }),
    })
    const res = await handle(req('https://cdn.example/a.mp3', { headers: { Range: 'bytes=0-2', 'If-None-Match': '"e"', Cookie: 'no' } }), env)
    assert.equal(res.status, 206)
    assert.equal(await res.text(), 'abc')
    assert.equal(res.headers.get('Content-Range'), 'bytes 0-2/100')
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN)
    assert.match(res.headers.get('Access-Control-Expose-Headers')!, /Content-Range/)
    assert.equal(res.headers.get('Set-Cookie'), null)
    assert.equal(calls[0].headers.get('Range'), 'bytes=0-2')
    assert.equal(calls[0].headers.get('If-None-Match'), '"e"')
    assert.equal(calls[0].headers.get('Cookie'), null)
  })

  it('passes through 304 and 404', async () => {
    mockUpstream({ 'https://a.example/304': () => new Response(null, { status: 304 }), 'https://a.example/404': () => new Response('no', { status: 404 }) })
    assert.equal((await handle(req('https://a.example/304'), env)).status, 304)
    assert.equal((await handle(req('https://a.example/404'), env)).status, 404)
  })

  it('follows redirects but not into private addresses', async () => {
    mockUpstream({
      'https://a.example/r': () => new Response(null, { status: 302, headers: { Location: '/final' } }),
      'https://a.example/final': () => new Response('done'),
      'https://a.example/bad': () => new Response(null, { status: 301, headers: { Location: 'http://192.168.0.1/' } }),
    })
    assert.equal(await (await handle(req('https://a.example/r'), env)).text(), 'done')
    assert.equal((await handle(req('https://a.example/bad'), env)).status, 400)
  })

  it('returns 502 when the upstream cannot be reached', async () => {
    mockUpstream({})
    assert.equal((await handle(req('https://down.example/'), env)).status, 502)
  })
})
