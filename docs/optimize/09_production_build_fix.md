# 09: production ビルド設定の修正

## 問題

クライアントのビルドスクリプトと Babel 設定が development 固定になっており、fly.io へのデプロイ時に最適化が一切効いていなかった。

### 1. ビルドスクリプトが `NODE_ENV=development` 固定

`application/client/package.json` のビルドスクリプト:
```json
"build": "NODE_ENV=development webpack"
```

webpack.config.js は `NODE_ENV` をもとに `mode` を切り替えるが、常に `mode: "development"` で動作していた。

**結果**: fly.io でのビルドログ上で `main.js` が **108MB** になり、splitChunks が全く効かない状態だった。

### 2. Babel の React プリセットが `development: true` 固定

`application/client/babel.config.js`:
```js
["@babel/preset-react", {
  development: true,  // ← ハードコード
  runtime: "automatic",
}]
```

`development: true` のとき、Babel は JSX を `react/jsx-dev-runtime` の `jsxDEV` にコンパイルする（dev版JSXランタイム）。

`NODE_ENV=production` で webpack が production 最適化（tree shaking / minification / module concatenation）を行う際、dev版JSXランタイムが依存する開発用ユーティリティが削除され、**ランタイムエラー → 白画面**になる。

## 対応方針

両設定を `NODE_ENV` に連動させる。

## 変更内容

### `application/client/package.json`

| 設定 | 変更前 | 変更後 |
|------|--------|--------|
| `build` スクリプト | `NODE_ENV=development webpack` | `NODE_ENV=production webpack` |

### `application/client/babel.config.js`

| 設定 | 変更前 | 変更後 |
|------|--------|--------|
| `development` | `true`（固定） | `process.env.NODE_ENV === 'development'` |

変更後:
```js
["@babel/preset-react", {
  development: process.env.NODE_ENV === 'development',
  runtime: "automatic",
}]
```

これにより:
- `NODE_ENV=production` → `development: false` → `jsx` / `jsxs`（production JSXランタイム）
- `NODE_ENV=development` → `development: true` → `jsxDEV`（dev JSXランタイム）

## 変更箇所

- [application/client/package.json](../../application/client/package.json) — `build` スクリプト
- [application/client/babel.config.js](../../application/client/babel.config.js) — `development` オプション

## 期待効果

- **splitChunks が正常に機能**: `vendor-react.js`, `vendor.js` 等が分離され、108MB → 数MB に削減
- **minification が有効**: Terser による圧縮
- **白画面の解消**: production JSXランタイムを使用するため、production 最適化と整合する

## 注意事項

- ローカル開発時は `pnpm run dev`（webpack-dev-server）を使うため影響なし
- 変更後に VRT を実行して動作確認必須
