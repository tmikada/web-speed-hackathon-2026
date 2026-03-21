# 36. Crokサジェスト検索のサーバーサイド化

## 問題

Crokページを開くと、クライアントが kuromoji の日本語形態素解析辞書ファイル（`/dicts/*.dat.gz`）を **13ファイル** ダウンロードしていた。これらはチャット入力のサジェスト候補をBM25で絞り込むためにクライアント側でトークナイズを行っていたため。

- ダウンロード総量: 約18MB相当の辞書ファイル
- クライアントバンドルに `kuromoji` + `bayesian-bm25` が含まれ、vendor-heavyチャンクとして非同期ロード
- キーストロークのたびに全サジェスト候補を `/api/v1/crok/suggestions` から取得し、クライアントでBM25を実行

## 対応内容

### 1. サーバー側に検索エンドポイントを追加 (`crok.ts`)

新エンドポイント `GET /api/v1/crok/suggestions/search?q=<query>` を追加。

- サーバー上の kuromoji（辞書は `public/dicts` にあり既存）を使ってトークナイズ
- `bayesian-bm25` でBM25スコアリングを実行
- レスポンス: `{ suggestions: string[], queryTokens: string[] }`
- kuromojiはシングルトンとして初期化（`sentiment.ts` と同じパターン）

### 2. クライアント側の kuromoji を完全削除 (`ChatInput.tsx`)

- `kuromoji` の動的インポートと初期化 `useEffect` を削除
- `extractTokens` / `filterSuggestionsBM25` の呼び出しを削除
- 新APIを呼び出すだけに変更:
  ```typescript
  const { suggestions: results, queryTokens: tokens } = await fetchJSON<{
    suggestions: string[];
    queryTokens: string[];
  }>(`/api/v1/crok/suggestions/search?q=${encodeURIComponent(inputValue)}`);
  ```
- `highlightMatchByTokens` はサーバーから返された `queryTokens` を使うのでそのまま維持

### 3. webpack の vendor-heavy チャンク削除 (`webpack.config.js`)

- `kuromoji` / `bayesian-bm25` の vendor-heavy チャンク定義を削除
- `resolve.alias` から `bayesian-bm25$` と `kuromoji$` のエイリアスを削除

### 4. サーバー依存追加 (`server/package.json`)

- `bayesian-bm25: 0.4.0` を dependencies に追加
- `@types/kuromoji: 0.1.3` を devDependencies に追加（ワークスペース共有で既インストール済み）

## 期待効果

| 項目 | Before | After |
|------|--------|-------|
| 辞書ファイルDL | 13ファイル × ~1.4MB | **0ファイル** |
| vendor-heavy チャンク | あり（kuromoji + bayesian-bm25） | **なし** |
| キーストローク通信 | 全候補 + クライアントBM25 | 検索済み結果のみ（少量） |
| サジェスト待機 | kuromoji初期化が完了するまで動作しない | **即時動作** |

## 影響ファイル

- `application/server/src/routes/api/crok.ts`
- `application/server/package.json`
- `application/client/src/components/crok/ChatInput.tsx`
- `application/client/webpack.config.js`
