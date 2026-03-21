# 03: 巨大依存関係の遅延読み込み（Lazy Load）

## 問題

以下のライブラリが初期バンドルに含まれており、ページ表示に不要なコードが大量に読み込まれていた。
ビルド後 `vendor.js` が **106MB** になりタイムライン表示時も全てのJSが読み込まれていた。

| ライブラリ | 使用箇所 | 使用タイミング |
|-----------|---------|--------------|
| `@mlc-ai/web-llm` | `create_translator.ts` | 翻訳ボタンを押したとき |
| `@ffmpeg/ffmpeg` | `load_ffmpeg.ts` | 動画/音声アップロード時 |
| `@imagemagick/magick-wasm` | `convert_image.ts` | 画像アップロード時 |
| `kuromoji` | `negaposi_analyzer.ts`, `ChatInput.tsx` | 感情分析・Crokチャット時 |

---

## 根本原因と対応

### 問題1（最重要）: `babel.config.js` の `modules: "commonjs"` が dynamic import を無効化

`modules: "commonjs"` により Babel が全ての `import()` を同期的な `require()` に変換していた。
その結果、以下が全て無効化されていた:
- `React.lazy(() => import("./Container"))` → `require("./Container")`（同期）
- `await import("@mlc-ai/web-llm")` → `require("@mlc-ai/web-llm")`（同期）

**変更ファイル:** `application/client/babel.config.js`

```javascript
// 変更前
["@babel/preset-env", {
  targets: "ie 11",
  corejs: "3",
  modules: "commonjs",
  useBuiltIns: false,
}]

// 変更後
["@babel/preset-env", {
  targets: "last 1 Chrome version",
  useBuiltIns: false,
}]
```

---

### 問題2: `AppContainer.tsx` で self-referencing パスを使用していた

`React.lazy()` の dynamic import にパッケージの完全パスを使用していたため、webpack がコード分割できなかった。

**変更ファイル:** `application/client/src/containers/AppContainer.tsx`

```typescript
// 変更前（NG: self-referencing パス）
const CrokContainer = lazy(() =>
  import("@web-speed-hackathon-2026/client/src/containers/CrokContainer").then(...)
);

// 変更後（OK: 相対パス）
const CrokContainer = lazy(() =>
  import("./CrokContainer").then(...)
);
```

対象: CrokContainer, DirectMessageContainer, DirectMessageListContainer,
      NotFoundContainer, PostContainer, SearchContainer, TermContainer,
      TimelineContainer, UserProfileContainer（全9コンテナ）

---

### 問題3: 各ライブラリの static import を dynamic import に変換

#### A. @mlc-ai/web-llm

**変更ファイル:** `application/client/src/utils/create_translator.ts`

```typescript
// 変更前
import { CreateMLCEngine } from "@mlc-ai/web-llm";

// 変更後（関数内で動的インポート）
export async function createTranslator(params: Params): Promise<Translator> {
  const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
  const engine = await CreateMLCEngine("gemma-2-2b-jpn-it-q4f16_1-MLC");
  // ...
}
```

#### B. @ffmpeg/ffmpeg

**変更ファイル:** `application/client/src/utils/load_ffmpeg.ts`

```typescript
// 変更前
import { FFmpeg } from "@ffmpeg/ffmpeg";

// 変更後
import type { FFmpeg } from "@ffmpeg/ffmpeg";

export async function loadFFmpeg(): Promise<FFmpeg> {
  const { FFmpeg: FFmpegClass } = await import("@ffmpeg/ffmpeg");
  // ...
}
```

#### C. @imagemagick/magick-wasm

**変更ファイル:** `application/client/src/utils/convert_image.ts`

```typescript
// 変更前
import { ImageMagick, initializeImageMagick, MagickFormat } from "@imagemagick/magick-wasm";

// 変更後
export async function convertImage(file: File, options: Options): Promise<Blob> {
  const { ImageMagick, initializeImageMagick } = await import("@imagemagick/magick-wasm");
  const { default: magickWasm } = await import("@imagemagick/magick-wasm/magick.wasm?binary");
  await initializeImageMagick(magickWasm);
  // ...
}
```

**関連変更:** `NewPostModalPage.tsx` で `MagickFormat.Jpg` を使っていた箇所を文字列 `"Jpg"` に変更し、
`@imagemagick/magick-wasm` の static import を除去。

#### D. kuromoji

**変更ファイル:** `application/client/src/utils/negaposi_analyzer.ts`, `components/crok/ChatInput.tsx`

```typescript
// 変更前
import kuromoji from "kuromoji";

// 変更後
import type { Tokenizer, IpadicFeatures } from "kuromoji";

async function getTokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  const { default: kuromoji } = await import("kuromoji");
  const builder = Bluebird.promisifyAll(kuromoji.builder({ dicPath: "/dicts" }));
  return await builder.buildAsync();
}
```

---

### 問題4: `webpack.config.js` の splitChunks 設定

`vendor-webllm` と `vendor-heavy` が `chunks: 'all'` だったため、初期チャンクへ混入していた。

**変更ファイル:** `application/client/webpack.config.js`

```javascript
// 変更後
webllm: {
  test: /[\\/]node_modules[\\/]@mlc-ai[\\/]/,
  name: 'vendor-webllm',
  chunks: 'async',   // 'all' → 'async'
  priority: 25,
  enforce: true,
},
heavy: {
  test: /[\\/]node_modules[\\/](@ffmpeg|@imagemagick|kuromoji|bayesian-bm25|negaposi-analyzer-ja)[\\/]/,
  name: 'vendor-heavy',
  chunks: 'async',   // 'all' → 'async'
  priority: 20,
  enforce: true,
},
```

---

## 変更ファイル一覧

- [babel.config.js](../../application/client/babel.config.js) — `modules: false`（**最重要**）
- [AppContainer.tsx](../../application/client/src/containers/AppContainer.tsx) — 相対パスで lazy import
- [create_translator.ts](../../application/client/src/utils/create_translator.ts) — dynamic import
- [load_ffmpeg.ts](../../application/client/src/utils/load_ffmpeg.ts) — dynamic import
- [convert_image.ts](../../application/client/src/utils/convert_image.ts) — dynamic import
- [negaposi_analyzer.ts](../../application/client/src/utils/negaposi_analyzer.ts) — dynamic import
- [ChatInput.tsx](../../application/client/src/components/crok/ChatInput.tsx) — dynamic import
- [NewPostModalPage.tsx](../../application/client/src/components/new_post_modal/NewPostModalPage.tsx) — `MagickFormat` 除去
- [webpack.config.js](../../application/client/webpack.config.js) — splitChunks chunks: 'async'

## 期待効果

- **初期バンドル**: `vendor.js` 106MB → 大幅削減（mlc-ai・ffmpeg・imagemagick・kuromoji を除外）
- 各コンテナが async chunk に分割され `vendor-webllm.js`・`vendor-heavy.js` が async chunk として生成される
- タイムライン表示時に重いJSが読み込まれなくなる
- **Lighthouse スコア**: FCP・LCP・TBT が大幅改善

## 注意事項

- `@mlc-ai/web-llm` は WASM を使用するため、動的インポート後も初回使用時に時間がかかる（UX 上の問題はない）
- kuromoji の辞書ファイル（`/dicts`）は引き続き静的に配信する必要がある
- VRT で翻訳・画像/動画/音声アップロード・検索・Crok チャット機能の動作を確認すること
