# 13. webpackのpublicPath修正（深いパスでの白画面）

## 問題

`/posts/ff93a168-ea7c-4202-9879-672382febfda` のような深いURL直接アクセス時に、JSチャンクファイルの読み込みに失敗して白画面になる。

**原因**: `webpack.config.js` の `output.publicPath: "auto"` が問題。`"auto"` は現在のページURLを基準に相対パスでチャンクを解決するため、`/posts/:id` からアクセスすると以下のような誤ったパスを要求してしまい 404 になる。

```
// 誤: /posts/ff93a168-ea7c-4202-9879-672382febfda/scripts/chunk-xxx.js
// 正: /scripts/chunk-xxx.js
```

## 修正

**ファイル**: `application/client/webpack.config.js`

```diff
  output: {
    chunkFilename: "scripts/chunk-[contenthash].js",
    filename: "scripts/[name].js",
    path: DIST_PATH,
-   publicPath: "auto",
+   publicPath: "/",
    clean: true,
  },
```

`"/"` に固定することで、どのURLからアクセスしても常にルート相対パスでチャンクを読み込む。

## 変更ファイル

- `application/client/webpack.config.js`

## 影響範囲

- `/posts/:id`、`/users/:id` など、ネストしたURL直接アクセス時の白画面が解消
- ビルドし直しが必要（`pnpm run build`）
- サーバー側はルートから静的ファイルを配信しているため、変更後も問題なし

## 期待効果

- 直リンクやブックマークからの遷移が正常に動作
- Lighthouseスコア計測時の白画面エラーが解消
