# 設計書
要件は [docs/REQUIREMENT.md](../docs/REQUIREMENT.md) を参照。要件IDは同ファイルのもの。

## 1. 技術構成

| 区分 | 採用 | 備考 |
|---|---|---|
| 言語 | TypeScript | テンプレート準拠 |
| UI | React + MUI + PevenMUI | テンプレート準拠。モバイル/デスクトップのレイアウト、設定ダイアログ、i18nを流用 |
| ビルド | Vite | テンプレート準拠 |
| ルーティング | React Router (HashRouter) | 静的ホスティングでも404にならない。SWのナビゲーション処理も単純になる |
| 状態管理 | Zustand | プレイヤー状態のような「画面をまたぐ1つの状態」を持つ |
| 永続化 | IndexedDB (Dexie) + OPFS | メタデータはDexie、音声ファイル本体はOPFS（§8） |
| 一覧表示 | `react-virtuoso` | 仮想スクロール（N-3） |
| RSS解析 | `DOMParser` | ブラウザ標準で十分。Worker内では使えないためメインスレッドで解析 |
| Service Worker | `vite-plugin-pwa` (injectManifest) | プリキャッシュはWorkbox、音声配信は自前処理（§9） |
| PWA更新案内 | `pevenmui/pwa` | テンプレート側の仕組みを利用する |
| 自前プロキシ（付加） | Cloudflare Workers | §6。アプリとは別にデプロイ |
| Wasm | 今のところ利用しない、必要になれば利用する | §11 |

PevenMUIはgit submoduleとして取り込む。

> 確認済み: PevenMUIのVite plugin（`pevenApp`）はmanifestを出さない。manifestは `vite-plugin-pwa` が生成し、名前、言語は `pevenManifest(APP_INFO)` で渡す。

## 2. 全体構成

```
┌───────────────────────── ブラウザ ─────────────────────────┐
│                                                            │
│  React UI (PevenMUI)                                       │
│    ├─ 画面 (pages/)                                        │
│    └─ ミニプレイヤー / フルプレイヤー                       │
│         │                                                  │
│  Zustand store ── playerStore / downloadStore              │
│         │                                                  │
│  Services                                                  │
│    ├─ feedService      … フィード取得、解析、差分反映      │
│    ├─ playerService    … <audio> 制御、Media Session       │
│    ├─ downloadService  … 音声取得、OPFS保存                │
│    └─ opmlService      … OPML入出力                        │
│         │                                                  │
│  Network (gateway)  … 外部への fetch はすべてここを通す §5  │
│    └─ Transport: direct / proxy / （後から追加）           │
│         │                                                  │
│  Repository (Dexie / IndexedDB)   OPFS (音声ファイル)       │
│                                                            │
│  Service Worker                                            │
│    ├─ アプリ本体のプリキャッシュ                            │
│    └─ /local-audio/{id} を OPFS から Range 対応で返す      │
└────────────────────────────────────────────────────────────┘
          │ direct                     │ proxy
          ▼                            ▼
   Podcast配信元  ◀──────────  自前プロキシ (Workers, 付加 §6)
   (RSS / 音声)                 または公開CORSプロキシ
```

## 3. ディレクトリ構成

```
podcast/
  src/
    main.tsx
    App.tsx               … PevenProvider、ルーティング、レイアウト
    appInfo.ts            … テンプレート由来
    settings.ts           … テンプレート由来。アプリ設定を追加
    lang/                 … ja_jp.json / en_us.json
    pages/
      LibraryPage.tsx       … 購読番組一覧
      PodcastPage.tsx       … 番組詳細、エピソード一覧
      EpisodePage.tsx       … エピソード詳細（ショーノート）
      QueuePage.tsx         … 再生キュー
      DownloadsPage.tsx     … ダウンロード管理
    components/
      player/  MiniPlayer.tsx / FullPlayer.tsx / SeekBar.tsx / SpeedSelector.tsx
      podcast/ PodcastCard.tsx / EpisodeListItem.tsx / AddPodcastDialog.tsx
    services/
      network/ gateway.ts / transports.ts / errors.ts
      feed/    parseFeed.ts / syncPodcast.ts
      player/  playerService.ts / mediaSession.ts
      download/downloadService.ts / opfs.ts
      opml/    opml.ts
    store/
      playerStore.ts / downloadStore.ts
    db/
      schema.ts / repositories.ts
    sw/
      sw.ts                 … Service Worker 本体
  proxy/                  … 自前プロキシ（付加 F-6）。独立した wrangler プロジェクト
    src/index.ts
    wrangler.toml
```

