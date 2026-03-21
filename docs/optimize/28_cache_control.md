# 28. キャッシュ制御の最適化

## 問題

全レスポンスに `Cache-Control: max-age=0, no-transform` が設定されており、静的アセットも含めて一切ブラウザキャッシュが効いていなかった。加えて `etag: false` / `lastModified: false` で 304 Not Modified も使えない状態だった。

webpack の `main.js` / `main.css` にコンテンツハッシュがなく、URLが変わらないため長期キャッシュを安全に設定できなかった。

## 対応

### 1. webpack: main.js / main.css に contenthash を追加

**ファイル**: `application/client/webpack.config.js`

```diff
- filename: "scripts/[name].js",
+ filename: "scripts/[name].[contenthash:8].js",

- filename: "styles/[name].css",    // MiniCssExtractPlugin
+ filename: "styles/[name].[contenthash:8].css",
```

`index.html` テンプレートは `htmlWebpackPlugin.files.css/js` でパスを参照しており、ハッシュが変わっても自動で追従するため変更不要。非同期チャンク (`chunk-[contenthash].js`) はもともとハッシュ付きだった。

### 2. app.ts: グローバル max-age=0 ミドルウェアを削除

**ファイル**: `application/server/src/app.ts`

グローバルミドルウェアを削除し、`/api/v1` 専用で `no-store` に変更。

```diff
- app.use((_req, res, next) => {
-   res.header({ "Cache-Control": "max-age=0, no-transform" });
-   return next();
- });
- app.use("/api/v1", apiRouter);
+ app.use("/api/v1", (_req, res, next) => {
+   res.header({ "Cache-Control": "no-store" });
+   return next();
+ }, apiRouter);
```

### 3. static.ts: ファイル種別ごとに Cache-Control を設定

**ファイル**: `application/server/src/routes/static.ts`

`etag: false` / `lastModified: false` を削除し（デフォルト有効）、`setHeaders` でファイル種別ごとに設定。

| ファイル種別 | Cache-Control | 理由 |
|---|---|---|
| `index.html` | `no-cache` | 毎回確認。変更があれば最新バンドルのURLで再取得 |
| `*.{8桁hash}.js/css` | `public, max-age=31536000, immutable` | contenthash 付きで内容不変 → 1年キャッシュ |
| KaTeX フォント等コピーファイル | `public, max-age=86400` | ハッシュなしだが変更頻度低 |
| アップロードファイル (UPLOAD_PATH) | `public, max-age=86400` | UUID ベースのパスで内容は不変 |
| 公開アセット (PUBLIC_PATH) | `public, max-age=86400` | フォント・画像等、変更頻度低 |

```js
setHeaders(res, filePath) {
  if (filePath.endsWith("index.html")) {
    res.setHeader("Cache-Control", "no-cache");
  } else if (/\.[0-9a-f]{8,}\.(js|css)$/.test(filePath)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    res.setHeader("Cache-Control", "public, max-age=86400");
  }
}
```

## 関連する変更（26, 27 と組み合わせて効果大）

- **26_crok_async_chunk**: `vendor-crok` を非同期チャンク化 → 初期ロード対象の JS サイズ削減
- **27_remove_bluebird**: bluebird (~87KB) を native Promise のシムに置き換え → バンドル軽量化

これらと組み合わせることで、ダウンロードするバイト数が減りつつ、ブラウザキャッシュも効くようになる。

## 期待される効果

- **2回目以降のページロード**: JS/CSS バンドル (数MB) がキャッシュから返る → FCP/LCP が大幅改善
- **初回ロード**: ETag による 304 が使えるようになる（サーバー再起動間はハッシュが一致）
- **API**: `no-store` で認証状態・DBデータの整合性を維持

## 検証方法

```bash
cd application && pnpm run build && pnpm run start
```

1. DevTools → Network タブ → JS/CSS の `Cache-Control` ヘッダーが `immutable` になっていることを確認
2. ページリロードで JS/CSS が `(disk cache)` から返ることを確認
3. `index.html` が `no-cache` / 200 (revalidated) になっていることを確認
4. VRT を実行して見た目の変化がないことを確認
