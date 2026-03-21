# 26. Crokページ専用モジュールの非同期チャンク化

## 問題

`vendors` cacheGroup が `chunks: 'all'` になっているため、Crokページ（`/crok`）でしか使われないモジュールも初期バンドル `vendor.js` に含まれていた。

`CrokContainer` は `React.lazy()` で非同期化済みだが、その依存モジュールは `vendors` グループに吸い上げられ、全ページで初期ロードされていた。

### 影響を受けていたパッケージ

| パッケージ | 推定サイズ | 直接インポート元 |
|---|---|---|
| `highlight.js` | 1.4 MB | react-syntax-highlighter の依存 |
| `refractor` | 985 KB | react-syntax-highlighter の依存 |
| `katex` | 634 KB | ChatMessage.tsx |
| `react-syntax-highlighter` | 319 KB | CodeBlock.tsx |
| `react-markdown` | — | ChatMessage.tsx |
| `rehype-katex` | — | ChatMessage.tsx |
| `remark-math` | — | ChatMessage.tsx |
| `remark-gfm` | — | ChatMessage.tsx |
| `bluebird` | — | ChatInput.tsx |
| unified エコシステム（hast/mdast/micromark 等） | — | react-markdown の依存 |

**合計推定削減量**: ~3.3 MB（初期バンドルから除外）

## 対応

`webpack.config.js` の `splitChunks.cacheGroups` に `crok` グループを追加。

- `chunks: 'async'` → async チャンク（CrokContainer）からのみ参照されるモジュールに限定
- `priority: 22` → `vendors`（priority 10）より高優先度で先にキャプチャ
- `enforce: true` → minSize/maxSize 等のデフォルト条件を無視して確実に分割

### 変更ファイル

- `application/client/webpack.config.js`

### 変更内容

```js
// 追加
crok: {
  test: /[\\/]node_modules[\\/](katex|rehype-katex|remark-math|remark-gfm|react-markdown|react-syntax-highlighter|refractor|highlight\.js|bluebird|unified|vfile|mdast-util-[^/]+|hast-util-[^/]+|micromark[^/]*|zwitch|comma-separated-tokens|space-separated-tokens|hastscript|html-url-attributes|property-information|devlop|bail|is-plain-obj|trough|extend)[\\/]/,
  name: 'vendor-crok',
  chunks: 'async',
  priority: 22,
  enforce: true,
},
```

### 備考

- `kuromoji`・`bayesian-bm25` は既存の `vendor-heavy`（priority 20, `chunks: 'async'`）で対応済みのため除外
- ソースコード（ChatMessage.tsx 等）の変更は不要。CrokContainer がすでに lazy なため、依存モジュールは自動的に async チャンクの文脈で扱われる

## 効果

- `/crok` 以外のページでは `vendor-crok` チャンクが読み込まれない
- `/crok` 訪問時に初めて `vendor-crok` チャンクがロードされる
- KaTeX CSS も MiniCssExtractPlugin が async chunk として遅延ロードする