## 4. データモデル（IndexedDB / Dexie）

```ts
interface Podcast {
  id: string;              // feedUrl の SHA-1（重複登録防止）
  feedUrl: string;
  title: string;
  author?: string;
  description?: string;
  artworkUrl?: string;
  link?: string;
  lastFetchedAt?: number;  // epoch ms
  etag?: string;           // 条件付きGET用
  lastModified?: string;
  autoDownload: boolean;   // F-5-6
  addedAt: number;
  sortOrder: number;
}

interface Episode {
  id: string;              // podcastId + (guid ?? enclosureUrl) のハッシュ
  podcastId: string;
  guid?: string;
  title: string;
  description?: string;    // サニタイズ済みHTML
  pubDate: number;
  enclosureUrl: string;
  enclosureType?: string;
  enclosureLength?: number;
  duration?: number;       // 秒。itunes:duration から
  artworkUrl?: string;     // itunes:image（エピソード個別）
}

interface PlaybackState {   // エピソードと分けて、フィード更新で上書きされないようにする
  episodeId: string;
  position: number;        // 秒
  duration?: number;       // 実測値
  played: boolean;
  updatedAt: number;
}

interface Download {
  episodeId: string;
  status: 'queued' | 'downloading' | 'done' | 'blocked' | 'error';
  //  blocked … どの Transport でも CORS で取れなかった（F-5-7）。プロキシ追加時の再試行対象（F-5-8）
  //  error   … それ以外の失敗（404、容量不足など）
  bytes: number;
  totalBytes?: number;
  mimeType?: string;
  opfsPath: string;        // audio/{episodeId}
  error?: string;
  completedAt?: number;
}

interface QueueItem { episodeId: string; order: number; }

// どの Transport で取れたかを Origin 単位で覚える（§5.3）
interface OriginRoute {
  origin: string;          // 例: https://anchor.fm
  transportId: string;     // 'direct' または ProxyConfig.id
  checkedAt: number;
}
```

### Dexieスキーマ
```ts
db.version(1).stores({
  podcasts:       'id, &feedUrl, sortOrder',
  episodes:       'id, podcastId, [podcastId+pubDate], pubDate',
  playbackStates: 'episodeId, updatedAt',
  downloads:      'episodeId, status',
  queue:          'episodeId, order',
  originRoutes:   'origin',
});
```

- 設定（言語、テーマ、スキップ秒数、プロキシ一覧など）はテンプレートに合わせてlocalStorageに置く
- 最後に再生していたエピソードIDもlocalStorageに置き、起動時にミニプレイヤーを復元する

## 5. 通信層（Network）

CORS対策を後から足せるように、外部への `fetch` はすべて `services/network/gateway.ts` を通す。
フィード取得、ダウンロードのコードは「どう取るか」を知らず、`gateway.fetch(url, init)` を呼ぶだけにする。

### 5.1 Transport
「URLをどう取りに行くか」を1つの Transport として表す。

```ts
interface Transport {
  id: string;
  / 元のURLに対する Request を組み立てる */
  buildRequest(url: string, init: RequestInit): Request;
}

// MVP で用意するもの
const direct: Transport = {
  id: 'direct',
  buildRequest: (url, init) => new Request(url, { ...init, mode: 'cors' }),
};

// 設定に登録されたプロキシから作る
interface ProxyConfig {
  id: string;              // UUID
  name: string;            // 表示名
  urlTemplate: string;     // 例: https://proxy.example.workers.dev/?url={url}
  headers?: Record<string, string>; // 例: { Authorization: 'Bearer xxx' }（自前プロキシ用）
  enabled: boolean;
}
function proxyTransport(cfg: ProxyConfig): Transport {
  return {
    id: cfg.id,
    buildRequest: (url, init) => {
      const headers = new Headers(init.headers);
      for (const [k, v] of Object.entries(cfg.headers ?? {})) headers.set(k, v);
      return new Request(cfg.urlTemplate.replace('{url}', encodeURIComponent(url)),
                         { ...init, headers, mode: 'cors' });
    },
  };
}
```

- 公開CORSプロキシも自前プロキシ（§6）も、アプリから見ると同じ `ProxyConfig` で表せる。自前プロキシを追加するときに必要なのは設定の追加だけ（F-6-4）
- 将来、URLテンプレートで表せない経路（例: 別のAPIを呼ぶ、ブラウザ拡張経由）が必要になったら、`Transport` の実装を1つ足して `transports.ts` に登録する。呼び出し側は変えなくてよい

