# 02: HTTP キャッシュ + Keep-Alive 設定

## 問題

サーバーが全レスポンスに対してキャッシュ無効・接続切断ヘッダーを返している。

- `Cache-Control: max-age=0, no-transform` — ブラウザキャッシュが効かない
- `Connection: close` — HTTP keep-alive が無効（毎リクエスト TCP 接続を張り直す）
- 静的ファイルサーバーで `etag: false`, `lastModified: false` — 304 Not Modified が返らない

## 対応方針

静的アセット（JS/CSS/画像）には長期キャッシュを設定し、API レスポンスは no-cache にする。
Keep-alive を有効化してコネクションを再利用する。

### 変更内容

#### app.ts: グローバルヘッダーの修正

```typescript
// 変更前
app.use((_req, res, next) => {
  res.header({
    "Cache-Control": "max-age=0, no-transform",
    Connection: "close",
  });
  return next();
});

// 変更後: Connection: close を削除（keep-alive がデフォルト）
// Cache-Control はルート別に設定する
```

#### static.ts: 静的ファイルの長期キャッシュ

```typescript
// 変更前
serveStatic(CLIENT_DIST_PATH, {
  etag: false,
  lastModified: false,
})

// 変更後: webpack でコンテントハッシュを付与した JS/CSS は1年キャッシュ
serveStatic(CLIENT_DIST_PATH, {
  etag: true,
  lastModified: true,
  maxAge: "1y",   // ハッシュ付きファイルは長期キャッシュ可
  immutable: true,
})
```

#### API ルートのキャッシュ設定

```typescript
// 変更後: API は no-store でキャッシュしない
apiRouter.use((_req, res, next) => {
  res.header("Cache-Control", "no-store");
  return next();
});
```

### webpack でのコンテントハッシュ付与（01 と連動）

静的ファイルに長期キャッシュを設定するには、ファイル名にコンテントハッシュが必要。

```javascript
// webpack.config.js
output: {
  filename: "scripts/[name].[contenthash].js",
  chunkFilename: "scripts/[name].[contenthash].chunk.js",
}
```

## 変更箇所

- [application/server/src/app.ts](../../application/server/src/app.ts)
  - `Cache-Control: max-age=0` ヘッダーの削除/変更
  - `Connection: close` ヘッダーの削除
- [application/server/src/routes/static.ts](../../application/server/src/routes/static.ts)
  - `etag: false` → `true`
  - `lastModified: false` → `true`
  - `maxAge` の設定追加
- [application/client/webpack.config.js](../../application/client/webpack.config.js)
  - `output.filename` にコンテントハッシュを追加

## 期待効果

- **2回目以降のロード**: JS/CSS/画像が全てキャッシュから返るため劇的に高速化
- **Keep-alive**: TCP 接続の確立コスト削減（特に多数のリクエストがある場合）
- **Lighthouse スコア**: FCP / LCP に直接影響

## 注意事項

- コンテントハッシュ付きファイル名を使う場合、`index.html` から正しいファイル名を参照できるか確認が必要（HtmlWebpackPlugin を使うか、サーバー側で動的に解決する）
- アップロードファイル（ユーザー生成コンテンツ）は `max-age=0` のままにする
- `POST /api/v1/initialize` はキャッシュしないこと（レギュレーション）
