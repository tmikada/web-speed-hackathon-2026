# 24. サーバーサイドページネーション対応

## 問題

タイムラインや検索結果などのリスト表示時に、APIが全件（2000件以上）を一度に返していた。

**原因**: `useInfiniteFetch` フックがクエリパラメータなしでAPIを呼ぶため、サーバーが全件返す。クライアント側で `.slice(offset, offset + 30)` して30件だけ表示していた。`fetchMore()` のたびに全件を再取得するという二重の無駄も発生していた。

```
/api/v1/posts → 2200件のJSONを毎回ダウンロード → クライアントで30件だけ使う
```

## 対応内容

### 修正ファイル

- `application/client/src/hooks/use_infinite_fetch.ts`

### 変更点

1. **サーバーサイドページネーション**: `?limit=30&offset=X` をAPIパスに付与してリクエスト
2. **クライアント側sliceを削除**: サーバーが正しい30件を返すのでクライアントでの加工不要
3. **末尾検出**: 返ってきた件数が30未満なら `hasMore = false` にして以降のリクエストを停止
4. **`?` の重複回避**: 既にクエリパラメータがあるパス（`/search?q=...` など）は `&` で追記

```typescript
// 修正前
void fetcher(apiPath).then((allData) => {
  data: [...cur.data, ...allData.slice(offset, offset + LIMIT)],
});

// 修正後
const separator = apiPath.includes("?") ? "&" : "?";
const paginatedPath = `${apiPath}${separator}limit=${LIMIT}&offset=${offset}`;
void fetcher(paginatedPath).then((pageData) => {
  data: [...cur.data, ...pageData],
  hasMore: pageData.length >= LIMIT,
});
```

## 恩恵を受けるエンドポイント

全て既に `limit` / `offset` クエリパラメータ対応済み。

| エンドポイント | 利用箇所 |
|---|---|
| `GET /api/v1/posts` | TimelineContainer |
| `GET /api/v1/posts/:id/comments` | PostContainer |
| `GET /api/v1/users/:username/posts` | UserProfileContainer |
| `GET /api/v1/search?q=...` | SearchContainer |

## 期待される改善

- **初回ロード**: 2000件→30件のJSONに削減 → LCP・TBT の大幅改善
- **fetchMore**: 毎回全件取得→次の30件のみ取得に変更
- **メモリ**: ブラウザが保持するデータ量を削減