### 5.2 gateway.fetch
```
gateway.fetch(url, init)
  1. 候補の Transport を並べる
       originRoutes に記録があればそれを先頭、続いて direct、続いて有効なプロキシを設定順
  2. 先頭から順に試す
       - TypeError（CORS、ネットワーク断） → 次へ
       - HTTP レスポンスが返った → 成功。originRoutes を更新して返す
         （404 などもレスポンスとして返す。経路の問題ではないため次は試さない）
  3. すべて TypeError → オフラインなら OfflineError、それ以外は CorsBlockedError を投げる
```
- `fetch` の TypeError からは「CORS」と「ネットワーク断」を区別できないため、`navigator.onLine` と、他の Transport の結果で判断する
- 呼び出し側は `CorsBlockedError` を受け取ったら、フィードなら設定画面へ案内、ダウンロードなら `status='blocked'` にする

### 5.3 経路の記録（originRoutes）
- 成功した Transport を Origin 単位で覚え、次回は最初からそれを利用する。無駄な失敗リクエストを減らすため
- 番組単位ではなく Origin 単位にする理由: 音声ファイルは番組をまたいで同じCDN（例: anchor.fm, megaphone.fm）から配信されることが多く、まとめて効くため
- 記録した Transport が失敗したら、その記録を消して 5.2 の順で試し直す
- プロキシ設定を変更、削除したら、そのプロキシを参照している記録を消す

## 6. 自前プロキシ（付加 F-6）

`proxy/` に Cloudflare Workers のプロジェクトとして置く。アプリのビルドとは独立。

### 6.1 API
```
GET /?url={エンコード済みURL}
  リクエストヘッダー:
    Range            … あれば配信元へそのまま転送
    Authorization    … トークンを設定した場合のみ確認
  レスポンス:
    配信元のステータス（200 / 206 / 304 / 404 …）とボディをストリームのまま返す
    Access-Control-Allow-Origin: 許可したOrigin
    Access-Control-Expose-Headers: Content-Length, Content-Range, Content-Type, ETag, Last-Modified
OPTIONS … プリフライト応答（Range, Authorization, If-None-Match, If-Modified-Since を許可）
```

### 6.2 制約
- 許可Origin（アプリのデプロイ先）以外は 403（F-6-3）
- `url` は `http:` / `https:` のみ。プライベートIPやlocalhost宛ては拒否
- ボディは `fetch` の結果の `body` をそのまま返し、バッファしない（F-6-2）
- アプリ側の `proxyTransport` と同じ `?url=` 形式なので、アプリの設定に `urlTemplate` を登録するだけで使える

> 注意: Workers 無料枠のリクエスト数、転送量の上限内で収まるかは、ダウンロード量次第。フィード取得だけをプロキシに通す使い方なら十分に収まる。

## 7. フィード取得、解析（F-1）

### 7.1 取得
- `gateway.fetch(feedUrl, { headers: If-None-Match / If-Modified-Since })` で取得する
  - 304 → 変更なし
  - `CorsBlockedError` → 「取得できませんでした。設定でプロキシを追加してください」と案内
- オフライン時（`navigator.onLine === false`）は取得せず、保存済みのデータを表示する
- 一括更新は同時実行数4に制限する

### 7.2 解析
`DOMParser` で RSS 2.0 + iTunes名前空間を解析する。

| 項目 | 取得元（優先順） |
|---|---|
| 番組アートワーク | `itunes:image@href` → `image/url` |
| エピソードID | `guid` → `enclosure@url` |
| 長さ | `itunes:duration`（`HH:MM:SS` / `MM:SS` / 秒数のすべてに対応） |
| 説明 | `content:encoded` → `description` → `itunes:summary` |

- `enclosure` を持たない `item` は捨てる
- 説明のHTMLは DOMPurify でサニタイズし、リンクに `target="_blank" rel="noopener"` を付ける
- Atomフィードは対象外（Podcastではほぼ使われない）

### 7.3 差分反映
- エピソードIDで既存と突き合わせ、新規は追加、既存はメタデータを更新する
- フィードから消えたエピソードは削除しない（ダウンロード済み、再生途中のものを守るため）
- 自動ダウンロードONの番組は、新規エピソードをダウンロードキューへ入れる

## 8. 音声ファイルキャッシュ（F-5）

