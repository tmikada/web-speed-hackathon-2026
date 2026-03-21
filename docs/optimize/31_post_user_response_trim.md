# 31. Post API レスポンスの user フィールド削減

## 概要

Post を返す全 API（タイムライン、検索等）のレスポンスに、クライアントが使用しない user の `description`・`createdAt` が含まれており、レスポンスサイズが無駄に大きくなっていた。

## 問題

Post モデルの defaultScope で user を include する際、`exclude: ["profileImageId"]` しか指定されていなかったため、全フィールドが返っていた。

クライアント（TimelineItem.tsx）が user から使うフィールドは以下のみ：
- `username`
- `name`
- `profileImage.id`
- `profileImage.alt`

`description` は長文になりうるため、タイムライン・検索等の Post クエリに含めることはレスポンスの無駄。

## データ取得経路の確認

| 画面 | user データ取得元 | description 必要？ |
|---|---|---|
| UserProfile ページ | `/api/v1/users/:username`（User 直接取得） | ✅ 必要 |
| Timeline / Search / その他 Post クエリ | Post defaultScope の user include | ❌ 不要 |

UserProfile ページは Post association とは別の API エンドポイントで User を取得するため、Post defaultScope の変更は影響しない。

## 対応

**`application/server/src/models/Post.ts`**

```ts
// Before
attributes: { exclude: ["profileImageId"] },

// After
attributes: { exclude: ["profileImageId", "description", "createdAt"] },
```

Post defaultScope の user include に `description` と `createdAt` を除外対象として追加。

## 効果

全 Post クエリのレスポンスから user の `description`・`createdAt` が除去される。
