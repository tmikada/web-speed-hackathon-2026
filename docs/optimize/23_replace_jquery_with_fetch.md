# 23. jQuery / pako を native fetch に置き換え

## 問題

Lighthouse の「使用していない JavaScript の削減」で `vendor.js`（2,433.8 KiB 転送）のうち 2,274.8 KiB が削減可能と指摘されていた。

`fetchers.ts` が `jquery` と `pako` を静的 import しており、これらが初期ロード時の vendor.js に含まれていた。

- `jquery` ~88 KB (minified)
- `pako` ~51 KB (minified)
- `jquery-binarytransport` プラグイン（エントリポイントに追加されていた）

## 対応内容

### `application/client/src/utils/fetchers.ts`

`$.ajax()` + `pako.gzip()` を native `fetch()` API に置き換え。

| 関数 | 変更前 | 変更後 |
|---|---|---|
| `fetchBinary` | `$.ajax({ dataType: "binary", responseType: "arraybuffer" })` | `fetch().arrayBuffer()` |
| `fetchJSON` | `$.ajax({ dataType: "json" })` | `fetch().json()` |
| `sendFile` | `$.ajax({ data: file, processData: false })` | `fetch({ body: file })` |
| `sendJSON` | `pako.gzip()` で圧縮 → `$.ajax()` | plain JSON → `fetch()` |

エラーハンドリングも追加（`!res.ok` チェック）。

`sendJSON` の gzip 圧縮を廃止した理由：サーバー側は `bodyParser.json()` を使用しており plain JSON を受け付けるため、クライアント側での圧縮は不要。

### `application/client/webpack.config.js`

- `entry.main` から `"jquery-binarytransport"` を削除
- `ProvidePlugin` から `$: "jquery"` と `"window.jQuery": "jquery"` を削除

## 期待される効果

- vendor.js から jquery（~88 KB）・pako（~51 KB）・jquery-binarytransport を除去
- 初期ロード時の JS 転送量削減

## 残課題（未対応）

以下は今後の対応候補：

- `vendors` cacheGroup を `chunks: 'async'` に変更（遅延ルートの deps を初期 vendor.js から除外）
- bluebird を native Promise に置き換え（`ChatInput.tsx`）
