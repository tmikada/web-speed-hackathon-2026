# 20. negaposi-analyzer-ja をサーバーサイドに移行

## 問題

`negaposi-analyzer-ja`（感情分析ライブラリ）と `kuromoji`（形態素解析）がクライアントバンドルに含まれており、巨大なチャンクが生成されていた。

- チャンク名: `scripts/chunk-92ea0929a3ab725852bd.js`
- Stat size: **3.65 MB**
- Parsed size: **4.27 MB**
- Gzipped size: **828.77 KB**

これらのライブラリの用途は検索ページのネガポジ判定（ネガティブキーワード検索時に「どしたん話聞こうか?」を表示する機能）のみ。

## 対応内容

### サーバーサイド

1. **新規**: `application/server/src/routes/api/sentiment.ts`
   - `GET /api/v1/sentiment?text=<keywords>` エンドポイントを追加
   - kuromojiのtokenizerはシングルトンとして初期化（起動後の初回リクエスト時に生成、以降は使い回す）
   - dicPathは既存の `public/dicts/` を使用（クライアントが使っている辞書ファイルと共有）
   - レスポンス: `{ score: number, label: "positive" | "negative" | "neutral" }`

2. **修正**: `application/server/src/routes/api.ts`
   - `sentimentRouter` を `/sentiment` に登録

3. **修正**: `application/server/package.json`
   - `negaposi-analyzer-ja: 1.0.1` と `kuromoji: 0.1.2` を dependencies に追加

4. **追加**: `application/server/types/negaposi-analyzer-ja.d.ts`
   - サーバー側の TypeScript 型宣言

### クライアントサイド

5. **修正**: `application/client/src/components/application/SearchPage.tsx`
   - `analyzeSentiment()` の直接呼び出しを `fetch("/api/v1/sentiment?text=...")` に置き換え

6. **削除**: `application/client/src/utils/negaposi_analyzer.ts`
   - クライアント側の感情分析ユーティリティを削除

7. **修正**: `application/client/package.json`
   - `negaposi-analyzer-ja` を dependencies から削除

8. **修正**: `application/client/webpack.config.js`
   - manual chunk の正規表現から `negaposi-analyzer-ja` を除去
   ```js
   // Before
   test: /[\\/]node_modules[\\/](kuromoji|bayesian-bm25|negaposi-analyzer-ja)[\\/]/,
   // After
   test: /[\\/]node_modules[\\/](kuromoji|bayesian-bm25)[\\/]/,
   ```

## 期待される効果

- `negaposi-analyzer-ja` がクライアントバンドルから完全に消える
- vendor-heavy チャンクのサイズ削減（828KB gzip 削減の一部）
- 初回ロード時のJSパース・実行コスト削減により TBT / LCP / FCP 改善が期待される
- kuromoji は他の機能（ChatInput の BM25検索など）で引き続きクライアントに残る

## 注意

- kuromojiの辞書読み込みはサーバー起動後の初回リクエスト時のみ発生（以降はキャッシュ）
- `/api/v1/sentiment` が失敗した場合は `neutral` を返しネガティブ表示を行わない（フォールバック済み）
- VRTで検索ページの表示が崩れていないことを確認すること
