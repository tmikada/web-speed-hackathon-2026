# 18. レンダリングブロッキング CSS の非同期化

## 問題

`/styles/main.css`（36.3 KiB, 120ms）と `/styles/vendor.css`（23.4 KiB, 80ms）が
`<head>` 内で同期的な `<link rel="stylesheet">` として挿入されており、レンダリングをブロックしていた。

- **合計推定削減時間**: 110ミリ秒（Lighthouse 表示）
- **影響指標**: FCP、LCP、TBT

HtmlWebpackPlugin のデフォルト動作により、MiniCssExtractPlugin が生成した CSS ファイルが
自動的にブロッキングな `<link>` タグとして `<head>` に挿入されていたことが原因。

`vendor.css` は splitChunks の `vendors` グループ（`chunks: 'all'`）により、
node_modules 内の JS（KaTeX 等）が import する CSS が分離されたもの。

## 対応

`rel="preload"` + `onload` 方式で CSS を非ブロッキングロードに切り替え。

### 変更内容

1. **`webpack.config.js`**
   - `HtmlWebpackPlugin` の `inject: 'body'` → `inject: false` に変更
   - HTML テンプレートで CSS・JS の挿入を手動制御する

2. **`src/index.html`**
   - CSS: `<link rel="preload" as="style" onload="...">` で非同期ロード
   - JS: `<script defer>` を body 末尾に配置（従来と同等）
   - `<noscript>` フォールバックを追加

## 期待効果

| 指標 | 変更前 | 変更後 |
|------|--------|--------|
| CSS ロード方式 | ブロッキング（`<link rel="stylesheet">`） | 非ブロッキング（`preload` + `onload`） |
| 推定削減時間 | — | 110ms |
| FCP / LCP への影響 | CSS ダウンロード完了まで遅延 | CSS に関係なく描画開始 |

## 影響範囲

- CSS が非同期ロードになるため、初回表示時に一瞬 FOUC（スタイルなし表示）が発生する可能性がある
- VRT 要確認
- JS の動作は `defer` 属性で変更なし
