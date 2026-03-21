# 19: webpack.config.js クリーンアップ

## 問題

`application/client/webpack.config.js` に、パフォーマンスに影響する未対応の設定が残っている。

---

## 対応項目

### 1. `regenerator-runtime` エントリー削除【優先度: 高】

**問題**

`entry` に `"regenerator-runtime/runtime"` が含まれており、初期バンドルに ~7KB が無駄に含まれる。

**原因**

`regenerator-runtime` は Babel が `async/await` をジェネレーター関数に変換するときに必要になるポリフィル。
しかし `babel.config.js` の `targets: "last 1 Chrome version"` により、Chrome 最新版はネイティブで async/await をサポートしているため Babel は変換を行わない。つまり `regeneratorRuntime` グローバルは一切参照されない。

**対応**

```diff
  entry: {
    main: [
-     "regenerator-runtime/runtime",
      "jquery-binarytransport",
      ...
    ],
  },
```

**期待効果**: 初期バンドルから ~7KB 削減、FCP/LCP 改善

---

### 2. `providedExports: false` → `true`【優先度: 高】

**問題**

```js
providedExports: false,  // 各モジュールが何をexportしているかの収集が無効
usedExports: true,       // tree-shakingは有効のつもりだが…
```

`usedExports: true` (使用されているexportを判定) は `providedExports` の情報を前提とする。
`providedExports: false` にすると tree-shaking の効果が大幅に下がる。

**対応**

```diff
- providedExports: false,
+ providedExports: true,
```

**期待効果**: tree-shaking の改善によるバンドルサイズ削減

---

### 3. CSS ファイル名に `[contenthash]` 付与【優先度: 中】

**問題**

```js
new MiniCssExtractPlugin({
  filename: "styles/[name].css",  // ハッシュなし
}),
```

CSS が更新されてもファイル名が変わらないため、ブラウザキャッシュが再利用されてしまう。

**対応**

```diff
new MiniCssExtractPlugin({
- filename: "styles/[name].css",
+ filename: "styles/[name]-[contenthash].css",
}),
```

**期待効果**: キャッシュバスティング改善、CSS 更新が確実に反映される

---

### 4. スクリプト注入を `head` + `defer` に変更【優先度: 低】

**問題**

```js
new HtmlWebpackPlugin({
  inject: 'body',  // bodyの末尾にscriptタグを挿入
}),
```

`body` 末尾への注入だとブラウザのプリロードスキャナーがスクリプトを先読みできず、発見が遅れる。

**対応**

```diff
new HtmlWebpackPlugin({
- inject: 'body',
+ inject: 'head',
+ scriptLoading: 'defer',
  template: path.resolve(SRC_PATH, "./index.html"),
}),
```

**期待効果**: ブラウザのプリロードスキャナーによる先読みで LCP 改善の可能性

---

### 5. jQuery 削除【優先度: 高・別タスク】

**問題**

- `jquery-binarytransport`（jQuery プラグイン）はエントリーにグローバル副作用として必要
- jQuery 本体は **~87KB (minified+gzip)** と重い

**代替案**

`application/client/src/utils/fetchers.ts` の `fetchBinary()` を `fetch` API で置き換えれば jQuery 依存を削除できる。

```ts
// 変更前
export async function fetchBinary(url: string): Promise<ArrayBuffer> {
  return $.ajax({ dataType: "binary", responseType: "arraybuffer", url });
}

// 変更後
export async function fetchBinary(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  return res.arrayBuffer();
}
```

他の jQuery 使用箇所（`$.ajax` など）の調査と合わせて別タスクとして対応する。

---

## 変更ファイル

- `application/client/webpack.config.js`

## Verification

1. `cd application && pnpm run build` が正常終了すること
2. VRT を実行して動作確認
3. Lighthouse スコア計測（FCP / LCP / TBT の変化を確認）
