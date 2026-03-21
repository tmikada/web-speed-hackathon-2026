# 07: lodash 完全削除（ネイティブJS置き換え）

## 問題

`lodash` (minified: ~17.5KB) を `SoundWaveSVG.tsx` の1ファイルだけで使用していた。
5つの関数（`map`, `zip`, `chunk`, `mean`, `max`）のためだけに全ライブラリがバンドルされていた。

### 使用箇所

| ファイル | 使用関数 |
|---------|---------|
| `application/client/src/components/foundation/SoundWaveSVG.tsx` | `map`, `zip`, `chunk`, `mean`, `max` |

※ `bm25_search.ts` の lodash は 09 の対応（`bm25-ts` パッケージ化）により既に削除済み

## 対応内容

### `SoundWaveSVG.tsx` の変更

`import _ from "lodash"` を削除し、すべてネイティブJS実装に置き換え。

| lodash | ネイティブJS |
|--------|-------------|
| `_.map(float32Array, Math.abs)` | `Array.from(float32Array, Math.abs)` |
| `_.zip(leftData, rightData)` | `leftData.map((l, i) => [l, rightData[i]])` |
| `_.mean(arr)` | `arr.reduce((a, b) => a + b, 0) / arr.length` |
| `_.chunk(arr, size)` | `Array.from({ length: ... }, (_, i) => arr.slice(...))` |
| `_.max(peaks)` | `Math.max(...peaks)` |

### `package.json` の変更

- `dependencies` から `"lodash": "4.17.21"` を削除
- `devDependencies` から `"@types/lodash": "4.17.20"` を削除

## 変更ファイル

- [application/client/src/components/foundation/SoundWaveSVG.tsx](../../application/client/src/components/foundation/SoundWaveSVG.tsx)
- [application/client/package.json](../../application/client/package.json)

## 期待効果

- **バンドルサイズ削減**: ~17.5KB (minified) → 0 byte
- **Lighthouse スコア**: TBT・FCP に貢献

## 確認方法

音声付き投稿の詳細ページで波形SVGが正常に表示されることを確認（VRT）。
