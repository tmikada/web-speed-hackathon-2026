# 30. 検索APIのサブクエリエラー修正

## 問題

`GET /api/v1/search?q=<キーワード>` でユーザー名・表示名による検索を行うと以下のエラーが発生:

```
SequelizeDatabaseError: SQLITE_ERROR: no such column: user.profileImageId
```

## 原因

`User` モデルの `defaultScope` に `include: { association: "profileImage" }` が設定されており、全ての User クエリで ProfileImage の JOIN が自動的に追加される。

`search.ts` の `postsByUser` クエリは `limit`/`offset` + `required: true` の include を持つため、Sequelize が**サブクエリパターン**を生成する:

1. **内側サブクエリ**: Post + User カラムを SELECT するが、`attributes: { exclude: ["profileImageId"] }` により `profileImageId` は含まれない
2. **外側クエリ**: `LEFT OUTER JOIN ProfileImages AS user->profileImage ON user.profileImageId = user->profileImage.id` を試みるが、サブクエリ結果に `user.profileImageId` が存在しないためエラー

## 修正内容

**`application/server/src/routes/api/search.ts`**

`postsByUser` の `Post.findAll` に `subQuery: false` を追加:

```diff
  postsByUser = await Post.findAll({
+   subQuery: false,
    include: [
      {
        association: "user",
```

`subQuery: false` により Sequelize はサブクエリパターンを使わず単一の JOIN クエリを生成するため、`profileImageId` の参照問題が解消される。

## 影響範囲

- 検索API (`GET /api/v1/search`) のユーザー名・表示名検索が正常に動作するように修正
- パフォーマンスへの影響は軽微（limit が小さい場合はサブクエリなしの方が高速なケースもある）
