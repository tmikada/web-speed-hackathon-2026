# 01: webpack ビルド最適化

## 問題

`application/client/webpack.config.js` が開発向け設定のまま本番に使用されている。

- `mode: "none"` — 最適化が一切無効
- `minimize: false` — JS/CSS がミニファイされない
- `splitChunks: false` — コード分割なし（単一巨大バンドル）
- `usedExports: false` — tree-shaking 無効（未使用コードが全て含まれる）
- `concatenateModules: false` — モジュール結合無効
- `devtool: "inline-source-map"` — ソースマップがバンドル内に埋め込まれる（大幅にファイルサイズ増加）

## 対応方針

webpack を `mode: "production"` に切り替えることで、ほとんどの最適化が自動的に有効になる。

### 変更内容

| 設定 | 変更前 | 変更後 |
|------|--------|--------|
| `mode` | `"none"` | `"production"` |
| `minimize` | `false` | `true`（production デフォルト） |
| `splitChunks` | `false` | 有効化（チャンク分割） |
| `usedExports` | `false` | `true`（tree-shaking） |
| `concatenateModules` | `false` | `true` |
| `devtool` | `"inline-source-map"` | `false` |

### splitChunks の設定

```javascript
splitChunks: {
  chunks: 'all',
  cacheGroups: {
    react: {
      test: /[\\/]node_modules[\\/](react|react-dom|react-router|redux|react-redux|redux-form|scheduler)[\\/]/,
      name: 'vendor-react',
      chunks: 'all',
      priority: 30,
      enforce: true,
    },
    heavy: {
      test: /[\\/]node_modules[\\/](@ffmpeg|@imagemagick|@mlc-ai|kuromoji|bayesian-bm25|negaposi-analyzer-ja)[\\/]/,
      name: 'vendor-heavy',
      chunks: 'all',
      priority: 20,
      enforce: true,
    },
    vendors: {
      test: /[\\/]node_modules[\\/]/,
      name: 'vendor',
      chunks: 'all',
      priority: 10,
      enforce: true,
    },
  },
},
```

## 変更箇所

- [application/client/webpack.config.js](../../application/client/webpack.config.js)
  - `output.chunkFormat: false` を削除（チャンクファイルの出力を有効化）
  - `HtmlWebpackPlugin inject: false` → `inject: 'body'`（生成チャンクを HTML に自動注入）
  - `optimization.splitChunks: false` → 3 cacheGroup 構成に変更
- [application/client/src/index.html](../../application/client/src/index.html)
  - 手動の `<script src="/scripts/main.js">` を削除（webpack が自動注入）
  - 手動の `<link rel="stylesheet" href="/styles/main.css">` を削除（webpack が自動注入）

## 期待効果

- **バンドルサイズ**: 推定 60-80% 削減（ミニファイ + tree-shaking）
- **ソースマップ除去**: inline-source-map は元コードの 3-5 倍のサイズになるため大幅削減
- **チャンク分割**: `dist/scripts/` に `main.js`, `vendor-react.js`, `vendor-heavy.js`, `vendor.js` が生成される
- **並列読み込み**: HTTP/2 で複数ファイルを並列取得
- **キャッシュ効率**: アプリコード変更時に vendor チャンクのキャッシュを再利用
- **Lighthouse スコア**: FCP / LCP / TBT の全項目に広く影響

## 注意事項

- `mode: "production"` にすると `process.env.NODE_ENV === "production"` が true になる（React の開発版/本番版切り替えにも影響）
- ビルド後に VRT を実行して動作確認必須
