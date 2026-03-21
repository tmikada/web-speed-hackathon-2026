# 27. bluebird 削除

## 概要

bluebird (~87KB minified) をクライアントバンドルから除去する。

## 問題

bluebird が2箇所で使われており、バンドルに含まれていた：

1. `ChatInput.tsx` — `Bluebird.promisifyAll` で kuromoji builder のコールバック API を Promise 化
2. `gifler` (node_modules) — `new Promise(...)` のコンストラクタとして使用

どちらも native Promise で代替可能。

## 対応内容

### 1. `ChatInput.tsx` を native Promise に書き換え

`Bluebird.promisifyAll` + `buildAsync()` を、kuromoji の callback API を直接 Promise でラップする形に変更。

```tsx
// Before
import Bluebird from "bluebird";
const builder = Bluebird.promisifyAll(kuromoji.builder({ dicPath: "/dicts" }));
const nextTokenizer = await builder.buildAsync();

// After
const nextTokenizer = await new Promise<Tokenizer<IpadicFeatures>>((resolve, reject) => {
  kuromoji.builder({ dicPath: "/dicts" }).build((err, tok) => {
    if (err) reject(err);
    else resolve(tok);
  });
});
```

### 2. bluebird シム作成

gifler は `require('bluebird')` で Promise コンストラクタとしてのみ使用するため、native Promise をエクスポートするシムを作成。

**ファイル**: `application/client/src/shims/bluebird.js`
```js
module.exports = Promise;
```

### 3. webpack alias で bluebird → シムに差し替え

`application/client/webpack.config.js` の `resolve.alias` に追加：

```js
"bluebird$": path.resolve(SRC_PATH, "./shims/bluebird.js"),
```

これにより gifler が `require('bluebird')` した際も native Promise が返る。

### 4. package.json から直接依存を削除

- `"bluebird": "3.7.2"` を dependencies から削除
- `"@types/bluebird": "3.5.42"` を devDependencies から削除

※ `pnpm-workspace.yaml` の `gifler>bluebird` override はそのまま維持（pnpm の依存解決のため）

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `application/client/src/components/crok/ChatInput.tsx` | Bluebird.promisifyAll → native Promise |
| `application/client/src/shims/bluebird.js` | 新規作成（native Promise シム） |
| `application/client/webpack.config.js` | bluebird alias 追加 |
| `application/client/package.json` | bluebird / @types/bluebird 削除 |

## 期待効果

バンドルサイズが bluebird 分 (~87KB minified) 削減される。