### 8.1 保存先にOPFSを利用する理由
- 数十〜数百MBのファイルを扱うため、IndexedDBのBlobより書き込み時のメモリ負荷が低いストリーム書き込み（`createWritable`）が使える
- Cache APIのように「レスポンスごと保存」ではないので、Range要求への応答を自分で組み立てやすい

> 要確認: iOS Safariは `createWritable` の対応が遅れていた。未対応なら Dedicated Worker 内の `createSyncAccessHandle` で書き込む。導入時に実機確認する。

### 8.2 ダウンロード処理
```
download(episode)
  1. gateway.fetch(enclosureUrl, { signal })
       - CorsBlockedError → status='blocked' で終了（F-5-7）
  2. response.body をストリームで読み、OPFS audio/{episodeId} へ書き込む
     - 一定バイトごとに進捗を downloadStore と Dexie に反映
     - AbortController でキャンセル
  3. 完了で status='done'。失敗、キャンセル時は書きかけのファイルを消す
```
- 同時ダウンロード数は2
- 開始前に `navigator.storage.estimate()` で空きを確認し、`enclosureLength` が分かれば十分か判定する
- 初回ダウンロード時に `navigator.storage.persist()` を要求する（N-4）
- プロキシ設定を追加、変更したら、`status='blocked'` の一覧を再試行できるボタンを出す（F-5-8）

### 8.3 CORSで取れない音声
- MVP: 直接取得のみ（またはユーザーが登録した公開プロキシ）。取れなければ `blocked`。ストリーミング再生はできる
- 付加: 自前プロキシ（§6）を登録すれば、アプリ側の変更なしで `blocked` を再試行できる
- 不採用: `no-cors` で不透明レスポンスをCache APIに入れる方法は、Chromeで1件ごとに大きな容量が加算される、Range応答を作れない、Safariでシークできない、ため採らない

## 9. Service Worker

### 9.1 アプリ本体
- Workboxでビルド成果物をプリキャッシュする（N-1）
- ナビゲーションは `index.html` を返す（HashRouterなので基本不要だが保険）
- 新バージョン検知時は `pevenmui/pwa` の更新案内を表示し、ユーザー操作で `skipWaiting`

### 9.2 ダウンロード済み音声の配信
`<audio src="/local-audio/{episodeId}">` で再生し、SWがOPFSから返す。

```
fetch イベント: /local-audio/{id}
  - OPFS audio/{id} を開く
  - Range ヘッダーあり → 206 + Content-Range で該当部分を file.slice() して返す
  - Range ヘッダーなし → 200 で全体を返す
  - Content-Type は Download.mimeType（なければ audio/mpeg）
  - ファイルがない → 404（プレイヤー側でストリーミングURLに切り替える）
```
iOS Safariはメディア要素に206を要求するため、Range対応は必須。

> 代替案: `URL.createObjectURL(file)` を `<audio>` に渡す方法でもシークは効く。SW経由のほうがURLが安定し、ロック画面復帰後も壊れにくいので、まずSW方式で作り、問題があればBlob URL方式に切り替える。

## 10. 再生（F-2）

### 10.1 構成
- `<audio>` 要素はアプリ全体で1つだけ持ち、`App.tsx` の直下に置く（画面遷移で消えない: F-2-6）
- `playerService` が `<audio>` を操作し、`playerStore` に状態を反映する。UIは store だけを見る

```ts
interface PlayerState {
  currentEpisodeId?: string;
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  position: number;
  duration: number;
  playbackRate: number;
  buffered: number;
}
```

### 10.2 再生URLの決定
```
ダウンロード済み (status='done') → /local-audio/{episodeId}
それ以外                          → enclosureUrl（オンライン時のみ）
オフラインかつ未ダウンロード      → 再生不可として表示
```
ストリーミング再生は `<audio>` が直接取得するのでCORSの影響を受けず、gateway を通さない。

### 10.3 再生位置の保存（F-2-4, F-2-5）
- 再生中は5秒ごと、および一時停止、エピソード切り替え、`visibilitychange`(hidden)、`pagehide` で `PlaybackState` に保存する
- 残り30秒未満、または `ended` で `played = true`
- 再生済みのエピソードを再生し直すときは先頭から始める

### 10.4 Media Session（F-2-7）
- `metadata`: タイトル、番組名、アートワーク
- アクション: `play` / `pause` / `seekbackward` / `seekforward` / `seekto` / `previoustrack`(=戻るスキップ) / `nexttrack`(=キューの次へ)
- `setPositionState` を再生中に更新する

