# 04: gzip/brotli 圧縮ミドルウェア

## 問題

サーバーが HTTP レスポンスを圧縮せずに送信している。
JS/CSS/HTML/JSON は圧縮なしでは転送量が大きく、ネットワーク転送に時間がかかる。

## 対応方針

Express に圧縮ミドルウェアを追加する。brotli（`br`）を優先し、非対応クライアントには gzip にフォールバック。

### オプション A: `compression` パッケージ（gzip のみ、シンプル）

```bash
cd application/server
pnpm add compression
pnpm add -D @types/compression
```

```typescript
// application/server/src/app.ts
import compression from "compression";

app.use(compression());
```

### オプション B: `shrink-ray-current`（brotli + gzip）

```bash
cd application/server
pnpm add shrink-ray-current
```

```typescript
import shrinkRay from "shrink-ray-current";

app.use(shrinkRay());
```

### 推奨: オプション A（`compression`）

- `compression` は Node.js 標準の zlib を使用し、追加の native 依存なし
- brotli の効果はある程度あるが、導入コストと比較してまず gzip を優先
- 静的ファイルに対しては webpack でビルド時に `.gz` ファイルを生成し、`serve-static` で `Accept-Encoding` に応じて配信する方法も有効（`compression-webpack-plugin` + `serve-static` の `gzip` オプション）

### ミドルウェアの位置

圧縮ミドルウェアは **すべてのルートの前**（静的ファイルサーバーの前）に配置する。

```typescript
// app.ts
app.use(compression());           // ← 最初に配置
app.use(staticRouter);            // 静的ファイル
app.use("/api", apiRouter);       // API
```

## 変更箇所

- [application/server/src/app.ts](../../application/server/src/app.ts)
  - `compression` のインポートと `app.use(compression())` の追加
- [application/server/package.json](../../application/server/package.json)
  - `compression` の依存追加

## 期待効果

- **転送サイズ**: テキストベースのコンテンツで 60-70% 削減
  - JS ファイル: 通常 50-70% 削減
  - JSON (API): 70-80% 削減
  - HTML: 60-70% 削減
- **Lighthouse スコア**: FCP / LCP（転送時間の短縮）

## 注意事項

- 動画/音声/画像ファイルはすでに圧縮済みのため、圧縮ミドルウェアの効果はない（自動的にスキップされる）
- `compression` のデフォルト閾値は 1KB — 小さいレスポンスは圧縮しない（適切）
- SSE エンドポイント（`GET /api/v1/crok`）への影響を確認すること（レギュレーションで SSE プロトコル変更禁止）
  - **⚠️ 要対応（未着手）**: `compression` は `text/event-stream` をデフォルトで圧縮対象にするため、zlib バッファによってイベントが遅延する問題がある
  - `crok.ts` では `res.write()` で1文字ずつ送信しているが、`res.flush()` を呼んでいないためバッファが詰まるまでクライアントに届かない可能性がある
  - **修正方針**: `compression` の `filter` オプションで `text/event-stream` を除外する
    ```typescript
    app.use(
      compression({
        filter: (req, res) => {
          if (res.getHeader("Content-Type") === "text/event-stream") {
            return false;
          }
          return compression.filter(req, res);
        },
      }),
    );
    ```