### 10.5 キュー（F-2-8）
- `ended` でキュー先頭を取り出して再生する。キューが空なら停止
- 並べ替えはドラッグ（PC）とハンドル操作（スマホ）

## 11. Wasm
MVPでは利用しない。現状の処理（XML解析、ファイル保存）はブラウザ標準APIで十分速く、Wasmを入れる利点がない。

導入候補（将来機能の検討時に判断）:
- 無音カット、音量正規化: AudioWorklet + Wasm（Rust）で再生中に処理する
- 大量フィードの一括解析: Worker + Wasm のXMLパーサー（`DOMParser` はWorkerで使えないため）

## 12. 画面構成

| 画面 | パス | 内容 |
|---|---|---|
| ライブラリ | `#/` | 購読番組のグリッド/リスト、追加ボタン、一括更新 |
| 番組詳細 | `#/podcast/:id` | 番組情報、エピソード一覧（仮想スクロール）、購読解除、自動DL設定 |
| エピソード詳細 | `#/episode/:id` | ショーノート、再生、DL、キュー追加 |
| キュー | `#/queue` | 再生キューの並べ替え |
| ダウンロード | `#/downloads` | ダウンロード一覧、進捗、容量表示、削除、`blocked` の再試行 |
| 設定 | ダイアログ | PevenMUIの設定ダイアログ。言語、テーマ、再生、プロキシ一覧、OPML入出力 |

### 設定: プロキシ一覧
- 追加、編集、削除、並べ替え、有効/無効の切り替え
- 「接続テスト」ボタン: 登録済みの番組フィードを1つ取得して成否を表示する

### レイアウト
- スマホ: PevenMUIのモバイルレイアウト。下部タブ（ライブラリ/キュー/ダウンロード）＋その上にミニプレイヤー。フルプレイヤーは全画面シート
- PC: PevenMUIのデスクトップレイアウト。左ペインに番組一覧、右に詳細、下部ステータスバー位置にプレイヤー。メニューバーに「ファイル（OPML入出力）」「再生」など

### キーボードショートカット（PC, N-6）
PevenMUIのキーマップ機能で定義し、設定から変更可能にする。

| キー | 操作 |
|---|---|
| Space | 再生/一時停止 |
| ← / → | 戻る/進むスキップ |
| Shift + ← / → | 再生速度 -/+ 0.1 |
| U | 全番組更新（Ctrl+R はブラウザの再読み込みと重なるため利用しない） |

## 13. エラー処理
| 状況 | 対応 |
|---|---|
| フィード取得で `CorsBlockedError` | トーストで案内し、設定（プロキシ一覧）を開くボタンを出す |
| フィード解析失敗 | 「RSSとして読めませんでした」と表示。番組は登録しない |
| ダウンロードで `CorsBlockedError` | `status='blocked'`。一覧に「ダウンロード不可（プロキシを追加すると取得できる場合があります）」 |
| 再生エラー（`audio.error`） | ダウンロード済みならストリーミングで再試行。だめならエラー表示 |
| 容量不足（`QuotaExceededError`） | ダウンロードを止め、ダウンロード管理画面への導線を出す |

## 14. テスト
- 単体テスト（Vitest）: `parseFeed`（実在番組のRSSをfixtureに数種）、`itunes:duration` 解析、OPML入出力、差分反映
- gateway: モックの Transport で、試す順番、originRoutes の記録と破棄、エラーの種類を確認
- SWのRange応答: Vitest + モックで 206 / Content-Range の計算を確認
- 自前プロキシ: `wrangler dev` で Range 転送、CORSヘッダー、Origin制限を確認
- 実機確認: iOS Safari（ホーム画面追加）、Android Chrome でバックグラウンド再生、ロック画面操作、オフライン再生

## 15. 実装順
1. テンプレートから雛形作成、ルーティング、レイアウト、i18n
2. Dexieスキーマ、通信層（direct + proxy）、フィード取得、解析、番組追加/一覧/詳細
3. プレイヤー（ストリーミング再生、再生位置保存、Media Session、キュー）
4. PWA化（プリキャッシュ、更新案内）、OPML入出力、プロキシ設定画面 ← ここまでMVP
5. ダウンロード（OPFS保存、SWのRange配信、管理画面、`blocked` の再試行）
6. 自前プロキシ（`proxy/`）
7. 自動ダウンロード、再生済み自動削除
